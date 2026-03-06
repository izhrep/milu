# Отчёт о переводе на Supabase Auth

## Выполненные изменения

### 1. Удалена кастомная система авторизации

**Удалённые таблицы:**
- `admin_sessions` - таблица для хранения пользовательских сессий
- `auth_users` - таблица для хранения учётных данных

**Удалённые поля:**
- `users.auth_user_id` - внешний ключ на кастомную таблицу auth_users

**Удалённые файлы:**
- `src/pages/LoginPage.tsx` - страница выбора пользователя
- `supabase/functions/custom-login/index.ts` - edge function для кастомного логина
- Удалена секция `[functions.custom-login]` из `supabase/config.toml`

### 2. Обновлённые SQL функции

**`get_current_user_id()`**
```sql
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;
```
Теперь использует только `auth.uid()` как единственный источник идентификации.

**`has_permission(_permission_name TEXT)`**
```sql
CREATE OR REPLACE FUNCTION public.has_permission(_permission_name TEXT)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Get user's role
  SELECT role INTO user_role
  FROM user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  -- Admin has all permissions
  IF user_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Check if user has the specific permission
  RETURN EXISTS (
    SELECT 1
    FROM user_effective_permissions
    WHERE user_id = auth.uid()
      AND permission_name = _permission_name
  );
END;
$$;
```
Обновлена для работы с `auth.uid()` вместо `admin_sessions`.

**`handle_new_user()` - триггер автоматического создания профиля**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert bypasses RLS because function is SECURITY DEFINER
  INSERT INTO public.users (
    id,
    email,
    first_name,
    last_name,
    status,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    true,
    NOW(),
    NOW()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the auth user creation
  RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$;
```
Автоматически создаёт запись в `users` при создании пользователя в `auth.users`.

**Триггер на auth.users:**
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### 3. Обновлённые RLS политики

Все RLS политики переведены на использование `auth.uid()`:

**Таблица `users`:**
- `users_select_auth_policy` - чтение
- `users_update_auth_policy` - обновление
- `users_insert_auth_policy` - вставка (для администраторов)
- `users_insert_service_role_policy` - вставка для service_role (используется триггером)

**Таблица `user_profiles`:**
- `user_profiles_select_auth_policy`
- `user_profiles_update_auth_policy`
- `user_profiles_insert_auth_policy`

**Таблица `tasks`:**
- `tasks_select_auth_policy`
- `tasks_update_auth_policy`
- `tasks_insert_auth_policy`

**Таблица `survey_360_assignments`:**
- `survey_360_assignments_select_auth_policy`
- `survey_360_assignments_insert_auth_policy`
- `survey_360_assignments_update_auth_policy`

**Таблицы результатов оценки:**
- `hard_skill_results_*_auth_policy`
- `soft_skill_results_*_auth_policy`

**Таблицы этапов диагностики:**
- `diagnostic_stages_*_auth_policy`
- `diagnostic_stage_participants_*_auth_policy`

**Таблицы встреч:**
- `meeting_stages_*_auth_policy`
- `meeting_stage_participants_*_auth_policy`
- `one_on_one_meetings_*_auth_policy`
- `meeting_decisions_*_auth_policy`

**Таблицы развития и карьеры:**
- `development_plans_*_auth_policy`
- `user_career_progress_*_auth_policy`
- `user_career_ratings_*_auth_policy`
- `user_kpi_results_*_auth_policy`

### 4. Обновлённый Frontend

**Новый файл: `src/pages/AuthPage.tsx`**
Страница входа с email и паролем через Supabase Auth.

**Обновлён: `src/contexts/AuthContext.tsx`**
- Удалена функция `login()`
- Использует `supabase.auth.getSession()` для проверки сессии
- Слушает `supabase.auth.onAuthStateChange()` для автоматического обновления
- Загружает данные пользователя из таблицы `users` и расшифровывает их
- Получает роль через `get_user_role` RPC
- Добавлен флаг `loading` для индикации загрузки

**Обновлён: `src/components/AuthGuard.tsx`**
- Добавлена обработка состояния `loading`
- Перенаправляет на `/auth` вместо `/login`
- Показывает spinner во время загрузки

**Обновлён: `src/App.tsx`**
- Маршрут `/login` заменён на `/auth`
- Импортирует `AuthPage` вместо `LoginPage`

### 5. Создан администратор

**Учётные данные:**
- Email: `alena.draganova@gmail.com`
- Пароль: `test123`
- ID пользователя: `e033ec4d-0155-44c9-8aaf-b4a79adbc572`

**Данные в базе:**
- Запись в `auth.users` с подтверждённым email
- Запись в `users` с данными профиля
- Запись в `user_roles` с ролью `admin`
- Записи в `user_effective_permissions` с правами администратора

**Edge Function для создания администратора:**
- Создан `supabase/functions/create-admin/index.ts`
- Добавлена секция `[functions.create-admin]` в `supabase/config.toml`
- Использует Admin API Supabase для создания пользователя
- Автоматически назначает роль администратора
- Обновляет эффективные права доступа

## Архитектура авторизации

### Единая схема идентификации

- `users.id = auth.users.id` - один ID на всю систему
- `auth.uid()` - единственный источник текущего пользователя
- RLS политики проверяют `auth.uid()` для доступа
- `user_roles` связана с `users.id`

### Процесс входа

1. Пользователь вводит email и пароль на `/auth`
2. `supabase.auth.signInWithPassword()` проверяет учётные данные
3. Supabase Auth создаёт сессию
4. `AuthContext` получает сессию через `onAuthStateChange`
5. Загружаются данные пользователя из `users`
6. Расшифровываются имя и email
7. Получается роль через `get_user_role()`
8. Обновляется состояние `user` в контексте
9. Пользователь перенаправляется на главную страницу

### Процесс выхода

1. Вызывается `logout()` из `AuthContext`
2. `supabase.auth.signOut()` удаляет сессию
3. Состояние `user` очищается
4. `AuthGuard` перенаправляет на `/auth`

### Проверка прав доступа

Все проверки прав выполняются на уровне базы данных через:

1. **RLS политики**: проверяют `auth.uid()` и вызывают `has_permission()`
2. **Функция `has_permission()`**:
   - Получает роль пользователя из `user_roles`
   - Если роль = 'admin', возвращает `true`
   - Иначе проверяет наличие права в `user_effective_permissions`
3. **Frontend hooks**: `usePermission()` использует RPC `has_permission()` для условного рендеринга

## Проверка работоспособности

### Вход администратора
✅ Администратор может войти через `/auth` с email и паролем

### Доступ к разделам
Необходимо проверить доступ администратора к:
- ✅ `/` - главная страница
- ⏳ `/profile` - профиль (требуется проверка)
- ⏳ `/team` - команда (требуется проверка)
- ⏳ `/development` - развитие (требуется проверка)
- ⏳ `/security` - безопасность (требуется проверка)

### Права администратора
✅ Роль `admin` назначена в `user_roles`
✅ Права в `user_effective_permissions` обновлены
⏳ `has_permission()` возвращает `true` для всех проверок (требуется тестирование)

## Безопасность

### Security Linter Results

Обнаружено 8 предупреждений:

**INFO (5 шт.) - Таблицы без RLS политик:**
Некоторые справочные таблицы имеют RLS, но без политик. Это нормально для служебных таблиц, к которым не нужен прямой доступ.

**WARN (3 шт.):**
1. **Auth OTP long expiry** - время жизни OTP превышает рекомендуемое
2. **Leaked Password Protection Disabled** - защита от утечки паролей отключена
3. **Current Postgres version has security patches** - доступны патчи безопасности для PostgreSQL

**Рекомендации:**
- Включить защиту от утечки паролей в Authentication → Settings
- Сократить время жизни OTP
- Обновить версию PostgreSQL через Supabase Dashboard

### RLS Политики

Все критичные таблицы защищены RLS:
- `users` - пользователи видят себя, администраторы видят всех
- `tasks` - пользователи видят свои задачи
- `survey_360_assignments` - участники видят свои назначения
- `hard_skill_results` / `soft_skill_results` - оцениваемые и оценивающие видят результаты
- `diagnostic_stages` - участники видят свои этапы
- `one_on_one_meetings` - сотрудник и руководитель видят встречу

## Связь с user_roles

### Таблица user_roles

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);
```

### Тип app_role

```sql
CREATE TYPE app_role AS ENUM ('admin', 'hr', 'manager', 'employee');
```

### Связь с пользователями

- `user_roles.user_id` → `users.id` → `auth.users.id`
- Один пользователь может иметь несколько ролей (но в текущей реализации используется только одна)
- При удалении пользователя роли удаляются автоматически (CASCADE)

### Обновление прав

При изменении ролей автоматически обновляются права через триггеры:

```sql
CREATE TRIGGER trigger_refresh_user_permissions
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_user_permissions();
```

Функция `refresh_user_effective_permissions(user_id)` пересчитывает права пользователя на основе его ролей.

## Следующие шаги

1. ✅ Протестировать вход администратора
2. ⏳ Проверить доступ ко всем разделам
3. ⏳ Протестировать создание, редактирование, удаление данных
4. ⏳ Проверить работу RLS политик для разных ролей
5. ⏳ Исправить предупреждения Security Linter
6. ⏳ Настроить Site URL и Redirect URLs в Supabase Auth
7. ⏳ Добавить политику паролей и защиту от утечек

## Настройки Supabase Auth

**Обязательно настроить в Supabase Dashboard → Authentication → URL Configuration:**

- **Site URL**: URL приложения (preview или production)
- **Redirect URLs**: Добавить все URL, на которые может быть перенаправлен пользователь

Иначе возможна ошибка: `{"error": "requested path is invalid"}`

## Заключение

Система полностью переведена на Supabase Auth:
- ✅ Кастомная авторизация удалена
- ✅ `auth.uid()` используется как единственный источник идентификации
- ✅ RLS политики обновлены для работы с Supabase Auth
- ✅ Frontend использует стандартные методы Supabase Auth
- ✅ Создан администратор с полными правами
- ✅ Автоматическое создание профиля при регистрации
- ⏳ Требуется тестирование всех функций
