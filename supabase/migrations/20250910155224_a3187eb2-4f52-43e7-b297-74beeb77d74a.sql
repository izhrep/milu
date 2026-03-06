-- Создаем тестовое назначение на самооценку навыков для пользователя Владимир Маршаков
-- Сначала найдем ID пользователя по email
DO $$
DECLARE
    user_id uuid;
BEGIN
    -- Ищем пользователя Владимир Маршаков
    SELECT id INTO user_id FROM users WHERE full_name = 'Владимир Маршаков' LIMIT 1;
    
    IF user_id IS NOT NULL THEN
        -- Создаем назначение на самооценку (evaluated_user_id = evaluating_user_id)
        INSERT INTO skill_survey_assignments (
            evaluated_user_id,
            evaluating_user_id,
            status
        ) VALUES (
            user_id,
            user_id,
            'отправлен запрос'
        ) ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Создано назначение на самооценку навыков для пользователя %', user_id;
    ELSE
        RAISE NOTICE 'Пользователь Владимир Маршаков не найден';
    END IF;
END $$;