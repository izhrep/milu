// API Layer with Mock Data and Future Integration Points

import { 
  User, 
  Task, 
  LearningItem, 
  CalendarEvent, 
  Assessment, 
  ApiResponse, 
  PaginatedResponse,
  UserStatus,
  AchievementCategory,
  TaskPriority,
  TaskCategory,
  LearningType,
  LearningStatus,
  EventType,
  EventCategory,
  AssessmentStatus
} from '@/types';

// Mock Data
export const mockUser: User = {
  id: '1',
  name: 'Владимир Маршаков',
  position: 'Продавец-консультант',
  status: UserStatus.ACTIVE,
  avatar: '/avatars/vladimir.jpg',
  workAddress: {
    storeNumber: '#00343',
    address: 'Ул. Красная Пресня 36 с1',
    coordinates: { lat: 55.7558, lng: 37.6176 }
  },
  managers: [
    {
      id: '2',
      name: 'Перевозкина Александра',
      position: 'Директор магазина',
      avatar: '/avatars/alexandra.jpg'
    },
    {
      id: '3',
      name: 'Хабаров Рустам',
      position: 'Менеджер',
      avatar: '/avatars/rustam.jpg'
    }
  ],
  achievements: [
    {
      id: '1',
      title: 'Лидер изменений',
      description: 'Предложил улучшение выкладки товаров, что увеличило продажи на 15%',
      category: AchievementCategory.INNOVATION,
      earnedAt: new Date('2024-11-15')
    },
    {
      id: '2',
      title: 'Тренинг-мастер',
      description: 'Пройдены все тренинги из тренинг-плана',
      category: AchievementCategory.TRAINING,
      earnedAt: new Date('2024-10-20')
    }
  ]
};

export const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Пройти тренинг по товарной экспертизе',
    description: 'Пройти тренинг по свойствам тканей (до 23.03 вам необходимо записаться на очный тренинг по товарной экспертизе, а также сдать внутренний тест на знание свойств тканей)',
    completed: false,
    dueDate: new Date('2025-03-23'),
    priority: TaskPriority.HIGH,
    category: TaskCategory.TRAINING,
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01')
  },
  {
    id: '2',
    title: 'Подготовить решение по 2 товарным категориям',
    description: 'Для вашего дальнейшего продвижения по цели "Управлением товаром и мерчендайзинг" проработайте еще 2 группы товарных категорий',
    completed: false,
    dueDate: new Date('2025-01-15'),
    priority: TaskPriority.MEDIUM,
    category: TaskCategory.PROJECT,
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01')
  },
  {
    id: '3',
    title: 'Оцените еще 2 коллег',
    description: 'Согласно периоду оценки, ответьте еще на два опроса 360',
    completed: false,
    dueDate: new Date('2024-12-30'),
    priority: TaskPriority.MEDIUM,
    category: TaskCategory.ASSESSMENT,
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01')
  }
];

export const mockLearningItems: LearningItem[] = [
  {
    id: '1',
    type: LearningType.COURSE,
    title: 'Основы мерчендайзинга',
    status: LearningStatus.IN_PROGRESS,
    startDate: new Date('2025-03-12'),
    endDate: new Date('2025-03-29'),
    format: '12 – 29 марта 2025',
    mentor: 'Руководитель отдела',
    progress: {
      percentage: 60,
      completed: 3,
      total: 5,
      description: 'Прогресс: 3 / 5 модулей'
    },
    modules: [
      { id: '1', title: 'Введение в мерчендайзинг', completed: true, order: 1 },
      { id: '2', title: 'Планирование ассортимента', completed: true, order: 2 },
      { id: '3', title: 'Визуальное представление', completed: true, order: 3 },
      { id: '4', title: 'Анализ продаж', completed: false, order: 4 },
      { id: '5', title: 'Оптимизация выкладки', completed: false, order: 5 }
    ]
  },
  {
    id: '2',
    type: LearningType.TEST,
    title: 'Внутренний экзамен по знанию продукта',
    status: LearningStatus.IN_PROGRESS,
    startDate: new Date('2025-03-12'),
    endDate: new Date('2025-03-29'),
    format: '12 – 29 марта 2025',
    mentor: 'Руководитель отдела'
  },
  {
    id: '3',
    type: LearningType.ONBOARDING,
    title: 'Онбординг нового сотрудника',
    status: LearningStatus.COMPLETED,
    startDate: new Date('2024-05-01'),
    endDate: new Date('2024-05-30'),
    format: 'Очно',
    completionDate: new Date('2024-05-30'),
    currentStage: 'Обратная связь',
    progress: {
      percentage: 100,
      completed: 6,
      total: 7,
      description: '6 / 7 этапов завершено'
    }
  }
];

export const mockEvents: CalendarEvent[] = [
  {
    id: '1',
    title: 'Новогодний корпоратив',
    description: 'Корпоративная культура и эвэнты',
    date: new Date('2024-12-25'),
    type: EventType.CORPORATE,
    category: EventCategory.CORPORATE_CULTURE,
    isAllDay: true
  },
  {
    id: '2',
    title: 'Командная встреча',
    description: 'Магазин',
    date: new Date('2024-12-23'),
    type: EventType.MEETING,
    category: EventCategory.IMPORTANT,
    isAllDay: false
  }
];

// API Functions (Mock Implementation)

class ApiClient {
  private baseUrl = process.env.VITE_API_URL || '';
  private delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  private async mockRequest<T>(data: T, delay = 500): Promise<ApiResponse<T>> {
    await this.delay(delay);
    return {
      data,
      success: true,
      message: 'Success'
    };
  }

  private async mockError(message: string, code: string): Promise<never> {
    await this.delay(500);
    throw new ApiError(message, code);
  }

  // User API
  async fetchUser(id: string): Promise<ApiResponse<User>> {
    return this.mockRequest(mockUser);
  }

  async updateUser(id: string, data: Partial<User>): Promise<ApiResponse<User>> {
    return this.mockRequest({ ...mockUser, ...data });
  }

  // Tasks API
  async fetchTasks(userId: string): Promise<ApiResponse<Task[]>> {
    return this.mockRequest(mockTasks);
  }

  async createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Task>> {
    const newTask: Task = {
      ...task,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return this.mockRequest(newTask);
  }

  async updateTask(id: string, data: Partial<Task>): Promise<ApiResponse<Task>> {
    const task = mockTasks.find(t => t.id === id);
    if (!task) {
      return this.mockError('Task not found', 'TASK_NOT_FOUND');
    }
    return this.mockRequest({ ...task, ...data, updatedAt: new Date() });
  }

  async deleteTask(id: string): Promise<ApiResponse<void>> {
    return this.mockRequest(undefined);
  }

  // Learning API
  async fetchLearningItems(userId: string): Promise<ApiResponse<LearningItem[]>> {
    return this.mockRequest(mockLearningItems);
  }

  async updateLearningProgress(id: string, progress: number): Promise<ApiResponse<LearningItem>> {
    const item = mockLearningItems.find(l => l.id === id);
    if (!item) {
      return this.mockError('Learning item not found', 'LEARNING_ITEM_NOT_FOUND');
    }
    return this.mockRequest({
      ...item,
      progress: item.progress ? { ...item.progress, percentage: progress } : undefined
    });
  }

  // Calendar API
  async fetchEvents(userId: string, startDate: Date, endDate: Date): Promise<ApiResponse<CalendarEvent[]>> {
    return this.mockRequest(mockEvents);
  }

  async createEvent(event: Omit<CalendarEvent, 'id'>): Promise<ApiResponse<CalendarEvent>> {
    const newEvent: CalendarEvent = {
      ...event,
      id: Date.now().toString()
    };
    return this.mockRequest(newEvent);
  }

  // Assessment API
  async fetchAssessments(userId: string): Promise<ApiResponse<Assessment[]>> {
    return this.mockRequest([]);
  }

  async startAssessment(type: string): Promise<ApiResponse<Assessment>> {
    const assessment: Assessment = {
      id: Date.now().toString(),
      type: type as any,
      title: 'Оценка 360',
      description: 'Комплексная оценка навыков',
      status: AssessmentStatus.IN_PROGRESS
    };
    return this.mockRequest(assessment);
  }
}

// Custom Error Class
class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Export singleton instance
export const api = new ApiClient();

// React Query Keys
export const queryKeys = {
  user: (id: string) => ['user', id],
  tasks: (userId: string) => ['tasks', userId],
  learningItems: (userId: string) => ['learning', userId],
  events: (userId: string, startDate: Date, endDate: Date) => [
    'events', 
    userId, 
    startDate.toISOString(), 
    endDate.toISOString()
  ],
  assessments: (userId: string) => ['assessments', userId]
} as const;

// Mutation Keys
export const mutationKeys = {
  updateUser: 'updateUser',
  createTask: 'createTask',
  updateTask: 'updateTask',
  deleteTask: 'deleteTask',
  updateLearningProgress: 'updateLearningProgress',
  createEvent: 'createEvent',
  startAssessment: 'startAssessment'
} as const;