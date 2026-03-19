-- answer_categories: question_type NOT NULL + UNIQUE(name, question_type)
ALTER TABLE public.answer_categories 
  ALTER COLUMN question_type SET NOT NULL;

ALTER TABLE public.answer_categories 
  ADD CONSTRAINT answer_categories_name_question_type_unique 
  UNIQUE (name, question_type);