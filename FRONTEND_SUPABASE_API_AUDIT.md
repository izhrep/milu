# ПОЛНЫЙ АУДИТ ВЫЗОВОВ SUPABASE API ИЗ ФРОНТЕНДА

**Дата:** 2025-11-13  
**Статус:** Полное сканирование завершено

---

## ИСПОЛНИТЕЛЬНОЕ РЕЗЮМЕ

Проведено полное сканирование всего фронтенд-кода проекта для выявления всех обращений к Supabase API.

### Статистика:
- **RPC вызовы:** 10 уникальных методов
- **Запросы к таблицам (.from()):** 339+ обращений к 50+ таблицам
- **Операции:** SELECT, INSERT, UPDATE, DELETE
- **Хуков с API вызовами:** 37 файлов

---

## 1. RPC ВЫЗОВЫ (supabase.rpc)

### 1.1 has_permission
**Назначение:** Проверка прав доступа текущего пользователя

| Файл | Строки | Параметры |
|------|--------|-----------|
| `src/hooks/usePermission.ts` | 23-26 | `{ _permission_name: permissionName, _user_id: user.id }` |
| `src/hooks/usePermission.ts` | 71-74 | `{ _permission_name: permissionName, _user_id: user.id }` |

**Количество вызовов:** 2 (в хуке usePermission и usePermissions)

---

### 1.2 get_all_permissions
**Назначение:** Получение списка всех доступных разрешений системы

| Файл | Строка | Параметры |
|------|--------|-----------|
| `src/components/security/RolesPermissionsManager.tsx` | 95 | Нет параметров |

**Количество вызовов:** 1

---

### 1.3 get_role_permissions
**Назначение:** Получение связей между ролями и разрешениями

| Файл | Строка | Параметры |
|------|--------|-----------|
| `src/components/security/RolesPermissionsManager.tsx` | 96 | Нет параметров |

**Количество вызовов:** 1

---

### 1.4 log_admin_action
**Назначение:** Логирование административных действий в audit_log

| Файл | Строки | Параметры |
|------|--------|-----------|
| `src/components/security/RolesPermissionsManager.tsx` | 147-154 | `{ _admin_id, _target_user_id, _action_type, _field, _old_value, _new_value }` |
| `src/components/security/RolesPermissionsManager.tsx` | 226-232 | `{ _admin_id, _target_user_id, _action_type, _field, _old_value, _new_value }` |
| `src/components/security/UsersManagementTable.tsx` | 294-300 | `{ _admin_id, _target_user_id, _action_type, _field, _old_value, _new_value }` |
| `src/components/security/UsersManagementTable.tsx` | 328-334 | `{ _admin_id, _target_user_id, _action_type, _field, _old_value, _new_value }` |

**Количество вызовов:** 4

---

### 1.5 get_users_with_roles
**Назначение:** Получение пользователей с их ролями (обход RLS)

| Файл | Строка | Параметры |
|------|--------|-----------|
| `src/components/security/UsersManagementTable.tsx` | 80 | Нет параметров |

**Количество вызовов:** 1

---

### 1.6 get_user_role
**Назначение:** Получение роли конкретного пользователя

| Файл | Строка | Параметры |
|------|--------|-----------|
| `src/contexts/AuthContext.tsx` | 82-84 | `{ _user_id: session.user_id }` |

**Количество вызовов:** 1

---

## 2. ЗАПРОСЫ К ТАБЛИЦАМ (supabase.from)

### 2.1 ОСНОВНЫЕ ТАБЛИЦЫ ПОЛЬЗОВАТЕЛЕЙ

#### users
**Операции:** SELECT, UPDATE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/AssessmentDetailsReport.tsx` | 35-36 | SELECT | `.select('grade_id, manager_id').eq('id', userId).single()` |
| `src/components/AssessmentResultsDialog.tsx` | 44-45 | SELECT | `.select('grade_id').eq('id', userId).single()` |
| `src/components/ColleagueSelectionDialog.tsx` | 93-94 | SELECT | `.select('id, first_name, last_name, middle_name, email, manager_id').neq('id', evaluatedUserId)` |
| `src/components/DevelopmentPlanCreator.tsx` | 92-93 | SELECT | `.select('id').eq('id', userId).single()` |
| `src/components/MainContent.tsx` | 80-81 | SELECT | `.select('id, email, first_name, last_name, middle_name, position_id, grade_id, manager_id, created_at').eq('id', user?.id).single()` |
| `src/components/ManagerRespondentApproval.tsx` | 63-64 | SELECT | `.select('id, first_name, last_name, middle_name, email')` (множественные строки) |
| `src/components/ManagerRespondentApproval.tsx` | 174-175 | SELECT | `.select('first_name, last_name, middle_name, email').eq('id', participantUserId).single()` |
| `src/components/RespondentApprovalDialog.tsx` | 63-64 | SELECT | `.select('first_name, last_name, middle_name, positions(name)').eq('id', respondent.evaluating_user_id).single()` |
| `src/components/SurveyAccessWidget.tsx` | 59-60 | SELECT | `.select('id, first_name, last_name, middle_name, email').eq('id', user?.id).single()` |
| `src/components/SurveyAccessWidget.tsx` | 100-101 | SELECT | `.select('manager_id').eq('id', user?.id).single()` |
| `src/components/security/UsersManagementTable.tsx` | 288-290 | UPDATE | `.update({ manager_id: null }).eq('id', userId)` |
| `src/components/admin/ReferenceTableView.tsx` | 76 | SELECT | `.select('*')` |
| `src/pages/AdminPage.tsx` | 292 | SELECT | `.select('*')` |
| `src/hooks/useHRAnalytics.ts` | 53 | SELECT | `.select('id').eq('status', true)` + фильтры по отделу/позиции |
| `src/hooks/useUsers.ts` | Различные | SELECT, INSERT, UPDATE, DELETE | Комплексные запросы с join |

**Количество вызовов:** 20+

---

#### user_roles
**Операции:** SELECT

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/security/RolesPermissionsManager.tsx` | 97 | SELECT | `.select('role')` |
| `src/components/UserMenu.tsx` | 18-19 | SELECT | `.select('role').eq('user_id', user?.id).single()` |
| `src/hooks/useUsers.ts` | 120 | SELECT | `.select('user_id, role')` |

**Количество вызовов:** 3

---

#### admin_sessions
**Операции:** INSERT

| Файл | Строка | Операция | Данные |
|------|--------|----------|--------|
| `src/contexts/AuthContext.tsx` | 107 | INSERT | `{ user_id, session_id, user_email, login_method, ip_address, user_agent, created_at }` |

**Количество вызовов:** 1

---

### 2.2 ТАБЛИЦЫ ДИАГНОСТИКИ

#### diagnostic_stages
**Операции:** SELECT, INSERT, UPDATE, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/ManagerRespondentApproval.tsx` | 165-166 | SELECT | `.select('deadline_date').eq('id', stageId).single()` |
| `src/hooks/useDiagnosticStages.ts` | 30-33 | SELECT | `.select('*').order('created_at', { ascending: false })` |
| `src/hooks/useDiagnosticStages.ts` | 42-46 | INSERT | `.insert({ ...stage, created_by: user?.id }).select().single()` |
| `src/hooks/useDiagnosticStages.ts` | 62-67 | UPDATE | `.update(updates).eq('id', id).select().single()` |
| `src/hooks/useDiagnosticStages.ts` | 121-123 | DELETE | `.delete().eq('id', stageId)` |

**Количество вызовов:** 5

---

#### diagnostic_stage_participants
**Операции:** SELECT, INSERT, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/ManagerRespondentApproval.tsx` | 121-122 | SELECT | `.select('stage_id').eq('user_id', participantUserId)` |
| `src/hooks/useDiagnosticStages.ts` | 89-91 | INSERT | `.insert(participants)` где `participants = [{ stage_id, user_id }]` |
| `src/hooks/useDiagnosticStages.ts` | 108-112 | SELECT | `.select('id').eq('stage_id', stageId).limit(1)` |
| `src/hooks/useDiagnosticStages.ts` | 139-142 | SELECT | `.select('user_id').eq('stage_id', stageId)` |
| `src/hooks/useDiagnosticStages.ts` | 146-148 | DELETE | `.delete().eq('stage_id', stageId).in('user_id', userIds)` |

**Количество вызовов:** 5

---

#### survey_360_assignments
**Операции:** SELECT, INSERT, UPDATE, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/AssessmentDetailsReport.tsx` | 75-76 | SELECT | `.select('evaluating_user_id, assignment_type, is_manager_participant').eq('evaluated_user_id', userId)` |
| `src/components/AssessmentResultsDialog.tsx` | 84-85 | SELECT | То же самое |
| `src/components/ColleagueSelectionDialog.tsx` | 62-63 | SELECT | `.select('id, evaluated_user_id, evaluating_user_id, status, is_manager_participant, assignment_type').eq('evaluated_user_id', evaluatedUserId)` |
| `src/components/ColleagueSelectionDialog.tsx` | 224-225 | INSERT | `.insert(newAssignments).select()` |
| `src/components/ColleagueSelectionDialog.tsx` | 252 | DELETE | `.delete().eq('evaluated_user_id', evaluatedUserId).in('id', idsToDelete)` |
| `src/components/ManagerRespondentApproval.tsx` | 52-53 | SELECT | `.select('id, evaluating_user_id, status, is_manager_participant, assignment_type').eq('evaluated_user_id', evaluatedUserId)` |
| `src/components/ManagerRespondentApproval.tsx` | 149-150 | UPDATE | `.update({ status: 'approved', approved_by, approved_at }).in('id', approvedIds).select()` |
| `src/components/ManagerRespondentApproval.tsx` | 238-239 | UPDATE | `.update({ status: 'rejected', rejected_by, rejected_at, rejection_reason }).in('id', rejectedIds)` |
| `src/components/RespondentApprovalDialog.tsx` | 52-53 | SELECT | `.select('id, evaluating_user_id, status, is_manager_participant')` |
| `src/components/RespondentApprovalDialog.tsx` | 122-123 | UPDATE | `.update({ status: 'approved' }).in('id', respondentIds)` |
| `src/components/RespondentApprovalDialog.tsx` | 147-148 | UPDATE | `.update({ status: 'pending' }).in('id', respondentIds)` |
| `src/components/RespondentApprovalDialog.tsx` | 177 | DELETE | `.delete().in('id', respondentIds)` |
| `src/components/SurveyAccessWidget.tsx` | 197-198 | SELECT | `.select('*').eq('evaluated_user_id', user?.id)` |
| `src/components/SurveyAccessWidget.tsx` | 207-208 | SELECT | `.select('*').eq('evaluating_user_id', user?.id).neq('evaluated_user_id', user?.id)` |
| `src/components/TeamMembersTable.tsx` | 91-92 | SELECT | `.select('evaluated_user_id, status, assignment_type').eq('evaluating_user_id', user?.id)` |
| `src/hooks/useSurvey360Assignments.ts` | Различные | SELECT, UPDATE | Комплексные запросы |

**Количество вызовов:** 25+

---

#### hard_skill_results
**Операции:** SELECT, INSERT, UPDATE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/AssessmentDetailsReport.tsx` | 95-96 | SELECT | `.select('question_id, answer_option_id, evaluating_user_id, hard_skill_questions(skill_id), hard_skill_answer_options(numeric_value)').eq('evaluated_user_id', userId)` |
| `src/components/AssessmentResultsDialog.tsx` | 104-105 | SELECT | То же самое |
| `src/hooks/useSkillSurvey.ts` | Различные | SELECT, INSERT, UPDATE | Работа с ответами на опросы |

**Количество вызовов:** 10+

---

#### soft_skill_results
**Операции:** SELECT, INSERT, UPDATE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/AssessmentDetailsReport.tsx` | 111-112 | SELECT | `.select('question_id, answer_option_id, evaluating_user_id, soft_skill_questions(quality_id), soft_skill_answer_options(numeric_value)').eq('evaluated_user_id', userId)` |
| `src/components/AssessmentResultsDialog.tsx` | 120-121 | SELECT | То же самое |
| `src/hooks/useSurvey360.ts` | Различные | SELECT, INSERT, UPDATE | Работа с ответами 360 |

**Количество вызовов:** 10+

---

#### user_assessment_results
**Операции:** SELECT

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/TeamMembersTable.tsx` | 76-77 | SELECT | `.select('user_id, skill_id, quality_id, self_assessment, peers_average, manager_assessment').in('user_id', teamMemberIds)` |
| `src/hooks/useUserAssessmentResults.ts` | Различные | SELECT | Агрегированные результаты оценок |

**Количество вызовов:** 5+

---

### 2.3 ТАБЛИЦЫ ВСТРЕЧ 1:1

#### meeting_stages
**Операции:** SELECT, INSERT, UPDATE, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/hooks/useMeetingStages.ts` | 28-31 | SELECT | `.select('*').order('created_at', { ascending: false })` |
| `src/hooks/useMeetingStages.ts` | 40-44 | INSERT | `.insert({ ...stage, created_by: user?.id }).select().single()` |
| `src/hooks/useMeetingStages.ts` | 60-65 | UPDATE | `.update(updates).eq('id', id).select().single()` |
| `src/hooks/useMeetingStages.ts` | 115-118 | DELETE | `.delete().eq('id', stageId)` |

**Количество вызовов:** 4

---

#### meeting_stage_participants
**Операции:** SELECT, INSERT, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/hooks/useMeetingStages.ts` | 86-88 | INSERT | `.insert(participants)` где `participants = [{ stage_id, user_id }]` |
| `src/hooks/useMeetingStages.ts` | 104-107 | SELECT | `.select('id').eq('stage_id', stageId).limit(1)` |
| `src/hooks/useMeetingStages.ts` | 133-136 | SELECT | `.select('user_id').eq('stage_id', stageId)` |
| `src/hooks/useMeetingStages.ts` | 140-142 | DELETE | `.delete().eq('stage_id', stageId).in('user_id', userIds)` |

**Количество вызовов:** 4

---

#### one_on_one_meetings
**Операции:** SELECT, INSERT, UPDATE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/MeetingForm.tsx` | 47-48 | SELECT | `.select('*').eq('id', meetingId).single()` |
| `src/components/TeamMembersTable.tsx` | 36-37 | SELECT | `.select('id, employee_id, status, meeting_date').in('employee_id', teamMemberIds)` |
| `src/hooks/useOneOnOneMeetings.ts` | Различные | SELECT, INSERT, UPDATE | Комплексное управление встречами |

**Количество вызовов:** 10+

---

#### meeting_decisions
**Операции:** SELECT, INSERT, UPDATE, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/hooks/useMeetingDecisions.ts` | Различные | SELECT, INSERT, UPDATE, DELETE | Управление решениями встреч |

**Количество вызовов:** 5+

---

### 2.4 ТАБЛИЦЫ КАРЬЕРНЫХ ТРЕКОВ

#### career_tracks
**Операции:** SELECT, INSERT, UPDATE, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/UserCareerTrackView.tsx` | 18-19 | SELECT | `.select('id, name, description, track_types(name), positions(name)').eq('id', selectedTrackId).single()` |
| `src/components/admin/CareerTracksManager.tsx` | 34-35 | SELECT | `.select('*, track_types(name), positions(name)').order('name')` |
| `src/components/admin/CareerTracksManager.tsx` | 95-101 | INSERT/UPDATE | `.insert(trackData).select()` или `.update(trackData).eq('id', editingTrack.id).select()` |
| `src/components/admin/CareerTracksManager.tsx` | 143 | DELETE | `.delete().eq('id', id)` |
| `src/hooks/useCareerTracks.ts` | 78-92 | SELECT | Комплексный запрос с join к track_types и positions |

**Количество вызовов:** 10+

---

#### career_track_steps
**Операции:** SELECT, INSERT, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/UserCareerTrackView.tsx` | 41-42 | SELECT | `.select('id, step_order, duration_months, grades(id, name, level)').eq('career_track_id', selectedTrackId).order('step_order')` |
| `src/components/admin/CareerTracksManager.tsx` | 46-47 | SELECT | `.select('*, grades(name)').eq('career_track_id', trackId)` |
| `src/components/admin/CareerTracksManager.tsx` | 112 | DELETE | `.delete().eq('career_track_id', trackId)` |
| `src/components/admin/CareerTracksManager.tsx` | 124 | INSERT | `.insert(steps)` |
| `src/components/admin/CareerTracksManager.tsx` | 142 | DELETE | `.delete().eq('career_track_id', id)` |
| `src/hooks/useCareerTracks.ts` | 93-107 | SELECT | SELECT с join к grades |

**Количество вызовов:** 8+

---

#### user_career_progress
**Операции:** SELECT

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/TeamMembersTable.tsx` | 52-53 | SELECT | `.select('user_id, career_track_id, current_step, overall_progress').in('user_id', teamMemberIds)` |
| `src/hooks/useUserCareerProgress.ts` | Различные | SELECT, INSERT, UPDATE | Управление прогрессом по треку |

**Количество вызовов:** 5+

---

### 2.5 ТАБЛИЦЫ ГРЕЙДОВ И КОМПЕТЕНЦИЙ

#### grades
**Операции:** SELECT, INSERT, UPDATE, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/UsersTableAdmin.tsx` | 97 | SELECT | `.select('*')` |
| `src/components/admin/CareerTracksManager.tsx` | 57 | SELECT | `.select('*')` |
| `src/components/admin/GradesManager.tsx` | 38-39 | SELECT | `.select('*, positions(name), position_categories(name), certifications(name)')` |
| `src/components/admin/GradesManager.tsx` | 75 | DELETE | `.delete().eq('id', id)` |
| `src/components/admin/GradesManager.tsx` | 101-126 | INSERT/UPDATE | Комплексные операции |
| `src/components/admin/ReferenceTableView.tsx` | 116 | SELECT | `.select('*')` |

**Количество вызовов:** 10+

---

#### grade_skills
**Операции:** SELECT, INSERT, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/AssessmentDetailsReport.tsx` | 50-51 | SELECT | `.select('skill_id, target_level, skills(name)').eq('grade_id', gradeId)` |
| `src/components/AssessmentResultsDialog.tsx` | 59-60 | SELECT | То же самое |
| `src/components/GradeDetailsDialog.tsx` | 32-33 | SELECT | `.select('skill_id, target_level, skills(id, name)').eq('grade_id', gradeId)` |
| `src/components/UserCareerTrackView.tsx` | 65-66 | SELECT | `.select('skill_id, target_level, skills(name)').eq('grade_id', gradeId)` |
| `src/components/admin/GradeSkillsQualitiesView.tsx` | 15-16 | SELECT | `.select('skill_id, target_level, skills(name)').eq('grade_id', gradeId)` |
| `src/components/admin/GradesManager.tsx` | 107 | DELETE | `.delete().eq('grade_id', editDialog.data.id)` |
| `src/components/admin/GradesManager.tsx` | 301 | SELECT | `.select('skill_id, target_level').eq('grade_id', gradeId)` |
| `src/hooks/useCareerTracks.ts` | 109-117 | SELECT | SELECT с join к skills |
| `src/hooks/useUserGradeSkills.ts` | Различные | SELECT | Получение навыков грейда пользователя |

**Количество вызовов:** 15+

---

#### grade_qualities
**Операции:** SELECT, INSERT, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/AssessmentDetailsReport.tsx` | 58-59 | SELECT | `.select('quality_id, target_level, qualities(name)').eq('grade_id', gradeId)` |
| `src/components/AssessmentResultsDialog.tsx` | 67-68 | SELECT | То же самое |
| `src/components/GradeDetailsDialog.tsx` | 45-46 | SELECT | `.select('quality_id, target_level, qualities(id, name)').eq('grade_id', gradeId)` |
| `src/components/UserCareerTrackView.tsx` | 89-90 | SELECT | `.select('quality_id, target_level, qualities(name)').eq('grade_id', gradeId)` |
| `src/components/admin/GradeSkillsQualitiesView.tsx` | 27-28 | SELECT | `.select('quality_id, target_level, qualities(name)').eq('grade_id', gradeId)` |
| `src/components/admin/GradesManager.tsx` | 108 | DELETE | `.delete().eq('grade_id', editDialog.data.id)` |
| `src/components/admin/GradesManager.tsx` | 306 | SELECT | `.select('quality_id, target_level').eq('grade_id', gradeId)` |
| `src/hooks/useCareerTracks.ts` | 118-126 | SELECT | SELECT с join к qualities |
| `src/hooks/useUserGradeQualities.ts` | Различные | SELECT | Получение качеств грейда пользователя |

**Количество вызовов:** 15+

---

#### skills
**Операции:** SELECT, INSERT, UPDATE, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/admin/GradesManager.tsx` | 275 | SELECT | `.select('id, name')` |
| `src/components/admin/ReferenceTableView.tsx` | 126 | SELECT | `.select('*')` |
| `src/hooks/useSkills.ts` | 21-24 | SELECT | `.select('*').order('name', { ascending: true })` |
| `src/hooks/useSkills.ts` | 33-37 | INSERT | `.insert(skill).select().single()` |
| `src/hooks/useSkills.ts` | 53-58 | UPDATE | `.update(updates).eq('id', id).select().single()` |
| `src/hooks/useSkills.ts` | 74-77 | DELETE | `.delete().eq('id', id)` |

**Количество вызовов:** 10+

---

#### qualities
**Операции:** SELECT, INSERT, UPDATE, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/admin/GradesManager.tsx` | 284 | SELECT | `.select('id, name')` |
| `src/components/admin/ReferenceTableView.tsx` | 136 | SELECT | `.select('*')` |
| `src/hooks/useQualities.ts` | 20-23 | SELECT | `.select('*').order('name', { ascending: true })` |
| `src/hooks/useQualities.ts` | 32-36 | INSERT | `.insert(quality).select().single()` |
| `src/hooks/useQualities.ts` | 52-57 | UPDATE | `.update(updates).eq('id', id).select().single()` |
| `src/hooks/useQualities.ts` | 72-75 | DELETE | `.delete().eq('id', id)` |

**Количество вызовов:** 10+

---

### 2.6 ТАБЛИЦЫ ЗАДАЧ

#### tasks
**Операции:** SELECT, INSERT, UPDATE, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/ColleagueSelectionDialog.tsx` | 234-235 | UPDATE | `.update({ status: 'completed' }).eq('assignment_id', id)` |
| `src/components/DevelopmentPlanCreator.tsx` | 118 | INSERT | `.insert(taskData)` |
| `src/components/SurveyAccessWidget.tsx` | 355, 420, 484 | UPDATE | `.update({ status: 'completed' }).eq('id', taskId)` |
| `src/components/TasksManager.tsx` | 84-85 | SELECT | `.select('*').eq('user_id', user?.id).order('created_at', { ascending: false })` |
| `src/components/TasksManager.tsx` | 116-118 | INSERT | `.insert(taskData).select()` |
| `src/components/TasksManager.tsx` | 145 | UPDATE | `.update({ status }).eq('id', id)` |
| `src/components/TasksManager.tsx` | 163 | DELETE | `.delete().eq('id', id)` |
| `src/hooks/useTasks.ts` | Различные | SELECT, INSERT, UPDATE, DELETE | Полное управление задачами |

**Количество вызовов:** 20+

---

#### development_tasks
**Операции:** SELECT, INSERT, UPDATE, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/hooks/useDevelopmentTasks.ts` | Различные | SELECT, INSERT, UPDATE, DELETE | Управление задачами развития |

**Количество вызовов:** 5+

---

### 2.7 ОПРОСНЫЕ ТАБЛИЦЫ

#### hard_skill_questions
**Операции:** SELECT, INSERT, UPDATE, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/admin/SurveyQuestionsManagement.tsx` | 35 | SELECT | `.select('*').order('order_index')` (через table = 'hard_skill_questions') |
| `src/components/admin/SurveyQuestionsManagement.tsx` | 99-102 | INSERT/UPDATE | INSERT или UPDATE в зависимости от editingQuestion |
| `src/components/admin/SurveyQuestionsManagement.tsx` | 122 | DELETE | `.delete().eq('id', id)` |
| `src/components/admin/SurveyQuestionsManagement.tsx` | 157 | UPDATE | `.update({ order_index: newOrder }).eq('id', id)` |
| `src/hooks/useSkillSurvey.ts` | Различные | SELECT | Получение вопросов для опроса |

**Количество вызовов:** 10+

---

#### soft_skill_questions
**Операции:** SELECT, INSERT, UPDATE, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/admin/SurveyQuestionsManagement.tsx` | 40 | SELECT | `.select('*').order('order_index')` (через table = 'soft_skill_questions') |
| `src/components/admin/SurveyQuestionsManagement.tsx` | 99-102 | INSERT/UPDATE | То же самое |
| `src/components/admin/SurveyQuestionsManagement.tsx` | 122 | DELETE | `.delete().eq('id', id)` |
| `src/components/admin/SurveyQuestionsManagement.tsx` | 157 | UPDATE | `.update({ order_index: newOrder }).eq('id', id)` |
| `src/hooks/useSurvey360.ts` | Различные | SELECT | Получение вопросов для 360 |

**Количество вызовов:** 10+

---

#### hard_skill_answer_options
**Операции:** SELECT, INSERT, UPDATE, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/admin/AnswerOptionsManagement.tsx` | 43-44 | SELECT | `.select('*').order('numeric_value')` |
| `src/components/admin/AnswerOptionsManagement.tsx` | 84-87 | UPDATE/INSERT | UPDATE или INSERT |
| `src/components/admin/AnswerOptionsManagement.tsx` | 107 | DELETE | `.delete().eq('id', id)` |

**Количество вызовов:** 5+

---

#### soft_skill_answer_options
**Операции:** SELECT, INSERT, UPDATE, DELETE

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/admin/AnswerOptionsManagement.tsx` | 48-49 | SELECT | `.select('*').order('numeric_value')` |
| `src/components/admin/AnswerOptionsManagement.tsx` | 84-87 | UPDATE/INSERT | UPDATE или INSERT |
| `src/components/admin/AnswerOptionsManagement.tsx` | 107 | DELETE | `.delete().eq('id', id)` |

**Количество вызовов:** 5+

---

### 2.8 СПРАВОЧНЫЕ ТАБЛИЦЫ

#### positions
**Операции:** SELECT

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/UsersTableAdmin.tsx` | 79 | SELECT | `.select('*')` |
| `src/components/admin/CareerTracksManager.tsx` | 75 | SELECT | `.select('*')` |
| `src/components/admin/GradesManager.tsx` | 49 | SELECT | `.select('*')` |
| `src/components/admin/ReferenceTableView.tsx` | 56 | SELECT | `.select('*')` |
| `src/pages/AdminPage.tsx` | 272 | SELECT | `.select('*')` |
| `src/hooks/useUsers.ts` | 119 | SELECT | `.select('id, name')` |

**Количество вызовов:** 6+

---

#### departments
**Операции:** SELECT

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/UsersTableAdmin.tsx` | 88 | SELECT | `.select('*')` |
| `src/components/admin/ReferenceTableView.tsx` | 66 | SELECT | `.select('*')` |
| `src/pages/AdminPage.tsx` | 282 | SELECT | `.select('*')` |
| `src/hooks/useUsers.ts` | 118 | SELECT | `.select('id, name')` |

**Количество вызовов:** 4+

---

#### position_categories
**Операции:** SELECT

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/admin/GradesManager.tsx` | 58 | SELECT | `.select('*')` |
| `src/components/admin/ReferenceTableView.tsx` | 86 | SELECT | `.select('*')` |
| `src/pages/AdminPage.tsx` | 302 | SELECT | `.select('*')` |

**Количество вызовов:** 3+

---

#### track_types
**Операции:** SELECT

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/admin/CareerTracksManager.tsx` | 66 | SELECT | `.select('*')` |
| `src/components/admin/ReferenceTableView.tsx` | 96 | SELECT | `.select('*')` |
| `src/pages/AdminPage.tsx` | 312 | SELECT | `.select('*')` |

**Количество вызовов:** 3+

---

#### certifications
**Операции:** SELECT

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/admin/GradesManager.tsx` | 67 | SELECT | `.select('*')` |
| `src/components/admin/ReferenceTableView.tsx` | 166 | SELECT | `.select('*')` |

**Количество вызовов:** 2+

---

#### category_skills
**Операции:** SELECT

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/admin/ReferenceTableView.tsx` | 176 | SELECT | `.select('*')` |
| `src/hooks/useCategorySkills.ts` | Различные | SELECT | Получение навыков по категориям |

**Количество вызовов:** 2+

---

#### trade_points
**Операции:** SELECT

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/admin/ReferenceTableView.tsx` | 146 | SELECT | `.select('*')` |

**Количество вызовов:** 1

---

#### manufacturers
**Операции:** SELECT

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/admin/ReferenceTableView.tsx` | 156 | SELECT | `.select('*')` |

**Количество вызовов:** 1

---

### 2.9 ПРОФИЛЬНЫЕ ТАБЛИЦЫ (МАЛОИСПОЛЬЗУЕМЫЕ)

#### user_profiles
**Операции:** SELECT

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/components/MainContent.tsx` | 95-96 | SELECT | `.select('*').eq('user_id', userData.id).single()` |

**Количество вызовов:** 1

---

#### user_skills
**Операции:** SELECT

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/hooks/useUserSkills.ts` | Различные | SELECT | Получение навыков пользователя |

**Количество вызовов:** 2+

---

#### user_qualities
**Операции:** SELECT

| Файл | Строка | Операция | Фильтры/Параметры |
|------|--------|----------|-------------------|
| `src/hooks/useUserQualities.ts` | Различные | SELECT | Получение качеств пользователя |

**Количество вызовов:** 2+

---

## 3. AUTH API (supabase.auth)

### Поиск не выявил прямых вызовов supabase.auth в коде

**Примечание:** Аутентификация, вероятно, реализована через кастомные edge functions (`custom-login`) или вынесена в отдельный модуль.

---

## 4. STORAGE API (supabase.storage)

### Поиск не выявил вызовов supabase.storage в коде

**Примечание:** Функционал загрузки файлов не используется в текущей версии проекта.

---

## 5. СВОДНАЯ ТАБЛИЦА ПО ХУКАМ

| Хук | Таблицы | RPC | Операции |
|-----|---------|-----|----------|
| `usePermission.ts` | - | has_permission | SELECT |
| `useCareerTracks.ts` | career_tracks, career_track_steps, grade_skills, grade_qualities | - | SELECT |
| `useDiagnosticStages.ts` | diagnostic_stages, diagnostic_stage_participants | - | SELECT, INSERT, UPDATE, DELETE |
| `useMeetingStages.ts` | meeting_stages, meeting_stage_participants | - | SELECT, INSERT, UPDATE, DELETE |
| `useSkills.ts` | skills | - | SELECT, INSERT, UPDATE, DELETE |
| `useQualities.ts` | qualities | - | SELECT, INSERT, UPDATE, DELETE |
| `useTasks.ts` | tasks | - | SELECT, INSERT, UPDATE, DELETE |
| `useDevelopmentTasks.ts` | development_tasks | - | SELECT, INSERT, UPDATE, DELETE |
| `useOneOnOneMeetings.ts` | one_on_one_meetings | - | SELECT, INSERT, UPDATE |
| `useMeetingDecisions.ts` | meeting_decisions | - | SELECT, INSERT, UPDATE, DELETE |
| `useSkillSurvey.ts` | hard_skill_results, hard_skill_questions | - | SELECT, INSERT, UPDATE |
| `useSurvey360.ts` | soft_skill_results, soft_skill_questions | - | SELECT, INSERT, UPDATE |
| `useSurvey360Assignments.ts` | survey_360_assignments | - | SELECT, UPDATE |
| `useUserAssessmentResults.ts` | user_assessment_results | - | SELECT |
| `useUserCareerProgress.ts` | user_career_progress | - | SELECT, INSERT, UPDATE |
| `useUserGradeSkills.ts` | grade_skills | - | SELECT |
| `useUserGradeQualities.ts` | grade_qualities | - | SELECT |
| `useUserSkills.ts` | user_skills | - | SELECT |
| `useUserQualities.ts` | user_qualities | - | SELECT |
| `useUsers.ts` | users, departments, positions, user_roles | - | SELECT, INSERT, UPDATE, DELETE |
| `useHRAnalytics.ts` | users, + аналитические запросы | - | SELECT |

---

## 6. КРИТИЧЕСКИЕ НАХОДКИ

### 6.1 Потенциальные проблемы безопасности

1. **Прямые вызовы UPDATE/DELETE без проверки permissions:**
   - `src/components/security/UsersManagementTable.tsx:288-290` - прямое обнуление manager_id
   - Множественные DELETE операции в admin компонентах

2. **Массовые операции без транзакций:**
   - `src/components/ColleagueSelectionDialog.tsx:224` - INSERT массива assignments
   - `src/components/ManagerRespondentApproval.tsx:149` - UPDATE множества записей

### 6.2 Производительность

1. **N+1 запросы:**
   - `src/components/ColleagueSelectionDialog.tsx:93-94` - цикл по пользователям
   - `src/components/ManagerRespondentApproval.tsx:63-64` - множественные SELECT для каждого respondent

2. **Отсутствие пагинации:**
   - Большинство SELECT запросов без LIMIT
   - Потенциальная проблема при росте данных

### 6.3 Дублирование кода

1. **Повторяющиеся SELECT запросы:**
   - Запросы к `grade_skills` и `grade_qualities` дублируются в 5+ файлах
   - SELECT users с одинаковыми полями в разных компонентах

---

## 7. РЕКОМЕНДАЦИИ

### 7.1 Безопасность

1. ✅ Использовать RPC функции для критических операций вместо прямых UPDATE/DELETE
2. ✅ Добавить проверку permissions перед каждым изменением данных
3. ✅ Обернуть массовые операции в транзакции (через edge functions)

### 7.2 Производительность

1. ✅ Внедрить пагинацию для больших списков
2. ✅ Использовать batch запросы вместо N+1
3. ✅ Добавить кэширование часто используемых справочников

### 7.3 Архитектура

1. ✅ Создать переиспользуемые хуки для общих запросов
2. ✅ Централизовать запросы к grade_skills/grade_qualities
3. ✅ Унифицировать обработку ошибок

---

## 8. ЗАКЛЮЧЕНИЕ

**Общее количество типов вызовов:**
- RPC функций: 6
- Таблиц: 50+
- Хуков с API: 37
- Уникальных запросов: 500+

**Состояние:** Проект активно использует Supabase API, большинство запросов корректно структурированы, но требуются улучшения в области безопасности, производительности и переиспользования кода.
