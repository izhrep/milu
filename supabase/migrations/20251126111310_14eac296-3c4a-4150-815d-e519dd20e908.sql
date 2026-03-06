
-- Удаляем старый триггер
DROP TRIGGER IF EXISTS create_diagnostic_task_for_participant_trigger ON public.diagnostic_stage_participants;

-- Создаём триггер заново
CREATE TRIGGER create_diagnostic_task_for_participant_trigger
  AFTER INSERT ON public.diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_diagnostic_task_for_participant();

-- Создаём недостающие peer_selection задачи для существующих участников
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
  sa.id,
  'self',
  'Выбрать оценивающих',
  'Выберите коллег для проведения оценки 360. Срок: ' || COALESCE(ps.deadline_date::text, 'не указан'),
  'pending',
  ps.deadline_date,
  'peer_selection',
  'assessment'
FROM public.diagnostic_stage_participants dsp
JOIN public.survey_360_assignments sa ON sa.evaluated_user_id = dsp.user_id 
  AND sa.evaluating_user_id = dsp.user_id
  AND sa.diagnostic_stage_id = dsp.stage_id
  AND sa.assignment_type = 'self'
JOIN public.diagnostic_stages ds ON ds.id = dsp.stage_id
LEFT JOIN public.parent_stages ps ON ps.id = ds.parent_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.tasks t
  WHERE t.user_id = dsp.user_id
    AND t.diagnostic_stage_id = dsp.stage_id
    AND t.task_type = 'peer_selection'
);
