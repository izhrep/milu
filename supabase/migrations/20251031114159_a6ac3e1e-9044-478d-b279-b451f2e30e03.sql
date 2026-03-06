-- Создаем функцию для удаления всех данных из таблицы (только для администраторов)
CREATE OR REPLACE FUNCTION public.admin_delete_all_from_table(table_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Проверяем, что текущий пользователь - администратор
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;
  
  -- Выполняем удаление всех записей из указанной таблицы
  EXECUTE format('DELETE FROM public.%I', table_name);
  
  -- Получаем количество удаленных строк
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;