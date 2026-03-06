# Ожидаемый diff для types.ts после регенерации

**Дата:** 2025-11-13  
**Файл:** src/integrations/supabase/types.ts

---

## Основные изменения

### 1. has_permission (КРИТИЧНО)

```diff
  Functions: {
    has_permission: {
-     Args: { _permission_name: string; _user_id: string }
+     Args: { _permission_name: string }
      Returns: boolean
    }
```

**Обоснование:** Функция использует `auth.uid()` внутри, не требует `_user_id`.

---

### 2. Возможные дополнительные изменения

#### get_current_user_id (может быть добавлена)

```diff
+ get_current_user_id: {
+   Args: Record<string, never>
+   Returns: string
+ }
```

#### is_owner (может быть добавлена)

```diff
+ is_owner: {
+   Args: { user_id_to_check: string }
+   Returns: boolean
+ }
```

#### is_users_manager (может быть добавлена)

```diff
+ is_users_manager: {
+   Args: { employee_id: string }
+   Returns: boolean
+ }
```

#### refresh_user_effective_permissions (может быть добавлена)

```diff
+ refresh_user_effective_permissions: {
+   Args: { target_user_id: string }
+   Returns: void
+ }
```

#### refresh_role_effective_permissions (может быть добавлена)

```diff
+ refresh_role_effective_permissions: {
+   Args: { target_role: Database["public"]["Enums"]["app_role"] }
+   Returns: void
+ }
```

#### log_access_denied (может быть добавлена)

```diff
+ log_access_denied: {
+   Args: {
+     _permission_name: string
+     _resource_type?: string | null
+     _resource_id?: string | null
+     _action_attempted?: string | null
+   }
+   Returns: void
+ }
```

---

## Полный список функций после регенерации

После регенерации в разделе `Functions` должны быть:

```typescript
Functions: {
  // Существующие (должны остаться)
  admin_cleanup_all_data: { Args: never; Returns: Json }
  admin_delete_all_from_table: { Args: { table_name: string }; Returns: number }
  calculate_diagnostic_stage_progress: { Args: { stage_id_param: string }; Returns: number }
  check_diagnostic_invariants: { Args: { stage_id_param: string }; Returns: {...}[] }
  check_diagnostic_data_consistency: { Args: never; Returns: {...}[] }
  check_meetings_data_consistency: { Args: never; Returns: {...}[] }
  check_user_has_auth: { Args: { user_email: string }; Returns: boolean }
  get_all_permissions: { Args: never; Returns: {...}[] }
  get_current_session_user: { Args: never; Returns: string }
  get_evaluation_period: { Args: { created_date: string }; Returns: string }
  get_role_permissions: { Args: never; Returns: {...}[] }
  get_user_role: { Args: { _user_id: string }; Returns: Database["public"]["Enums"]["app_role"] }
  get_user_with_role: { Args: { user_email: string }; Returns: {...}[] }
  get_users_with_roles: { Args: never; Returns: {...}[] }
  is_diagnostic_stage_participant: { Args: { _stage_id: string; _user_id: string }; Returns: boolean }
  is_meeting_stage_participant: { Args: { _stage_id: string; _user_id: string }; Returns: boolean }
  log_admin_action: { Args: {...}; Returns: string }
  calculate_career_gap: { Args: { p_user_id: string; p_grade_id: string }; Returns: {...}[] }

  // Исправлена сигнатура (ВАЖНО)
  has_permission: {
    Args: { _permission_name: string }  // ✅ БЕЗ _user_id
    Returns: boolean
  }

  // Новые функции (могут быть добавлены)
  get_current_user_id: { Args: never; Returns: string }
  is_owner: { Args: { user_id_to_check: string }; Returns: boolean }
  is_users_manager: { Args: { employee_id: string }; Returns: boolean }
  refresh_user_effective_permissions: { Args: { target_user_id: string }; Returns: void }
  refresh_role_effective_permissions: { Args: { target_role: Database["public"]["Enums"]["app_role"] }; Returns: void }
  log_access_denied: { Args: {...}; Returns: void }

  // Удалённые функции (могут отсутствовать, если были удалены)
  // has_role - удалена в миграции 20251113180406
  // is_current_user_admin - удалена в миграции 20251113180406
  // is_manager_of - удалена в миграции 20251113180406
}
```

---

## Проверочный чеклист после регенерации

### ✅ Критические изменения

- [ ] `has_permission` принимает только `{ _permission_name: string }`
- [ ] Удалён параметр `_user_id` из `has_permission`
- [ ] Добавлена функция `get_current_user_id` (если есть в БД)
- [ ] Добавлена функция `is_users_manager` (если есть в БД)

### ✅ Функции должны присутствовать

- [ ] `get_all_permissions` - без параметров
- [ ] `get_role_permissions` - без параметров
- [ ] `log_admin_action` - с 7 параметрами
- [ ] `get_users_with_roles` - без параметров
- [ ] `get_user_role` - с `_user_id`
- [ ] `calculate_diagnostic_stage_progress` - с `stage_id_param`
- [ ] `check_diagnostic_data_consistency` - без параметров
- [ ] `check_meetings_data_consistency` - без параметров

### ✅ Функции НЕ должны присутствовать (удалены)

- [ ] `has_role(uuid, app_role)` - удалена
- [ ] `is_current_user_admin()` - удалена
- [ ] `is_manager_of(uuid, uuid)` - удалена

---

## Команды для проверки

### Проверить has_permission

```bash
grep -A 3 '"has_permission":' src/integrations/supabase/types.ts
```

**Ожидаемый вывод:**
```typescript
has_permission: {
  Args: { _permission_name: string }
  Returns: boolean
}
```

### Проверить наличие новых функций

```bash
grep -E "(get_current_user_id|is_owner|is_users_manager)" src/integrations/supabase/types.ts
```

### Посчитать количество функций

```bash
grep -c "Args:" src/integrations/supabase/types.ts
```

**Ожидается:** 25-30 функций

---

## После применения изменений

### 1. Обновите usePermission.ts

```typescript
// src/hooks/usePermission.ts

// УДАЛИТЬ:
const { data, error } = await (supabase.rpc as any)('has_permission', {
  _permission_name: permissionName
});

// ЗАМЕНИТЬ НА:
const { data, error } = await supabase.rpc('has_permission', {
  _permission_name: permissionName
});
```

### 2. Удалите временный файл (опционально)

```bash
rm src/types/supabase-rpc.ts
```

Или оставьте его как дополнительную документацию по RPC API.

### 3. Запустите typecheck

```bash
npm run typecheck
```

**Ожидаемый результат:** ✅ No errors

---

## Полный diff (ожидаемый)

```diff
diff --git a/src/integrations/supabase/types.ts b/src/integrations/supabase/types.ts
index abc1234..def5678 100644
--- a/src/integrations/supabase/types.ts
+++ b/src/integrations/supabase/types.ts
@@ -2345,7 +2345,7 @@ export type Database = {
       }
       has_permission: {
-        Args: { _permission_name: string; _user_id: string }
+        Args: { _permission_name: string }
         Returns: boolean
       }
       has_role: {
@@ -2360,6 +2360,22 @@ export type Database = {
           _user_id: string
         }
         Returns: boolean
+      }
+      get_current_user_id: {
+        Args: Record<string, never>
+        Returns: string
+      }
+      is_owner: {
+        Args: { user_id_to_check: string }
+        Returns: boolean
+      }
+      is_users_manager: {
+        Args: { employee_id: string }
+        Returns: boolean
+      }
+      refresh_user_effective_permissions: {
+        Args: { target_user_id: string }
+        Returns: void
       }
       // ... остальные функции ...
     }
```

---

**Примечание:** Точный diff может отличаться в зависимости от версии Supabase CLI и текущего состояния БД.

**Подготовлено:** AI Assistant  
**Последнее обновление:** 2025-11-13 20:57 UTC
