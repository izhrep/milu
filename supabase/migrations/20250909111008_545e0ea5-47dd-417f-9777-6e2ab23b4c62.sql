-- Добавляем временную политику для тестирования торговых точек
CREATE POLICY "Allow all operations for testing user_trade_points" 
ON public.user_trade_points 
FOR ALL 
USING (true);