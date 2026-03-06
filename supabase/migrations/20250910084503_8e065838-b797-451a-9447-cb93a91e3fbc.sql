-- Create survey_360_assignments table for tracking evaluation assignments
CREATE TABLE public.survey_360_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluated_user_id UUID NOT NULL,
  evaluating_user_id UUID NOT NULL,
  assigned_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'отправлен запрос',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(evaluated_user_id, evaluating_user_id)
);

-- Enable RLS
ALTER TABLE public.survey_360_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for assignments
CREATE POLICY "Users can view assignments involving them" 
ON public.survey_360_assignments 
FOR SELECT 
USING (
  (auth.uid())::text = (evaluated_user_id)::text OR 
  (auth.uid())::text = (evaluating_user_id)::text
);

CREATE POLICY "Users can create assignments as evaluated user" 
ON public.survey_360_assignments 
FOR INSERT 
WITH CHECK ((auth.uid())::text = (evaluated_user_id)::text);

CREATE POLICY "System can update assignment status" 
ON public.survey_360_assignments 
FOR UPDATE 
USING (true);

CREATE POLICY "Admins can manage all assignments" 
ON public.survey_360_assignments 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create tasks table linked to assignments
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  assignment_id UUID NOT NULL REFERENCES public.survey_360_assignments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for tasks
CREATE POLICY "Users can view their own tasks" 
ON public.tasks 
FOR SELECT 
USING ((auth.uid())::text = (user_id)::text);

CREATE POLICY "System can create and update tasks" 
ON public.tasks 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can manage all tasks" 
ON public.tasks 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_survey_360_assignments_updated_at
BEFORE UPDATE ON public.survey_360_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically create tasks when assignments are created
CREATE OR REPLACE FUNCTION public.create_task_for_assignment()
RETURNS TRIGGER AS $$
DECLARE
  evaluated_user_name TEXT;
BEGIN
  -- Get the name of the evaluated user
  SELECT full_name INTO evaluated_user_name
  FROM public.users
  WHERE id = NEW.evaluated_user_id;
  
  -- Create a task for the evaluating user
  INSERT INTO public.tasks (
    user_id,
    assignment_id,
    title,
    description,
    status
  ) VALUES (
    NEW.evaluating_user_id,
    NEW.id,
    'Оценка 360',
    'Необходимо пройти оценку 360 для ' || COALESCE(evaluated_user_name, 'сотрудника'),
    'pending'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to automatically create tasks
CREATE TRIGGER create_task_on_assignment
AFTER INSERT ON public.survey_360_assignments
FOR EACH ROW
EXECUTE FUNCTION public.create_task_for_assignment();

-- Create function to update assignment status when evaluation is completed
CREATE OR REPLACE FUNCTION public.update_assignment_on_survey_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Update assignment status to completed
  UPDATE public.survey_360_assignments
  SET status = 'выполнено',
      updated_at = now()
  WHERE evaluated_user_id = NEW.evaluated_user_id 
    AND evaluating_user_id = NEW.evaluating_user_id;
  
  -- Update corresponding task status
  UPDATE public.tasks
  SET status = 'completed',
      updated_at = now()
  FROM public.survey_360_assignments sa
  WHERE tasks.assignment_id = sa.id
    AND sa.evaluated_user_id = NEW.evaluated_user_id
    AND sa.evaluating_user_id = NEW.evaluating_user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to update assignment status when survey is completed
CREATE TRIGGER update_assignment_on_survey_result
AFTER INSERT ON public.survey_360_results
FOR EACH ROW
EXECUTE FUNCTION public.update_assignment_on_survey_completion();