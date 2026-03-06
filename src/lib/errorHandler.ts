import { toast } from 'sonner';
import { PostgrestError } from '@supabase/supabase-js';

export interface AppError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Централизованный обработчик ошибок приложения
 */
export class ErrorHandler {
  /**
   * Обработка ошибок Supabase
   */
  static handleSupabaseError(error: PostgrestError | Error, context?: string): AppError {
    console.error(`[ErrorHandler] ${context || 'Error'}:`, error);

    const appError: AppError = {
      message: 'Произошла ошибка',
      details: error.message
    };

    // Обработка специфичных ошибок Supabase
    if ('code' in error && error.code) {
      appError.code = error.code;

      switch (error.code) {
        case '42501': // Insufficient privilege
          appError.message = 'Недостаточно прав для выполнения операции';
          appError.hint = 'Обратитесь к администратору системы';
          break;
        case '23503': // Foreign key violation
          appError.message = 'Невозможно выполнить операцию из-за связанных данных';
          break;
        case '23505': // Unique violation
          appError.message = 'Запись с такими данными уже существует';
          break;
        case '23514': // Check violation
          appError.message = 'Данные не соответствуют требованиям валидации';
          break;
        case 'PGRST116': // No RLS policy
          appError.message = 'Доступ запрещен';
          appError.hint = 'Политики безопасности не позволяют выполнить операцию';
          break;
        case 'PGRST301': // JWTExpired
          appError.message = 'Срок действия сеанса истёк';
          appError.hint = 'Пожалуйста, войдите в систему снова';
          break;
        default:
          if ('hint' in error && error.hint) {
            appError.hint = error.hint;
          }
      }
    }

    return appError;
  }

  /**
   * Показать ошибку пользователю
   */
  static showError(error: AppError | string, duration?: number) {
    const message = typeof error === 'string' ? error : error.message;
    const description = typeof error === 'object' ? error.hint || error.details : undefined;

    toast.error(message, {
      description,
      duration: duration || 5000
    });
  }

  /**
   * Показать успешное уведомление
   */
  static showSuccess(message: string, description?: string) {
    toast.success(message, {
      description,
      duration: 3000
    });
  }

  /**
   * Обработка и показ ошибки Supabase
   */
  static handleAndShow(error: PostgrestError | Error, context?: string) {
    const appError = this.handleSupabaseError(error, context);
    this.showError(appError);
    return appError;
  }

  /**
   * Валидация обязательных полей
   */
  static validateRequired(fields: Record<string, any>, requiredFields: string[]): boolean {
    const missingFields = requiredFields.filter(field => !fields[field]);
    
    if (missingFields.length > 0) {
      this.showError({
        message: 'Не заполнены обязательные поля',
        details: `Требуется: ${missingFields.join(', ')}`
      });
      return false;
    }
    
    return true;
  }

  /**
   * Обработка ошибок валидации
   */
  static handleValidationError(errors: Record<string, string[]>) {
    const firstError = Object.values(errors)[0]?.[0];
    if (firstError) {
      this.showError({
        message: 'Ошибка валидации',
        details: firstError
      });
    }
  }

  /**
   * Логирование ошибок (для отладки)
   */
  static log(error: any, context?: string) {
    if (import.meta.env.DEV) {
      console.group(`🔴 Error: ${context || 'Unknown'}`);
      console.error(error);
      console.trace();
      console.groupEnd();
    }
  }
}

/**
 * Обёртка для async функций с обработкой ошибок
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<{ data: T | null; error: AppError | null }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (err) {
    const error = ErrorHandler.handleSupabaseError(err as Error, context);
    ErrorHandler.showError(error);
    return { data: null, error };
  }
}