-- Create skill survey answer options table
CREATE TABLE IF NOT EXISTS skill_survey_answer_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE skill_survey_answer_options ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow skill_survey_answer_options operations for admin panel" 
ON skill_survey_answer_options 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Insert test answer options
INSERT INTO skill_survey_answer_options (step, title, description) VALUES
(1, 'Начинающий', 'Базовые знания, требуется постоянная поддержка'),
(2, 'Развивающийся', 'Может выполнять задачи с периодической поддержкой'),
(3, 'Опытный', 'Самостоятельно выполняет большинство задач'),
(4, 'Продвинутый', 'Выполняет сложные задачи, может обучать других'),
(5, 'Эксперт', 'Максимальный уровень экспертизы, лидер в области')
ON CONFLICT DO NOTHING;

-- Add some test skill survey questions if none exist
INSERT INTO skill_survey_questions (skill_id, question_text, order_index) 
SELECT 
  s.id as skill_id,
  'Оцените уровень навыка "' || s.name || '"' as question_text,
  1 as order_index
FROM skills s
WHERE NOT EXISTS (
  SELECT 1 FROM skill_survey_questions ssq WHERE ssq.skill_id = s.id
)
LIMIT 5;