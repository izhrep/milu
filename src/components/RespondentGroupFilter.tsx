import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Check } from 'lucide-react';
import { 
  RespondentGroupType, 
  allRespondentGroups, 
  respondentGroupLabels 
} from '@/components/CompetencyFilter';

interface RespondentGroupFilterProps {
  selectedGroups: RespondentGroupType[];
  onChange: (groups: RespondentGroupType[]) => void;
}

export const RespondentGroupFilter: React.FC<RespondentGroupFilterProps> = ({
  selectedGroups,
  onChange
}) => {
  const isAllSelected = selectedGroups.length === allRespondentGroups.length;

  // Toggle respondent group - implementing new logic:
  // - Selecting "All" clears all specific selections and selects all
  // - Selecting specific values auto-deselects "All" (if was selected)
  const toggleGroup = (group: RespondentGroupType) => {
    if (selectedGroups.includes(group)) {
      // Remove group - allow empty selection now (will show empty state)
      onChange(selectedGroups.filter(g => g !== group));
    } else {
      // Add group
      onChange([...selectedGroups, group]);
    }
  };

  // Toggle all groups - if all selected, clear; otherwise select all
  const toggleAllGroups = () => {
    if (isAllSelected) {
      onChange([]); // Отщёлкивание - снять все
    } else {
      onChange(allRespondentGroups); // Выбрать все
    }
  };

  // Clear all (for empty state)
  const clearAllGroups = () => {
    onChange([]);
  };

  // Get display text
  const getDisplayText = () => {
    if (selectedGroups.length === 0) {
      return 'Не выбрано';
    }
    if (isAllSelected) {
      return 'Все группы';
    }
    if (selectedGroups.length === 1) {
      return respondentGroupLabels[selectedGroups[0]];
    }
    return `Выбрано: ${selectedGroups.length}`;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className={`w-[220px] h-10 justify-between font-normal ${
            selectedGroups.length === 0 ? 'text-muted-foreground' : ''
          }`}
        >
          <span className="truncate">{getDisplayText()}</span>
          <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-2" align="start">
        <div className="space-y-1">
          {/* "Все группы" option - acts as reset */}
          <button
            onClick={toggleAllGroups}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left text-sm ${
              isAllSelected ? 'bg-muted' : ''
            }`}
          >
            <div className={`w-4 h-4 border rounded flex items-center justify-center ${
              isAllSelected ? 'bg-primary border-primary' : 'border-input'
            }`}>
              {isAllSelected && (
                <Check className="h-3 w-3 text-primary-foreground" />
              )}
            </div>
            <span>Все группы</span>
          </button>
          <div className="h-px bg-border my-1" />
          {/* Individual groups */}
          {allRespondentGroups.map((group) => (
            <button
              key={group}
              onClick={() => toggleGroup(group)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left text-sm ${
                selectedGroups.includes(group) && !isAllSelected ? 'bg-muted/50' : ''
              }`}
            >
              <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                selectedGroups.includes(group) ? 'bg-primary border-primary' : 'border-input'
              }`}>
                {selectedGroups.includes(group) && (
                  <Check className="h-3 w-3 text-primary-foreground" />
                )}
              </div>
              <span>{respondentGroupLabels[group]}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
