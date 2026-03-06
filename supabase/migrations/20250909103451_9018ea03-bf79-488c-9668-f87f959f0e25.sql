-- Создаем таблицу для связи пользователей и торговых точек
CREATE TABLE public.user_trade_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trade_point_id UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, trade_point_id)
);

-- Включаем RLS
ALTER TABLE public.user_trade_points ENABLE ROW LEVEL SECURITY;

-- Создаем политики доступа
CREATE POLICY "Admins can manage user_trade_points" 
ON public.user_trade_points 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own trade point assignments" 
ON public.user_trade_points 
FOR SELECT 
USING (auth.uid()::text = user_id::text);

-- Создаем триггер для обновления updated_at
CREATE TRIGGER update_user_trade_points_updated_at
BEFORE UPDATE ON public.user_trade_points
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Вставляем торговую точку "ул. Центральная, 1"
INSERT INTO public.trade_points (name, address, status)
VALUES ('Торговая точка Центральная', 'ул. Центральная, 1', 'Активный');

-- Связываем всех пользователей из департамента "Розница" с торговой точкой
INSERT INTO public.user_trade_points (user_id, trade_point_id)
SELECT u.id, tp.id
FROM public.users u
JOIN public.departments d ON u.department_id = d.id
CROSS JOIN public.trade_points tp
WHERE d.name = 'Розница' 
  AND u.status = 'Активный'
  AND tp.address = 'ул. Центральная, 1';