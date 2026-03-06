// Form Validation Utilities

import { ValidationRule, ValidationType } from '@/types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class FormValidator {
  static validateField(value: any, rules: ValidationRule[]): ValidationResult {
    const errors: string[] = [];

    for (const rule of rules) {
      const result = this.validateRule(value, rule);
      if (!result.isValid) {
        errors.push(result.message);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateRule(value: any, rule: ValidationRule): { isValid: boolean; message: string } {
    switch (rule.type) {
      case ValidationType.REQUIRED:
        return {
          isValid: this.isRequired(value),
          message: rule.message
        };

      case ValidationType.MIN_LENGTH:
        return {
          isValid: this.minLength(value, rule.value),
          message: rule.message
        };

      case ValidationType.MAX_LENGTH:
        return {
          isValid: this.maxLength(value, rule.value),
          message: rule.message
        };

      case ValidationType.EMAIL:
        return {
          isValid: this.isEmail(value),
          message: rule.message
        };

      case ValidationType.PATTERN:
        return {
          isValid: this.matchesPattern(value, rule.value),
          message: rule.message
        };

      case ValidationType.MIN_VALUE:
        return {
          isValid: this.minValue(value, rule.value),
          message: rule.message
        };

      case ValidationType.MAX_VALUE:
        return {
          isValid: this.maxValue(value, rule.value),
          message: rule.message
        };

      default:
        return { isValid: true, message: '' };
    }
  }

  private static isRequired(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  private static minLength(value: string, minLength: number): boolean {
    if (!value) return false;
    return value.length >= minLength;
  }

  private static maxLength(value: string, maxLength: number): boolean {
    if (!value) return true;
    return value.length <= maxLength;
  }

  private static isEmail(value: string): boolean {
    if (!value) return true; // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  private static matchesPattern(value: string, pattern: string): boolean {
    if (!value) return true; // Optional field
    const regex = new RegExp(pattern);
    return regex.test(value);
  }

  private static minValue(value: number, minValue: number): boolean {
    if (value === null || value === undefined) return true; // Optional field
    return value >= minValue;
  }

  private static maxValue(value: number, maxValue: number): boolean {
    if (value === null || value === undefined) return true; // Optional field
    return value <= maxValue;
  }
}

// Common validation rule builders
export const validationRules = {
  required: (message = 'Это поле обязательно для заполнения'): ValidationRule => ({
    type: ValidationType.REQUIRED,
    message
  }),

  minLength: (length: number, message = `Минимальная длина: ${length} символов`): ValidationRule => ({
    type: ValidationType.MIN_LENGTH,
    value: length,
    message
  }),

  maxLength: (length: number, message = `Максимальная длина: ${length} символов`): ValidationRule => ({
    type: ValidationType.MAX_LENGTH,
    value: length,
    message
  }),

  email: (message = 'Введите корректный email адрес'): ValidationRule => ({
    type: ValidationType.EMAIL,
    message
  }),

  pattern: (pattern: string, message: string): ValidationRule => ({
    type: ValidationType.PATTERN,
    value: pattern,
    message
  }),

  minValue: (value: number, message = `Минимальное значение: ${value}`): ValidationRule => ({
    type: ValidationType.MIN_VALUE,
    value,
    message
  }),

  maxValue: (value: number, message = `Максимальное значение: ${value}`): ValidationRule => ({
    type: ValidationType.MAX_VALUE,
    value,
    message
  }),

  phone: (message = 'Введите корректный номер телефона'): ValidationRule => ({
    type: ValidationType.PATTERN,
    value: '^[+]?[0-9\\s\\-\\(\\)]{10,}$',
    message
  })
};

// Form validation schemas
export const taskFormSchema = {
  title: [
    validationRules.required('Название задачи обязательно'),
    validationRules.minLength(3, 'Название должно содержать минимум 3 символа'),
    validationRules.maxLength(100, 'Название не должно превышать 100 символов')
  ],
  description: [
    validationRules.maxLength(500, 'Описание не должно превышать 500 символов')
  ],
  dueDate: [
    validationRules.required('Укажите срок выполнения')
  ]
};

export const eventFormSchema = {
  title: [
    validationRules.required('Название события обязательно'),
    validationRules.minLength(3, 'Название должно содержать минимум 3 символа'),
    validationRules.maxLength(100, 'Название не должно превышать 100 символов')
  ],
  date: [
    validationRules.required('Укажите дату события')
  ],
  description: [
    validationRules.maxLength(300, 'Описание не должно превышать 300 символов')
  ]
};

export const userProfileSchema = {
  email: [
    validationRules.email('Введите корректный email адрес')
  ],
  phone: [
    validationRules.phone('Введите корректный номер телефона')
  ]
};

// Async validation
export class AsyncValidator {
  static async validateEmailUnique(email: string): Promise<boolean> {
    // Mock async validation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simulate email uniqueness check
    const existingEmails = ['test@example.com', 'admin@company.com'];
    return !existingEmails.includes(email.toLowerCase());
  }

  static async validateUsernameUnique(username: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const existingUsernames = ['admin', 'user', 'test'];
    return !existingUsernames.includes(username.toLowerCase());
  }
}