import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Plus, Pencil, Archive, CheckCircle, ChevronDown, ChevronUp, ExternalLink, Info } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  useDiagnosticConfigTemplates,
  DiagnosticConfigTemplate,
} from '@/hooks/useDiagnosticConfigTemplates';
import { useAuth } from '@/contexts/AuthContext';

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

const reverseBadge = (hard: boolean, soft: boolean) => {
  if (!hard && !soft) return <span className="text-muted-foreground text-xs">Выкл</span>;
  const parts: string[] = [];
  if (hard) parts.push('Hard');
  if (soft) parts.push('Soft');
  return <Badge variant="warning">{parts.join(' + ')}</Badge>;
};

// ─── Template Form Dialog ──────────────────────────────────────────────────
interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: DiagnosticConfigTemplate | null;
}

const TemplateFormDialog: React.FC<TemplateFormDialogProps> = ({ open, onOpenChange, template }) => {
  const { createTemplate, updateTemplate, fetchLabels, approveTemplate } = useDiagnosticConfigTemplates();
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
    } else {
      setName(''); setDescription('');
      setHardMin(0); setHardMax(4); setSoftMin(0); setSoftMax(5);
      setHardReversed(false); setSoftReversed(false); setHardEnabled(true);
    }
  }, [template, open]);

  // --- validation ---
  const nameValid = name.trim().length > 0;
  const hardRangeValid = !hardEnabled || (hardMin >= 0 && hardMax > hardMin);
  const softRangeValid = softMin >= 0 && softMax > softMin;
  const formValid = nameValid && hardRangeValid && softRangeValid;

  const hardRangeError = hardEnabled && hardMin >= 0 && hardMax <= hardMin
    ? 'Максимум должен быть больше минимума' : null;
  const softRangeError = softMin >= 0 && softMax <= softMin
    ? 'Максимум должен быть больше минимума' : null;

  const buildInput = () => ({
    name: name.trim(),
    description: description.trim() || undefined,
    hard_scale_min: hardMin, hard_scale_max: hardMax,
    soft_scale_min: softMin, soft_scale_max: softMax,
    hard_scale_reversed: hardReversed, soft_scale_reversed: softReversed,
    hard_skills_enabled: hardEnabled,
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
      onOpenChange(false);
    } finally { setSaving(false); }
  };

  const handleApprove = async () => {
    if (!formValid || !isEdit || !template) return;
    setApproving(true);
    try {
      await updateTemplate(template.id, buildInput());
      const tplLabels = await fetchLabels(template.id);
      await approveTemplate(template.id, tplLabels);
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
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button onClick={handleApprove} disabled={!canApprove || approving} className="h-9">
                  {approving ? 'Утверждение...' : 'Утвердить'}
                </Button>
              </span>
            </TooltipTrigger>
            {!canApprove && (
              <TooltipContent side="top">
                {!isEdit
                  ? 'Сначала создайте шаблон'
                  : !formValid
                    ? 'Исправьте ошибки валидации'
                    : template?.status !== 'draft'
                      ? 'Можно утвердить только черновик'
                      : ''}
              </TooltipContent>
            )}
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Expanded Details Row ──────────────────────────────────────────────────
const TemplateDetails: React.FC<{ tpl: DiagnosticConfigTemplate }> = ({ tpl }) => {
  const navigateToAnswerOptions = () => {
    sessionStorage.setItem('activeTemplateContext', JSON.stringify({
      id: tpl.id, name: tpl.name, version: tpl.version,
      hard_scale_min: tpl.hard_scale_min, hard_scale_max: tpl.hard_scale_max,
      soft_scale_min: tpl.soft_scale_min, soft_scale_max: tpl.soft_scale_max,
      hard_skills_enabled: tpl.hard_skills_enabled,
    }));
    const questionsTab = document.querySelector('[data-value="questions"]') as HTMLElement;
    if (questionsTab) questionsTab.click();
  };

  return (
    <TableRow>
      <TableCell colSpan={8} className="bg-muted/20 p-3">
        <div className="space-y-3 text-sm">
          {tpl.description && (
            <p className="text-muted-foreground">{tpl.description}</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <span className="text-muted-foreground">Soft диапазон:</span>{' '}
              <span className="font-medium">[{tpl.soft_scale_min}..{tpl.soft_scale_max}]</span>
            </div>
            <div>
              <span className="text-muted-foreground">Soft реверс:</span>{' '}
              <span className="font-medium">{tpl.soft_scale_reversed ? 'Да' : 'Нет'}</span>
            </div>
            {tpl.hard_skills_enabled ? (
              <>
                <div>
                  <span className="text-muted-foreground">Hard диапазон:</span>{' '}
                  <span className="font-medium">[{tpl.hard_scale_min}..{tpl.hard_scale_max}]</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Hard реверс:</span>{' '}
                  <span className="font-medium">{tpl.hard_scale_reversed ? 'Да' : 'Нет'}</span>
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <span className="text-muted-foreground">Hard Skills:</span>{' '}
                <span className="font-medium">Выключены</span>
              </div>
            )}
          </div>

          {(tpl.hard_scale_reversed || tpl.soft_scale_reversed) && (
            <Alert className="border-accent bg-accent/10">
              <Info className="h-4 w-4 text-accent-foreground" />
              <AlertDescription className="text-xs text-muted-foreground">
                Названия и описания вариантов ответа переписывать не нужно.
                При реверсе меняется только интерпретация баллов в аналитике.
              </AlertDescription>
            </Alert>
          )}

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

  const handleApprove = async (tpl: DiagnosticConfigTemplate) => {
    const tplLabels = await fetchLabels(tpl.id);
    await approveTemplate(tpl.id, tplLabels);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Шкалы и правила диагностики</h2>
          <p className="text-sm text-muted-foreground">
            Настройка диапазонов шкал, реверса и параметров опросов.
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
              <TableHead className="text-center">Версия</TableHead>
              <TableHead>Hard</TableHead>
              <TableHead>Soft</TableHead>
              <TableHead>Реверс</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map(tpl => (
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
                  <TableCell className="font-medium">{tpl.name}</TableCell>
                  <TableCell>{statusBadge(tpl.status)}</TableCell>
                  <TableCell className="text-center text-muted-foreground">v{tpl.version}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tpl.hard_skills_enabled
                      ? `[${tpl.hard_scale_min}..${tpl.hard_scale_max}]`
                      : 'Выкл'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    [{tpl.soft_scale_min}..{tpl.soft_scale_max}]
                  </TableCell>
                  <TableCell>
                    {reverseBadge(
                      tpl.hard_skills_enabled && tpl.hard_scale_reversed,
                      tpl.soft_scale_reversed,
                    )}
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
                {expandedId === tpl.id && <TemplateDetails tpl={tpl} />}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      )}

      <TemplateFormDialog open={formOpen} onOpenChange={setFormOpen} template={editTemplate} />
    </div>
  );
};
