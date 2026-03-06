-- Добавляем новую должность "Директор магазина"
-- Сначала получаем подходящую категорию должности или создаем новую
INSERT INTO public.position_categories (name, description)
VALUES ('Руководящие должности', 'Категория для руководящих должностей в компании')
ON CONFLICT (name) DO NOTHING;

-- Добавляем должность "Директор магазина" 
INSERT INTO public.positions (name, position_category_id)
SELECT 'Директор магазина', pc.id
FROM public.position_categories pc
WHERE pc.name = 'Руководящие должности'
LIMIT 1;