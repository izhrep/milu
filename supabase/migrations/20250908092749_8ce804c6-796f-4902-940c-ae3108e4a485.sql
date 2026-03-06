-- Create additional tables based on the career development glossary

-- Development Plan Tasks table for individual career development
CREATE TABLE public.development_plan_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  development_plan_id UUID REFERENCES public.development_plans(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('kpi_performance', 'hard_skill', 'soft_skill', 'out_of_process')),
  title TEXT NOT NULL,
  description TEXT,
  target_skill_id UUID REFERENCES public.skills(id),
  target_quality_id UUID REFERENCES public.qualities(id),
  target_level NUMERIC,
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completion_evidence TEXT,
  status TEXT NOT NULL DEFAULT 'Активная'::text CHECK (status IN ('Активная', 'Выполнена', 'Отменена', 'Просрочена')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.development_plan_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for development_plan_tasks
CREATE POLICY "Admins can manage development_plan_tasks"
ON public.development_plan_tasks
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Training Plans table for structured learning sequences
CREATE TABLE public.training_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  target_grade_id UUID REFERENCES public.grades(id),
  target_position_id UUID REFERENCES public.positions(id),
  sequence_order INTEGER NOT NULL DEFAULT 1,
  duration_days INTEGER,
  status TEXT NOT NULL DEFAULT 'Активный'::text,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;

-- Create policies for training_plans
CREATE POLICY "Admins can manage training_plans"
ON public.training_plans
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Training Plan Steps for individual training modules
CREATE TABLE public.training_plan_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_plan_id UUID NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('course', 'test', 'certification', 'workshop', 'practical')),
  title TEXT NOT NULL,
  description TEXT,
  content_url TEXT,
  duration_hours INTEGER,
  passing_score INTEGER,
  required_for_completion BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_plan_steps ENABLE ROW LEVEL SECURITY;

-- Create policies for training_plan_steps
CREATE POLICY "Admins can manage training_plan_steps"
ON public.training_plan_steps
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- User Training Progress for tracking individual progress
CREATE TABLE public.user_training_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  training_plan_id UUID NOT NULL REFERENCES public.training_plans(id),
  training_step_id UUID NOT NULL REFERENCES public.training_plan_steps(id),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  score INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, training_step_id)
);

-- Enable RLS
ALTER TABLE public.user_training_progress ENABLE ROW LEVEL SECURITY;

-- Create policies for user_training_progress
CREATE POLICY "Admins can manage user_training_progress"
ON public.user_training_progress
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- User Skill Assessments for tracking current skill levels
CREATE TABLE public.user_skill_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  skill_id UUID NOT NULL REFERENCES public.skills(id),
  assessed_level NUMERIC NOT NULL,
  assessment_method TEXT NOT NULL CHECK (assessment_method IN ('test', 'certification', 'practical', 'observation', '360_review')),
  assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assessor_id UUID,
  notes TEXT,
  valid_until DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_skill_assessments ENABLE ROW LEVEL SECURITY;

-- Create policies for user_skill_assessments
CREATE POLICY "Admins can manage user_skill_assessments"
ON public.user_skill_assessments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- User Quality Assessments for tracking soft skills
CREATE TABLE public.user_quality_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  quality_id UUID NOT NULL REFERENCES public.qualities(id),
  assessed_level NUMERIC NOT NULL,
  assessment_method TEXT NOT NULL CHECK (assessment_method IN ('360_review', 'observation', 'assessment_center', 'self_assessment')),
  assessment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assessor_id UUID,
  notes TEXT,
  valid_until DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_quality_assessments ENABLE ROW LEVEL SECURITY;

-- Create policies for user_quality_assessments
CREATE POLICY "Admins can manage user_quality_assessments"
ON public.user_quality_assessments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- KPI Targets for performance measurement
CREATE TABLE public.kpi_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  measurement_unit TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  department_id UUID REFERENCES public.departments(id),
  position_id UUID REFERENCES public.positions(id),
  active_from DATE NOT NULL DEFAULT CURRENT_DATE,
  active_until DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kpi_targets ENABLE ROW LEVEL SECURITY;

-- Create policies for kpi_targets
CREATE POLICY "Admins can manage kpi_targets"
ON public.kpi_targets
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- User KPI Results for tracking actual performance
CREATE TABLE public.user_kpi_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kpi_target_id UUID NOT NULL REFERENCES public.kpi_targets(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  actual_value NUMERIC NOT NULL,
  achievement_percentage NUMERIC GENERATED ALWAYS AS (
    CASE 
      WHEN (SELECT target_value FROM public.kpi_targets WHERE id = kpi_target_id) > 0 
      THEN ROUND((actual_value / (SELECT target_value FROM public.kpi_targets WHERE id = kpi_target_id)) * 100, 2)
      ELSE 0 
    END
  ) STORED,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, kpi_target_id, period_start, period_end)
);

-- Enable RLS
ALTER TABLE public.user_kpi_results ENABLE ROW LEVEL SECURITY;

-- Create policies for user_kpi_results
CREATE POLICY "Admins can manage user_kpi_results"
ON public.user_kpi_results
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create triggers for updated_at columns
CREATE TRIGGER update_development_plan_tasks_updated_at
  BEFORE UPDATE ON public.development_plan_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_training_plans_updated_at
  BEFORE UPDATE ON public.training_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_training_plan_steps_updated_at
  BEFORE UPDATE ON public.training_plan_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_training_progress_updated_at
  BEFORE UPDATE ON public.user_training_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_skill_assessments_updated_at
  BEFORE UPDATE ON public.user_skill_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_quality_assessments_updated_at
  BEFORE UPDATE ON public.user_quality_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kpi_targets_updated_at
  BEFORE UPDATE ON public.kpi_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_kpi_results_updated_at
  BEFORE UPDATE ON public.user_kpi_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();