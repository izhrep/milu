// ── Types ──

export type SalaryMode = 'exact' | 'range' | 'unknown';

export type ChangeType = 'project' | 'salary' | 'role' | 'challenge' | 'extra_function' | 'other';

export interface ManagementProfile {
  // Block 1 — Что сейчас
  currentProject: string;
  currentRole: string;
  salaryMode: SalaryMode;
  salaryExact: string;
  salaryFrom: string;
  salaryTo: string;
  relevanceDate: string;

  // Block 2 — Последнее известное изменение
  lastChangeType: ChangeType | '';
  lastChangeDate: string;
  lastChangeReason: string;

  // Block 3 — Сигналы
  wantsProjectChange: boolean;
  satisfiedWithProject: boolean;
  satisfiedWithSalary: boolean;
  readyForOvertime: boolean;
  readyForLeadership: boolean;
  signalsComment: string;
}

export const emptyProfile: ManagementProfile = {
  currentProject: '',
  currentRole: '',
  salaryMode: 'unknown',
  salaryExact: '',
  salaryFrom: '',
  salaryTo: '',
  relevanceDate: '',
  lastChangeType: '',
  lastChangeDate: '',
  lastChangeReason: '',
  wantsProjectChange: false,
  satisfiedWithProject: false,
  satisfiedWithSalary: false,
  readyForOvertime: false,
  readyForLeadership: false,
  signalsComment: '',
};

// ── Profile status (computed, never stored) ──

export type ProfileStatus = 'not_filled' | 'partially_filled' | 'filled';

function isBlock1Filled(p: ManagementProfile): boolean {
  if (!p.currentProject.trim()) return false;
  if (!p.currentRole.trim()) return false;
  if (!p.relevanceDate) return false;
  // salary: any mode is valid; for exact/range check value
  if (p.salaryMode === 'exact' && !p.salaryExact.trim()) return false;
  if (p.salaryMode === 'range' && (!p.salaryFrom.trim() || !p.salaryTo.trim())) return false;
  return true;
}

function isBlock2Filled(p: ManagementProfile): boolean {
  return !!(p.lastChangeType && p.lastChangeDate);
}

function isBlock3Filled(p: ManagementProfile): boolean {
  return (
    p.wantsProjectChange ||
    p.satisfiedWithProject ||
    p.satisfiedWithSalary ||
    p.readyForOvertime ||
    p.readyForLeadership
  );
}

export function computeProfileStatus(profile: ManagementProfile | null): ProfileStatus {
  if (!profile) return 'not_filled';
  if (!isBlock1Filled(profile)) return 'not_filled';
  if (isBlock2Filled(profile) || isBlock3Filled(profile)) return 'filled';
  return 'partially_filled';
}

// ── Task status (derived from profile status) ──

export type TaskStatusLabel = 'К заполнению' | 'К дополнению' | 'Выполнена';

const taskStatusMap: Record<ProfileStatus, TaskStatusLabel> = {
  not_filled: 'К заполнению',
  partially_filled: 'К дополнению',
  filled: 'Выполнена',
};

export function computeTaskStatus(profileStatus: ProfileStatus): TaskStatusLabel {
  return taskStatusMap[profileStatus];
}

// ── UI helpers ──

export const profileStatusLabels: Record<ProfileStatus, string> = {
  not_filled: 'Не заполнен',
  partially_filled: 'Частично заполнен',
  filled: 'Заполнен',
};

export const profileStatusColors: Record<ProfileStatus, string> = {
  not_filled: 'bg-destructive/10 text-destructive',
  partially_filled: 'bg-yellow-100 text-yellow-800',
  filled: 'bg-green-100 text-green-800',
};

export const changeTypeLabels: Record<ChangeType, string> = {
  project: 'Проект',
  salary: 'Зарплата',
  role: 'Роль',
  challenge: 'Челлендж',
  extra_function: 'Доп. функция',
  other: 'Иное',
};

export const actionLabel: Record<ProfileStatus, string> = {
  not_filled: 'Заполнить профиль',
  partially_filled: 'Дополнить профиль',
  filled: 'Открыть профиль',
};
