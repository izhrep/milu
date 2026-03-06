-- Add certification_id column to grades table to reference certifications
ALTER TABLE grades ADD COLUMN IF NOT EXISTS certification_id UUID REFERENCES certifications(id);

-- Migrate existing text data if needed (optional, for data preservation)
-- Update certification_id based on existing certification text field if there are matches
-- UPDATE grades g
-- SET certification_id = c.id
-- FROM certifications c
-- WHERE g.certification = c.name;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_grades_certification_id ON grades(certification_id);