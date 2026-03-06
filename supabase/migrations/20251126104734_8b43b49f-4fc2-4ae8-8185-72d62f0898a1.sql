-- Создаём задачи peer_selection для всех существующих участников диагностики, у которых их нет
INSERT INTO public.tasks (
  user_id,
  diagnostic_stage_id,
  assignment_id,
  assignment_type,
  title,
  description,
  status,
  deadline,
  task_type,
  category
)
SELECT 
  dsp.user_id,
  dsp.stage_id,
  sa.id as assignment_id,
  'self' as assignment_type,
  'Выбрать оценивающих' as title,
  'Выберите коллег для проведения оценки 360. Срок: ' || ps.deadline_date::text as description,
  'pending' as status,
  ps.deadline_date,
  'peer_selection' as task_type,
  'assessment' as category
FROM public.diagnostic_stage_participants dsp
JOIN public.diagnostic_stages ds ON ds.id = dsp.stage_id
JOIN public.parent_stages ps ON ps.id = ds.parent_id
JOIN public.survey_360_assignments sa ON sa.evaluated_user_id = dsp.user_id 
  AND sa.evaluating_user_id = dsp.user_id 
  AND sa.diagnostic_stage_id = dsp.stage_id
  AND sa.assignment_type = 'self'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tasks t
  WHERE t.user_id = dsp.user_id
    AND t.diagnostic_stage_id = dsp.stage_id
    AND t.task_type = 'peer_selection'
)
AND ds.is_active = true;