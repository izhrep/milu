-- RLS политики для доступа руководителей к отчётам подчинённых

-- Политика для просмотра результатов навыков подчинённых
CREATE POLICY "Managers can view subordinate skill results"
ON skill_survey_results
FOR SELECT
USING (
  user_id = get_current_session_user() 
  OR evaluating_user_id = get_current_session_user() 
  OR is_current_user_admin() 
  OR is_manager_of_user(user_id)
);

-- Политика для просмотра результатов 360 подчинённых
CREATE POLICY "Managers can view subordinate 360 results"
ON survey_360_results
FOR SELECT
USING (
  evaluated_user_id = get_current_session_user() 
  OR evaluating_user_id = get_current_session_user() 
  OR is_current_user_admin() 
  OR is_manager_of_user(evaluated_user_id)
);