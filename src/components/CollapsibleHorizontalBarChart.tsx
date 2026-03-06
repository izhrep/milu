import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface BarChartDataItem {
  label: string;
  value: number | null;
  color: string;
  count?: number;
}

interface CollapsibleHorizontalBarChartProps {
  data: BarChartDataItem[];
  title?: string;
  subtitle?: string;
  maxValue?: number;
  defaultOpen?: boolean;
}

export const CollapsibleHorizontalBarChart: React.FC<CollapsibleHorizontalBarChartProps> = ({ 
  data, 
  title,
  subtitle,
  maxValue = 5,
  defaultOpen = true
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!data || data.length === 0) {
    return (
      <Card>
        {title && (
          <CardHeader>
            <CardTitle className="text-base">{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <p className="text-sm text-muted-foreground">Нет данных для отображения</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/40 shadow-sm">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-4">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer group">
              <div className="flex-1">
                <CardTitle className="text-base font-semibold text-foreground/90">{title}</CardTitle>
                {subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 group-hover:bg-muted">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 py-4 pt-0">
            {/* Ось X */}
            <div className="flex items-center gap-4 mb-2">
              <div className="w-[180px] shrink-0"></div>
              <div className="flex-1 flex justify-between px-1">
                {Array.from({ length: maxValue + 1 }, (_, i) => (
                  <span key={i} className="text-xs text-muted-foreground">{i}</span>
                ))}
              </div>
              <div className="w-[65px] shrink-0"></div>
            </div>

            {data.map((item, index) => {
              const hasValue = item.value != null;
              return (
                <div key={index} className="flex items-center gap-4">
                  <div 
                    className={`w-[180px] shrink-0 text-sm font-medium truncate ${hasValue ? 'text-foreground/80' : 'text-muted-foreground/60'}`} 
                    title={item.label}
                  >
                    {item.label}
                    {hasValue && item.count !== undefined && item.count > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">({item.count})</span>
                    )}
                  </div>
                  <div className="flex-1 flex items-center">
                    <div className="w-full h-6 relative">
                      <svg 
                        width="100%" 
                        height="100%" 
                        className="overflow-visible"
                        style={{ display: 'block' }}
                      >
                        {/* Фоновая полоса (серая) */}
                        <rect
                          x="0"
                          y="0"
                          width="100%"
                          height="100%"
                          rx="8"
                          ry="8"
                          fill="hsl(var(--muted) / 0.4)"
                        />
                        {/* Цветная полоса значения */}
                        {hasValue && (
                          <rect
                            x="0"
                            y="0"
                            width={`${Math.min((item.value / maxValue) * 100, 100)}%`}
                            height="100%"
                            rx="8"
                            ry="8"
                            fill={item.color}
                            fillOpacity={0.85}
                            className="transition-all duration-500 ease-out"
                          />
                        )}
                      </svg>
                      {/* Текст "Нет ответа" для пустых значений */}
                      {!hasValue && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs text-muted-foreground/50">Нет ответа</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="w-[65px] shrink-0 text-right">
                    <span className={`text-sm font-semibold tabular-nums ${hasValue ? 'text-foreground/90' : 'text-muted-foreground/50'}`}>
                      {hasValue ? item.value.toFixed(2) : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
