-- Create category_soft_skills table
CREATE TABLE IF NOT EXISTS public.category_soft_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add category_id to soft_skills table
ALTER TABLE public.soft_skills
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.category_soft_skills(id) ON DELETE SET NULL;

-- Enable RLS on category_soft_skills
ALTER TABLE public.category_soft_skills ENABLE ROW LEVEL SECURITY;

-- Create policies for category_soft_skills
CREATE POLICY "Anyone can view category_soft_skills"
ON public.category_soft_skills
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert category_soft_skills"
ON public.category_soft_skills
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update category_soft_skills"
ON public.category_soft_skills
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete category_soft_skills"
ON public.category_soft_skills
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_category_soft_skills_updated_at
BEFORE UPDATE ON public.category_soft_skills
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_category_soft_skills_name ON public.category_soft_skills(name);
CREATE INDEX IF NOT EXISTS idx_soft_skills_category_id ON public.soft_skills(category_id);