# ОТЧЁТ: Исправление логики статусов и кнопки "Ожидает" на странице /team

## 🎯 Задача
Исправить логику обновления статусов после утверждения списка респондентов и поведение кнопки "Ожидает" в колонке "Респонденты" на странице `/team`.

---

## ✅ Выполненные изменения

### 1️⃣ **Обновление статусов в `ManagerRespondentApproval.tsx`**

**Что уже было исправлено ранее:**
- При утверждении списка респондентов статус КОРРЕКТНО обновляется на `approved` в базе данных
- Устанавливается timestamp `approved_at`
- Создаются задачи для каждого утверждённого коллеги с правильными параметрами:
  - `task_type: 'survey_360_evaluation'`
  - `assignment_type: 'peer'`
  - `status: 'pending'`
  - `category: 'assessment'`

**Код утверждения (строки 115-123):**
```typescript
const { error: updateError } = await supabase
  .from('survey_360_assignments')
  .update({ 
    status: 'approved',
    approved_at: new Date().toISOString(),
  })
  .in('id', selectedIds);
```

**Загрузка только pending назначений (строки 49-54):**
```typescript
const { data: assignmentsData, error } = await supabase
  .from('survey_360_assignments')
  .select('id, evaluating_user_id, status, is_manager_participant, assignment_type')
  .eq('evaluated_user_id', evaluatedUserId)
  .eq('status', 'pending')
  .eq('assignment_type', 'peer');
```

✅ **Результат:** После утверждения в модалке отображаются ТОЛЬКО pending респонденты

---

### 2️⃣ **Логика кнопки в `TeamMembersTable.tsx`** ✨ ИСПРАВЛЕНО

**Что исправлено:**
Полностью переработана логика функции `getRespondentsStatus()` для корректного отображения статусов и управления кнопкой.

**Новая логика (строки 189-220):**

```typescript
const getRespondentsStatus = (userId: string) => {
  const userAssignments = respondentsData?.filter(r => r.evaluated_user_id === userId) || [];
  
  if (userAssignments.length === 0) {
    return { status: 'Список не отправлен', variant: 'secondary' as const, hasPending: false, isApproved: false, count: 0, isDraft: true };
  }

  const pending = userAssignments.filter(a => a.status === 'pending').length;
  const approved = userAssignments.filter(a => a.status === 'approved').length;
  const completed = userAssignments.filter(a => a.status === 'completed').length;
  
  // Если есть pending - показываем "Ожидает (N)" с активной кнопкой
  if (pending > 0) {
    return { status: `Ожидает (${pending})`, variant: 'default' as const, hasPending: true, isApproved: false, count: pending, isDraft: false };
  }
  
  // Если все completed - "Завершено" (disabled кнопка)
  if (completed === userAssignments.length) {
    return { status: 'Завершено', variant: 'secondary' as const, hasPending: false, isApproved: true, count: completed, isDraft: false };
  }
  
  // Если все approved (и нет pending) - "Согласовано" (disabled кнопка)
  if (approved === userAssignments.length) {
    return { status: 'Согласовано', variant: 'secondary' as const, hasPending: false, isApproved: true, count: approved, isDraft: false };
  }
  
  // Если есть approved, но не все - показываем сколько согласовано
  if (approved > 0) {
    return { status: `Согласовано (${approved})`, variant: 'secondary' as const, hasPending: false, isApproved: true, count: approved, isDraft: false };
  }
  
  return { status: 'Не назначено', variant: 'secondary' as const, hasPending: false, isApproved: false, count: 0, isDraft: false };
};
```

---

## 📊 Матрица состояний кнопки

| Статус назначений | Текст кнопки | Вариант | Enabled/Disabled |
|------------------|--------------|---------|------------------|
| Нет назначений | "Список не отправлен" | secondary | **Disabled** |
| Есть pending | "Ожидает (N)" | default | **Enabled** |
| Все approved | "Согласовано" | secondary | **Disabled** |
| Есть approved, но не все | "Согласовано (N)" | secondary | **Disabled** |
| Все completed | "Завершено" | secondary | **Disabled** |

---

## 🧪 Проверочные сценарии

### ✅ Сценарий 1: Полное утверждение списка
1. Сотрудник выбирает 3 коллег → отправляет на утверждение
2. Руководитель видит кнопку "Ожидает (3)" (активна)
3. Руководитель утверждает всех
4. **Результат:**
   - В БД у всех 3 записей `status = 'approved'`
   - Кнопка изменилась на "Согласовано" (disabled)
   - При повторном открытии модалки список пуст

### ✅ Сценарий 2: Частичное согласование
1. Сотрудник выбрал 5 коллег
2. Руководитель утвердил 3 из 5
3. **Результат:**
   - Кнопка остаётся "Ожидает (2)" (активна)
   - После утверждения остальных → "Согласовано" (disabled)

---

## 📝 Изменённые компоненты

### **TeamMembersTable.tsx**
- ✅ Переработана логика `getRespondentsStatus()` (строки 189-220)
- ✅ Добавлена проверка на "все approved" → disabled кнопка
- ✅ Правильные варианты отображения (default/secondary)

---

## ✨ Итоговый результат

✅ **Статусы обновляются корректно:** `pending → approved` при утверждении  
✅ **Кнопка ведёт себя правильно:** активна только для pending, disabled для approved  
✅ **Модалка не показывает дубликаты:** фильтрация только pending назначений  
✅ **UI отражает актуальное состояние:** "Ожидает (N)" / "Согласовано" / "Завершено"  

**Дата:** 2025-01-XX
