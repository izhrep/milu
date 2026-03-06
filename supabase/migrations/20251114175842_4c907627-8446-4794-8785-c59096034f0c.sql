-- Создаём таблицу companies (Компании)
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Добавляем поле company_id в таблицу departments
ALTER TABLE public.departments 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Добавляем RLS политики для companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_select_policy"
ON public.companies
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can update companies"
ON public.companies
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

CREATE POLICY "Admins can delete companies"
ON public.companies
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'hr_bp')
  )
);

-- Добавляем триггер для автоматического обновления updated_at
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Вставляем запись "Ракета"
INSERT INTO public.companies (name, description)
VALUES ('Ракета', 'Основная компания')
ON CONFLICT DO NOTHING;

-- Связываем все существующие подразделения с компанией "Ракета"
UPDATE public.departments
SET company_id = (SELECT id FROM public.companies WHERE name = 'Ракета' LIMIT 1)
WHERE company_id IS NULL;