-- Добавляем временную политику для тестирования торговых точек
CREATE POLICY "Allow all operations for testing trade_points" 
ON public.trade_points 
FOR ALL 
USING (true);