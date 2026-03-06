-- Create KPI Targets table first
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

-- Create User KPI Results table
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

-- Create triggers for updated_at columns
CREATE TRIGGER update_kpi_targets_updated_at
  BEFORE UPDATE ON public.kpi_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_kpi_results_updated_at
  BEFORE UPDATE ON public.user_kpi_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();