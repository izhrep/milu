# Руководство по тестированию системы выбора оценивающих

## Обзор системы

Система автоматически создаёт задачи для peer evaluation workflow в три этапа:

### Этап 1: Добавление участника (автоматически)
- **Триггер**: INSERT в `diagnostic_stage_participants`
- **Функция**: `create_diagnostic_task_for_participant()`
- **Создаются задачи**:
  1. `peer_selection` для участника (status='pending')
  2. `survey_360_evaluation` для руководителя (status='pending')

### Этап 2: Отправка списка сотрудником (через UI)
- **Действие**: Сотрудник выбирает коллег и нажимает "Отправить"
- **Компонент**: `ColleagueSelectionDialog`
- **Создаются**:
  1. `survey_360_assignments` со статусом 'pending' и `added_by_manager=false`
  2. Задача `peer_approval` для руководителя через Edge Function
  3. Задача `peer_selection` меняет статус на 'completed'

### Этап 3: Утверждение руководителем (через UI)
- **Действие**: Руководитель утверждает/отклоняет список
- **Создаются**:
  1. При одобрении: задачи `survey_360_evaluation` для каждого выбранного коллеги
  2. При добавлении новых: assignment с `added_by_manager=true` и сразу 'approved'
  3. Задача `peer_approval` меняет статус на 'completed'

## End-to-End тестирование

### Тест 1: Создание задачи peer_selection при добавлении участника

```sql
-- 1. Добавить участника в диагностический этап
INSERT INTO diagnostic_stage_participants (user_id, stage_id)
VALUES ('USER_ID', 'STAGE_ID');

-- 2. Проверить создание задачи peer_selection
SELECT 
  t.id,
  t.user_id,
  t.task_type,
  t.status,
  t.title,
  t.diagnostic_stage_id
FROM tasks t
WHERE t.user_id = 'USER_ID'
  AND t.diagnostic_stage_id = 'STAGE_ID'
  AND t.task_type = 'peer_selection';

-- Ожидаемый результат:
-- - task_type = 'peer_selection'
-- - status = 'pending'
-- - title = 'Выбрать оценивающих'
-- - category = 'assessment'
```

### Тест 2: Создание задачи peer_approval при отправке списка

**UI шаги:**
1. Войти как сотрудник
2. Открыть "Мои задачи"
3. Найти задачу "Выбрать оценивающих"
4. Нажать кнопку "Выбрать оценивающих"
5. Выбрать 2-3 коллеги
6. Нажать "Отправить"

**Проверка в БД:**
```sql
-- Проверить статус задачи peer_selection
SELECT status FROM tasks
WHERE task_type = 'peer_selection'
  AND user_id = 'EMPLOYEE_ID'
  AND diagnostic_stage_id = 'STAGE_ID';
-- Должно быть: status = 'completed'

-- Проверить создание assignments
SELECT 
  id,
  evaluating_user_id,
  status,
  added_by_manager
FROM survey_360_assignments
WHERE evaluated_user_id = 'EMPLOYEE_ID'
  AND assignment_type = 'peer'
  AND diagnostic_stage_id = 'STAGE_ID';
-- Ожидаемый результат:
-- - status = 'pending'
-- - added_by_manager = false

-- Проверить создание задачи peer_approval для руководителя
SELECT 
  t.id,
  t.user_id,
  t.title,
  t.status,
  t.task_type
FROM tasks t
WHERE t.task_type = 'peer_approval'
  AND t.user_id = 'MANAGER_ID'
  AND t.diagnostic_stage_id = 'STAGE_ID';
-- Ожидаемый результат:
-- - task_type = 'peer_approval'
-- - status = 'pending'
-- - title = 'Утвердить список оценивающих для [ФИО]'
-- - category = 'assessment'
```

### Тест 3: Утверждение списка руководителем

**UI шаги:**
1. Войти как руководитель
2. Открыть "Мои задачи"
3. Найти задачу "Утвердить список оценивающих"
4. Открыть задачу
5. Просмотреть список коллег
6. Утвердить всех (или добавить дополнительных)
7. Нажать "Согласовать"

**Проверка в БД:**
```sql
-- Проверить статус assignments
SELECT 
  evaluating_user_id,
  status,
  added_by_manager
FROM survey_360_assignments
WHERE evaluated_user_id = 'EMPLOYEE_ID'
  AND assignment_type = 'peer'
  AND diagnostic_stage_id = 'STAGE_ID';
-- Ожидаемый результат:
-- - Все должны иметь status = 'approved'

-- Проверить создание задач survey_360_evaluation для каждого коллеги
SELECT 
  t.user_id,
  t.title,
  t.status,
  t.task_type
FROM tasks t
JOIN survey_360_assignments sa ON sa.id = t.assignment_id
WHERE sa.evaluated_user_id = 'EMPLOYEE_ID'
  AND sa.assignment_type = 'peer'
  AND t.diagnostic_stage_id = 'STAGE_ID';
-- Ожидаемый результат:
-- - Задача для каждого evaluating_user_id
-- - task_type = 'survey_360_evaluation'
-- - status = 'pending'

-- Проверить статус задачи peer_approval
SELECT status FROM tasks
WHERE task_type = 'peer_approval'
  AND user_id = 'MANAGER_ID'
  AND diagnostic_stage_id = 'STAGE_ID';
-- Должно быть: status = 'completed'
```

## Диагностические запросы

### Проверка всех задач для диагностического этапа
```sql
SELECT 
  t.user_id,
  u.last_name || ' ' || u.first_name as user_name,
  t.task_type,
  t.title,
  t.status,
  t.assignment_type,
  t.created_at
FROM tasks t
JOIN users u ON u.id = t.user_id
WHERE t.diagnostic_stage_id = 'STAGE_ID'
ORDER BY t.task_type, t.created_at;
```

### Проверка assignments для участника
```sql
SELECT 
  sa.id,
  sa.evaluating_user_id,
  u.last_name || ' ' || u.first_name as evaluator_name,
  sa.assignment_type,
  sa.status,
  sa.added_by_manager,
  sa.created_at
FROM survey_360_assignments sa
JOIN users u ON u.id = sa.evaluating_user_id
WHERE sa.evaluated_user_id = 'EMPLOYEE_ID'
  AND sa.diagnostic_stage_id = 'STAGE_ID'
ORDER BY sa.assignment_type, sa.created_at;
```

### Проверка логов Edge Function
```sql
-- В Supabase Dashboard: Functions > create-peer-approval-task > Logs
-- Искать сообщения:
-- - "Creating peer approval task for manager"
-- - "Peer approval task created"
-- - "Task already exists, skipping creation"
```

## Известные проблемы и решения

### Проблема: Задача peer_selection не создаётся
**Причина**: Самооценка (self assignment) ещё не создана
**Решение**: Проверить наличие записи в `survey_360_assignments` с `assignment_type='self'`

### Проблема: Задача peer_approval не создаётся
**Причины**:
1. Edge Function не вызывается (проверить logs)
2. Нет прав доступа (проверить JWT)
3. Задача уже существует

**Решение**: 
- Проверить console logs в браузере
- Проверить edge function logs в Supabase Dashboard
- Проверить, что managerId передаётся корректно

### Проблема: Дублирование задач
**Причина**: Множественные вызовы триггера или edge function
**Решение**: Проверки `NOT EXISTS` в функциях предотвращают дублирование

## Контрольный список проверки

- [ ] Задача peer_selection создаётся автоматически при добавлении участника
- [ ] Задача создаётся для всех участников, независимо от подразделения
- [ ] Задача создаётся только если есть self assignment
- [ ] Сотрудник может выбрать коллег из всей компании (кроме HR/admin)
- [ ] При отправке списка задача peer_selection завершается (status='completed')
- [ ] При отправке списка создаётся задача peer_approval для руководителя
- [ ] Задача peer_approval создаётся только один раз
- [ ] Руководитель может утверждать/отклонять выбранных коллег
- [ ] Руководитель может добавлять дополнительных коллег
- [ ] При утверждении создаются задачи survey_360_evaluation для каждого коллеги
- [ ] При завершении утверждения задача peer_approval завершается

## SQL для очистки тестовых данных

```sql
-- Удалить все задачи для этапа
DELETE FROM tasks WHERE diagnostic_stage_id = 'STAGE_ID';

-- Удалить все peer assignments для этапа
DELETE FROM survey_360_assignments 
WHERE diagnostic_stage_id = 'STAGE_ID' 
  AND assignment_type = 'peer';

-- Удалить участника из этапа (это также вызовет триггер удаления задач)
DELETE FROM diagnostic_stage_participants 
WHERE stage_id = 'STAGE_ID' 
  AND user_id = 'USER_ID';
```
