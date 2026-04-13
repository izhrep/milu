import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

export interface JohariRulesState {
  openPct: number;
  bhPct: number;
  borderlineEnabled: boolean;
  borderlineThreshold: number;
  borderlineDown: number;
  borderlineUp: number;
}

export interface JohariRulesCardProps {
  softMin: number;
  softMax: number;
  state: JohariRulesState;
  onChange: (patch: Partial<JohariRulesState>) => void;
}

/** Returns true when the johari state is valid. */
export function validateJohariRules(s: JohariRulesState): boolean {
  const openValid = s.openPct >= 0 && s.openPct <= 0.5;
  const bhValid = s.bhPct >= 0 && s.bhPct <= 0.5;
  const orderValid = s.openPct < s.bhPct;
  const borderlineValid = !s.borderlineEnabled || (
    s.borderlineDown < s.borderlineThreshold && s.borderlineThreshold < s.borderlineUp
  );
  return openValid && bhValid && orderValid && borderlineValid;
}

export const JohariRulesCard: React.FC<JohariRulesCardProps> = ({
  softMin, softMax, state, onChange,
}) => {
  const softRange = softMax - softMin;
  const openDelta = softRange * state.openPct;
  const bhDelta = softRange * state.bhPct;

  const orderValid = state.openPct < state.bhPct;
  const borderlineValid = !state.borderlineEnabled || (
    state.borderlineDown < state.borderlineThreshold && state.borderlineThreshold < state.borderlineUp
  );

  return (
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
              value={Math.round(state.openPct * 100)}
              onChange={e => onChange({ openPct: Math.max(0, Math.min(50, +e.target.value)) / 100 })}
              className="mt-1 h-9"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">δ открытой зоны</Label>
            <Input value={openDelta.toFixed(2)} disabled className="mt-1 h-9 bg-muted" />
          </div>
        </div>

        {/* Blind/hidden zone % */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <Label className="text-xs text-muted-foreground">% для blind/hidden зоны</Label>
            <Input
              type="number" min={0} max={50} step={1}
              value={Math.round(state.bhPct * 100)}
              onChange={e => onChange({ bhPct: Math.max(0, Math.min(50, +e.target.value)) / 100 })}
              className="mt-1 h-9"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">δ blind/hidden зоны</Label>
            <Input value={bhDelta.toFixed(2)} disabled className="mt-1 h-9 bg-muted" />
          </div>
        </div>

        {!orderValid && (
          <p className="text-xs text-destructive">% открытой зоны должен быть меньше % blind/hidden</p>
        )}

        {/* Borderline rounding */}
        <div className="flex items-center justify-between pt-1">
          <Label className="text-sm">Пограничное округление</Label>
          <Switch checked={state.borderlineEnabled} onCheckedChange={v => onChange({ borderlineEnabled: v })} />
        </div>

        {state.borderlineEnabled && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Порог</Label>
              <Input
                type="number" step={0.01}
                value={state.borderlineThreshold}
                onChange={e => onChange({ borderlineThreshold: +e.target.value })}
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Округл. вниз</Label>
              <Input
                type="number" step={0.01}
                value={state.borderlineDown}
                onChange={e => onChange({ borderlineDown: +e.target.value })}
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Округл. вверх</Label>
              <Input
                type="number" step={0.01}
                value={state.borderlineUp}
                onChange={e => onChange({ borderlineUp: +e.target.value })}
                className="mt-1 h-9"
              />
            </div>
          </div>
        )}
        {state.borderlineEnabled && !borderlineValid && (
          <p className="text-xs text-destructive">Должно выполняться: округл. вниз {'<'} порог {'<'} округл. вверх</p>
        )}
      </div>
    </div>
  );
};
