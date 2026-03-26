import React, { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Plus, Pencil, Archive, CheckCircle, ChevronDown, ChevronUp, ExternalLink, Info } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  useDiagnosticConfigTemplates,
  DiagnosticConfigTemplate,
} from '@/hooks/useDiagnosticConfigTemplates';
import { useAuth } from '@/contexts/AuthContext';
import { buildTemplateSummary, type TemplateSummary } from '@/lib/templateViewModel';

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
  const [approving, setApproving] = useState(false);

  // Johari rules state (stored as fractions 0.20, displayed as % 20)
  const [johariOpenPct, setJohariOpenPct] = useState(0.20);
  const [johariBhPct, setJohariBhPct] = useState(0.25);
  const [johariBorderlineEnabled, setJohariBorderlineEnabled] = useState(true);
  const [johariBorderlineThreshold, setJohariBorderlineThreshold] = useState(0.45);
  const [johariBorderlineDown, setJohariBorderlineDown] = useState(0.40);
  const [johariBorderlineUp, setJohariBorderlineUp] = useState(0.50);

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
      // Johari rules
      const jr = template.johari_rules as Record<string, any> | undefined;
      if (jr && jr.open_delta_pct !== undefined) {
        setJohariOpenPct(jr.open_delta_pct);
        setJohariBhPct(jr.blind_hidden_delta_pct);
        setJohariBorderlineEnabled(jr.borderline_rounding_enabled ?? true);
        setJohariBorderlineThreshold(jr.borderline_threshold_delta ?? 0.45);
        setJohariBorderlineDown(jr.borderline_round_down_to ?? 0.40);
        setJohariBorderlineUp(jr.borderline_round_up_to ?? 0.50);
      } else {
        setJohariOpenPct(0.20); setJohariBhPct(0.25);
        setJohariBorderlineEnabled(true); setJohariBorderlineThreshold(0.45);
        setJohariBorderlineDown(0.40); setJohariBorderlineUp(0.50);
      }
    } else {
      setName(''); setDescription('');
      setHardMin(0); setHardMax(4); setSoftMin(0); setSoftMax(5);
      setHardReversed(false); setSoftReversed(false); setHardEnabled(true);
      setJohariOpenPct(0.20); setJohariBhPct(0.25);
      setJohariBorderlineEnabled(true); setJohariBorderlineThreshold(0.45);
      setJohariBorderlineDown(0.40); setJohariBorderlineUp(0.50);
    }
  }, [template, open]);

  const nameValid = name.trim().length > 0;
  const hardRangeValid = !hardEnabled || (hardMin >= 0 && hardMax > hardMin);
  const softRangeValid = softMin >= 0 && softMax > softMin;

  // Johari validation
  const johariOpenValid = johariOpenPct >= 0 && johariOpenPct <= 0.5;
  const johariBhValid = johariBhPct >= 0 && johariBhPct <= 0.5;
  const johariOrderValid = johariOpenPct < johariBhPct;
  const johariBorderlineValid = !johariBorderlineEnabled || (
    johariBorderlineDown < johariBorderlineThreshold && johariBorderlineThreshold < johariBorderlineUp
  );
  const johariValid = johariOpenValid && johariBhValid && johariOrderValid && johariBorderlineValid;

  const formValid = nameValid && hardRangeValid && softRangeValid && johariValid;

  const hardRangeError = hardEnabled && hardMin >= 0 && hardMax <= hardMin
    ? 'Максимум должен быть больше минимума' : null;
  const softRangeError = softMin >= 0 && softMax <= softMin
    ? 'Максимум должен быть больше минимума' : null;

  // Johari delta calculator
  const softRange = softMax - softMin;
  const johariOpenDelta = softRange * johariOpenPct;
  const johariBhDelta = softRange * johariBhPct;

  const buildInput = () => ({
    name: name.trim(),
    description: description.trim() || undefined,
    hard_scale_min: hardMin, hard_scale_max: hardMax,
    soft_scale_min: softMin, soft_scale_max: softMax,
    hard_scale_reversed: hardReversed, soft_scale_reversed: softReversed,
    hard_skills_enabled: hardEnabled,
    johari_rules: {
      applies_to: 'soft',
      open_delta_pct: johariOpenPct,
      blind_hidden_delta_pct: johariBhPct,
      borderline_rounding_enabled: johariBorderlineEnabled,
      borderline_threshold_delta: johariBorderlineThreshold,
      borderline_round_down_to: johariBorderlineDown,
      borderline_round_up_to: johariBorderlineUp,
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

  const handleApprove = async () => {
    if (!formValid || !isEdit || !template) return;
    setApproving(true);
    try {
      await updateTemplate(template.id, buildInput());
      await approveTemplate(template.id);
      onSuccess?.();
      onOpenChange(false);
    } finally { setApproving(false); }
  };

  const canApprove = isEdit && formValid && template?.status === 'draft';

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
              {/* Карточка Hard-навыки */}
              <div className="border border-border rounded-lg p-3 bg-card">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Включить Hard-навыки в опросник</Label>
                    <Switch checked={hardEnabled} onCheckedChange={setHardEnabled} />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <Label className="text-xs text-muted-foreground">Минимум (Hard)</Label>
                      <Input
                        type="number" min={0} value={hardMin}
                        onChange={e => setHardMin(+e.target.value)}
                        disabled={!hardEnabled} className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Максимум (Hard)</Label>
                      <Input
                        type="number" min={0} value={hardMax}
                        onChange={e => setHardMax(+e.target.value)}
                        disabled={!hardEnabled} className="mt-1 h-9"
                      />
                    </div>
                  </div>
                  {hardEnabled && hardRangeError && (
                    <p className="text-xs text-destructive">{hardRangeError}</p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <Label className="text-sm">Реверс шкалы Hard</Label>
                    <Switch checked={hardReversed} onCheckedChange={setHardReversed} disabled={!hardEnabled} />
                  </div>
                </div>
              </div>

              {/* Карточка Soft-навыки */}
              <div className="border border-border rounded-lg p-3 bg-card">
                <div className="space-y-2.5">
                  <h4 className="text-sm font-medium text-foreground">Soft-навыки</h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <Label className="text-xs text-muted-foreground">Минимум (Soft)</Label>
                      <Input type="number" min={0} value={softMin} onChange={e => setSoftMin(+e.target.value)} className="mt-1 h-9" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Максимум (Soft)</Label>
                      <Input type="number" min={0} value={softMax} onChange={e => setSoftMax(+e.target.value)} className="mt-1 h-9" />
                    </div>
                  </div>
                  {softRangeError && (
                    <p className="text-xs text-destructive">{softRangeError}</p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <Label className="text-sm">Реверс шкалы Soft</Label>
                    <Switch checked={softReversed} onCheckedChange={setSoftReversed} />
                  </div>
                </div>
              </div>

              {/* Карточка Правила Johari */}
              <div className="border border-border rounded-lg p-3 bg-card">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-medium text-foreground">Правила Johari (soft skills)</h4>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs text-xs">
                        <p>Абсолютная дельта рассчитывается по формуле:</p>
                        <p className="font-mono mt-1">δ = (scale_max − scale_min) × %</p>
                        <p className="mt-1">Пример: шкала 0–5, 20% → δ = 1.0</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Шкала Soft: {softMin}–{softMax} (диапазон: {softRange})
                  </p>

                  {/* Open zone % */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <Label className="text-xs text-muted-foreground">% для открытой зоны</Label>
                      <Input
                        type="number" min={0} max={50} step={1}
                        value={Math.round(johariOpenPct * 100)}
                        onChange={e => setJohariOpenPct(Math.max(0, Math.min(50, +e.target.value)) / 100)}
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">δ открытой зоны</Label>
                      <Input value={johariOpenDelta.toFixed(2)} disabled className="mt-1 h-9 bg-muted" />
                    </div>
                  </div>

                  {/* Blind/hidden zone % */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <Label className="text-xs text-muted-foreground">% для blind/hidden зоны</Label>
                      <Input
                        type="number" min={0} max={50} step={1}
                        value={Math.round(johariBhPct * 100)}
                        onChange={e => setJohariBhPct(Math.max(0, Math.min(50, +e.target.value)) / 100)}
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">δ blind/hidden зоны</Label>
                      <Input value={johariBhDelta.toFixed(2)} disabled className="mt-1 h-9 bg-muted" />
                    </div>
                  </div>

                  {/* Validation errors */}
                  {!johariOrderValid && (
                    <p className="text-xs text-destructive">% открытой зоны должен быть меньше % blind/hidden</p>
                  )}

                  {/* Borderline rounding */}
                  <div className="flex items-center justify-between pt-1">
                    <Label className="text-sm">Пограничное округление</Label>
                    <Switch checked={johariBorderlineEnabled} onCheckedChange={setJohariBorderlineEnabled} />
                  </div>

                  {johariBorderlineEnabled && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Порог</Label>
                        <Input
                          type="number" step={0.01}
                          value={johariBorderlineThreshold}
                          onChange={e => setJohariBorderlineThreshold(+e.target.value)}
                          className="mt-1 h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Округл. вниз</Label>
                        <Input
                          type="number" step={0.01}
                          value={johariBorderlineDown}
                          onChange={e => setJohariBorderlineDown(+e.target.value)}
                          className="mt-1 h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Округл. вверх</Label>
                        <Input
                          type="number" step={0.01}
                          value={johariBorderlineUp}
                          onChange={e => setJohariBorderlineUp(+e.target.value)}
                          className="mt-1 h-9"
                        />
                      </div>
                    </div>
                  )}
                  {johariBorderlineEnabled && !johariBorderlineValid && (
                    <p className="text-xs text-destructive">Должно выполняться: округл. вниз {'<'} порог {'<'} округл. вверх</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Инфо-блок */}
          <Alert className="border-border bg-muted/40 p-2.5">
            <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <AlertDescription className="text-xs text-muted-foreground ml-2">
              Названия и описания вариантов ответа переписывать не нужно. При реверсе меняется только интерпретация баллов в аналитике.
            </AlertDescription>
          </Alert>
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
  const navigateToAnswerOptions = () => {
    sessionStorage.setItem('activeTemplateContext', JSON.stringify({
      id: tpl.id, name: tpl.name, version: tpl.version,
      hard_scale_min: tpl.hard_scale_min, hard_scale_max: tpl.hard_scale_max,
      soft_scale_min: tpl.soft_scale_min, soft_scale_max: tpl.soft_scale_max,
      hard_skills_enabled: tpl.hard_skills_enabled,
      hard_scale_reversed: tpl.hard_scale_reversed,
      soft_scale_reversed: tpl.soft_scale_reversed,
    }));
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
  } = useDiagnosticConfigTemplates();

  const [formOpen, setFormOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<DiagnosticConfigTemplate | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // Pre-compute summaries for all templates
  const summariesMap = useMemo(() => {
    const map = new Map<string, TemplateSummary>();
    templates.forEach(tpl => map.set(tpl.id, buildTemplateSummary(tpl)));
    return map;
  }, [templates]);

  const handleApprove = async (tpl: DiagnosticConfigTemplate) => {
    await approveTemplate(tpl.id);
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
                            <Button size="sm" onClick={() => handleApprove(tpl)}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Утвердить
                            </Button>
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
