/**
 * Централизованная система маппинга статусов
 * В БД всегда используем английские значения, в UI - локализованные
 */

// Database status values (always in English)
export const DB_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  COMPLETED: 'completed',
  IN_PROGRESS: 'in_progress',
  REJECTED: 'rejected',
  DRAFT: 'draft',
  EXPIRED: 'expired',
} as const;

// UI status labels (localized Russian)
export const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  approved: 'Согласовано',
  completed: 'Выполнено',
  in_progress: 'В процессе',
  rejected: 'Отклонено',
  draft: 'Черновик',
  expired: 'Просрочено',
};

// Get UI label from DB status
export const getStatusLabel = (dbStatus: string): string => {
  return STATUS_LABELS[dbStatus] || dbStatus;
};

// Check if status is completed
export const isCompleted = (status: string): boolean => {
  return status === DB_STATUS.COMPLETED;
};

// Check if status is expired
export const isExpired = (status: string): boolean => {
  return status === DB_STATUS.EXPIRED;
};

// Check if status is terminal (completed or expired - no further action possible)
export const isTerminal = (status: string): boolean => {
  return status === DB_STATUS.COMPLETED || status === DB_STATUS.EXPIRED;
};

// Check if status is pending (includes both pending and approved)
export const isPending = (status: string): boolean => {
  return status === DB_STATUS.PENDING || status === DB_STATUS.APPROVED;
};
