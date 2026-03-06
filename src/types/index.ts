// Core Data Types

export interface User {
  id: string;
  name: string;
  position: string;
  status: UserStatus;
  avatar: string;
  workAddress: WorkAddress;
  managers: Manager[];
  achievements: Achievement[];
  personalInfo?: PersonalInfo;
  skills?: Skill[];
}

export interface WorkAddress {
  storeNumber: string;
  address: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface Manager {
  id: string;
  name: string;
  position: string;
  avatar: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  earnedAt: Date;
}

export interface PersonalInfo {
  email?: string;
  phone?: string;
  birthDate?: Date;
  startDate?: Date;
}

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  level: SkillLevel;
  lastAssessed?: Date;
}

// Learning & Development Types

export interface LearningItem {
  id: string;
  type: LearningType;
  title: string;
  status: LearningStatus;
  startDate: Date;
  endDate: Date;
  format: string;
  mentor?: string;
  progress?: Progress;
  completionDate?: Date;
  currentStage?: string;
  modules?: LearningModule[];
}

export interface LearningModule {
  id: string;
  title: string;
  completed: boolean;
  order: number;
}

export interface Progress {
  percentage: number;
  completed: number;
  total: number;
  description?: string;
}

// Task Management Types

export interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  dueDate?: Date;
  priority: TaskPriority;
  category: TaskCategory;
  createdAt: Date;
  updatedAt: Date;
}

// Calendar & Events Types

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: Date;
  type: EventType;
  category: EventCategory;
  location?: string;
  attendees?: string[];
  isAllDay: boolean;
}

export interface CalendarDate {
  date: number;
  month: number;
  year: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  hasEvents: boolean;
  events?: CalendarEvent[];
}

// Assessment Types

export interface Assessment {
  id: string;
  type: AssessmentType;
  title: string;
  description: string;
  status: AssessmentStatus;
  dueDate?: Date;
  completedAt?: Date;
  results?: AssessmentResult[];
}

export interface AssessmentResult {
  skillId: string;
  score: number;
  maxScore: number;
  feedback?: string;
}

// Form Types

export interface FormField {
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  validation?: ValidationRule[];
  options?: FormOption[];
}

export interface FormOption {
  value: string;
  label: string;
}

export interface ValidationRule {
  type: ValidationType;
  value?: any;
  message: string;
}

export interface FormState {
  data: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

// API Types

export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Enums

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ON_LEAVE = 'on_leave',
  TERMINATED = 'terminated'
}

export enum AchievementCategory {
  LEADERSHIP = 'leadership',
  TRAINING = 'training',
  SALES = 'sales',
  INNOVATION = 'innovation',
  TEAMWORK = 'teamwork'
}

export enum SkillCategory {
  TECHNICAL = 'technical',
  SOFT_SKILLS = 'soft_skills',
  LEADERSHIP = 'leadership',
  DOMAIN_KNOWLEDGE = 'domain_knowledge'
}

export enum SkillLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export enum LearningType {
  COURSE = 'course',
  TEST = 'test',
  ONBOARDING = 'onboarding',
  WORKSHOP = 'workshop',
  CERTIFICATION = 'certification'
}

export enum LearningStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum TaskCategory {
  TRAINING = 'training',
  ASSESSMENT = 'assessment',
  PROJECT = 'project',
  ADMINISTRATIVE = 'administrative',
  DEVELOPMENT = 'development'
}

export enum EventType {
  MEETING = 'meeting',
  TRAINING = 'training',
  ASSESSMENT = 'assessment',
  CORPORATE = 'corporate',
  PERSONAL = 'personal'
}

export enum EventCategory {
  WORK = 'work',
  CORPORATE_CULTURE = 'corporate_culture',
  TRAINING = 'training',
  IMPORTANT = 'important'
}

export enum AssessmentType {
  SKILLS_360 = 'skills_360',
  PROFESSIONAL_SKILLS = 'professional_skills',
  KNOWLEDGE_TEST = 'knowledge_test',
  PERFORMANCE_REVIEW = 'performance_review'
}

export enum AssessmentStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue'
}

export enum FormFieldType {
  TEXT = 'text',
  EMAIL = 'email',
  PASSWORD = 'password',
  NUMBER = 'number',
  DATE = 'date',
  SELECT = 'select',
  MULTI_SELECT = 'multi_select',
  TEXTAREA = 'textarea',
  CHECKBOX = 'checkbox',
  RADIO = 'radio',
  FILE = 'file'
}

export enum ValidationType {
  REQUIRED = 'required',
  MIN_LENGTH = 'min_length',
  MAX_LENGTH = 'max_length',
  EMAIL = 'email',
  PATTERN = 'pattern',
  MIN_VALUE = 'min_value',
  MAX_VALUE = 'max_value'
}

// Component Props Types

export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface InteractiveComponentProps extends BaseComponentProps {
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

export interface FormComponentProps extends BaseComponentProps {
  name: string;
  value?: any;
  onChange?: (value: any) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}