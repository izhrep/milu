import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Plus, Pencil, Archive, CheckCircle, ChevronDown, ChevronUp, ExternalLink, Info, Loader2 } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  useDiagnosticConfigTemplates,
  DiagnosticConfigTemplate,
} from '@/hooks/useDiagnosticConfigTemplates';
import { useAuth } from '@/contexts/AuthContext';
import { useTemplateSelection } from '@/contexts/TemplateSelectionContext';
import { buildTemplateSummary, type TemplateSummary } from '@/lib/templateViewModel';
import { HardSkillsScaleCard } from './template-form/HardSkillsScaleCard';
import { SoftSkillsScaleCard } from './template-form/SoftSkillsScaleCard';
import { JohariRulesCard, validateJohariRules, type JohariRulesState } from './template-form/JohariRulesCard';
import { TemplateCoverageReport } from './template-form/TemplateCoverageReport';

// ─── Status badge ──────────────────────────────────────────────────────────
const statusBadge = (status: string) => {
  switch (status) {
    case 'draft':
      return <Badge variant="secondary">Черновик</Badge>;
    case 'approved':
      return <Badge variant="success">Утверждён</Badge>;
    case 'archived':
      return <Badge variant="outline">Архив</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

// ─── Default Johari state ──────────────────────────────────────────────────
const defaultJohari: JohariRulesState = {
  openPct: 0.20,
  bhPct: 0.25,
  borderlineEnabled: true,
  borderlineThreshold: 0.45,
  borderlineDown: 0.40,
  borderlineUp: 0.50,
};

function johariFromTemplate(template: DiagnosticConfigTemplate): JohariRulesState {
  const jr = template.johari_rules as Record<string, number | boolean | undefined> | undefined;
  if (jr && jr.open_delta_pct !== undefined) {
    return {
      openPct: jr.open_delta_pct as number,
      bhPct: jr.blind_hidden_delta_pct as number,
      borderlineEnabled: (jr.borderline_rounding_enabled as boolean) ?? true,
      borderlineThreshold: (jr.borderline_threshold_delta as number) ?? 0.45,
      borderlineDown: (jr.borderline_round_down_to as number) ?? 0.40,
      borderlineUp: (jr.borderline_round_up_to as number) ?? 0.50,
    };
  }
  return { ...defaultJohari };
}

// ─── Template Form Dialog ──────────────────────────────────────────────────
interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: DiagnosticConfigTemplate | null;
  onSuccess?: () => void;
}

const TemplateFormDialog: React.FC<TemplateFormDialogProps> = ({ open, onOpenChange, template, onSuccess }) => {
  const { createTemplate, updateTemplate, approveTemplate } = useDiagnosticConfigTemplates();
  const { user } = useAuth();
  const isEdit = !!template;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hardMin, setHardMin] = useState(0);
  const [hardMax, setHardMax] = useState(4);
  const [softMin, setSoftMin] = useState(0);
  const [softMax, setSoftMax] = useState(5);
  const [hardReversed, setHardReversed] = useState(false);
  const [softReversed, setSoftReversed] = useState(false);
  const [hardEnabled, setHardEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [johari, setJohari] = useState<JohariRulesState>(defaultJohari);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setHardMin(template.hard_scale_min);
      setHardMax(template.hard_scale_max);
      setSoftMin(template.soft_scale_min);
      setSoftMax(template.soft_scale_max);
      setHardReversed(template.hard_scale_reversed);
      setSoftReversed(template.soft_scale_reversed);
      setHardEnabled(template.hard_skills_enabled);
      setJohari(johariFromTemplate(template));
    } else {
      setName(''); setDescription('');
      setHardMin(0); setHardMax(4); setSoftMin(0); setSoftMax(5);
      setHardReversed(false); setSoftReversed(false); setHardEnabled(true);
      setJohari({ ...defaultJohari });
    }
  }, [template, open]);

  const handleJohariChange = useCallback((patch: Partial<JohariRulesState>) => {
    setJohari(prev => ({ ...prev, ...patch }));
  }, []);

  const nameValid = name.trim().length > 0;
  const hardRangeValid = !hardEnabled || (hardMin >= 0 && hardMax > hardMin);
  const softRangeValid = softMin >= 0 && softMax > softMin;
  const johariValid = validateJohariRules(johari);
  const formValid = nameValid && hardRangeValid && softRangeValid && johariValid;

  const buildInput = () => ({
    name: name.trim(),
    description: description.trim() || undefined,
    hard_scale_min: hardMin, hard_scale_max: hardMax,
    soft_scale_min: softMin, soft_scale_max: softMax,
    hard_scale_reversed: hardReversed, soft_scale_reversed: softReversed,
    hard_skills_enabled: hardEnabled,
    johari_rules: {
      applies_to: 'soft',
      open_delta_pct: johari.openPct,
      blind_hidden_delta_pct: johari.bhPct,
      borderline_rounding_enabled: johari.borderlineEnabled,
      borderline_threshold_delta: johari.borderlineThreshold,
      borderline_round_down_to: johari.borderlineDown,
      borderline_round_up_to: johari.borderlineUp,
    },
  });

  const handleSave = async () => {
    if (!formValid) return;
    setSaving(true);
    try {
      if (isEdit && template) {
        await updateTemplate(template.id, buildInput());
      } else {
        await createTemplate(buildInput(), user?.id || '');
      }
      onSuccess?.();
      onOpenChange(false);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[85vh]">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg">{isEdit ? 'Редактировать шаблон' : 'Новый шаблон конфигурации'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1 -mr-1">
          {/* Основное */}
          <div className="space-y-2.5">
            <div>
              <Label className="text-xs text-muted-foreground">Название</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Шаблон v1" className="mt-1 h-9" />
              {!nameValid && name !== '' && (
                <p className="text-xs text-destructive mt-0.5">Обязательное поле</p>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Описание</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Опционально" className="mt-1 h-9" />
            </div>
          </div>

          {/* Раздел: Шкалы и правила */}
          <div className="pt-1">
            <h3 className="text-sm font-semibold text-foreground mb-3">Шкалы и правила опросника диагностики</h3>
            <div className="space-y-3">
              <HardSkillsScaleCard
                enabled={hardEnabled} onEnabledChange={setHardEnabled}
                min={hardMin} onMinChange={setHardMin}
                max={hardMax} onMaxChange={setHardMax}
                reversed={hardReversed} onReversedChange={setHardReversed}
              />
              <SoftSkillsScaleCard
                min={softMin} onMinChange={setSoftMin}
                max={softMax} onMaxChange={setSoftMax}
                reversed={softReversed} onReversedChange={setSoftReversed}
              />
              <JohariRulesCard
                softMin={softMin} softMax={softMax}
                state={johari} onChange={handleJohariChange}
              />
            </div>
          </div>

          {/* Условный инфо-блок — только если реверс включён */}
          {(hardReversed || softReversed) && (
            <Alert className="border-amber-200 bg-amber-50 p-2.5">
              <Info className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <AlertDescription className="text-xs text-amber-700 ml-2">
                Реверс шкалы включён. Баллы ответа остаются прежними для респондента, но в аналитике и профиле компетенций направление инвертируется. Формула: итоговый балл = мин + макс − ответ.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="border-t pt-3 gap-2 sm:gap-2 flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9">Отмена</Button>
          <Button variant="secondary" onClick={handleSave} disabled={!formValid || saving} className="h-9">
            {saving ? 'Сохранение...' : 'Сохранить черновик'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
// ─── Expanded Details Row ──────────────────────────────────────────────────
const TemplateDetails: React.FC<{ tpl: DiagnosticConfigTemplate; summary: TemplateSummary }> = ({ tpl, summary }) => {
  const { selectTemplate } = useTemplateSelection();

  const navigateToAnswerOptions = () => {
    selectTemplate(tpl.id);
    const questionsTab = document.querySelector('[data-value="questions"]') as HTMLElement;
    if (questionsTab) questionsTab.click();
  };

  return (
    <TableRow>
      <TableCell colSpan={9} className="bg-muted/20 p-4">
        <div className="space-y-4 text-sm">
          {tpl.description && (
            <p className="text-muted-foreground">{tpl.description}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Левый блок — Шкалы */}
            <div className="border border-border rounded-lg p-3 bg-card space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Шкалы</h4>
              <div>
                <span className="text-muted-foreground">Hard-навыки: </span>
                <span className="font-medium">{summary.hardSkillsLabel}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Шкала Hard: </span>
                <span className="font-medium">{summary.hardScaleLabel}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Шкала Soft: </span>
                <span className="font-medium">{summary.softScaleLabel}</span>
              </div>
              {summary.reverseExplanation && (
                <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2">
                  <p className="text-xs font-medium text-amber-800 mb-1">⚠️ Реверс шкалы активен</p>
                  <p className="text-xs text-amber-700">{summary.reverseExplanation}</p>
                </div>
              )}
            </div>

            {/* Правый блок — Правила */}
            <div className="border border-border rounded-lg p-3 bg-card space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Правила</h4>
              <div>
                <span className="text-muted-foreground">Комментарии: </span>
                <span className="font-medium">{summary.commentsLabel}</span>
                {summary.commentExceptions > 0 && (
                  <span className="text-muted-foreground ml-1">(исключения: {summary.commentExceptions})</span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Открытые вопросы: </span>
                <span className="font-medium">{summary.openQuestionsLabel}</span>
              </div>
            </div>
          </div>

          {/* Блок Johari */}
          <div className="border border-border rounded-lg p-3 bg-card space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Окно Джохари</h4>
            <p className="font-medium">{summary.johariLabel}</p>
          </div>

          {/* Покрытие шкалы */}
          <TemplateCoverageReport templateId={tpl.id} />

          {/* Accordion: Подробнее */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="details" className="border-none">
              <AccordionTrigger className="py-1 text-xs text-muted-foreground hover:no-underline">
                Подробнее о шаблоне
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground pb-2">
                {summary.detailsText}
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Button variant="outline" size="sm" onClick={navigateToAnswerOptions}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Открыть «Вопросы и ответы» для настройки вариантов
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

// ─── Main Manager ──────────────────────────────────────────────────────────
export const DiagnosticConfigTemplatesManager: React.FC = () => {
  const {
    templates, loading,
    fetchTemplates, fetchLabels,
    approveTemplate, archiveTemplate,
    fetchTemplateCoverage,
  } = useDiagnosticConfigTemplates();

  const [formOpen, setFormOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<DiagnosticConfigTemplate | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Coverage readiness cache: templateId → 'ready' | 'gaps' | 'loading' | null
  type ReadinessStatus = 'ready' | 'gaps' | 'loading' | null;
  const [readinessMap, setReadinessMap] = useState<Map<string, ReadinessStatus>>(new Map());

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // Fetch coverage for all draft templates once templates are loaded
  useEffect(() => {
    if (templates.length === 0) return;
    const drafts = templates.filter(t => t.status === 'draft');
    if (drafts.length === 0) return;

    // Mark all drafts as loading
    setReadinessMap(prev => {
      const next = new Map(prev);
      drafts.forEach(d => {
        if (!next.has(d.id)) next.set(d.id, 'loading');
      });
      return next;
    });

    // Fetch coverage for each draft (don't block render)
    drafts.forEach(async (d) => {
      const result = await fetchTemplateCoverage(d.id);
      setReadinessMap(prev => {
        const next = new Map(prev);
        if (!result) {
          next.set(d.id, null);
        } else {
          next.set(d.id, result.allComplete ? 'ready' : 'gaps');
        }
        return next;
      });
    });
  }, [templates, fetchTemplateCoverage]);

  // Pre-compute summaries for all templates
  const summariesMap = useMemo(() => {
    const map = new Map<string, TemplateSummary>();
    templates.forEach(tpl => map.set(tpl.id, buildTemplateSummary(tpl)));
    return map;
  }, [templates]);

  const handleApprove = async (tpl: DiagnosticConfigTemplate) => {
    await approveTemplate(tpl.id);
  };

  const readinessBadge = (tplId: string, status: string) => {
    // Only show for drafts
    if (status !== 'draft') return <span className="text-xs text-muted-foreground">—</span>;

    const readiness = readinessMap.get(tplId);
    if (readiness === 'loading') {
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
    }
    if (readiness === 'ready') {
      return (
        <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50">
          Готов
        </Badge>
      );
    }
    if (readiness === 'gaps') {
      return (
        <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
          Есть пробелы
        </Badge>
      );
    }
    return <span className="text-xs text-muted-foreground">Нет данных</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Шкалы и правила диагностики</h2>
          <p className="text-sm text-muted-foreground">
            Настройка шкал оценки, реверсивной логики и параметров опросов.
            Варианты ответа редактируются на вкладке «Вопросы и ответы».
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditTemplate(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Новый шаблон
        </Button>
      </div>

      {loading && <p className="text-muted-foreground text-sm">Загрузка...</p>}

      {!loading && templates.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          Шаблонов пока нет. Создайте первый шаблон.
        </p>
      )}

      {!loading && templates.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Название</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Готовность</TableHead>
              <TableHead>Hard-навыки</TableHead>
              <TableHead>Шкала Hard</TableHead>
              <TableHead>Шкала Soft</TableHead>
              <TableHead>Комментарии</TableHead>
              <TableHead>Откр. вопросы</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map(tpl => {
              const s = summariesMap.get(tpl.id)!;
              const readiness = readinessMap.get(tpl.id);
              const hasGaps = readiness === 'gaps';
              const coverageUnknown = readiness === 'loading' || readiness === null || readiness === undefined;
              const canApprove = tpl.status === 'draft' && !hasGaps && !coverageUnknown;

              return (
                <React.Fragment key={tpl.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setExpandedId(expandedId === tpl.id ? null : tpl.id)}
                  >
                    <TableCell className="px-2">
                      {expandedId === tpl.id
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{tpl.name}</span>
                        <span className="text-muted-foreground text-xs ml-1.5">v{tpl.version}</span>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(tpl.status)}</TableCell>
                    <TableCell>{readinessBadge(tpl.id, tpl.status)}</TableCell>
                    <TableCell>
                      <Badge variant={tpl.hard_skills_enabled ? 'default' : 'secondary'} className="text-xs">
                        {s.hardSkillsLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.hardScaleLabel}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.softScaleLabel}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{s.commentsLabel}</div>
                      {s.commentExceptions > 0 && (
                        <div className="text-xs text-muted-foreground/70">Исключения: {s.commentExceptions}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.openQuestionsLabel}
                    </TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {tpl.status === 'draft' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setEditTemplate(tpl); setFormOpen(true); }}
                            >
                              <Pencil className="h-3 w-3 mr-1" /> Редактировать
                            </Button>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    size="sm"
                                    onClick={() => handleApprove(tpl)}
                                    disabled={!canApprove}
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" /> Утвердить
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              {!canApprove && (
                                <TooltipContent side="top" className="max-w-xs text-xs">
                                  {hasGaps
                                    ? 'Не все группы ответов покрывают диапазон шкалы. Раскройте шаблон для подробностей.'
                                    : 'Проверка покрытия ещё не завершена. Подождите загрузки.'}
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </>
                        )}
                        {tpl.status === 'approved' && (
                          <Button size="sm" variant="outline" onClick={() => archiveTemplate(tpl.id)}>
                            <Archive className="h-3 w-3 mr-1" /> Архивировать
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === tpl.id && <TemplateDetails tpl={tpl} summary={s} />}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}

      <TemplateFormDialog open={formOpen} onOpenChange={setFormOpen} template={editTemplate} onSuccess={fetchTemplates} />
    </div>
  );
};
