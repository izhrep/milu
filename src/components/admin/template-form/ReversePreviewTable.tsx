import React from 'react';
import { ArrowRightLeft } from 'lucide-react';

interface ReversePreviewTableProps {
  min: number;
  max: number;
  /** Optional labels keyed by level_value. */
  labels?: Map<number, string>;
}

/**
 * Mini-table showing raw → effective mapping when reverse is enabled.
 * Formula: effective = min + max − raw
 */
export const ReversePreviewTable: React.FC<ReversePreviewTableProps> = ({ min, max, labels }) => {
  if (max <= min) return null;

  const levels: number[] = [];
  for (let i = min; i <= max; i++) levels.push(i);

  return (
    <div className="mt-2 rounded border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/60">
            <th className="px-2 py-1 text-left text-muted-foreground font-medium">Балл ответа</th>
            <th className="px-2 py-1 text-center text-muted-foreground font-medium">
              <ArrowRightLeft className="h-3 w-3 inline-block mr-1" />
              В аналитике
            </th>
            {labels && labels.size > 0 && (
              <th className="px-2 py-1 text-left text-muted-foreground font-medium">Подпись</th>
            )}
          </tr>
        </thead>
        <tbody>
          {levels.map(raw => {
            const effective = min + max - raw;
            const label = labels?.get(raw);
            return (
              <tr key={raw} className="border-t border-border">
                <td className="px-2 py-0.5 font-mono">{raw}</td>
                <td className="px-2 py-0.5 font-mono text-center font-semibold">{effective}</td>
                {labels && labels.size > 0 && (
                  <td className="px-2 py-0.5 text-muted-foreground">{label ?? '—'}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
