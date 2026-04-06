import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  ManagementProfile,
  SalaryMode,
  ChangeType,
  changeTypeLabels,
  emptyProfile,
} from './profileTypes';

interface Props {
  initial: ManagementProfile;
  onSave: (data: ManagementProfile) => void;
  onSaveAndNext: (data: ManagementProfile) => void;
  onCancel?: () => void;
  isEditing: boolean;
  onStartEdit: () => void;
}

const ProfileForm = ({ initial, onSave, onSaveAndNext, onCancel, isEditing, onStartEdit }: Props) => {
  const [form, setForm] = useState<ManagementProfile>({ ...initial });

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
              {form.salaryMode === 'unknown' ? 'Неизвестно'
                : form.salaryMode === 'exact' ? form.salaryExact
                : `${form.salaryFrom} — ${form.salaryTo}`}
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

  return (
    <div className="space-y-6">
      {/* Block 1: Что сейчас */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Что сейчас</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Текущий проект *</Label>
            <Input
              value={form.currentProject}
              onChange={e => upd('currentProject', e.target.value)}
              placeholder="Название проекта"
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
          <RadioGroup
            value={form.salaryMode}
            onValueChange={(v) => upd('salaryMode', v as SalaryMode)}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="exact" id="salary-exact" />
              <Label htmlFor="salary-exact" className="font-normal">Точное значение</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="range" id="salary-range" />
              <Label htmlFor="salary-range" className="font-normal">Диапазон</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="unknown" id="salary-unknown" />
              <Label htmlFor="salary-unknown" className="font-normal">Неизвестно</Label>
            </div>
          </RadioGroup>
          {form.salaryMode === 'exact' && (
            <Input
              type="number"
              value={form.salaryExact}
              onChange={e => upd('salaryExact', e.target.value)}
              placeholder="Сумма"
            />
          )}
          {form.salaryMode === 'range' && (
            <div className="flex gap-3 items-center">
              <Input
                type="number"
                value={form.salaryFrom}
                onChange={e => upd('salaryFrom', e.target.value)}
                placeholder="От"
              />
              <span className="text-text-secondary">—</span>
              <Input
                type="number"
                value={form.salaryTo}
                onChange={e => upd('salaryTo', e.target.value)}
                placeholder="До"
              />
            </div>
          )}
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

      {/* Block 3: Сигналы */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Сигналы</h3>
        <div className="space-y-3">
          {([
            ['wantsProjectChange', 'Хочет сменить проект'],
            ['satisfiedWithProject', 'Удовлетворен текущим проектом'],
            ['satisfiedWithSalary', 'Удовлетворен текущей зарплатой'],
            ['readyForOvertime', 'Готов к переработкам'],
            ['readyForLeadership', 'Готов к лидерской роли'],
          ] as const).map(([key, label]) => (
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
      </div>

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
