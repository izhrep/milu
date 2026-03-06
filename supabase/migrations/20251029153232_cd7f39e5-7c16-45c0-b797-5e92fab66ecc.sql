-- Create category_skills table
CREATE TABLE IF NOT EXISTS category_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on category_skills
ALTER TABLE category_skills ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for category_skills
CREATE POLICY "Public can view category_skills"
  ON category_skills FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage category_skills"
  ON category_skills FOR ALL
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- Migrate existing skill categories to category_skills table
INSERT INTO category_skills (name)
SELECT DISTINCT category
FROM skills
WHERE category IS NOT NULL AND category != ''
ON CONFLICT (name) DO NOTHING;

-- Add category_id column to skills
ALTER TABLE skills ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES category_skills(id);

-- Migrate data from skills.category to skills.category_id
UPDATE skills s
SET category_id = cs.id
FROM category_skills cs
WHERE s.category = cs.name;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_skills_category_id ON skills(category_id);

-- Drop old certification column from grades
ALTER TABLE grades DROP COLUMN IF EXISTS certification;

-- Drop old category and behavioral_indicators columns from qualities
ALTER TABLE qualities DROP COLUMN IF EXISTS category;
ALTER TABLE qualities DROP COLUMN IF EXISTS behavioral_indicators;

-- Drop old category column from skills
ALTER TABLE skills DROP COLUMN IF EXISTS category;