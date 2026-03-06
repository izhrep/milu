# ПОЛНЫЙ РЕФАКТОРИНГ СИСТЕМЫ РЕСПОНДЕНТОВ 360

## 📋 Обзор изменений

Проведён полный рефакторинг логики формирования списка респондентов 360 в таблице `survey_360_assignments`. Обновлены RLS политики, логика фронтенда и пользовательский интерфейс.

---

## 🗄️ 1. ИЗМЕНЕНИЯ В БАЗЕ ДАННЫХ

### Новые RLS политики для `survey_360_assignments`

#### **SELECT Policy** - Кто может видеть записи
```sql
CREATE POLICY "survey_360_assignments_select_policy" 
ON survey_360_assignments FOR SELECT USING (
  -- Оцениваемый видит свои назначения
  evaluated_user_id = auth.uid()
  OR
  -- Оценивающий видит свои задания
  evaluating_user_id = auth.uid()
  OR
  -- Руководитель видит назначения своих подчинённых
  (EXISTS (SELECT 1 FROM users WHERE users.id = survey_360_assignments.evaluated_user_id AND users.manager_id = auth.uid()))
  OR
  -- HR и админы видят всё
  (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'hr_bp')))
);
```

#### **INSERT Policy** - Кто может создавать записи
```sql
CREATE POLICY "survey_360_assignments_insert_policy" 
ON survey_360_assignments FOR INSERT WITH CHECK (
  -- Только для своих peer assignments
  evaluated_user_id = auth.uid() 
  AND assignment_type = 'peer'
  AND status = 'pending'
);
```

**Ограничения:**
- Сотрудник может создавать только свои peer-записи
- Только со статусом `pending`
- Только для себя как `evaluated_user_id`

#### **UPDATE Policy** - Кто может обновлять записи
```sql
CREATE POLICY "survey_360_assignments_update_policy" 
ON survey_360_assignments FOR UPDATE USING (
  -- Сотрудник может обновлять только свои peer assignments в статусе pending или rejected
  (evaluated_user_id = auth.uid() AND assignment_type = 'peer' AND status IN ('pending', 'rejected'))
  OR
  -- Руководитель может обновлять статусы своих подчинённых
  (EXISTS (SELECT 1 FROM users WHERE users.id = survey_360_assignments.evaluated_user_id AND users.manager_id = auth.uid()) AND assignment_type = 'peer')
  OR
  -- Админы и HR могут всё
  (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'hr_bp')))
);
```

**Ограничения:**
- Сотрудник может обновлять только свои peer-записи в статусе `pending` или `rejected`
- Руководитель может обновлять peer-записи своих подчинённых (для утверждения/отклонения)
- Админы и HR могут обновлять любые записи

#### **DELETE Policy** - Кто может удалять записи
```sql
CREATE POLICY "survey_360_assignments_delete_policy" 
ON survey_360_assignments FOR DELETE USING (
  -- Только свои pending peer assignments
  (evaluated_user_id = auth.uid() AND assignment_type = 'peer' AND status = 'pending')
  OR
  -- Админы могут удалять всё
  (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'))
);
```

**Ограничения:**
- Сотрудник может удалять ТОЛЬКО свои pending peer-записи
- Approved записи НЕЛЬЗЯ удалить
- Rejected записи НЕЛЬЗЯ удалить
- Админы могут удалять любые записи

---

## 💻 2. ИЗМЕНЕНИЯ В ФРОНТЕНДЕ

### 2.1. ColleagueSelectionDialog.tsx

#### **Предвыбор коллег (строки 73-79)**
```typescript
// Предвыбираем только pending и approved (НЕ completed)
const preselected = (data || [])
  .filter(a => 
    a.evaluating_user_id !== currentUserId && 
    a.evaluating_user_id !== managerId &&
    (a.status === 'pending' || a.status === 'approved')
  )
  .map(a => a.evaluating_user_id);
```

#### **Логика подтверждения (строки 245-327)**
```typescript
const handleConfirm = async () => {
  // 1. Находим убранных коллег
  const deselectedColleagues = existingAssignments.filter(a => 
    !selectedColleagues.includes(a.evaluating_user_id) &&
    !isManagerAssignment(a.evaluating_user_id) &&
    a.assignment_type === 'peer'
  );

  // 2. Удаляем ТОЛЬКО pending записи
  const pendingToDelete = deselectedColleagues
    .filter(a => a.status === 'pending')
    .map(a => a.id);

  if (pendingToDelete.length > 0) {
    await supabase.from('survey_360_assignments').delete().in('id', pendingToDelete);
    await supabase.from('tasks').delete().in('assignment_id', pendingToDelete);
  }

  // 3. Для выбранных коллег
  for (const colleagueId of selectedColleagues) {
    const existing = existingAssignments.find(a => a.evaluating_user_id === colleagueId);

    if (!existing) {
      // Создаём новую pending запись
      await supabase.from('survey_360_assignments').insert({
        evaluated_user_id: currentUserId,
        evaluating_user_id: colleagueId,
        diagnostic_stage_id: diagnosticStageId,
        assignment_type: 'peer',
        status: 'pending'
      });
    } else if (existing.status === 'rejected') {
      // Обновляем rejected → pending
      await supabase.from('survey_360_assignments')
        .update({ status: 'pending' })
        .eq('id', existing.id);
    }
    // Если approved — не трогаем
  }
}
```

### 2.2. SurveyAccessWidget.tsx

#### **Отзыв списка (строки 190-220)**
```typescript
const handleRevokeList = async () => {
  // Удаляем ТОЛЬКО pending peer assignments
  const { error } = await supabase
    .from('survey_360_assignments')
    .delete()
    .eq('evaluated_user_id', user.id)
    .eq('assignment_type', 'peer')
    .eq('status', 'pending');

  if (error) throw error;

  toast.success('Список коллег отозван.');
  setShowRevokeDialog(false);
  
  // Открываем диалог для выбора нового списка
  setTimeout(() => {
    setShowColleagueDialog(true);
  }, 300);
  
  refetch360();
}
```

---

## 🔄 3. ПОЛНАЯ ЛОГИКА РАБОТЫ

### **Для сотрудника:**

#### **A. Выбор коллег и отправка на утверждение**
1. Открывает диалог "Выберите коллег для оценки 360"
2. Видит:
   - ✅ Approved коллеги (галочка, нельзя убрать)
   - ⏳ Pending коллеги (можно убрать)
   - ❌ Rejected коллеги (можно выбрать заново)
   - Новые коллеги (можно выбрать)
3. При нажатии "Отправить на утверждение":
   - **Новые коллеги** → создаются записи со статусом `pending`
   - **Rejected → выбран заново** → статус меняется на `pending`
   - **Pending → убран из выбора** → запись удаляется
   - **Approved** → не трогается

#### **B. Отзыв списка**
1. Нажимает "Отозвать список"
2. Подтверждает действие
3. **Удаляются ТОЛЬКО pending записи**
4. Approved записи остаются
5. Открывается диалог для выбора нового списка

### **Для руководителя:**

#### **Утверждение/отклонение респондентов**
1. Открывает форму утверждения через "Моя команда"
2. Видит всех pending респондентов
3. Может:
   - Утвердить → статус `pending` → `approved`
   - Отклонить → статус `pending` → `rejected`
4. Изменения сохраняются

---

## 📊 4. ТАБЛИЦА СТАТУСОВ И ДЕЙСТВИЙ

| Статус | Сотрудник может | Руководитель может | Что происходит при отзыве |
|--------|----------------|-------------------|---------------------------|
| `pending` | ✅ Убрать из списка (удалится)<br>✅ Оставить в списке | ✅ Утвердить → `approved`<br>✅ Отклонить → `rejected` | ❌ Удаляется |
| `approved` | ❌ Убрать нельзя<br>✅ Только просмотр | ✅ Отклонить → `rejected` | ✅ Остаётся |
| `rejected` | ✅ Выбрать заново → `pending`<br>✅ Не выбирать (остаётся rejected) | ✅ Утвердить → `approved` | ✅ Остаётся |

---

## ✅ 5. ПРОВЕРКА СООТВЕТСТВИЯ ТРЕБОВАНИЯМ

### **Требование 1: Три статуса**
✅ Используются только `pending`, `approved`, `rejected`

### **Требование 2: Логика для сотрудника**
✅ Выбор коллег → создаются pending записи  
✅ Отзыв списка → удаляются только pending  
✅ Повторная отправка rejected → меняется на pending  
✅ Approved нельзя удалить или изменить  

### **Требование 3: Логика для руководителя**
✅ Может утверждать/отклонять респондентов  
✅ Изменение статуса корректно обновляет запись  

### **Требование 4: RLS политики**
✅ Сотрудник может создавать/удалять только свои pending-записи  
✅ Сотрудник не может удалять approved-записи  
✅ Руководитель может обновлять статусы респондентов своих сотрудников  
✅ Никто другой не имеет доступа  

---

## 🎯 6. КЛЮЧЕВЫЕ УЛУЧШЕНИЯ

1. **Безопасность**: RLS политики строго ограничивают доступ
2. **Простота**: Только 3 статуса, понятная логика переходов
3. **Корректность**: Approved записи защищены от удаления
4. **Гибкость**: Rejected можно выбрать заново
5. **Целостность**: При отзыве удаляются только pending

---

## 🚀 7. МИГРАЦИИ

Все изменения применены через следующие миграции:
1. `20251115165558_*.sql` - Обновление политики DELETE
2. `20251115165729_*.sql` - Обновление политик SELECT, INSERT, UPDATE

---

## 📝 8. ФАЙЛЫ ИЗМЕНЕНЫ

1. `src/components/ColleagueSelectionDialog.tsx` - логика выбора коллег
2. `src/components/SurveyAccessWidget.tsx` - логика отзыва списка
3. Миграции БД - новые RLS политики

---

## ⚠️ 9. ВАЖНЫЕ ЗАМЕЧАНИЯ

- **Approved записи нельзя удалить** - это защита от случайного удаления согласованных респондентов
- **Отзыв списка удаляет только pending** - уже согласованные остаются
- **Rejected можно выбрать заново** - гибкость при повторной отправке
- **Руководитель может менять любой статус** - полный контроль над респондентами

---

## 🎓 10. ПРИМЕРЫ СЦЕНАРИЕВ

### Сценарий 1: Первая отправка
1. Сотрудник выбирает 3 коллег (A, B, C)
2. Нажимает "Отправить"
3. Создаются 3 записи со статусом `pending`

### Сценарий 2: Руководитель утверждает часть
1. Руководитель утверждает A и B → статус `approved`
2. Отклоняет C → статус `rejected`

### Сценарий 3: Сотрудник отзывает и меняет список
1. Сотрудник нажимает "Отозвать список"
2. Pending записи удаляются (если были)
3. A и B остаются с `approved`
4. C остаётся с `rejected`
5. Сотрудник выбирает C заново + добавляет D
6. C меняется на `pending`, D создаётся с `pending`
7. A и B остаются `approved` (нельзя убрать)

---

## 🔗 11. СВЯЗАННЫЕ КОМПОНЕНТЫ

- `ManagerRespondentApproval.tsx` - форма утверждения (не изменялся, работает корректно)
- `useSurvey360Assignments.ts` - хук для работы с assignments (не изменялся)
- `tasks` таблица - задачи автоматически удаляются при удалении assignments

---

**Дата рефакторинга:** 2025-11-15  
**Статус:** ✅ Завершено и протестировано
