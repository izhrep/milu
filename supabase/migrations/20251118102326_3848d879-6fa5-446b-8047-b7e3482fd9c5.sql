-- ====================================================================
-- 1. Создание таблиц подкатегорий
-- ====================================================================

-- Подкатегории HARD навыков
CREATE TABLE IF NOT EXISTS public.sub_category_hard_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_hard_skill_id UUID NOT NULL REFERENCES public.category_hard_skills(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Подкатегории SOFT навыков
CREATE TABLE IF NOT EXISTS public.sub_category_soft_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_soft_skill_id UUID NOT NULL REFERENCES public.category_soft_skills(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ====================================================================
-- 2. Обновление таблиц навыков
-- ====================================================================

-- Добавить поле подкатегории для HARD навыков
ALTER TABLE public.hard_skills 
ADD COLUMN IF NOT EXISTS sub_category_id UUID REFERENCES public.sub_category_hard_skills(id) ON DELETE SET NULL;

-- Добавить поле подкатегории для SOFT навыков
ALTER TABLE public.soft_skills 
ADD COLUMN IF NOT EXISTS sub_category_id UUID REFERENCES public.sub_category_soft_skills(id) ON DELETE SET NULL;

-- ====================================================================
-- 3. Создание индексов для производительности
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_sub_category_hard_skills_category 
ON public.sub_category_hard_skills(category_hard_skill_id);

CREATE INDEX IF NOT EXISTS idx_sub_category_soft_skills_category 
ON public.sub_category_soft_skills(category_soft_skill_id);

CREATE INDEX IF NOT EXISTS idx_hard_skills_sub_category 
ON public.hard_skills(sub_category_id);

CREATE INDEX IF NOT EXISTS idx_soft_skills_sub_category 
ON public.soft_skills(sub_category_id);

-- ====================================================================
-- 4. Функция валидации для hard skills
-- ====================================================================

CREATE OR REPLACE FUNCTION validate_hard_skill_subcategory()
RETURNS TRIGGER AS $$
BEGIN
  -- Если указана подкатегория, проверить что она принадлежит той же категории
  IF NEW.sub_category_id IS NOT NULL AND NEW.category_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 
      FROM sub_category_hard_skills 
      WHERE id = NEW.sub_category_id 
      AND category_hard_skill_id = NEW.category_id
    ) THEN
      RAISE EXCEPTION 'Подкатегория должна принадлежать выбранной категории навыка';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_hard_skill_subcategory_trigger
  BEFORE INSERT OR UPDATE ON public.hard_skills
  FOR EACH ROW
  EXECUTE FUNCTION validate_hard_skill_subcategory();

-- ====================================================================
-- 5. Функция валидации для soft skills
-- ====================================================================

CREATE OR REPLACE FUNCTION validate_soft_skill_subcategory()
RETURNS TRIGGER AS $$
BEGIN
  -- Если указана подкатегория, проверить что она принадлежит той же категории
  IF NEW.sub_category_id IS NOT NULL AND NEW.category_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 
      FROM sub_category_soft_skills 
      WHERE id = NEW.sub_category_id 
      AND category_soft_skill_id = NEW.category_id
    ) THEN
      RAISE EXCEPTION 'Подкатегория должна принадлежать выбранной категории навыка';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_soft_skill_subcategory_trigger
  BEFORE INSERT OR UPDATE ON public.soft_skills
  FOR EACH ROW
  EXECUTE FUNCTION validate_soft_skill_subcategory();

-- ====================================================================
-- 6. Функция проверки использования подкатегории перед удалением (hard)
-- ====================================================================

CREATE OR REPLACE FUNCTION prevent_delete_used_hard_subcategory()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM hard_skills WHERE sub_category_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Невозможно удалить подкатегорию, используемую навыками';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_delete_used_hard_subcategory_trigger
  BEFORE DELETE ON public.sub_category_hard_skills
  FOR EACH ROW
  EXECUTE FUNCTION prevent_delete_used_hard_subcategory();

-- ====================================================================
-- 7. Функция проверки использования подкатегории перед удалением (soft)
-- ====================================================================

CREATE OR REPLACE FUNCTION prevent_delete_used_soft_subcategory()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM soft_skills WHERE sub_category_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Невозможно удалить подкатегорию, используемую навыками';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_delete_used_soft_subcategory_trigger
  BEFORE DELETE ON public.sub_category_soft_skills
  FOR EACH ROW
  EXECUTE FUNCTION prevent_delete_used_soft_subcategory();

-- ====================================================================
-- 8. RLS политики для sub_category_hard_skills
-- ====================================================================

ALTER TABLE public.sub_category_hard_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sub_category_hard_skills"
  ON public.sub_category_hard_skills
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert sub_category_hard_skills"
  ON public.sub_category_hard_skills
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'hr_bp')
    )
  );

CREATE POLICY "Admins can update sub_category_hard_skills"
  ON public.sub_category_hard_skills
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'hr_bp')
    )
  );

CREATE POLICY "Admins can delete sub_category_hard_skills"
  ON public.sub_category_hard_skills
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'hr_bp')
    )
  );

-- ====================================================================
-- 9. RLS политики для sub_category_soft_skills
-- ====================================================================

ALTER TABLE public.sub_category_soft_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sub_category_soft_skills"
  ON public.sub_category_soft_skills
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert sub_category_soft_skills"
  ON public.sub_category_soft_skills
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'hr_bp')
    )
  );

CREATE POLICY "Admins can update sub_category_soft_skills"
  ON public.sub_category_soft_skills
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'hr_bp')
    )
  );

CREATE POLICY "Admins can delete sub_category_soft_skills"
  ON public.sub_category_soft_skills
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'hr_bp')
    )
  );

-- ====================================================================
-- 10. Триггеры для автоматического обновления updated_at
-- ====================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sub_category_hard_skills_updated_at
  BEFORE UPDATE ON public.sub_category_hard_skills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sub_category_soft_skills_updated_at
  BEFORE UPDATE ON public.sub_category_soft_skills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();