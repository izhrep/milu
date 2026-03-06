import React, { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from 'lucide-react';

export interface StageOption {
  id: string;
  period: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
}

interface StageFilterProps {
  stages: StageOption[] | undefined;
  selectedStageId: string | null;
  onStageChange: (stageId: string | null) => void;
  label?: string;
  placeholder?: string;
  showAllOption?: boolean;
  allOptionLabel?: string;
  className?: string;
  disabled?: boolean;
}

export const StageFilter: React.FC<StageFilterProps> = ({
  stages,
  selectedStageId,
  onStageChange,
  label = 'Этап',
  placeholder = 'Выберите этап',
  showAllOption = false,
  allOptionLabel = 'Все этапы',
  className = '',
  disabled = false,
}) => {
  // Sort stages: active first, then by period descending
  const sortedStages = useMemo(() => {
    if (!stages) return [];
    
    return [...stages].sort((a, b) => {
      // Active stages first
      if (a.is_active && !b.is_active) return -1;
      if (!a.is_active && b.is_active) return 1;
      
      // Then sort by period descending (assuming period format like "H1 2025" or "Q1 2025")
      // Or by end_date if available
      if (a.end_date && b.end_date) {
        return new Date(b.end_date).getTime() - new Date(a.end_date).getTime();
      }
      
      // Fallback to period string comparison (reverse alphabetical for descending)
      return b.period.localeCompare(a.period);
    });
  }, [stages]);

  // Get the active stage (default selection)
  const activeStage = useMemo(() => {
    return sortedStages.find(s => s.is_active);
  }, [sortedStages]);

  // Handle value change
  const handleValueChange = (value: string) => {
    if (value === 'all') {
      onStageChange(null);
    } else {
      onStageChange(value);
    }
  };

  // Determine current value
  const currentValue = selectedStageId || (showAllOption ? 'all' : activeStage?.id) || '';

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {label}
        </Label>
      )}
      <Select
        value={currentValue}
        onValueChange={handleValueChange}
        disabled={disabled || sortedStages.length === 0}
      >
        <SelectTrigger className="w-full min-w-[200px]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-background border shadow-lg z-50">
          {showAllOption && (
            <SelectItem value="all">{allOptionLabel}</SelectItem>
          )}
          {sortedStages.map((stage) => (
            <SelectItem key={stage.id} value={stage.id}>
              <div className="flex items-center gap-2">
                <span>{stage.period}</span>
                {stage.is_active && (
                  <span className="text-xs text-primary font-medium">(активный)</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

// Hook to manage stage filter state with default active stage selection
export const useStageFilter = (stages: StageOption[] | undefined) => {
  const [selectedStageId, setSelectedStageId] = React.useState<string | null>(null);

  // Auto-select active stage on first load
  // Sort stages by end_date DESC to ensure we pick the newest active stage
  React.useEffect(() => {
    if (stages && stages.length > 0 && selectedStageId === null) {
      // Sort stages by date (newest first) before selecting
      const sortedStages = [...stages].sort((a, b) => {
        if (a.end_date && b.end_date) {
          return new Date(b.end_date).getTime() - new Date(a.end_date).getTime();
        }
        return b.period.localeCompare(a.period);
      });
      
      // Select the first active stage from sorted list (ensures newest active is selected)
      const activeStage = sortedStages.find(s => s.is_active);
      if (activeStage) {
        setSelectedStageId(activeStage.id);
      } else if (sortedStages.length > 0) {
        // If no active stage, select the most recent one
        setSelectedStageId(sortedStages[0].id);
      }
    }
  }, [stages, selectedStageId]);

  return {
    selectedStageId,
    setSelectedStageId,
  };
};
