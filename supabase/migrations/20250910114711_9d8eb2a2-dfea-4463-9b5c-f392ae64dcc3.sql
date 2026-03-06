-- Create skill survey answer options table if it doesn't exist
CREATE TABLE IF NOT EXISTS skill_survey_answer_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class 
    WHERE relname = 'skill_survey_answer_options' 
    AND relrowsecurity = true
  ) THEN
    ALTER TABLE skill_survey_answer_options ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create RLS policy only if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'skill_survey_answer_options' 
    AND policyname = 'Allow skill_survey_answer_options operations for admin panel'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow skill_survey_answer_options operations for admin panel" 
             ON skill_survey_answer_options 
             FOR ALL 
             USING (true) 
             WITH CHECK (true)';
  END IF;
END $$;

-- Insert test answer options
INSERT INTO skill_survey_answer_options (step, title, description) VALUES
(1, 'Начинающий', 'Базовые знания, требуется постоянная поддержка'),
(2, 'Развивающийся', 'Может выполнять задачи с периодической поддержкой'),
(3, 'Опытный', 'Самостоятельно выполняет большинство задач'),
(4, 'Продвинутый', 'Выполняет сложные задачи, может обучать других'),
(5, 'Эксперт', 'Максимальный уровень экспертизы, лидер в области')
ON CONFLICT DO NOTHING;