import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ReversePreviewTable } from './ReversePreviewTable';

export interface SoftSkillsScaleCardProps {
  min: number;
  onMinChange: (v: number) => void;
  max: number;
  onMaxChange: (v: number) => void;
  reversed: boolean;
  onReversedChange: (v: boolean) => void;
  /** Optional level labels from template_scale_labels, keyed by level_value. */
  scaleLabels?: Map<number, string>;
}

export const SoftSkillsScaleCard: React.FC<SoftSkillsScaleCardProps> = ({
  min, onMinChange,
  max, onMaxChange,
  reversed, onReversedChange,
  scaleLabels,
}) => {
  const rangeError = min >= 0 && max <= min
    ? 'Максимум должен быть больше минимума' : null;

  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <div className="space-y-2.5">
        <h4 className="text-sm font-medium text-foreground">Soft-навыки</h4>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <Label className="text-xs text-muted-foreground">Минимум (Soft)</Label>
            <Input type="number" min={0} value={min} onChange={e => onMinChange(+e.target.value)} className="mt-1 h-9" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Максимум (Soft)</Label>
            <Input type="number" min={0} value={max} onChange={e => onMaxChange(+e.target.value)} className="mt-1 h-9" />
          </div>
        </div>
        {rangeError && (
          <p className="text-xs text-destructive">{rangeError}</p>
        )}
        <div className="flex items-center justify-between pt-1">
          <Label className="text-sm">Реверс шкалы Soft</Label>
          <Switch checked={reversed} onCheckedChange={onReversedChange} />
        </div>
        {reversed && max > min && (
          <ReversePreviewTable min={min} max={max} labels={scaleLabels} />
        )}
      </div>
    </div>
  );
};
