-- Добавляем колонки для координат в таблицу торговых точек
ALTER TABLE public.trade_points 
ADD COLUMN latitude numeric,
ADD COLUMN longitude numeric;

-- Обновляем существующую торговую точку с правильными данными
UPDATE public.trade_points 
SET 
  address = 'Краснодар, Центральная улица, 1',
  latitude = 45.058071,
  longitude = 39.109530
WHERE address = 'ул. Центральная, 1';