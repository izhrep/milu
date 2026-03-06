-- Fix the KPI results table by removing the computed column and creating a view instead
DROP TABLE IF EXISTS public.user_kpi_results;

-- Create user_kpi_results table without computed column  
CREATE TABLE public.user_kpi_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kpi_target_id UUID NOT NULL REFERENCES public.kpi_targets(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  actual_value NUMERIC NOT NULL,
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

-- Create a view that includes the calculated achievement percentage
CREATE VIEW public.user_kpi_results_with_achievement AS
SELECT 
  r.*,
  CASE 
    WHEN t.target_value > 0 
    THEN ROUND((r.actual_value / t.target_value) * 100, 2)
    ELSE 0 
  END as achievement_percentage
FROM public.user_kpi_results r
JOIN public.kpi_targets t ON r.kpi_target_id = t.id;

-- Create trigger for updated_at column
CREATE TRIGGER update_user_kpi_results_updated_at
  BEFORE UPDATE ON public.user_kpi_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();