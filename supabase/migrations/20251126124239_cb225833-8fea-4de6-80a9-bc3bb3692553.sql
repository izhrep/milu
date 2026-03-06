-- Add question_type column to answer_categories table
ALTER TABLE answer_categories 
ADD COLUMN question_type text CHECK (question_type IN ('hard', 'soft', 'both')) DEFAULT 'both';

-- Add index for better query performance
CREATE INDEX idx_answer_categories_question_type ON answer_categories(question_type);

COMMENT ON COLUMN answer_categories.question_type IS 'Type of questions this category applies to: hard (Hard Skills), soft (Soft Skills), or both';