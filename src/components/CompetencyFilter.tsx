import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export type CompetencyFilterType = 
  | 'hard_skills'
  | 'soft_skills'
  | 'hard_categories'
  | 'soft_categories'
  | 'hard_subcategories'
  | 'soft_subcategories';

// Multi-select role filter for RadarChart (Все, Личный фидбек, Лид, Коллеги)
export type RadarRoleType = 'self' | 'manager' | 'peers';

export type SkillSetFilterType = 'all' | 'assigned_to_all';

// Группы респондентов для горизонтальных диаграмм
export type RespondentGroupType = 
  | 'self' 
  | 'manager_internal' 
  | 'manager_external' 
  | 'peer_internal' 
  | 'peer_external' 
  | 'customer_external'
  | 'all_except_self';

export interface PositionCategoryOption {
  id: string;
  name: string;
}

interface CompetencyFilterProps {
  value: CompetencyFilterType;
  onChange: (value: CompetencyFilterType) => void;
  // Роль для RadarChart (multi-select)
  radarRoles: RadarRoleType[];
  onRadarRolesChange: (roles: RadarRoleType[]) => void;
  availableFilters?: CompetencyFilterType[];
  managerPositionCategory?: string | null;
  skillSetValue?: SkillSetFilterType;
  onSkillSetChange?: (value: SkillSetFilterType) => void;
  // Переключатель комментариев
  showComments?: boolean;
  onShowCommentsChange?: (show: boolean) => void;
  // Переключатель авторов комментариев
  showAuthors?: boolean;
  onShowAuthorsChange?: (show: boolean) => void;
}

// Лейблы для групп респондентов (горизонтальные диаграммы)
export const respondentGroupLabels: Record<RespondentGroupType, string> = {
  self: 'Личный фидбек',
  manager_internal: 'Лид (внутренний)',
  manager_external: 'Лид (внешний)',
  peer_internal: 'Коллега (внутренний)',
  peer_external: 'Коллега (внешний)',
  customer_external: 'Заказчик (внешний)',
  all_except_self: 'Все, кроме фидбека сотрудника'
};

export const allRespondentGroups: RespondentGroupType[] = [
  'self', 'manager_internal', 'manager_external', 
  'peer_internal', 'peer_external', 'customer_external',
  'all_except_self'
];

// Лейблы для ролей RadarChart
export const radarRoleLabels: Record<RadarRoleType, string> = {
  self: 'Личный фидбек',
  manager: 'Лид (внутренний)',
  peers: 'Все кроме фидбека сотрудника'
};

export const allRadarRoles: RadarRoleType[] = ['self', 'manager', 'peers'];

export const CompetencyFilter: React.FC<CompetencyFilterProps> = ({ 
  value, 
  onChange,
  radarRoles = allRadarRoles,
  onRadarRolesChange,
  availableFilters = [
    'hard_skills',
    'soft_skills',
    'hard_categories',
    'soft_categories',
    'hard_subcategories',
    'soft_subcategories'
  ],
  skillSetValue = 'all',
  onSkillSetChange,
  showComments,
  onShowCommentsChange,
  showAuthors,
  onShowAuthorsChange
}) => {
  const filterLabels: Record<CompetencyFilterType, string> = {
    hard_skills: 'Hard-навыки',
    soft_skills: 'Soft-навыки',
    hard_categories: 'Hard-компетенции',
    soft_categories: 'Soft-компетенции',
    hard_subcategories: 'Hard-подкомпетенции',
    soft_subcategories: 'Soft-подкомпетенции'
  };

  const skillSetLabels: Record<SkillSetFilterType, string> = {
    all: 'Все навыки',
    assigned_to_all: 'Назначенные всем ролям'
  };

  const isAllRolesSelected = radarRoles === allRadarRoles;

  // Toggle radar role - new logic:
  // - Selecting specific values - just toggle
  // - If "All" was selected, now we're selecting individual items
  const toggleRadarRole = (role: RadarRoleType) => {
    if (radarRoles.includes(role)) {
      // Remove role - allow empty selection (will show empty state)
      onRadarRolesChange(radarRoles.filter(r => r !== role));
    } else {
      // Add role
      onRadarRolesChange([...radarRoles, role]);
    }
  };

  // Select all radar roles - acts as reset:
  // - If currently "Все" active -> clear selection (empty state)
  // - Otherwise -> select all
  const selectAllRadarRoles = () => {
    onRadarRolesChange(isAllRolesSelected ? [] : allRadarRoles);
  };

  // Get display text for radar roles
  const getRadarRolesDisplayText = () => {
    if (radarRoles.length === 0) {
      return 'Не выбрано';
    }
    if (isAllRolesSelected) {
      return 'Все';
    }
    if (radarRoles.length === 1) {
      return radarRoleLabels[radarRoles[0]];
    }
    return `Выбрано: ${radarRoles.length}`;
  };

  return (
    <Card className="p-5 mb-6">
      <div className="flex gap-6 flex-wrap items-start">
        {/* Основной фильтр компетенций */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-muted-foreground">
            Фильтр компетенций
          </label>
          <Select value={value} onValueChange={(val) => onChange(val as CompetencyFilterType)}>
            <SelectTrigger className="w-[200px] h-10">
              <SelectValue placeholder="Выберите фильтр" />
            </SelectTrigger>
            <SelectContent>
              {availableFilters.map((filter) => (
                <SelectItem key={filter} value={filter}>
                  {filterLabels[filter]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Фильтр роли для RadarChart (multi-select) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-muted-foreground">
            Роль
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className={`w-[200px] h-10 justify-between font-normal ${
                  radarRoles.length === 0 ? 'text-muted-foreground' : ''
                }`}
              >
                <span className="truncate">{getRadarRolesDisplayText()}</span>
                <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-2" align="start">
              <div className="space-y-1">
                {/* "Все" option - acts as reset */}
                <button
                  onClick={selectAllRadarRoles}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left text-sm ${
                    isAllRolesSelected ? 'bg-muted' : ''
                  }`}
                >
                  <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                    isAllRolesSelected ? 'bg-primary border-primary' : 'border-input'
                  }`}>
                    {isAllRolesSelected && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <span>Все</span>
                </button>
                <div className="h-px bg-border my-1" />
                {/* Individual roles */}
                {allRadarRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => toggleRadarRole(role)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left text-sm ${
                      radarRoles.includes(role) && !isAllRolesSelected ? 'bg-muted/50' : ''
                    }`}
                  >
                    <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                      radarRoles.includes(role) ? 'bg-primary border-primary' : 'border-input'
                    }`}>
                      {radarRoles.includes(role) && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <span>{radarRoleLabels[role]}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Набор навыков */}
        {onSkillSetChange && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              Набор навыков
            </label>
            <Select value={skillSetValue} onValueChange={(val) => onSkillSetChange(val as SkillSetFilterType)}>
              <SelectTrigger className="w-[200px] h-10">
                <SelectValue placeholder="Выберите набор" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(skillSetLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Переключатель отображения комментариев - центрирован по вертикали */}
        {onShowCommentsChange !== undefined && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground invisible">
              Комментарии
            </label>
            <div className="flex items-center space-x-2 h-10">
              <Checkbox 
                id="showComments" 
                checked={showComments}
                onCheckedChange={(checked) => onShowCommentsChange(checked === true)}
              />
              <Label 
                htmlFor="showComments" 
                className="text-sm font-medium cursor-pointer"
              >
                Показать комментарии
              </Label>
            </div>
          </div>
        )}

        {/* Переключатель отображения авторов */}
        {onShowAuthorsChange !== undefined && showComments && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground invisible">
              Авторы
            </label>
            <div className="flex items-center space-x-2 h-10">
              <Checkbox 
                id="showAuthors" 
                checked={showAuthors}
                onCheckedChange={(checked) => onShowAuthorsChange(checked === true)}
              />
              <Label 
                htmlFor="showAuthors" 
                className="text-sm font-medium cursor-pointer"
              >
                Показать авторов
              </Label>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
