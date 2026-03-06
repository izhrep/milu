-- Create table for user career progress
CREATE TABLE public.user_career_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  career_track_id UUID NOT NULL,
  current_step_id UUID,
  selected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_career_progress ENABLE ROW LEVEL SECURITY;

-- Create policies for user career progress
CREATE POLICY "Users can view their own career progress" 
ON public.user_career_progress 
FOR SELECT 
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create their own career progress" 
ON public.user_career_progress 
FOR INSERT 
WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own career progress" 
ON public.user_career_progress 
FOR UPDATE 
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can manage all career progress" 
ON public.user_career_progress 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_career_progress_updated_at
BEFORE UPDATE ON public.user_career_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();