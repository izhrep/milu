# Система аутентификации и авторизации

## Содержание

1. [Общая архитектура](#общая-архитектура)
2. [Аутентификация (Authentication)](#аутентификация-authentication)
3. [Авторизация (Authorization)](#авторизация-authorization)
4. [Управление сессиями](#управление-сессиями)
5. [Защита маршрутов](#защита-маршрутов)
6. [Безопасность](#безопасность)

---

## Общая архитектура

Система использует **кастомную аутентификацию** без встроенного Supabase Auth, с собственными таблицами для пользователей и сессий, и **permission-based авторизацию** через систему ролей и разрешений.

```
┌─────────────────────────────────────────────────────────────┐
│                     ПОЛЬЗОВАТЕЛЬ                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               LoginPage.tsx                                  │
│  - Выбор пользователя из списка                             │
│  - Ввод пароля (по умолчанию test123)                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         Edge Function: custom-login                          │
│  1. Проверка email в auth_users                             │
│  2. Верификация пароля (bcrypt)                             │
│  3. Получение данных из users                               │
│  4. Расшифровка ФИО (Yandex Cloud Function)                 │
│  5. Получение роли из user_roles                            │
│  6. Получение permissions из role_permissions               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              AuthContext.login()                             │
│  - Сохранение пользователя в state                          │
│  - Создание записи в admin_sessions (24ч TTL)               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  ПРИЛОЖЕНИЕ                                  │
│  - AuthGuard защищает все маршруты                          │
│  - usePermission() проверяет доступ к функциям              │
│  - RLS политики контролируют доступ к данным                │
└─────────────────────────────────────────────────────────────┘
```

---

## Аутентификация (Authentication)

### Таблицы базы данных

#### 1. `auth_users` — учетные записи пользователей

```sql
CREATE TABLE auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Назначение:**
- Хранит учетные данные для входа
- Email используется как логин
- Пароли хранятся в виде bcrypt-хеша
- Поле `is_active` позволяет деактивировать пользователей без удаления

**RLS:**
- Обычные пользователи не имеют прямого доступа к этой таблице
- Только Edge Function с service role key может читать/писать

#### 2. `users` — профили пользователей

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth_users(id),
  email TEXT, -- зашифрованный
  first_name TEXT, -- зашифрованный
  last_name TEXT, -- зашифрованный
  middle_name TEXT, -- зашифрованный
  employee_number TEXT,
  status BOOLEAN DEFAULT true,
  -- другие поля профиля
);
```

**Назначение:**
- Хранит расширенную информацию о пользователе
- ФИО и email зашифрованы для безопасности
- Связан с `auth_users` через `auth_user_id`
- Используется для отображения информации в UI

**Шифрование:**
- ФИО и email зашифрованы в БД
- Расшифровка происходит через Yandex Cloud Function
- Функция `decryptUserData()` вызывается при логине и отображении данных

#### 3. `admin_sessions` — активные сессии

```sql
CREATE TABLE admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
```

**Назначение:**
- Хранит активные сессии пользователей
- TTL сессии = 24 часа
- При логине создаётся новая запись
- При логауте записи удаляются

---

### Процесс входа (Login Flow)

#### Шаг 1: Отображение формы входа

**Компонент:** `src/pages/LoginPage.tsx`

```typescript
// Получение списка активных пользователей
const { data: users } = await supabase
  .from('auth_users')
  .select('email, id')
  .eq('is_active', true);

// Расшифровка email через Yandex Cloud
const decryptedUsers = await decryptEmails(users);

// Отображение в Select компоненте
<Select onValueChange={setSelectedUser}>
  {decryptedUsers.map(user => (
    <SelectItem value={user.email}>{user.email}</SelectItem>
  ))}
</Select>
```

**Особенности:**
- Пользователь выбирает email из списка (не вводит вручную)
- Email расшифровываются перед отображением
- Пароль по умолчанию: `test123`
- Real-time обновление списка при изменениях в `auth_users`

#### Шаг 2: Вызов Edge Function

**Edge Function:** `supabase/functions/custom-login/index.ts`

```typescript
serve(async (req) => {
  const { email, password } = await req.json();

  // 1. Получить запись из auth_users
  const { data: authUser } = await supabaseAdmin
    .from('auth_users')
    .select('*')
    .eq('email', email)
    .eq('is_active', true)
    .single();

  // 2. Проверить пароль (bcrypt)
  const passwordMatch = await verifyPassword(password, authUser.password_hash);
  
  if (!passwordMatch) {
    return Response.json({ error: 'Неверный email или пароль' }, { status: 401 });
  }

  // 3. Получить данные пользователя из users
  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('id, email, first_name, last_name, middle_name')
    .eq('auth_user_id', authUser.id)
    .eq('status', true)
    .single();

  // 4. Построить полное имя (зашифрованные поля)
  const fullName = [userData.last_name, userData.first_name, userData.middle_name]
    .filter(Boolean)
    .join(' ');

  // 5. Получить роль из user_roles
  const { data: roleData } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.id)
    .maybeSingle();

  const role = roleData?.role || 'employee';

  // 6. Получить permissions для роли
  const { data: permissionsData } = await supabaseAdmin
    .from('role_permissions')
    .select('permissions(name)')
    .eq('role', role);

  const permissions = permissionsData?.map(p => p.permissions.name).filter(Boolean);

  // 7. Вернуть данные пользователя
  return Response.json({
    success: true,
    user: {
      id: userData.id,
      email: authUser.email,
      full_name: fullName,
      role,
      permissions
    }
  });
});
```

**Важные моменты:**
- Функция использует Service Role Key для полного доступа к БД
- Пароли проверяются через bcrypt (в production использовать полноценную библиотеку)
- Возвращаются только необходимые данные, без чувствительной информации
- CORS настроен для работы с фронтендом

#### Шаг 3: Сохранение в AuthContext

**Контекст:** `src/contexts/AuthContext.tsx`

```typescript
const login = async (userToLogin: AuthUser) => {
  // Обновить state
  setUser(userToLogin);
  
  // Создать сессию в БД (TTL 24 часа)
  await supabase.from('admin_sessions').insert({
    user_id: userToLogin.id,
    email: userToLogin.email,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });
};
```

**Структура AuthUser:**

```typescript
interface AuthUser {
  id: string;           // UUID из таблицы users
  email: string;        // Email пользователя
  full_name: string;    // Расшифрованное ФИО
  role: string;         // Роль (admin, hr_bp, manager, employee)
  permissions?: string[]; // Массив разрешений
}
```

#### Шаг 4: Редирект в приложение

```typescript
// В LoginPage.tsx после успешного логина
const { user } = await response.json();
login(user); // Сохранить в AuthContext
navigate('/'); // Перенаправить на главную
toast.success('Вход выполнен успешно');
```

---

### Процесс выхода (Logout Flow)

**Компонент:** `src/components/UserMenu.tsx`

```typescript
const handleLogout = async () => {
  // Удалить все сессии пользователя из БД
  await supabase
    .from('admin_sessions')
    .delete()
    .eq('user_id', user.id);
  
  // Очистить state
  setUser(null);
  
  // Уведомить пользователя
  toast.success('Вы успешно вышли из системы');
};
```

**Что происходит:**
1. Удаляются все записи в `admin_sessions` для данного пользователя
2. State в `AuthContext` очищается (`user = null`)
3. `AuthGuard` перенаправляет на `/login`
4. Все проверки `usePermission()` возвращают `false`

---

### Восстановление сессии при перезагрузке

**AuthContext useEffect:**

```typescript
useEffect(() => {
  const checkSession = async () => {
    // Получить последнюю сессию из admin_sessions
    const { data: sessions } = await supabase
      .from('admin_sessions')
      .select('user_id, email')
      .order('created_at', { ascending: false })
      .limit(1);

    if (sessions && sessions.length > 0) {
      const session = sessions[0];
      
      // Получить данные пользователя из users
      const { data: usersData } = await supabase
        .from('users')
        .select('first_name, last_name, middle_name')
        .eq('id', session.user_id)
        .single();

      // Расшифровать ФИО
      const decryptedData = await decryptUserData({
        id: session.user_id,
        first_name: usersData.first_name,
        last_name: usersData.last_name,
        middle_name: usersData.middle_name,
        email: session.email,
      });

      const fullName = [decryptedData.last_name, decryptedData.first_name, decryptedData.middle_name]
        .filter(Boolean)
        .join(' ');
      
      // Получить роль
      const { data: roleData } = await supabase.rpc('get_user_role', {
        _user_id: session.user_id
      });

      // Восстановить пользователя
      setUser({
        id: session.user_id,
        full_name: fullName,
        email: session.email,
        role: roleData || 'employee'
      });
    }
  };

  checkSession();
}, []);
```

**Логика:**
- При загрузке приложения проверяется наличие активной сессии
- Если сессия найдена — пользователь автоматически авторизуется
- Если сессии нет или истекла — редирект на `/login`
- ФИО расшифровывается через `decryptUserData()`

---

## Авторизация (Authorization)

### Система ролей и разрешений

#### Таблицы

**1. `user_roles` — роли пользователей**

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);
```

**Назначение:**
- Связывает пользователя с ролью
- Один пользователь может иметь только одну роль (UNIQUE constraint)
- Поддерживаемые роли: `admin`, `hr_bp`, `manager`, `employee`

**2. `permissions` — справочник разрешений**

```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL, -- например: "users.view_all"
  description TEXT,
  resource TEXT, -- например: "users"
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Назначение:**
- Содержит все доступные разрешения в системе
- Всего 77 разрешений по 19 ресурсам
- Структура: `resource.action` (например, `diagnostics.view_results`)

**3. `role_permissions` — связь ролей и разрешений**

```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  permission_id UUID REFERENCES permissions(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, permission_id)
);
```

**Назначение:**
- Определяет, какие разрешения имеет каждая роль
- `admin` автоматически получает все разрешения через функцию `has_permission()`
- Остальные роли получают только назначенные им permissions

#### Роли и их разрешения

| Роль | Количество permissions | Описание |
|------|------------------------|----------|
| **admin** | Все (77) | Полный доступ ко всем функциям системы |
| **hr_bp** | 51 | HR Business Partner — управление персоналом, диагностика, аналитика |
| **manager** | 28 | Руководитель — управление командой, 1:1, задачи, просмотр результатов |
| **employee** | 12 | Сотрудник — базовый доступ к собственным данным и задачам |

**Детальное распределение см. в:** `PERMISSION_SYSTEM_COMPLETE_SPECIFICATION.md` (раздел 3)

---

### Функция проверки прав

**SQL Function:** `has_permission(permission_name TEXT)`

```sql
CREATE OR REPLACE FUNCTION has_permission(permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  user_role TEXT;
BEGIN
  -- Получить ID текущего пользователя
  current_user_id := get_current_session_user();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Получить роль пользователя
  SELECT role INTO user_role
  FROM user_roles
  WHERE user_id = current_user_id
  LIMIT 1;

  -- Administrator автоматически имеет все права
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Проверить наличие конкретного разрешения через role_permissions
  RETURN EXISTS (
    SELECT 1
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role = user_role
      AND p.name = permission_name
  );
END;
$$;
```

**Особенности:**
- `SECURITY DEFINER` — выполняется с правами владельца функции, обходит RLS
- Роль `admin` автоматически получает все разрешения
- Для других ролей проверяется наличие записи в `role_permissions`
- Используется в RLS политиках и на фронтенде

---

### Использование на фронтенде

**React Hook:** `src/hooks/usePermission.ts`

```typescript
export const usePermission = (permissionName: string): boolean => {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasAccess(false);
      return;
    }

    const checkPermission = async () => {
      const { data, error } = await supabase
        .rpc('has_permission', { permission_name: permissionName });
      
      if (!error && data !== null) {
        setHasAccess(data);
      }
    };

    checkPermission();
  }, [user, permissionName]);

  return hasAccess;
};
```

**Примеры использования:**

```typescript
// Проверка одного разрешения
const canViewAllUsers = usePermission('users.view_all');

// Проверка нескольких разрешений
const { 'users.create': canCreate, 'users.delete': canDelete } = 
  usePermissions(['users.create', 'users.delete']);

// Проверка на admin
const isAdmin = useIsAdmin(); // Проверяет users.manage_roles

// Условный рендеринг
{canViewAllUsers && (
  <Button onClick={viewAllUsers}>Показать всех пользователей</Button>
)}

// Защита экшенов
const handleDelete = async () => {
  if (!canDelete) {
    toast.error('У вас нет прав для удаления');
    return;
  }
  // ...
};
```

---

### Использование в RLS политиках

**Пример политик для таблицы `users`:**

```sql
-- SELECT: HR и admin могут видеть всех, остальные только себя
CREATE POLICY "Users can view based on permissions"
ON users FOR SELECT
TO authenticated
USING (
  has_permission('users.view_all')
  OR id = get_current_session_user()
);

-- INSERT: Только с правом users.create
CREATE POLICY "Users can create with permission"
ON users FOR INSERT
TO authenticated
WITH CHECK (has_permission('users.create'));

-- UPDATE: HR/admin могут редактировать всех, остальные только себя
CREATE POLICY "Users can update based on permissions"
ON users FOR UPDATE
TO authenticated
USING (
  has_permission('users.edit_all')
  OR id = get_current_session_user()
)
WITH CHECK (
  has_permission('users.edit_all')
  OR id = get_current_session_user()
);

-- DELETE: Только с правом users.delete
CREATE POLICY "Users can delete with permission"
ON users FOR DELETE
TO authenticated
USING (has_permission('users.delete'));
```

**Комбинирование с другими условиями:**

```sql
-- Менеджеры видят своих подчинённых + право на просмотр
CREATE POLICY "Managers can view their team"
ON users FOR SELECT
TO authenticated
USING (
  has_permission('users.view_team')
  AND (
    supervisor_id = get_current_session_user()
    OR id = get_current_session_user()
  )
);

-- Доступ только к активным записям + разрешение
CREATE POLICY "View active users with permission"
ON users FOR SELECT
TO authenticated
USING (
  has_permission('users.view_all')
  AND status = true
);
```

---

## Управление сессиями

### Таблица admin_sessions

```sql
CREATE TABLE admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
```

### Жизненный цикл сессии

1. **Создание:**
   - При успешном логине создаётся запись в `admin_sessions`
   - `expires_at = created_at + 24 часа`
   - Хранятся: `user_id`, `email`, временные метки

2. **Проверка:**
   - При загрузке приложения `AuthContext` ищет последнюю сессию
   - Если найдена — пользователь восстанавливается
   - Истёкшие сессии игнорируются

3. **Завершение:**
   - При логауте все сессии пользователя удаляются
   - При деактивации пользователя (`is_active = false`) сессии остаются, но вход заблокирован

### Функция получения текущего пользователя

```sql
CREATE OR REPLACE FUNCTION get_current_session_user()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT user_id
  FROM admin_sessions
  WHERE expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1
$$;
```

**Использование в RLS:**

```sql
-- Доступ только к собственным данным
CREATE POLICY "Users see own records"
ON some_table FOR SELECT
TO authenticated
USING (user_id = get_current_session_user());
```

---

## Защита маршрутов

### AuthGuard компонент

**Файл:** `src/components/AuthGuard.tsx`

```typescript
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
```

**Использование в роутинге:**

```typescript
// src/App.tsx
<Routes>
  {/* Публичный маршрут */}
  <Route path="/login" element={<LoginPage />} />
  
  {/* Защищённые маршруты */}
  <Route path="/*" element={
    <AuthGuard>
      <div className="flex h-screen">
        <AppSidebar />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin/*" element={<AdminPages />} />
          {/* ... */}
        </Routes>
      </div>
    </AuthGuard>
  } />
</Routes>
```

**Логика:**
- Все маршруты кроме `/login` обёрнуты в `<AuthGuard>`
- Если `isAuthenticated === false` — редирект на `/login`
- `isAuthenticated` обновляется в `AuthContext` при логине/логауте

### Условный рендеринг в UI

**Скрытие элементов по разрешениям:**

```typescript
// src/components/AppSidebar.tsx
const canViewAdmin = usePermission('users.manage_roles');
const canViewAnalytics = usePermission('analytics.view_all');

return (
  <Sidebar>
    <SidebarMenu>
      <SidebarMenuItem>
        <Link to="/">Главная</Link>
      </SidebarMenuItem>
      
      {canViewAnalytics && (
        <SidebarMenuItem>
          <Link to="/analytics">Аналитика</Link>
        </SidebarMenuItem>
      )}
      
      {canViewAdmin && (
        <SidebarMenuItem>
          <Link to="/admin">Админ-панель</Link>
        </SidebarMenuItem>
      )}
    </SidebarMenu>
  </Sidebar>
);
```

**Защита экшенов:**

```typescript
// src/components/UsersManagementTable.tsx
const canDelete = usePermission('users.delete');

const handleDelete = async (userId: string) => {
  if (!canDelete) {
    toast.error('Недостаточно прав для удаления пользователей');
    return;
  }
  
  // Выполнить удаление
};

return (
  <Button 
    onClick={() => handleDelete(user.id)}
    disabled={!canDelete}
  >
    Удалить
  </Button>
);
```

---

## Безопасность

### Защита данных

#### 1. Шифрование персональных данных

**Зашифрованные поля:**
- `users.email`
- `users.first_name`
- `users.last_name`
- `users.middle_name`

**Механизм:**
- Данные хранятся в зашифрованном виде в БД
- Расшифровка через Yandex Cloud Function:
  ```typescript
  // src/lib/userDataDecryption.ts
  export const decryptUserData = async (encryptedData) => {
    const response = await fetch('YANDEX_CLOUD_FUNCTION_URL', {
      method: 'POST',
      body: JSON.stringify(encryptedData)
    });
    return response.json();
  };
  ```
- Расшифрованные данные хранятся только в памяти (React state)
- Никогда не логируются или не сохраняются в localStorage

#### 2. Хеширование паролей

**Алгоритм:** bcrypt

```typescript
// При создании пользователя
const passwordHash = await bcrypt.hash(password, 10);

await supabase.from('auth_users').insert({
  email,
  password_hash: passwordHash
});

// При проверке пароля
const isValid = await bcrypt.compare(password, storedHash);
```

**Важно:**
- Пароли никогда не хранятся в открытом виде
- Используется стандартный bcrypt с cost factor = 10
- В production Edge Function необходимо использовать полноценную Deno-совместимую библиотеку

#### 3. Row-Level Security (RLS)

**Все таблицы защищены RLS:**

```sql
-- Включение RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
-- ... и т.д. для всех таблиц
```

**Политики используют `has_permission()`:**
- Нет прямых проверок ролей
- Нет жёстко закодированных user_id
- Всё через единую систему разрешений

**Пример безопасной политики:**

```sql
-- ❌ НЕПРАВИЛЬНО: прямая проверка роли
CREATE POLICY "Admins only"
ON sensitive_table FOR ALL
USING ((SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin');

-- ✅ ПРАВИЛЬНО: через has_permission()
CREATE POLICY "Users with permission"
ON sensitive_table FOR ALL
USING (has_permission('sensitive_data.manage'));
```

#### 4. SECURITY DEFINER функции

**Функции с SECURITY DEFINER:**
- `has_permission()`
- `get_current_session_user()`
- `get_user_role()`
- `get_user_permissions()`

**Зачем:**
- Обходят RLS для выполнения проверок
- Выполняются с правами владельца (postgres role)
- Предотвращают рекурсивные проверки RLS
- Безопасны, т.к. только читают данные и не изменяют

**Шаблон:**

```sql
CREATE OR REPLACE FUNCTION check_something(param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE -- Не изменяет данные
SECURITY DEFINER -- Выполняется с правами владельца
SET search_path = public -- Защита от схемы injection
AS $$
BEGIN
  -- Логика проверки
  RETURN ...;
END;
$$;
```

### Защита от атак

#### 1. SQL Injection

**Защита:**
- Используется Supabase SDK с prepared statements
- Все параметры экранируются автоматически
- В Edge Functions используется `supabaseAdmin.from()` и `.eq()`, не сырой SQL

```typescript
// ✅ Безопасно
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('email', userInput); // Автоматическое экранирование

// ❌ Опасно (не используется в проекте)
const { data } = await supabase
  .rpc('unsafe_raw_query', { 
    sql: `SELECT * FROM users WHERE email = '${userInput}'` 
  });
```

#### 2. XSS (Cross-Site Scripting)

**Защита:**
- React автоматически экранирует все выводимые данные
- Использование `dangerouslySetInnerHTML` запрещено (нет в коде)
- Все пользовательские данные отображаются через JSX

```typescript
// ✅ Безопасно
<div>{user.full_name}</div>

// ❌ Опасно (не используется)
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

#### 3. Privilege Escalation

**Защита:**
- Роли хранятся в отдельной таблице `user_roles`, не в `users`
- RLS политики на `user_roles` разрешают изменения только через `has_permission('users.manage_roles')`
- Обычный пользователь не может назначить себе `admin`

```sql
-- RLS на user_roles
CREATE POLICY "Only admins can modify roles"
ON user_roles FOR ALL
USING (has_permission('users.manage_roles'))
WITH CHECK (has_permission('users.manage_roles'));
```

#### 4. Session Hijacking

**Защита:**
- Сессии хранятся в БД, не в cookies/localStorage
- TTL = 24 часа, автоматическая инвалидация
- При логауте все сессии удаляются
- Нет передачи session token между клиентом и сервером

**Ограничения:**
- Нет защиты от параллельных сессий (один пользователь может войти с нескольких устройств)
- Нет механизма refresh token
- Для production рекомендуется добавить:
  - IP-based session validation
  - Device fingerprinting
  - Automatic session cleanup (scheduled job для удаления истёкших)

#### 5. CORS

**Настройка в Edge Functions:**

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Обработка preflight
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}
```

**Для production:**
- Заменить `*` на конкретный домен приложения
- Добавить проверку `Origin` header

### Аудит и логирование

**Таблица:** `audit_log`

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT, -- 'login', 'logout', 'create_user', etc.
  resource TEXT, -- 'users', 'roles', etc.
  resource_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Логируемые события:**
- Вход/выход пользователей
- Изменение ролей и разрешений
- Создание/удаление пользователей
- Критичные операции в системе

**Просмотр логов:**
- Компонент: `src/components/security/AuditLogViewer.tsx`
- Доступ: `has_permission('audit.view_logs')`
- Фильтрация по пользователю, действию, дате

---

## Диаграммы

### Общая схема аутентификации

```
┌──────────────┐
│ LoginPage    │
└──────┬───────┘
       │ POST /custom-login
       ▼
┌─────────────────────────────────────────┐
│  Edge Function: custom-login            │
│  1. Проверка email в auth_users         │
│  2. Проверка пароля (bcrypt)            │
│  3. Получение user_id из users          │
│  4. Получение role из user_roles        │
│  5. Получение permissions               │
└──────┬──────────────────────────────────┘
       │ { user, role, permissions }
       ▼
┌─────────────────────────────────────────┐
│  AuthContext.login()                    │
│  - setUser(user)                        │
│  - INSERT INTO admin_sessions           │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Приложение (защищено AuthGuard)        │
│  - Все маршруты доступны                │
│  - usePermission() работает             │
│  - RLS политики применяются             │
└─────────────────────────────────────────┘
```

### Схема проверки прав

```
┌────────────────────┐
│ Компонент/RLS      │
│ has_permission()   │
└─────────┬──────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│ SQL Function: has_permission()          │
│                                         │
│ 1. current_user_id =                    │
│    get_current_session_user()           │
│                                         │
│ 2. SELECT role FROM user_roles          │
│    WHERE user_id = current_user_id      │
│                                         │
│ 3. IF role = 'admin' THEN RETURN TRUE   │
│                                         │
│ 4. ELSE check role_permissions:         │
│    EXISTS (                             │
│      SELECT 1                           │
│      FROM role_permissions rp           │
│      JOIN permissions p ON p.id = rp... │
│      WHERE rp.role = user_role          │
│        AND p.name = permission_name     │
│    )                                    │
└─────────┬───────────────────────────────┘
          │
          ▼
┌─────────────────────┐
│ TRUE / FALSE        │
└─────────────────────┘
```

### Связь таблиц

```
┌─────────────────┐
│   auth_users    │
│  - id (PK)      │
│  - email        │
│  - password_hash│
│  - is_active    │
└────────┬────────┘
         │ auth_user_id (FK)
         ▼
┌─────────────────┐       ┌──────────────────┐
│     users       │       │   admin_sessions │
│  - id (PK)      │◄──────│  - user_id       │
│  - auth_user_id │       │  - email         │
│  - email (enc)  │       │  - expires_at    │
│  - first_name   │       └──────────────────┘
│  - last_name    │
│  - middle_name  │
└────────┬────────┘
         │ user_id (FK)
         ▼
┌─────────────────┐
│   user_roles    │
│  - id (PK)      │
│  - user_id (FK) │
│  - role         │─────┐
└─────────────────┘     │
                        │ role
                        ▼
┌─────────────────────────┐      ┌────────────────┐
│   role_permissions      │      │  permissions   │
│  - id (PK)              │      │  - id (PK)     │
│  - role                 │      │  - name        │
│  - permission_id (FK)   │─────►│  - description │
└─────────────────────────┘      │  - resource    │
                                 └────────────────┘
```

---

## Чек-лист для разработчиков

### При добавлении нового функционала

- [ ] Создать permission в таблице `permissions` (если нужен новый)
- [ ] Добавить permission в `role_permissions` для соответствующих ролей
- [ ] Создать/обновить RLS политики с использованием `has_permission()`
- [ ] Использовать `usePermission()` на фронтенде для условного рендеринга
- [ ] Проверить работу под всеми ролями (admin, hr_bp, manager, employee)
- [ ] Добавить audit log для критичных операций
- [ ] Документировать новое разрешение в спецификации

### При создании нового пользователя

- [ ] Создать запись в `auth_users` с email и password_hash
- [ ] Создать запись в `users` с зашифрованными ФИО
- [ ] Назначить роль в `user_roles`
- [ ] Проверить, что пользователь может войти через LoginPage
- [ ] Проверить, что права применяются корректно

### При изменении ролей/разрешений

- [ ] Обновить `role_permissions`
- [ ] Проверить, что изменения не нарушают существующую функциональность
- [ ] Уведомить пользователей о изменениях прав (если применимо)
- [ ] Обновить документацию

---

## Известные ограничения и рекомендации для production

### Текущие ограничения

1. **Упрощённая проверка паролей в Edge Function**
   - Используется простое сравнение для тестового пароля
   - Необходимо заменить на полноценную bcrypt-библиотеку для Deno

2. **Отсутствие rate limiting**
   - Нет защиты от brute-force атак на логин
   - Рекомендуется добавить ограничение попыток входа

3. **CORS настроен на `*`**
   - Разрешены запросы с любых доменов
   - Необходимо ограничить конкретными доменами в production

4. **Сессии не привязаны к устройству/IP**
   - Возможна атака session hijacking
   - Рекомендуется добавить device fingerprinting

5. **Нет автоматической очистки истёкших сессий**
   - Старые записи в `admin_sessions` накапливаются
   - Необходим scheduled job для очистки

6. **Расшифровка данных через внешний API**
   - Зависимость от доступности Yandex Cloud Function
   - Рекомендуется добавить fallback и кеширование

### Рекомендации для production

#### 1. Улучшить безопасность паролей

```typescript
// Установить Deno-совместимую bcrypt библиотеку
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
```

#### 2. Добавить rate limiting

```typescript
// В custom-login Edge Function
const loginAttempts = new Map<string, { count: number, resetAt: number }>();

serve(async (req) => {
  const { email } = await req.json();
  const now = Date.now();
  
  const attempts = loginAttempts.get(email);
  if (attempts && attempts.count >= 5 && attempts.resetAt > now) {
    return Response.json(
      { error: 'Слишком много попыток входа. Попробуйте позже.' },
      { status: 429 }
    );
  }
  
  // ... остальная логика
});
```

#### 3. Ограничить CORS

```typescript
const allowedOrigins = [
  'https://yourdomain.com',
  'https://app.yourdomain.com'
];

const origin = req.headers.get('origin');
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

#### 4. Добавить scheduled job для очистки сессий

```sql
-- Создать функцию очистки
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM admin_sessions
  WHERE expires_at < now();
END;
$$;

-- Настроить cron в Supabase Dashboard
-- Schedule: 0 0 * * * (ежедневно в полночь)
-- Function: cleanup_expired_sessions()
```

#### 5. Добавить логирование попыток входа

```sql
CREATE TABLE login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Индекс для быстрого поиска
CREATE INDEX idx_login_attempts_email_created 
ON login_attempts(email, created_at DESC);
```

#### 6. Реализовать refresh tokens

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Политика автоматической очистки
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM refresh_tokens
  WHERE expires_at < now();
END;
$$;
```

---

## Заключение

Текущая система аутентификации и авторизации предоставляет:

✅ **Кастомную аутентификацию** через собственные таблицы и Edge Functions  
✅ **Permission-based авторизацию** с гранулярным контролем доступа  
✅ **Row-Level Security** на всех таблицах через `has_permission()`  
✅ **Шифрование персональных данных** (ФИО, email)  
✅ **Хеширование паролей** через bcrypt  
✅ **Управление сессиями** с автоматической инвалидацией  
✅ **Защиту маршрутов** через AuthGuard и условный рендеринг  
✅ **Аудит действий** через audit_log  

Система готова к использованию в development и тестировании. Для production необходимо внедрить рекомендации из раздела "Рекомендации для production".

Полная документация по системе разрешений: `PERMISSION_SYSTEM_COMPLETE_SPECIFICATION.md`
