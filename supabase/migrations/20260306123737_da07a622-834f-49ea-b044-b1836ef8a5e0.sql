
ALTER TABLE employee_stage_snapshots ENABLE ROW LEVEL SECURITY;

-- SELECT: сам сотрудник, его руководитель, или HR/admin
CREATE POLICY "employee_stage_snapshots_select"
ON employee_stage_snapshots FOR SELECT TO authenticated
USING (
  evaluated_user_id = auth.uid()
  OR is_users_manager(evaluated_user_id)
  OR has_permission(auth.uid(), 'diagnostics.manage')
);

-- INSERT: только с правами управления диагностикой
CREATE POLICY "employee_stage_snapshots_insert"
ON employee_stage_snapshots FOR INSERT TO authenticated
WITH CHECK (
  has_permission(auth.uid(), 'diagnostics.manage')
);

-- UPDATE: только с правами управления диагностикой
CREATE POLICY "employee_stage_snapshots_modify"
ON employee_stage_snapshots FOR UPDATE TO authenticated
USING (has_permission(auth.uid(), 'diagnostics.manage'));

-- DELETE: только с правами управления диагностикой
CREATE POLICY "employee_stage_snapshots_delete"
ON employee_stage_snapshots FOR DELETE TO authenticated
USING (has_permission(auth.uid(), 'diagnostics.manage'));
