-- ====================================================================
-- 1. Создать таблицу answer_categories
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.answer_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS policies для answer_categories
ALTER TABLE public.answer_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view answer_categories"
  ON public.answer_categories FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert answer_categories"
  ON public.answer_categories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'hr_bp')
    )
  );

CREATE POLICY "Admins can update answer_categories"
  ON public.answer_categories FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'hr_bp')
    )
  );

CREATE POLICY "Admins can delete answer_categories"
  ON public.answer_categories FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'hr_bp')
    )
  );

-- Trigger для updated_at
CREATE TRIGGER update_answer_categories_updated_at
  BEFORE UPDATE ON public.answer_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- 2. Модифицировать таблицы вариантов ответов
-- ====================================================================

-- Добавить поля в hard_skill_answer_options
ALTER TABLE public.hard_skill_answer_options
  ADD COLUMN IF NOT EXISTS answer_category_id UUID REFERENCES public.answer_categories(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS level_value INTEGER NOT NULL DEFAULT 0 CHECK (level_value >= 0 AND level_value <= 4),
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 1 CHECK (order_index >= 1);

-- Переименовать numeric_value в level_value если нужно (но у нас уже есть numeric_value)
-- Мы будем использовать level_value как основное поле

-- Добавить поля в soft_skill_answer_options
ALTER TABLE public.soft_skill_answer_options
  ADD COLUMN IF NOT EXISTS answer_category_id UUID REFERENCES public.answer_categories(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS level_value INTEGER NOT NULL DEFAULT 0 CHECK (level_value >= 0 AND level_value <= 4),
  ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 1 CHECK (order_index >= 1);

-- Создать уникальный индекс для предотвращения дублирования level_value внутри категории
CREATE UNIQUE INDEX IF NOT EXISTS hard_skill_answer_options_category_level_unique
  ON public.hard_skill_answer_options(answer_category_id, level_value)
  WHERE answer_category_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS soft_skill_answer_options_category_level_unique
  ON public.soft_skill_answer_options(answer_category_id, level_value)
  WHERE answer_category_id IS NOT NULL;

-- ====================================================================
-- 3. Привязка категорий ответов к вопросам
-- ====================================================================

-- Добавить answer_category_id в hard_skill_questions
ALTER TABLE public.hard_skill_questions
  ADD COLUMN IF NOT EXISTS answer_category_id UUID REFERENCES public.answer_categories(id) ON DELETE RESTRICT;

-- Добавить answer_category_id в soft_skill_questions
ALTER TABLE public.soft_skill_questions
  ADD COLUMN IF NOT EXISTS answer_category_id UUID REFERENCES public.answer_categories(id) ON DELETE RESTRICT;

-- ====================================================================
-- 5. Инициализация данных
-- ====================================================================

-- Создать две категории по умолчанию
INSERT INTO public.answer_categories (id, name, description)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Оценка Hard Skills', 'Категория ответов для оценки hard skills'),
  ('00000000-0000-0000-0000-000000000002', 'Оценка Soft Skills', 'Категория ответов для оценки soft skills')
ON CONFLICT (id) DO NOTHING;

-- Обновить существующие варианты ответов hard_skill_answer_options
UPDATE public.hard_skill_answer_options
SET 
  answer_category_id = '00000000-0000-0000-0000-000000000001',
  level_value = COALESCE(numeric_value, 0),
  label = COALESCE(title, ''),
  order_index = 1
WHERE answer_category_id IS NULL;

-- Обновить существующие варианты ответов soft_skill_answer_options
UPDATE public.soft_skill_answer_options
SET 
  answer_category_id = '00000000-0000-0000-0000-000000000002',
  level_value = COALESCE(numeric_value, 0),
  order_index = 1
WHERE answer_category_id IS NULL;

-- Привязать существующие вопросы к категориям
UPDATE public.hard_skill_questions
SET answer_category_id = '00000000-0000-0000-0000-000000000001'
WHERE answer_category_id IS NULL;

UPDATE public.soft_skill_questions
SET answer_category_id = '00000000-0000-0000-0000-000000000002'
WHERE answer_category_id IS NULL;

-- ====================================================================
-- 8. Валидации и функции
-- ====================================================================

-- Функция для проверки использования категории
CREATE OR REPLACE FUNCTION public.check_answer_category_usage(_category_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hard_skill_questions WHERE answer_category_id = _category_id
    UNION
    SELECT 1 FROM public.soft_skill_questions WHERE answer_category_id = _category_id
  );
$$;

-- Функция для предотвращения удаления используемой категории
CREATE OR REPLACE FUNCTION public.prevent_delete_used_answer_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF check_answer_category_usage(OLD.id) THEN
    RAISE EXCEPTION 'Нельзя удалить категорию ответов, которая используется в вопросах';
  END IF;
  RETURN OLD;
END;
$$;

-- Trigger для предотвращения удаления используемой категории
DROP TRIGGER IF EXISTS prevent_delete_used_answer_category_trigger ON public.answer_categories;
CREATE TRIGGER prevent_delete_used_answer_category_trigger
  BEFORE DELETE ON public.answer_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_delete_used_answer_category();