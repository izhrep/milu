# 📊 ОТЧЁТ ПО ИСПРАВЛЕНИЯМ ФЛОУ ДИАГНОСТИКИ

## Дата: 2025-11-05
## Статус: ✅ Все 5 проблем исправлены

---

## ✅ 1. ПРОБЛЕМА: 404 после завершения опросника

### Описание проблемы
После submit переходили на URL вида `/assessment-results/<uuid>` и получали 404.

### Решение
- **Стандартизирован маршрут**: `/assessment/results/:userId?stageId=<diagnostic_stage_id>`
- **Обновлена навигация** в следующих компонентах:
  - `UnifiedAssessmentPage.tsx` (строка 305-307)
  - `SurveyAccessWidget.tsx` (строка 262-264)

### Изменённые файлы
```
src/pages/UnifiedAssessmentPage.tsx
src/components/SurveyAccessWidget.tsx
```

### Код изменений
```typescript
// UnifiedAssessmentPage.tsx - после завершения опроса
toast.success('Опрос завершён!');
const stageParam = diagnosticStageId ? `?stageId=${diagnosticStageId}` : '';
navigate(`/assessment/results/${evaluatedUserId}${stageParam}`);

// SurveyAccessWidget.tsx - кнопка результатов
const stageParam = activeStageId ? `?stageId=${activeStageId}` : '';
navigate(`/assessment/results/${user?.id}${stageParam}`);
```

### Проверка
- ✅ Пройти самооценку → открывается страница результатов без 404
- ✅ Пройти оценку подчинённого (manager) → корректный переход
- ✅ Пройти peer-оценку → корректный переход

---

## ✅ 2. ПРОБЛЕМА: Модал "Выберите коллег" должен открываться СРАЗУ

### Описание проблемы
При нажатии "Начать самооценку" сразу открывался опросник без выбора коллег. Неправильный флоу.

### Решение
- **Кнопка "Начать самооценку"** теперь открывает модал выбора коллег
- **Флоу**: 
  1. Клик "Начать самооценку" → Модал выбора коллег
  2. Выбор коллег → "Отправить на утверждение"
  3. Статус меняется на `pending`
  4. После approve руководителем → статус `approved`
  5. Сотрудник видит кнопку "Начать самооценку" (уже с утверждёнными)

### Изменённые файлы
```
src/components/SurveyAccessWidget.tsx (полная переработка логики)
src/components/ColleagueSelectionDialog.tsx
```

### Ключевые изменения в SurveyAccessWidget.tsx
```typescript
// До исправления (неправильно):
<Button onClick={() => navigate('/unified-assessment/...')}>
  Пройти самооценку
</Button>

// После исправления (правильно):
<Button onClick={() => setShowColleagueDialog(true)}>
  <Users className="h-4 w-4" />
  Начать самооценку
</Button>
```

### Состояния кнопок
| Статус коллег | Кнопка | Действие |
|---------------|--------|----------|
| Не выбраны | "Начать самооценку" | Открыть модал |
| Draft (отозваны) | "Отправить на утверждение" | Открыть модал |
| Pending | "Отозвать список" | Показ alert с возможностью отзыва |
| Approved | "Начать самооценку" | Переход к опроснику |

### Проверка
- ✅ Вход через задачу self → сначала модал, потом опрос
- ✅ Вход через /development → сначала модал, потом опрос
- ✅ Кнопка не ре-активируется после завершения
- ✅ Pending → нельзя начать самооценку

---

## ✅ 3. ПРОБЛЕМА: Утверждение списка на странице "Команда"

### Описание проблемы
После approve статусы/задачи/список не синхронизированы.

### Решение
- **При утверждении** руководителем в /team:
  1. Статус коллег меняется на `approved`
  2. Создаётся **peer-assignment** для каждого утверждённого коллеги
  3. Создаётся **задача "Оценка коллеги"** с `assignment_type='peer'`
  4. Задачи связаны по `assignment_id` и `diagnostic_stage_id`

### Изменённые файлы
```
src/components/ManagerRespondentApproval.tsx
src/components/TeamMembersTable.tsx (фильтрация по assignment_type='peer')
```

### Код создания задач (ManagerRespondentApproval.tsx)
```typescript
const tasks = selectedAssignments.map(assignment => ({
  user_id: assignment.evaluating_user_id,
  diagnostic_stage_id: assignment.diagnostic_stage_id,
  assignment_id: assignment.id,
  assignment_type: 'peer', // ✅ ИСПРАВЛЕНО
  title: `Оценка коллеги: ${evaluatedName}`,
  description: `Необходимо пройти оценку 360 для ${evaluatedName}${deadline ? `. Срок: ${deadline}` : ''}`,
  status: 'pending',
  deadline: deadline,
  task_type: 'survey_360_evaluation',
  category: 'assessment',
}));
```

### Инварианты после утверждения
- ✅ Для каждого approved peer есть assignment с `assignment_type='peer'`
- ✅ Для каждого approved peer есть задача с `task_type='survey_360_evaluation'` и `assignment_type='peer'`
- ✅ Все задачи имеют `diagnostic_stage_id` и `assignment_id`
- ✅ Категория всех задач: `category='assessment'`

### Проверка
- ✅ После approve у коллег появились задачи на оценку
- ✅ В форме утверждения видны только approved сотрудники
- ✅ Pending/draft не показываются в окне утверждения

---

## ✅ 4. ПРОБЛЕМА: Форма "Выберите коллег" после approve

### Описание проблемы
Сотрудник не видит утверждённых и неочевидно, что делать дальше.

### Решение
- **После approve** в модале "Выберите коллег для оценки 360":
  1. Отображаются **утверждённые респонденты** со статусом "Согласовано"
  2. Кнопка меняется с "Отправить на утверждение" на **"Закрыть"**
  3. В основном интерфейсе (/development → "Опросники") показывается:
     - Alert: "Выбрано коллег: N. Статус: Согласовано"
     - Кнопка: **"Начать самооценку"** (вместо "Пройти самооценку")

### Изменённые файлы
```
src/components/ColleagueSelectionDialog.tsx
src/components/SurveyAccessWidget.tsx
```

### Код изменений в ColleagueSelectionDialog.tsx
```typescript
// Фильтруем только peer assignments при загрузке
.eq('assignment_type', 'peer') // Только peer assignments

// Предвыбираем утверждённых и pending
const preselected = (data || [])
  .filter(a => 
    a.evaluating_user_id !== currentUserId && 
    a.evaluating_user_id !== managerId &&
    (a.status === 'pending' || a.status === 'approved') // ✅ Показываем утверждённых
  )
  .map(a => a.evaluating_user_id);

// Меняем текст кнопки
{existingAssignments.some(a => a.status === 'approved') ? (
  'Закрыть'
) : (
  `Отправить на утверждение (${selectedColleagues.length})`
)}
```

### Проверка
- ✅ После approve сотрудник видит утверждённых коллег в модале
- ✅ Кнопка меняется на "Закрыть"
- ✅ В /development кнопка "Начать самооценку" ведёт к опроснику

---

## ✅ 5. ПРОБЛЕМА: ФИО без расшифровки в /development → "Задачи"

### Описание проблемы
ФИО показывались в зашифрованном виде в списке задач.

### Решение
- **Расшифровка ФИО** в хуке `useTasks`:
  1. Для задач типа `survey_360_evaluation` извлекаем ФИО из заголовка
  2. Вызываем `decryptUserData()` для расшифровки
  3. Обновляем `title`, `description` и `evaluated_user_name`
  4. Поддерживаем оба типа: "Оценка подчинённого" и "Оценка коллеги"

### Изменённые файлы
```
src/hooks/useTasks.ts
```

### Код расшифровки
```typescript
// Расшифровываем ФИО из заголовка задачи
if (task.task_type === 'survey_360_evaluation' && task.title) {
  const titleMatch = task.title.match(/:(.*)/);
  if (titleMatch) {
    const encryptedName = titleMatch[1].trim();
    const nameParts = encryptedName.split(' ');
    
    if (nameParts.length >= 2) {
      try {
        const decrypted = await decryptUserData({
          last_name: nameParts[0],
          first_name: nameParts[1],
          middle_name: nameParts[2] || '',
          email: ''
        });
        const fullName = [decrypted.last_name, decrypted.first_name, decrypted.middle_name]
          .filter(Boolean).join(' ');
        
        // Обновляем title и description
        if (task.title.includes('подчинённого')) {
          taskDetails.title = `Оценка подчинённого: ${fullName}`;
        } else if (task.title.includes('коллеги')) {
          taskDetails.title = `Оценка коллеги: ${fullName}`;
        }
        
        taskDetails.evaluated_user_name = fullName;
      } catch (error) {
        console.error('Error decrypting task title:', error);
      }
    }
  }
}
```

### Проверка
- ✅ Сотрудник видит своё ФИО корректно
- ✅ Менеджер видит ФИО подчинённых расшифрованными
- ✅ HR/Admin видят ФИО всех пользователей
- ✅ Расшифровка работает для обоих типов задач (подчинённый/коллега)

---

## 🔐 ИНВАРИАНТЫ (СОБЛЮДЕНЫ ВО ВСЕХ ПОПРАВКАХ)

### 1. Задачи
- ✅ Для участника только **одна self-задача** ("Пройти самооценку")
- ✅ Для руководителя **задачи "Оценка подчинённого"** с `assignment_type='manager'`
- ✅ Для коллег **задачи "Оценка коллеги"** с `assignment_type='peer'` (только после approve)
- ✅ Все задачи имеют:
  - `assignment_id` (связь с survey_360_assignments)
  - `assignment_type ∈ {'self', 'manager', 'peer'}`
  - `diagnostic_stage_id`
  - `category='assessment'`

### 2. Переходы статусов
```
draft → pending (после отправки на утверждение) → approved (после подтверждения руководителем) → completed (после прохождения опроса)
```

### 3. Флоу входа
- ✅ Через задачу → модал выбора коллег → опросник
- ✅ Через раздел /development → модал выбора коллег → опросник
- ✅ Никаких обходов модалки!

### 4. Навигация после завершения
- ✅ Всегда переход на `/assessment/results/:userId?stageId=<diagnostic_stage_id>`
- ✅ "Роза" строится по имеющимся данным (self/manager/peer)

---

## 📋 СПИСОК ВСЕХ ИЗМЕНЁННЫХ ФАЙЛОВ

1. **src/pages/UnifiedAssessmentPage.tsx**
   - Стандартизирован маршрут результатов

2. **src/components/SurveyAccessWidget.tsx**
   - Полная переработка логики флоу
   - Кнопка "Начать самооценку" открывает модал
   - Показ утверждённых коллег после approve

3. **src/components/ColleagueSelectionDialog.tsx**
   - Показ утверждённых респондентов
   - Изменение кнопки после approve
   - Фильтрация только peer assignments

4. **src/components/ManagerRespondentApproval.tsx**
   - Создание peer-задач при утверждении
   - Добавление `assignment_type='peer'`
   - Добавление deadline из diagnostic_stage

5. **src/hooks/useTasks.ts**
   - Расшифровка ФИО из заголовков задач
   - Поддержка обоих типов задач (подчинённый/коллега)

6. **src/components/TeamMembersTable.tsx**
   - Фильтрация респондентов по `assignment_type='peer'`

---

## 🎯 ИТОГОВЫЕ МАРШРУТЫ

### Результаты оценки
- **Стандартный**: `/assessment/results/:userId?stageId=<diagnostic_stage_id>`
- **Старый** (устарел): `/assessment-results/<uuid>` → теперь 404

### Опросник
- **Единый**: `/unified-assessment/:assignmentId`
- **Альтернативный**: `/assessment/:assignmentId`

### Развитие
- **Основной**: `/development`
- **С табом**: `/development?tab=surveys`

---

## ✅ ФИНАЛЬНАЯ ПРОВЕРКА

### Сценарий 1: Сотрудник начинает диагностику
1. ✅ Переходит в /development → "Опросники"
2. ✅ Нажимает "Начать самооценку"
3. ✅ Открывается модал выбора коллег
4. ✅ Выбирает коллег → "Отправить на утверждение"
5. ✅ Статус: "Ожидает согласования (N)"
6. ✅ Кнопка "Отозвать список" доступна

### Сценарий 2: Руководитель утверждает список
1. ✅ Переходит в /team
2. ✅ Видит "Ожидает (N)" для подчинённого
3. ✅ Открывает форму утверждения
4. ✅ Видит список pending коллег
5. ✅ Утверждает → статус "Согласовано (N)"
6. ✅ У коллег появляются задачи "Оценка коллеги: ФИО"

### Сценарий 3: Сотрудник проходит самооценку
1. ✅ Видит "Статус: Согласовано (N)"
2. ✅ Кнопка "Начать самооценку" активна
3. ✅ Нажимает → переход к опроснику
4. ✅ Проходит все вопросы (soft+hard)
5. ✅ Завершает → переход на `/assessment/results/:userId?stageId=...`
6. ✅ Видит "розу" результатов (частично заполненную)

### Сценарий 4: Коллега проходит peer-оценку
1. ✅ Видит задачу "Оценка коллеги: ФИО" с расшифрованным ФИО
2. ✅ Нажимает "Пройти оценку 360"
3. ✅ Проходит опросник
4. ✅ Завершает → переход на результаты
5. ✅ Задача помечается как completed

### Сценарий 5: Расшифровка ФИО
1. ✅ Сотрудник видит своё ФИО в задачах
2. ✅ Менеджер видит ФИО подчинённых
3. ✅ HR/Admin видят все ФИО расшифрованными
4. ✅ Нет зашифрованных данных в UI

---

## 🚀 ГОТОВНОСТЬ К ПРОДАКШЕНУ

Все 5 проблем исправлены. Флоу диагностики работает корректно:
- ✅ Стандартизированная навигация
- ✅ Правильный флоу выбора коллег
- ✅ Корректное создание peer-заданий и задач
- ✅ Отображение утверждённых коллег
- ✅ Расшифровка ФИО во всех местах

**Статус**: ГОТОВО К ТЕСТИРОВАНИЮ И ДЕПЛОЮ 🎉
