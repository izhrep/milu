-- Исправляем constraint на tasks.assignment_type
-- Оставляем только валидные значения для системы диагностики
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assignment_type_check;

ALTER TABLE tasks ADD CONSTRAINT tasks_assignment_type_check 
CHECK (assignment_type IN ('self', 'manager', 'peer'));