import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDiagnosticStages } from '@/hooks/useDiagnosticStages';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Play, CheckCircle2, XCircle, AlertTriangle, Info, Database, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface SnapshotRun {
  id: string;
  stage_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  total_subjects: number;
  processed_subjects: number;
  progress_percent: number;
  inserted_count: number;
  skipped_count: number;
  versioned_count: number;
  error_count: number;
  summary_json: any;
  error_message: string | null;
}

interface PreflightData {
  totalUsers: number;
  existingSnapshots: number;
  missingSnapshots: number;
}

interface SnapshotTableCount {
  table_name: string;
  label: string;
  count: number;
}

const SNAPSHOT_TABLES: { name: string; label: string }[] = [
  { name: 'diagnostic_result_snapshots', label: 'Результаты диагностики' },
  { name: 'diagnostic_user_snapshots', label: 'Пользователи' },
  { name: 'answer_category_snapshots', label: 'Категории ответов' },
  { name: 'grade_quality_snapshots', label: 'Качества грейдов' },
  { name: 'grade_skill_snapshots', label: 'Навыки грейдов' },
  { name: 'soft_skill_snapshots', label: 'Софт-скиллы' },
  { name: 'soft_skill_category_snapshots', label: 'Категории софт-скиллов' },
  { name: 'soft_skill_subcategory_snapshots', label: 'Подкатегории софт-скиллов' },
  { name: 'soft_skill_question_snapshots', label: 'Вопросы софт-скиллов' },
  { name: 'soft_skill_answer_option_snapshots', label: 'Варианты ответов (софт)' },
  { name: 'hard_skill_snapshots', label: 'Хард-скиллы' },
  { name: 'hard_skill_category_snapshots', label: 'Категории хард-скиллов' },
  { name: 'hard_skill_subcategory_snapshots', label: 'Подкатегории хард-скиллов' },
  { name: 'hard_skill_question_snapshots', label: 'Вопросы хард-скиллов' },
  { name: 'hard_skill_answer_option_snapshots', label: 'Варианты ответов (хард)' },
  { name: 'survey_assignment_snapshots', label: 'Назначения опросов' },
  { name: 'johari_ai_snapshots', label: 'Johari AI отчёты' },
  { name: 'employee_stage_snapshots', label: 'Снапшоты этапов сотрудников' },
];

const DiagnosticStageSnapshotPanel: React.FC = () => {
  const { stages, isLoading: stagesLoading } = useDiagnosticStages();
  const { toast } = useToast();

  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [preflight, setPreflight] = useState<PreflightData | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [tableCounts, setTableCounts] = useState<SnapshotTableCount[]>([]);
  const [tableCountsLoading, setTableCountsLoading] = useState(false);
  const [activeRun, setActiveRun] = useState<SnapshotRun | null>(null);
  const [lastRun, setLastRun] = useState<SnapshotRun | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [polling, setPolling] = useState(false);

  const selectedStage = stages?.find(s => s.id === selectedStageId);

  // Load data when stage is selected
  useEffect(() => {
    if (!selectedStageId) {
      setPreflight(null);
      setActiveRun(null);
      setLastRun(null);
      setTableCounts([]);
      return;
    }
    loadPreflight(selectedStageId);
    loadLatestRun(selectedStageId);
    loadSnapshotTableCounts(selectedStageId);
  }, [selectedStageId]);

  const loadPreflight = async (stageId: string) => {
    setPreflightLoading(true);
    try {
      const { data: assignments } = await (supabase as any)
        .from('survey_360_assignments')
        .select('evaluated_user_id')
        .eq('diagnostic_stage_id', stageId);

      const uniqueUsers = [...new Set((assignments || []).map((a: any) => a.evaluated_user_id).filter(Boolean))];

      const { count: existingCount } = await (supabase as any)
        .from('diagnostic_result_snapshots')
        .select('*', { count: 'exact', head: true })
        .eq('stage_id', stageId)
        .eq('is_current', true);

      setPreflight({
        totalUsers: uniqueUsers.length,
        existingSnapshots: existingCount || 0,
        missingSnapshots: Math.max(0, uniqueUsers.length - (existingCount || 0)),
      });
    } catch (err) {
      console.error('Preflight error:', err);
    } finally {
      setPreflightLoading(false);
    }
  };

  const loadSnapshotTableCounts = async (stageId: string) => {
    setTableCountsLoading(true);
    try {
      // First get all diagnostic_result_snapshot IDs for this stage
      const { data: snapshots } = await (supabase as any)
        .from('diagnostic_result_snapshots')
        .select('id')
        .eq('stage_id', stageId);

      const snapshotIds = (snapshots || []).map((s: any) => s.id);

      // For diagnostic_result_snapshots itself, count by stage_id directly
      const { count: mainCount } = await (supabase as any)
        .from('diagnostic_result_snapshots')
        .select('*', { count: 'exact', head: true })
        .eq('stage_id', stageId);

      // For employee_stage_snapshots, count by stage_id
      const { count: employeeCount } = await (supabase as any)
        .from('employee_stage_snapshots')
        .select('*', { count: 'exact', head: true })
        .eq('stage_id', stageId);

      const counts: SnapshotTableCount[] = [
        { table_name: 'diagnostic_result_snapshots', label: 'Результаты диагностики', count: mainCount || 0 },
      ];

      // Tables that use stage_id directly (not diagnostic_id)
      const stageLinkedTables = ['employee_stage_snapshots', 'johari_ai_snapshots'];

      // For tables linked via diagnostic_id → diagnostic_result_snapshots.id
      const diagnosticLinkedTables = SNAPSHOT_TABLES.filter(
        t => t.name !== 'diagnostic_result_snapshots' && !stageLinkedTables.includes(t.name)
      );

      if (snapshotIds.length > 0) {
        const results = await Promise.all(
          diagnosticLinkedTables.map(async (table) => {
            try {
              const { count } = await (supabase as any)
                .from(table.name)
                .select('*', { count: 'exact', head: true })
                .in('diagnostic_id', snapshotIds);
              return { table_name: table.name, label: table.label, count: count || 0 };
            } catch {
              return { table_name: table.name, label: table.label, count: -1 };
            }
          })
        );
        counts.push(...results);
      } else {
        diagnosticLinkedTables.forEach(t => counts.push({ table_name: t.name, label: t.label, count: 0 }));
      }

      // Count stage-linked tables by stage_id
      const stageLinkedResults = await Promise.all(
        stageLinkedTables.map(async (tableName) => {
          const tableInfo = SNAPSHOT_TABLES.find(t => t.name === tableName);
          try {
            const { count } = await (supabase as any)
              .from(tableName)
              .select('*', { count: 'exact', head: true })
              .eq('stage_id', stageId);
            return { table_name: tableName, label: tableInfo?.label || tableName, count: count || 0 };
          } catch {
            return { table_name: tableName, label: tableInfo?.label || tableName, count: -1 };
          }
        })
      );
      counts.push(...stageLinkedResults);

      setTableCounts(counts);
    } catch (err) {
      console.error('Table counts error:', err);
    } finally {
      setTableCountsLoading(false);
    }
  };

  const loadLatestRun = async (stageId: string) => {
    const { data } = await (supabase as any)
      .from('diagnostic_snapshot_runs')
      .select('*')
      .eq('stage_id', stageId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const run = data as unknown as SnapshotRun;
      if (run.status === 'running') {
        setActiveRun(run);
        setPolling(true);
      } else {
        setLastRun(run);
        setActiveRun(null);
      }
    }
  };

  // Poll active run
  useEffect(() => {
    if (!polling || !activeRun) return;
    const interval = setInterval(async () => {
      const { data } = await (supabase as any)
        .from('diagnostic_snapshot_runs')
        .select('*')
        .eq('id', activeRun.id)
        .single();

      if (data) {
        const run = data as unknown as SnapshotRun;
        if (run.status === 'running') {
          setActiveRun(run);
        } else {
          setActiveRun(null);
          setLastRun(run);
          setPolling(false);
          loadPreflight(run.stage_id);
          loadSnapshotTableCounts(run.stage_id);
          toast({
            title: run.status === 'completed' ? 'Снапшот завершён' : 'Ошибка при создании снапшота',
            description: run.status === 'completed'
              ? `Создано: ${run.inserted_count}, пропущено: ${run.skipped_count}, обновлено: ${run.versioned_count}`
              : run.error_message || 'Произошла ошибка',
            variant: run.status === 'completed' ? 'default' : 'destructive',
          });
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [polling, activeRun?.id]);

  const handleStart = async () => {
    if (!selectedStageId) return;
    setIsStarting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Ошибка авторизации', variant: 'destructive' });
        return;
      }

      const response = await supabase.functions.invoke('admin-build-stage-snapshots', {
        body: { stage_id: selectedStageId },
      });

      if (response.error) {
        toast({
          title: 'Ошибка запуска',
          description: response.error.message || 'Не удалось запустить создание снапшотов',
          variant: 'destructive',
        });
        return;
      }

      const runId = response.data?.run_id;
      if (runId) {
        setActiveRun({
          id: runId,
          stage_id: selectedStageId,
          status: 'running',
          started_at: new Date().toISOString(),
          finished_at: null,
          total_subjects: preflight?.totalUsers || 0,
          processed_subjects: 0,
          progress_percent: 0,
          inserted_count: 0,
          skipped_count: 0,
          versioned_count: 0,
          error_count: 0,
          summary_json: null,
          error_message: null,
        });
        setPolling(true);
      }
    } catch (err) {
      console.error('Start error:', err);
      toast({ title: 'Ошибка запуска', variant: 'destructive' });
    } finally {
      setIsStarting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'ID скопирован', description: text });
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'd MMMM yyyy, HH:mm', { locale: ru });
    } catch {
      return dateStr;
    }
  };

  const totalSnapshotRecords = tableCounts.reduce((sum, t) => sum + Math.max(0, t.count), 0);

  return (
    <div className="space-y-6">
      {/* Stage selector */}
      <Card>
        <CardHeader>
          <CardTitle>Выбор этапа диагностики</CardTitle>
          <CardDescription>Выберите этап для просмотра снапшотов и создания новых</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedStageId} onValueChange={setSelectedStageId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Выберите этап…" />
            </SelectTrigger>
            <SelectContent>
              {stagesLoading && (
                <SelectItem value="_loading" disabled>Загрузка…</SelectItem>
              )}
              {stages?.map(stage => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.period || stage.evaluation_period || 'Без периода'}{' '}
                  {stage.is_active ? '● Активный' : '○ Завершён'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Stage info + preflight */}
      {selectedStage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Информация об этапе
              <Badge variant={selectedStage.is_active ? 'secondary' : 'default'}>
                {selectedStage.is_active ? 'Активный' : 'Завершён'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stage ID */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
              <span className="text-sm text-muted-foreground shrink-0">ID этапа:</span>
              <code className="text-sm font-mono text-foreground select-all">{selectedStageId}</code>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => copyToClipboard(selectedStageId)}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Период:</span>
                <p className="font-medium">{selectedStage.period || selectedStage.evaluation_period || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Начало:</span>
                <p className="font-medium">{selectedStage.start_date ? format(new Date(selectedStage.start_date), 'dd.MM.yyyy') : '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Окончание:</span>
                <p className="font-medium">{selectedStage.end_date ? format(new Date(selectedStage.end_date), 'dd.MM.yyyy') : '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Прогресс:</span>
                <p className="font-medium">{selectedStage.progress_percent ?? 0}%</p>
              </div>
            </div>

            {/* Preflight */}
            {preflightLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Подсчёт данных…
              </div>
            ) : preflight && (
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-2xl font-bold">{preflight.totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Всего оцениваемых</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{preflight.existingSnapshots}</p>
                  <p className="text-xs text-muted-foreground">Снапшотов есть</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-2xl font-bold">{preflight.missingSnapshots}</p>
                  <p className="text-xs text-muted-foreground">Снапшотов нет</p>
                </div>
              </div>
            )}

            {/* Warning for active stages */}
            {selectedStage.is_active && (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted p-3">
                <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Этап ещё активен. Снапшоты можно создать, но они могут быть неполными.
                </p>
              </div>
            )}

            {/* Run button — always available when there are users */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleStart}
                disabled={isStarting || !!activeRun || preflightLoading || !preflight?.totalUsers}
              >
                {isStarting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Запуск…</>
                ) : (
                  <><Play className="h-4 w-4 mr-2" />Сделать snapshot</>
                )}
              </Button>
              {preflight && preflight.totalUsers === 0 && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Info className="h-3.5 w-3.5" />
                  Нет оцениваемых пользователей для этого этапа
                </p>
              )}
              {preflight && preflight.totalUsers > 0 && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Info className="h-3.5 w-3.5" />
                  Операция может занять некоторое время
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Snapshot tables breakdown */}
      {selectedStageId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Таблицы снапшотов
              {!tableCountsLoading && (
                <Badge variant="outline">{totalSnapshotRecords} записей</Badge>
              )}
            </CardTitle>
            <CardDescription>Количество записей в каждой snapshot-таблице для этого этапа</CardDescription>
          </CardHeader>
          <CardContent>
            {tableCountsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Загрузка данных по таблицам…
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Таблица</TableHead>
                    <TableHead>Системное имя</TableHead>
                    <TableHead className="text-right">Записей</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableCounts.map(tc => (
                    <TableRow key={tc.table_name}>
                      <TableCell className="font-medium">{tc.label}</TableCell>
                      <TableCell>
                        <code className="text-xs text-muted-foreground">{tc.table_name}</code>
                      </TableCell>
                      <TableCell className="text-right">
                        {tc.count === -1 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Badge variant={tc.count > 0 ? 'default' : 'outline'}>
                            {tc.count}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active run progress */}
      {activeRun && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Выполняется создание снапшотов
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Обработано: {activeRun.processed_subjects} / {activeRun.total_subjects}</span>
                <span>{activeRun.progress_percent}%</span>
              </div>
              <Progress value={activeRun.progress_percent} className="h-2" />
            </div>
            <div className="grid grid-cols-4 gap-3 text-sm">
              <div className="text-center">
                <p className="text-lg font-bold text-primary">{activeRun.inserted_count}</p>
                <p className="text-xs text-muted-foreground">Создано</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-muted-foreground">{activeRun.skipped_count}</p>
                <p className="text-xs text-muted-foreground">Пропущено</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">{activeRun.versioned_count}</p>
                <p className="text-xs text-muted-foreground">Обновлено</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-destructive">{activeRun.error_count}</p>
                <p className="text-xs text-muted-foreground">Ошибок</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last run result */}
      {lastRun && !activeRun && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {lastRun.status === 'completed' ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              Результат последнего запуска
              <Badge variant={lastRun.status === 'completed' ? 'default' : 'destructive'}>
                {lastRun.status === 'completed' ? 'Успешно' : 'Ошибка'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Начало:</span>
                <p className="font-medium">{formatDate(lastRun.started_at)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Завершение:</span>
                <p className="font-medium">{formatDate(lastRun.finished_at)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Обработано:</span>
                <p className="font-medium">{lastRun.processed_subjects} / {lastRun.total_subjects}</p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Метрика</TableHead>
                  <TableHead className="text-right">Количество</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Создано новых снапшотов</TableCell>
                  <TableCell className="text-right font-medium text-primary">{lastRun.inserted_count}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Пропущено (без изменений)</TableCell>
                  <TableCell className="text-right font-medium text-muted-foreground">{lastRun.skipped_count}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Создано новых версий</TableCell>
                  <TableCell className="text-right font-medium">{lastRun.versioned_count}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Ошибок</TableCell>
                  <TableCell className="text-right font-medium text-destructive">{lastRun.error_count}</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            {lastRun.error_message && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {lastRun.error_message}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DiagnosticStageSnapshotPanel;
