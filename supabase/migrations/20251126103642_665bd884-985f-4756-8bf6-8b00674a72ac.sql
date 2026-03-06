-- Создаем триггер для автоматического создания задач при добавлении участника в диагностику
-- Триггер вызывается ПОСЛЕ assign_surveys_to_diagnostic_participant_trigger (порядок по алфавиту)
DROP TRIGGER IF EXISTS create_diagnostic_task_for_participant_trigger ON public.diagnostic_stage_participants;

CREATE TRIGGER create_diagnostic_task_for_participant_trigger
  AFTER INSERT ON public.diagnostic_stage_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_diagnostic_task_for_participant();