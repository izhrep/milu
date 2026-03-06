# Инструкция: Регенерация types.ts

**Дата:** 2025-11-13  
**Проблема:** `src/integrations/supabase/types.ts` содержит устаревшие типы для `has_permission`

---

## ⚠️ Важно: types.ts - read-only файл

Файл `src/integrations/supabase/types.ts` является **автоматически генерируемым** и находится в списке read-only файлов. Его **нельзя редактировать вручную**.

---

## Решение 1: Автоматическая синхронизация (рекомендуется)

Lovable автоматически синхронизирует types.ts с актуальной схемой Supabase при следующем изменении БД или при следующем деплое.

**Когда произойдёт:**
- При следующей миграции БД
- При автоматической синхронизации (обычно в течение нескольких минут)
- При перезапуске проекта

**Действия:** Просто подождите - файл обновится автоматически.

---

## Решение 2: Ручная регенерация через Supabase CLI

Если вы хотите обновить types.ts немедленно локально:

### Шаг 1: Установите Supabase CLI

```bash
npm install -g supabase
```

### Шаг 2: Войдите в Supabase

```bash
supabase login
```

### Шаг 3: Свяжите проект

```bash
supabase link --project-ref zgbimzuhrsgvfrhlboxy
```

### Шаг 4: Сгенерируйте types.ts

```bash
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

### Шаг 5: Проверьте изменения

```bash
git diff src/integrations/supabase/types.ts
```

---

## Решение 3: Использование type overrides (текущее)

✅ **УЖЕ РЕАЛИЗОВАНО:** Создан файл `src/types/supabase-rpc.ts` с правильными типами.

### Использование в коде:

```typescript
import type { SupabaseRPCFunctions } from '@/types/supabase-rpc';

// Вместо supabase.rpc() напрямую
const { data, error } = await supabase.rpc('has_permission', {
  _permission_name: 'users.view'
} as SupabaseRPCFunctions['has_permission']['Args']);

// Или используйте type assertion как сейчас
const { data, error } = await (supabase.rpc as any)('has_permission', {
  _permission_name: 'users.view'
});
```

---

## Ожидаемые изменения в types.ts

### До (текущее - НЕВЕРНО):

```typescript
has_permission: {
  Args: { _permission_name: string; _user_id: string }
  Returns: boolean
}
```

### После (ожидается - ВЕРНО):

```typescript
has_permission: {
  Args: { _permission_name: string }
  Returns: boolean
}
```

---

## Проверка после регенерации

После того как types.ts обновится, выполните:

### 1. Проверьте сигнатуру has_permission

```bash
grep -A 3 "has_permission:" src/integrations/supabase/types.ts
```

**Ожидаемый результат:**
```typescript
has_permission: {
  Args: { _permission_name: string }
  Returns: boolean
}
```

### 2. Обновите код usePermission.ts

Удалите type assertions после регенерации:

```typescript
// БЫЛО (с workaround):
const { data, error } = await (supabase.rpc as any)('has_permission', {
  _permission_name: permissionName
});

// СТАНЕТ (после регенерации):
const { data, error } = await supabase.rpc('has_permission', {
  _permission_name: permissionName
});
```

### 3. Запустите typecheck

```bash
npm run typecheck
```

**Не должно быть ошибок** связанных с has_permission.

---

## Diff после регенерации

После регенерации types.ts вы увидите примерно такой diff:

```diff
  has_permission: {
-   Args: { _permission_name: string; _user_id: string }
+   Args: { _permission_name: string }
    Returns: boolean
  }
```

Также могут быть обновлены:
- Описания таблиц
- Новые функции (если были добавлены)
- Enum значения
- Relationships между таблицами

---

## Статус

- ✅ **Корректные типы созданы** в `src/types/supabase-rpc.ts`
- ✅ **Фронтенд работает** с type assertions
- ⏳ **types.ts** - ожидает автоматической регенерации
- 📝 **После регенерации** - убрать type assertions

---

## FAQ

### Q: Почему я не могу просто отредактировать types.ts?

**A:** Этот файл генерируется автоматически из схемы Supabase. Любые ручные изменения будут перезаписаны при следующей синхронизации.

### Q: Как долго ждать автоматической синхронизации?

**A:** Обычно несколько минут после изменения схемы БД. Может быть до нескольких часов в зависимости от нагрузки на Supabase.

### Q: Можно ли ускорить процесс?

**A:** Да, используйте Supabase CLI (см. Решение 2) для немедленной регенерации локально.

### Q: Безопасно ли использовать type assertions?

**A:** Да, это временное решение. В runtime всё работает корректно, так как БД уже имеет правильную сигнатуру функции.

### Q: Что делать после регенерации?

**A:**
1. Проверить diff
2. Убрать `as any` из usePermission.ts
3. Запустить typecheck
4. Удалить `src/types/supabase-rpc.ts` (опционально)

---

**Подготовлено:** AI Assistant  
**Последнее обновление:** 2025-11-13 20:55 UTC
