
-- =====================================================
-- АУДИТ И ОПТИМИЗАЦИЯ МОДУЛЯ "КАРЬЕРНЫЙ ТРЕК"
-- =====================================================

-- ============ 1. ДОБАВЛЕНИЕ НЕДОСТАЮЩИХ ИНДЕКСОВ ============

-- Индексы для быстрого поиска по позициям и грейдам
CREATE INDEX IF NOT EXISTS idx_grades_position ON public.grades(position_id);
CREATE INDEX IF NOT EXISTS idx_grades_position_category ON public.grades(position_category_id);
CREATE INDEX IF NOT EXISTS idx_grades_level ON public.grades(level);

-- Индексы для карьерных треков
CREATE INDEX IF NOT EXISTS idx_career_tracks_target_position ON public.career_tracks(target_position_id);
CREATE INDEX IF NOT EXISTS idx_career_tracks_track_type ON public.career_tracks(track_type_id);

-- Индексы для development_tasks (для быстрого подбора задач)
CREATE INDEX IF NOT EXISTS idx_dev_tasks_skill ON public.development_tasks(skill_id) WHERE skill_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dev_tasks_quality ON public.development_tasks(quality_id) WHERE quality_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dev_tasks_level ON public.development_tasks(competency_level_id);
CREATE INDEX IF NOT EXISTS idx_dev_tasks_composite ON public.development_tasks(skill_id, quality_id, competency_level_id);

-- Индексы для grade_skills и grade_qualities (для gap-анализа)
CREATE INDEX IF NOT EXISTS idx_grade_skills_grade ON public.grade_skills(grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_skills_skill ON public.grade_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_grade_qualities_grade ON public.grade_qualities(grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_qualities_quality ON public.grade_qualities(quality_id);

-- Индексы для users (карьерные поля)
CREATE INDEX IF NOT EXISTS idx_users_position ON public.users(position_id) WHERE position_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_grade ON public.users(grade_id) WHERE grade_id IS NOT NULL;

-- Индексы для user_career_progress
CREATE INDEX IF NOT EXISTS idx_user_career_progress_user ON public.user_career_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_career_progress_track ON public.user_career_progress(career_track_id);
CREATE INDEX IF NOT EXISTS idx_user_career_progress_status ON public.user_career_progress(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_career_progress_active ON public.user_career_progress(user_id) WHERE status = 'active';

COMMENT ON INDEX idx_user_career_progress_active IS 'Быстрый поиск активного трека пользователя';

-- ============ 2. СОЗДАНИЕ ФУНКЦИИ GAP-АНАЛИЗА ============

CREATE OR REPLACE FUNCTION public.calculate_career_gap(
  p_user_id UUID,
  p_grade_id UUID
)
RETURNS TABLE(
  competency_type TEXT,
  competency_id UUID,
  competency_name TEXT,
  current_level NUMERIC,
  target_level NUMERIC,
  gap NUMERIC,
  is_ready BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Возвращаем gap-анализ по навыкам
  RETURN QUERY
  SELECT 
    'skill'::TEXT as competency_type,
    gs.skill_id as competency_id,
    s.name as competency_name,
    COALESCE(uar.self_assessment, 0) as current_level,
    gs.target_level,
    (gs.target_level - COALESCE(uar.self_assessment, 0)) as gap,
    (COALESCE(uar.self_assessment, 0) >= gs.target_level) as is_ready
  FROM grade_skills gs
  JOIN skills s ON s.id = gs.skill_id
  LEFT JOIN (
    SELECT skill_id, AVG(self_assessment) as self_assessment
    FROM user_assessment_results
    WHERE user_id = p_user_id AND skill_id IS NOT NULL
    GROUP BY skill_id
  ) uar ON uar.skill_id = gs.skill_id
  WHERE gs.grade_id = p_grade_id;

  -- Возвращаем gap-анализ по качествам
  RETURN QUERY
  SELECT 
    'quality'::TEXT as competency_type,
    gq.quality_id as competency_id,
    q.name as competency_name,
    COALESCE(uar.self_assessment, 0) as current_level,
    gq.target_level,
    (gq.target_level - COALESCE(uar.self_assessment, 0)) as gap,
    (COALESCE(uar.self_assessment, 0) >= gq.target_level) as is_ready
  FROM grade_qualities gq
  JOIN qualities q ON q.id = gq.quality_id
  LEFT JOIN (
    SELECT quality_id, AVG(self_assessment) as self_assessment
    FROM user_assessment_results
    WHERE user_id = p_user_id AND quality_id IS NOT NULL
    GROUP BY quality_id
  ) uar ON uar.quality_id = gq.quality_id
  WHERE gq.grade_id = p_grade_id;
END;
$function$;

COMMENT ON FUNCTION public.calculate_career_gap(UUID, UUID) IS 
'Вычисляет gap между текущими компетенциями пользователя и требованиями грейда';

-- ============ 3. ФУНКЦИЯ ПОДБОРА КАРЬЕРНЫХ ТРЕКОВ ============

CREATE OR REPLACE FUNCTION public.recommend_career_tracks(
  p_user_id UUID,
  p_limit INT DEFAULT 5
)
RETURNS TABLE(
  track_id UUID,
  track_name TEXT,
  track_type_name TEXT,
  target_position_name TEXT,
  compatibility_score NUMERIC,
  total_gap NUMERIC,
  steps_count INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_position_id UUID;
  v_user_grade_id UUID;
BEGIN
  -- Получаем текущую позицию и грейд пользователя
  SELECT position_id, grade_id 
  INTO v_user_position_id, v_user_grade_id
  FROM users 
  WHERE id = p_user_id;

  -- Подбираем треки на основе позиции и грейда
  RETURN QUERY
  WITH track_stats AS (
    SELECT 
      ct.id as track_id,
      ct.name as track_name,
      tt.name as track_type_name,
      p.name as target_position_name,
      COUNT(cts.id) as steps_count,
      -- Скор совместимости на основе совпадения позиции и наличия шагов
      (
        CASE 
          WHEN ct.target_position_id = v_user_position_id THEN 50
          ELSE 20
        END +
        CASE 
          WHEN COUNT(cts.id) > 0 THEN 30
          ELSE 0
        END
      )::NUMERIC as compatibility_score
    FROM career_tracks ct
    LEFT JOIN track_types tt ON tt.id = ct.track_type_id
    LEFT JOIN positions p ON p.id = ct.target_position_id
    LEFT JOIN career_track_steps cts ON cts.career_track_id = ct.id
    GROUP BY ct.id, ct.name, tt.name, p.name, ct.target_position_id
    HAVING COUNT(cts.id) > 0 -- Только треки с шагами
  ),
  track_gaps AS (
    SELECT 
      ts.track_id,
      ts.track_name,
      ts.track_type_name,
      ts.target_position_name,
      ts.compatibility_score,
      ts.steps_count,
      -- Вычисляем суммарный gap по всем шагам трека
      COALESCE(SUM(ABS(gap_data.gap)), 0) as total_gap
    FROM track_stats ts
    LEFT JOIN career_track_steps cts ON cts.career_track_id = ts.track_id
    LEFT JOIN LATERAL (
      SELECT SUM(ABS(gap)) as gap
      FROM calculate_career_gap(p_user_id, cts.grade_id)
    ) gap_data ON true
    GROUP BY ts.track_id, ts.track_name, ts.track_type_name, ts.target_position_name, 
             ts.compatibility_score, ts.steps_count
  )
  SELECT 
    tg.track_id,
    tg.track_name,
    tg.track_type_name,
    tg.target_position_name,
    tg.compatibility_score,
    tg.total_gap,
    tg.steps_count
  FROM track_gaps tg
  ORDER BY 
    tg.compatibility_score DESC,
    tg.total_gap ASC
  LIMIT p_limit;
END;
$function$;

COMMENT ON FUNCTION public.recommend_career_tracks(UUID, INT) IS 
'Рекомендует карьерные треки для пользователя на основе позиции, грейда и gap-анализа';

-- ============ 4. ФУНКЦИЯ ГЕНЕРАЦИИ РЕКОМЕНДОВАННЫХ ЗАДАЧ ============

CREATE OR REPLACE FUNCTION public.get_recommended_development_tasks(
  p_user_id UUID,
  p_grade_id UUID,
  p_limit INT DEFAULT 10
)
RETURNS TABLE(
  task_id UUID,
  task_name TEXT,
  task_goal TEXT,
  how_to TEXT,
  measurable_result TEXT,
  task_order INT,
  competency_type TEXT,
  competency_id UUID,
  competency_name TEXT,
  current_level NUMERIC,
  target_level NUMERIC,
  gap NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH gaps AS (
    SELECT * FROM calculate_career_gap(p_user_id, p_grade_id)
    WHERE gap > 0 -- Только где есть отставание
    ORDER BY gap DESC
  )
  SELECT 
    dt.id as task_id,
    dt.task_name,
    dt.task_goal,
    dt.how_to,
    dt.measurable_result,
    dt.task_order,
    g.competency_type,
    g.competency_id,
    g.competency_name,
    g.current_level,
    g.target_level,
    g.gap
  FROM gaps g
  LEFT JOIN LATERAL (
    SELECT *
    FROM development_tasks dt
    WHERE (
      (g.competency_type = 'skill' AND dt.skill_id = g.competency_id) OR
      (g.competency_type = 'quality' AND dt.quality_id = g.competency_id)
    )
    ORDER BY dt.task_order
    LIMIT 2 -- По 2 задачи на каждую компетенцию
  ) dt ON true
  WHERE dt.id IS NOT NULL
  ORDER BY g.gap DESC, dt.task_order
  LIMIT p_limit;
END;
$function$;

COMMENT ON FUNCTION public.get_recommended_development_tasks(UUID, UUID, INT) IS 
'Возвращает рекомендованные задачи развития на основе gap-анализа';

-- ============ 5. ФУНКЦИЯ ПРОВЕРКИ КОНСИСТЕНТНОСТИ ДАННЫХ ============

CREATE OR REPLACE FUNCTION public.check_career_data_consistency()
RETURNS TABLE(check_name TEXT, status TEXT, details JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Проверка 1: Треки без шагов
  RETURN QUERY
  SELECT 
    'tracks_without_steps'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'tracks', (
        SELECT jsonb_agg(jsonb_build_object(
          'track_id', ct.id,
          'track_name', ct.name
        ))
        FROM career_tracks ct
        WHERE NOT EXISTS (
          SELECT 1 FROM career_track_steps WHERE career_track_id = ct.id
        )
      )
    )
  FROM career_tracks ct
  WHERE NOT EXISTS (
    SELECT 1 FROM career_track_steps WHERE career_track_id = ct.id
  );

  -- Проверка 2: Грейды без навыков или качеств
  RETURN QUERY
  SELECT 
    'grades_without_competencies'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'grades', (
        SELECT jsonb_agg(jsonb_build_object(
          'grade_id', g.id,
          'grade_name', g.name,
          'has_skills', (SELECT COUNT(*) FROM grade_skills WHERE grade_id = g.id) > 0,
          'has_qualities', (SELECT COUNT(*) FROM grade_qualities WHERE grade_id = g.id) > 0
        ))
        FROM grades g
        WHERE NOT EXISTS (SELECT 1 FROM grade_skills WHERE grade_id = g.id)
           OR NOT EXISTS (SELECT 1 FROM grade_qualities WHERE grade_id = g.id)
      )
    )
  FROM grades g
  WHERE NOT EXISTS (SELECT 1 FROM grade_skills WHERE grade_id = g.id)
     OR NOT EXISTS (SELECT 1 FROM grade_qualities WHERE grade_id = g.id);

  -- Проверка 3: Шаги трека с некорректным порядком
  RETURN QUERY
  SELECT 
    'invalid_step_order'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERROR' END::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'steps', (
        SELECT jsonb_agg(jsonb_build_object(
          'step_id', cts.id,
          'track_id', cts.career_track_id,
          'step_order', cts.step_order
        ))
        FROM career_track_steps cts
        WHERE cts.step_order < 1
      )
    )
  FROM career_track_steps cts
  WHERE cts.step_order < 1;

  -- Проверка 4: Пользователи с активным прогрессом по несуществующим трекам
  RETURN QUERY
  SELECT 
    'progress_invalid_tracks'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERROR' END::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'progress', (
        SELECT jsonb_agg(jsonb_build_object(
          'progress_id', ucp.id,
          'user_id', ucp.user_id,
          'track_id', ucp.career_track_id
        ))
        FROM user_career_progress ucp
        WHERE ucp.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM career_tracks WHERE id = ucp.career_track_id
          )
      )
    )
  FROM user_career_progress ucp
  WHERE ucp.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM career_tracks WHERE id = ucp.career_track_id
    );

  -- Проверка 5: Development tasks без связи с компетенциями
  RETURN QUERY
  SELECT 
    'tasks_without_competencies'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'tasks', (
        SELECT jsonb_agg(jsonb_build_object(
          'task_id', dt.id,
          'task_name', dt.task_name
        ))
        FROM development_tasks dt
        WHERE dt.skill_id IS NULL AND dt.quality_id IS NULL
      )
    )
  FROM development_tasks dt
  WHERE dt.skill_id IS NULL AND dt.quality_id IS NULL;
END;
$function$;

COMMENT ON FUNCTION public.check_career_data_consistency() IS 
'Проверяет консистентность данных модуля карьерных треков';

-- ============ 6. ОБНОВЛЕНИЕ RLS ПОЛИТИК ============

-- Политики для user_career_progress (если их ещё нет)
DROP POLICY IF EXISTS "Users can view their own progress" ON public.user_career_progress;
DROP POLICY IF EXISTS "Users can manage their own progress" ON public.user_career_progress;
DROP POLICY IF EXISTS "Managers can view team progress" ON public.user_career_progress;
DROP POLICY IF EXISTS "HR can view all progress" ON public.user_career_progress;

CREATE POLICY "Users can view their own progress"
  ON public.user_career_progress
  FOR SELECT
  USING (user_id = get_current_session_user());

CREATE POLICY "Users can manage their own progress"
  ON public.user_career_progress
  FOR ALL
  USING (user_id = get_current_session_user())
  WITH CHECK (user_id = get_current_session_user());

CREATE POLICY "Managers can view team progress"
  ON public.user_career_progress
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = user_career_progress.user_id
        AND users.manager_id = get_current_session_user()
    )
  );

CREATE POLICY "HR can view all progress"
  ON public.user_career_progress
  FOR SELECT
  USING (is_current_user_hr());

CREATE POLICY "Admins can manage all progress"
  ON public.user_career_progress
  FOR ALL
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- ============ 7. ТРИГГЕРЫ ДЛЯ АВТОМАТИЗАЦИИ ============

-- Триггер для updated_at на user_career_progress
DROP TRIGGER IF EXISTS update_user_career_progress_updated_at ON public.user_career_progress;
CREATE TRIGGER update_user_career_progress_updated_at
  BEFORE UPDATE ON public.user_career_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============ 8. КОММЕНТАРИИ К ТАБЛИЦАМ ============

COMMENT ON TABLE public.career_tracks IS 'Карьерные треки: последовательности грейдов для развития';
COMMENT ON TABLE public.career_track_steps IS 'Шаги карьерного трека: связь трека с конкретными грейдами';
COMMENT ON TABLE public.user_career_progress IS 'Прогресс пользователя по карьерному треку';
COMMENT ON TABLE public.development_tasks IS 'Библиотека задач для развития компетенций';
COMMENT ON TABLE public.grade_skills IS 'Требования по навыкам для каждого грейда';
COMMENT ON TABLE public.grade_qualities IS 'Требования по качествам для каждого грейда';

-- ============ 9. ВАЛИДАЦИЯ ДАННЫХ ============

-- Проверяем, что у каждого шага трека есть грейд
ALTER TABLE public.career_track_steps
  ALTER COLUMN grade_id SET NOT NULL;

-- Проверяем, что у каждого шага есть порядковый номер >= 1
ALTER TABLE public.career_track_steps
  DROP CONSTRAINT IF EXISTS check_step_order_positive;
ALTER TABLE public.career_track_steps
  ADD CONSTRAINT check_step_order_positive CHECK (step_order >= 1);

-- Проверяем, что target_level в grade_skills положительный
ALTER TABLE public.grade_skills
  DROP CONSTRAINT IF EXISTS check_target_level_positive;
ALTER TABLE public.grade_skills
  ADD CONSTRAINT check_target_level_positive CHECK (target_level > 0);

-- Проверяем, что target_level в grade_qualities положительный
ALTER TABLE public.grade_qualities
  DROP CONSTRAINT IF EXISTS check_target_level_positive;
ALTER TABLE public.grade_qualities
  ADD CONSTRAINT check_target_level_positive CHECK (target_level > 0);
