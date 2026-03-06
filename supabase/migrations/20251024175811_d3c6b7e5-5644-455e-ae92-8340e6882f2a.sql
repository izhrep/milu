-- Удалить всех пользователей кроме администратора
-- Сначала удаляем связанные записи

-- Удаляем записи из audit_log
DELETE FROM public.audit_log 
WHERE target_user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df' 
   OR admin_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';

-- Удаляем записи из user_roles
DELETE FROM public.user_roles 
WHERE user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';

-- Удаляем записи из других таблиц с foreign keys к users
DELETE FROM public.tasks WHERE user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
DELETE FROM public.one_on_one_meetings 
WHERE employee_id != '9138f9ee-ca94-4563-9016-05e5d2b496df' 
  AND manager_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
DELETE FROM public.meeting_stage_participants WHERE user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
DELETE FROM public.survey_360_results WHERE evaluated_user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
DELETE FROM public.survey_360_assignments WHERE evaluated_user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
DELETE FROM public.survey_360_selections WHERE selector_user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
DELETE FROM public.skill_survey_results WHERE user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
DELETE FROM public.skill_survey_assignments WHERE evaluated_user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
DELETE FROM public.development_plans WHERE user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';
DELETE FROM public.survey_assignments WHERE user_id != '9138f9ee-ca94-4563-9016-05e5d2b496df';

-- Теперь удаляем самих пользователей
DELETE FROM public.users 
WHERE id != '9138f9ee-ca94-4563-9016-05e5d2b496df';