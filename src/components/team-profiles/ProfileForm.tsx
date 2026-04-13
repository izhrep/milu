import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  ManagementProfile,
  SalaryMode,
  ChangeType,
  changeTypeLabels,
  emptyProfile,
} from './profileTypes';
import ProjectSelect from './ProjectSelect';

interface Props {
  initial: ManagementProfile;
  onSave: (data: ManagementProfile) => void;
  onSaveAndNext: (data: ManagementProfile) => void;
  onCancel?: () => void;
  isEditing: boolean;
  onStartEdit: () => void;
}

const SIGNAL_KEYS = [
  ['wantsProjectChange', 'Хочет сменить проект'],
  ['satisfiedWithProject', 'Удовлетворен текущим проектом'],
  ['satisfiedWithSalary', 'Удовлетворен текущей зарплатой'],
  ['readyForOvertime', 'Готов к переработкам'],
  ['readyForLeadership', 'Готов к лидерской роли'],
] as const;

function signalsSummary(form: ManagementProfile): string | null {
  const count = SIGNAL_KEYS.filter(([k]) => form[k]).length;
  const hasComment = !!form.signalsComment.trim();
  const parts: string[] = [];
  if (count > 0) parts.push(`${count} отмечено`);
  if (hasComment) parts.push('есть комментарий');
  return parts.length > 0 ? parts.join(', ') : null;
}

const ProfileForm = ({ initial, onSave, onSaveAndNext, onCancel, isEditing, onStartEdit }: Props) => {
  const [form, setForm] = useState<ManagementProfile>({ ...initial });
  const [signalsOpen, setSignalsOpen] = useState(false);

  const upd = <K extends keyof ManagementProfile>(key: K, value: ManagementProfile[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(form);
    toast.success('Профиль сохранен');
  };

  const handleSaveNext = () => {
    onSaveAndNext(form);
    toast.success('Профиль сохранен');
  };

  if (!isEditing) {
    // Read-only view
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <span className="text-text-secondary">Текущий проект</span>
            <p className="font-medium text-text-primary">{form.currentProject || 'Не указан'}</p>
          </div>
          <div>
            <span className="text-text-secondary">Текущая роль</span>
            <p className="font-medium text-text-primary">{form.currentRole || '—'}</p>
          </div>
          <div>
            <span className="text-text-secondary">Зарплата</span>
            <p className="font-medium text-text-primary">
              {form.salaryExact || '—'}
            </p>
          </div>
          <div>
            <span className="text-text-secondary">Дата актуальности</span>
            <p className="font-medium text-text-primary">{form.relevanceDate || '—'}</p>
          </div>
        </div>
        {form.lastChangeType && (
          <>
            <Separator />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <span className="text-text-secondary">Что изменилось</span>
                <p className="font-medium text-text-primary">{changeTypeLabels[form.lastChangeType as ChangeType] || form.lastChangeType}</p>
              </div>
              <div>
                <span className="text-text-secondary">Когда</span>
                <p className="font-medium text-text-primary">{form.lastChangeDate || '—'}</p>
              </div>
              {form.lastChangeReason && (
                <div className="col-span-2">
                  <span className="text-text-secondary">Почему</span>
                  <p className="font-medium text-text-primary">{form.lastChangeReason}</p>
                </div>
              )}
            </div>
          </>
        )}
        <Separator />
        <div className="text-sm space-y-1">
          {form.wantsProjectChange && <p>✓ Хочет сменить проект</p>}
          {form.satisfiedWithProject && <p>✓ Удовлетворен текущим проектом</p>}
          {form.satisfiedWithSalary && <p>✓ Удовлетворен текущей зарплатой</p>}
          {form.readyForOvertime && <p>✓ Готов к переработкам</p>}
          {form.readyForLeadership && <p>✓ Готов к лидерской роли</p>}
          {form.signalsComment && <p className="text-text-secondary mt-2">{form.signalsComment}</p>}
        </div>
        <Button variant="outline" onClick={onStartEdit}>Редактировать</Button>
      </div>
    );
  }

  const summary = signalsSummary(form);

  return (
    <div className="space-y-6">
      {/* Block 1: Что сейчас */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Что сейчас</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Текущий проект *</Label>
            <ProjectSelect
              value={form.currentProject}
              onChange={(v) => upd('currentProject', v)}
            />
          </div>
          <div className="space-y-2">
            <Label>Текущая роль *</Label>
            <Input
              value={form.currentRole}
              onChange={e => upd('currentRole', e.target.value)}
              placeholder="Роль на проекте"
            />
          </div>
        </div>

        {/* Salary */}
        <div className="space-y-3">
          <Label>Зарплата *</Label>
          <Input
            type="number"
            value={form.salaryExact}
            onChange={e => {
              upd('salaryMode', 'exact' as SalaryMode);
              upd('salaryExact', e.target.value);
            }}
            placeholder="Сумма"
          />
        </div>

        <div className="space-y-2">
          <Label>Дата актуальности *</Label>
          <Input
            type="date"
            value={form.relevanceDate}
            onChange={e => upd('relevanceDate', e.target.value)}
          />
        </div>
      </div>

      <Separator />

      {/* Block 2: Последнее известное изменение */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Последнее известное изменение</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Что изменилось</Label>
            <Select value={form.lastChangeType} onValueChange={v => upd('lastChangeType', v as ChangeType)}>
              <SelectTrigger><SelectValue placeholder="Выберите..." /></SelectTrigger>
              <SelectContent>
                {(Object.entries(changeTypeLabels) as [ChangeType, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Когда</Label>
            <Input
              type="date"
              value={form.lastChangeDate}
              onChange={e => upd('lastChangeDate', e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Почему</Label>
          <Textarea
            value={form.lastChangeReason}
            onChange={e => upd('lastChangeReason', e.target.value)}
            placeholder="Причина изменения..."
            rows={2}
          />
        </div>
      </div>

      <Separator />

      {/* Block 3: Сигналы — collapsible */}
      <Collapsible open={signalsOpen} onOpenChange={setSignalsOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between w-full group text-left"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Сигналы</h3>
              {!signalsOpen && summary && (
                <span className="text-xs text-text-secondary font-normal normal-case">
                  ({summary})
                </span>
              )}
            </div>
            <ChevronDown
              className={`h-4 w-4 text-text-secondary transition-transform duration-200 ${signalsOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <div className="space-y-3">
            {SIGNAL_KEYS.map(([key, label]) => (
              <div key={key} className="flex items-center space-x-2">
                <Checkbox
                  id={key}
                  checked={form[key]}
                  onCheckedChange={(v) => upd(key, !!v)}
                />
                <Label htmlFor={key} className="font-normal">{label}</Label>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Комментарий к сигналам</Label>
            <Textarea
              value={form.signalsComment}
              onChange={e => upd('signalsComment', e.target.value)}
              placeholder="Дополнительные наблюдения..."
              rows={2}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleSave}>
          Сохранить
        </Button>
        <Button variant="outline" onClick={handleSaveNext}>
          Сохранить и перейти к следующему
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Отмена
          </Button>
        )}
      </div>
    </div>
  );
};

export default ProfileForm;
