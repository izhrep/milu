import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ReversePreviewTable } from './ReversePreviewTable';

export interface HardSkillsScaleCardProps {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  min: number;
  onMinChange: (v: number) => void;
  max: number;
  onMaxChange: (v: number) => void;
  reversed: boolean;
  onReversedChange: (v: boolean) => void;
  /** Optional level labels from template_scale_labels, keyed by level_value. */
  scaleLabels?: Map<number, string>;
}

export const HardSkillsScaleCard: React.FC<HardSkillsScaleCardProps> = ({
  enabled, onEnabledChange,
  min, onMinChange,
  max, onMaxChange,
  reversed, onReversedChange,
  scaleLabels,
}) => {
  const rangeError = enabled && min >= 0 && max <= min
    ? 'Максимум должен быть больше минимума' : null;

  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Включить Hard-навыки в опросник</Label>
          <Switch checked={enabled} onCheckedChange={onEnabledChange} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <Label className="text-xs text-muted-foreground">Минимум (Hard)</Label>
            <Input
              type="number" min={0} value={min}
              onChange={e => onMinChange(+e.target.value)}
              disabled={!enabled} className="mt-1 h-9"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Максимум (Hard)</Label>
            <Input
              type="number" min={0} value={max}
              onChange={e => onMaxChange(+e.target.value)}
              disabled={!enabled} className="mt-1 h-9"
            />
          </div>
        </div>
        {enabled && rangeError && (
          <p className="text-xs text-destructive">{rangeError}</p>
        )}
        <div className="flex items-center justify-between pt-1">
          <Label className="text-sm">Реверс шкалы Hard</Label>
          <Switch checked={reversed} onCheckedChange={onReversedChange} disabled={!enabled} />
        </div>
        {enabled && reversed && max > min && (
          <ReversePreviewTable min={min} max={max} labels={scaleLabels} />
        )}
      </div>
    </div>
  );
};
