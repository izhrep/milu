-- Add grade_id column to users table
ALTER TABLE public.users 
ADD COLUMN grade_id uuid REFERENCES public.grades(id);

-- Add index for better performance
CREATE INDEX idx_users_grade_id ON public.users(grade_id);

-- Update existing users to have a default grade if needed
-- (You can set a specific default grade or leave as NULL for now)