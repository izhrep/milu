-- Добавляем категорию должности, если её нет
INSERT INTO public.position_categories (name, description)
SELECT 'Руководящие должности', 'Категория для руководящих должностей в компании'
WHERE NOT EXISTS (
  SELECT 1 FROM public.position_categories WHERE name = 'Руководящие должности'
);

-- Добавляем должность "Директор магазина" 
INSERT INTO public.positions (name, position_category_id)
SELECT 'Директор магазина', pc.id
FROM public.position_categories pc
WHERE pc.name = 'Руководящие должности'
  AND NOT EXISTS (
    SELECT 1 FROM public.positions WHERE name = 'Директор магазина'
  )
LIMIT 1;