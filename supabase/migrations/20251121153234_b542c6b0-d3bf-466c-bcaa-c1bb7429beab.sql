-- Create development plan tasks table
CREATE TABLE IF NOT EXISTS public.development_plan_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  
  -- Competency references
  hard_skill_id UUID REFERENCES public.hard_skills(id) ON DELETE SET NULL,
  soft_skill_id UUID REFERENCES public.soft_skills(id) ON DELETE SET NULL,
  
  -- Task details
  title TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  goal TEXT NOT NULL,
  how_to TEXT NOT NULL,
  measurable_result TEXT NOT NULL,
  
  -- Career track context
  career_track_id UUID REFERENCES public.career_tracks(id) ON DELETE SET NULL,
  career_track_step_id UUID REFERENCES public.career_track_steps(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.development_plan_tasks ENABLE ROW LEVEL SECURITY;

-- Users can view their own development plan tasks
CREATE POLICY "Users can view own development plan tasks"
ON public.development_plan_tasks
FOR SELECT
USING (
  user_id = auth.uid() OR 
  has_permission('development.view_all')
);

-- Users can create their own development plan tasks
CREATE POLICY "Users can create own development plan tasks"
ON public.development_plan_tasks
FOR INSERT
WITH CHECK (
  user_id = auth.uid() OR 
  has_permission('development.manage')
);

-- Users can update their own development plan tasks
CREATE POLICY "Users can update own development plan tasks"
ON public.development_plan_tasks
FOR UPDATE
USING (
  user_id = auth.uid() OR 
  has_permission('development.manage')
);

-- Users can delete their own development plan tasks
CREATE POLICY "Users can delete own development plan tasks"
ON public.development_plan_tasks
FOR DELETE
USING (
  user_id = auth.uid() OR 
  has_permission('development.manage')
);

-- Create updated_at trigger
CREATE TRIGGER update_development_plan_tasks_updated_at
BEFORE UPDATE ON public.development_plan_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_development_plan_tasks_user_id ON public.development_plan_tasks(user_id);
CREATE INDEX idx_development_plan_tasks_task_id ON public.development_plan_tasks(task_id);
CREATE INDEX idx_development_plan_tasks_career_track ON public.development_plan_tasks(career_track_id, career_track_step_id);