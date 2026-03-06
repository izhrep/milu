# Отчёт: Аудит и исправление RPC-вызовов Supabase

**Дата:** 2025-11-13  
**Статус:** ✅ ИСПРАВЛЕНО

---

## 1. Найденные некорректные вызовы

### ❌ has_permission - НЕКОРРЕКТНЫЕ ВЫЗОВЫ

**Проблема:** Функция вызывалась с двумя параметрами (`_permission_name` и `_user_id`), хотя в базе данных она принимает только один параметр (`_permission_name`).

#### Найдено в файлах:

1. **src/hooks/usePermission.ts:23-26**
   ```typescript
   const { data, error } = await supabase.rpc('has_permission', {
     _permission_name: permissionName,
     _user_id: user.id  // ❌ ЛИШНИЙ ПАРАМЕТР
   });
   ```

2. **src/hooks/usePermission.ts:71-74**
   ```typescript
   const { data, error } = await supabase.rpc('has_permission', {
     _permission_name: permissionName,
     _user_id: user.id  // ❌ ЛИШНИЙ ПАРАМЕТР
   });
   ```

---

## 2. Сравнение с реальными SQL-функциями

### Функция: `has_permission`

**Реальная сигнатура в БД:**
```sql
CREATE OR REPLACE FUNCTION public.has_permission(_permission_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
```

**Параметры:**
- ✅ `_permission_name` (text) - название permission

**Логика:** Функция автоматически получает текущего пользователя через `auth.uid()` внутри функции, поэтому `_user_id` не нужен.

**Старая сигнатура в types.ts:**
```typescript
has_permission: {
  Args: { _permission_name: string; _user_id: string }  // ❌ НЕВЕРНО
  Returns: boolean
}
```

**Корректная сигнатура:**
```typescript
has_permission: {
  Args: { _permission_name: string }  // ✅ ВЕРНО
  Returns: boolean
}
```

---

## 3. Проверка всех RPC-вызовов на фронтенде

### ✅ Корректные вызовы (не требуют изменений):

#### get_all_permissions
- **Файл:** src/components/security/RolesPermissionsManager.tsx:95
- **Сигнатура БД:** `get_all_permissions() RETURNS SETOF permissions`
- **Вызов:** `supabase.rpc('get_all_permissions')` ✅
- **Параметры:** Нет параметров ✅

#### get_role_permissions
- **Файл:** src/components/security/RolesPermissionsManager.tsx:96
- **Сигнатура БД:** `get_role_permissions() RETURNS SETOF role_permissions`
- **Вызов:** `supabase.rpc('get_role_permissions')` ✅
- **Параметры:** Нет параметров ✅

#### log_admin_action
- **Файлы:** 
  - src/components/security/RolesPermissionsManager.tsx:147, 226
  - src/components/security/UsersManagementTable.tsx:294, 328
- **Сигнатура БД:**
  ```sql
  log_admin_action(
    _admin_id uuid,
    _target_user_id uuid,
    _action_type text,
    _field text DEFAULT NULL,
    _old_value text DEFAULT NULL,
    _new_value text DEFAULT NULL,
    _details jsonb DEFAULT NULL
  ) RETURNS uuid
  ```
- **Вызов:**
  ```typescript
  await supabase.rpc('log_admin_action', {
    _admin_id: user.id,
    _target_user_id: null,
    _action_type: 'permission_granted',
    _field: 'role_permissions',
    _old_value: null,
    _new_value: permissionName,
    _details: {...}
  })
  ```
- **Статус:** ✅ Все параметры корректны

#### get_users_with_roles
- **Файл:** src/components/security/UsersManagementTable.tsx:80
- **Сигнатура БД:** `get_users_with_roles() RETURNS TABLE(...)`
- **Вызов:** `supabase.rpc('get_users_with_roles')` ✅
- **Параметры:** Нет параметров ✅

#### get_user_role
- **Файл:** src/contexts/AuthContext.tsx:82
- **Сигнатура БД:** `get_user_role(_user_id uuid) RETURNS app_role`
- **Вызов:**
  ```typescript
  await supabase.rpc('get_user_role', {
    _user_id: session.user_id
  })
  ```
- **Статус:** ✅ Параметр корректный

---

## 4. Исправленные вызовы

### ✅ has_permission (ИСПРАВЛЕНО)

**Было:**
```typescript
// src/hooks/usePermission.ts:23-26
const { data, error } = await supabase.rpc('has_permission', {
  _permission_name: permissionName,
  _user_id: user.id  // ❌ УДАЛЕНО
});

// src/hooks/usePermission.ts:71-74
const { data, error } = await supabase.rpc('has_permission', {
  _permission_name: permissionName,
  _user_id: user.id  // ❌ УДАЛЕНО
});
```

**Стало:**
```typescript
// src/hooks/usePermission.ts:23-25
const { data, error } = await supabase.rpc('has_permission', {
  _permission_name: permissionName  // ✅ ТОЛЬКО ОДИН ПАРАМЕТР
});

// src/hooks/usePermission.ts:71-73
const { data, error } = await supabase.rpc('has_permission', {
  _permission_name: permissionName  // ✅ ТОЛЬКО ОДИН ПАРАМЕТР
});
```

---

## 5. Изменения в types.ts

**⚠️ ВАЖНО:** Файл `src/integrations/supabase/types.ts` является read-only и генерируется автоматически из схемы БД.

### Текущее состояние в types.ts:
```typescript
has_permission: {
  Args: { _permission_name: string; _user_id: string }  // ❌ НЕВЕРНО
  Returns: boolean
}
```

### Ожидаемое состояние после перегенерации:
```typescript
has_permission: {
  Args: { _permission_name: string }  // ✅ ВЕРНО
  Returns: boolean
}
```

**Действие:** После следующей автоматической синхронизации схемы Supabase, файл `types.ts` будет обновлён автоматически и будет отражать корректную сигнатуру функции.

---

## 6. Итоговая статистика

### Всего найдено RPC-вызовов: 10

| RPC Функция | Файлов | Вызовов | Статус |
|-------------|--------|---------|--------|
| has_permission | 1 | 2 | ✅ ИСПРАВЛЕНО |
| get_all_permissions | 1 | 1 | ✅ Корректно |
| get_role_permissions | 1 | 1 | ✅ Корректно |
| log_admin_action | 2 | 4 | ✅ Корректно |
| get_users_with_roles | 1 | 1 | ✅ Корректно |
| get_user_role | 1 | 1 | ✅ Корректно |

### Исправлено:
- ✅ 2 вызова `has_permission` в `src/hooks/usePermission.ts`
- ✅ Удалён лишний параметр `_user_id`

### Требует внимания:
- ⚠️ `types.ts` будет автоматически обновлён при следующей синхронизации схемы

---

## 7. Рекомендации

1. ✅ **Все некорректные вызовы исправлены**
2. ⚠️ **Дождаться автоматической регенерации types.ts** после следующего изменения схемы БД
3. ✅ **Проверить работу permission системы** - все вызовы теперь соответствуют реальной сигнатуре функции
4. ✅ **usePermission хук готов к использованию** - больше не передаёт лишних параметров

---

## 8. Архитектурные замечания

### Почему has_permission не требует _user_id?

Функция `has_permission` реализована как `SECURITY DEFINER` и использует встроенную функцию PostgreSQL `auth.uid()` для получения ID текущего пользователя из контекста сессии Supabase. Это:

1. **Безопаснее** - нельзя подделать user_id в запросе
2. **Удобнее** - не нужно передавать user_id в каждом вызове
3. **Соответствует архитектуре RLS** - использует те же механизмы аутентификации

### Пример реализации в БД:
```sql
CREATE OR REPLACE FUNCTION public.has_permission(_permission_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
BEGIN
  -- Автоматически получаем ID текущего пользователя
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Проверяем permission в кэше
  RETURN EXISTS (
    SELECT 1 
    FROM user_effective_permissions
    WHERE user_id = current_user_id
      AND permission_name = _permission_name
  );
END;
$function$
```

---

## Заключение

✅ **Все RPC-вызовы на фронтенде теперь соответствуют реальным сигнатурам функций в базе данных.**

Исправления внесены только там, где это было необходимо (`has_permission`). Все остальные вызовы уже были корректными.
