/**
 * КОРРЕКТНЫЕ ТИПЫ ДЛЯ RPC-ФУНКЦИЙ SUPABASE
 * 
 * ⚠️ ВРЕМЕННЫЙ ФАЙЛ-OVERRIDE
 * Этот файл содержит правильные типы для RPC-функций, которые отличаются
 * от автоматически сгенерированных в src/integrations/supabase/types.ts
 * 
 * После регенерации types.ts этот файл можно будет удалить.
 */

import type { Database } from '@/integrations/supabase/types';

/**
 * Корректные типы для всех RPC-функций
 * На основе актуальной схемы БД (миграция 20251113202611)
 */
export interface SupabaseRPCFunctions {
  // ========== АВТОРИЗАЦИЯ И ПРАВА ДОСТУПА ==========
  
  /**
   * Проверка наличия permission у текущего пользователя
   * Использует auth.uid() автоматически
   * @param _permission_name - название permission (например, 'users.view')
   */
  has_permission: {
    Args: { _permission_name: string };
    Returns: boolean;
  };

  /**
   * Получение роли пользователя
   */
  get_user_role: {
    Args: { _user_id: string };
    Returns: Database['public']['Enums']['app_role'];
  };

  /**
   * Получение текущего user_id из auth.uid()
   */
  get_current_user_id: {
    Args: Record<string, never>;
    Returns: string;
  };

  /**
   * Проверка владельца записи
   */
  is_owner: {
    Args: { user_id_to_check: string };
    Returns: boolean;
  };

  /**
   * Проверка, является ли текущий пользователь руководителем указанного сотрудника
   */
  is_users_manager: {
    Args: { employee_id: string };
    Returns: boolean;
  };

  /**
   * Проверка наличия любой из указанных ролей
   */
  has_any_role: {
    Args: {
      _roles: Database['public']['Enums']['app_role'][];
      _user_id: string;
    };
    Returns: boolean;
  };

  // ========== УПРАВЛЕНИЕ ПРАВАМИ ==========

  /**
   * Получение всех permissions
   */
  get_all_permissions: {
    Args: Record<string, never>;
    Returns: Array<{
      id: string;
      name: string;
      resource: string;
      action: string;
      description: string | null;
      created_at: string | null;
      updated_at: string | null;
    }>;
  };

  /**
   * Получение всех связей роль-permission
   */
  get_role_permissions: {
    Args: Record<string, never>;
    Returns: Array<{
      id: string;
      role: Database['public']['Enums']['app_role'];
      permission_id: string | null;
      created_at: string | null;
    }>;
  };

  /**
   * Получение пользователей с их ролями
   */
  get_users_with_roles: {
    Args: Record<string, never>;
    Returns: Array<{
      id: string;
      email: string;
      status: boolean;
      last_login_at: string | null;
      created_at: string;
      updated_at: string;
      role: string;
    }>;
  };

  /**
   * Обновление кэша прав для пользователя
   */
  refresh_user_effective_permissions: {
    Args: { target_user_id: string };
    Returns: void;
  };

  /**
   * Обновление кэша прав для всех пользователей с указанной ролью
   */
  refresh_role_effective_permissions: {
    Args: { target_role: Database['public']['Enums']['app_role'] };
    Returns: void;
  };

  // ========== АУДИТ И ЛОГИРОВАНИЕ ==========

  /**
   * Логирование действия администратора
   */
  log_admin_action: {
    Args: {
      _admin_id: string;
      _target_user_id: string | null;
      _action_type: string;
      _field?: string | null;
      _old_value?: string | null;
      _new_value?: string | null;
      _details?: Record<string, unknown> | null;
    };
    Returns: string;
  };

  /**
   * Логирование отказа в доступе
   */
  log_access_denied: {
    Args: {
      _permission_name: string;
      _resource_type?: string | null;
      _resource_id?: string | null;
      _action_attempted?: string | null;
    };
    Returns: void;
  };

  // ========== ДИАГНОСТИКА ==========

  /**
   * Расчёт прогресса диагностического этапа
   */
  calculate_diagnostic_stage_progress: {
    Args: { stage_id_param: string };
    Returns: number;
  };

  /**
   * Проверка инвариантов диагностического этапа
   */
  check_diagnostic_invariants: {
    Args: { stage_id_param: string };
    Returns: Array<{
      check_name: string;
      status: string;
      details: Record<string, unknown>;
    }>;
  };

  /**
   * Проверка консистентности данных диагностики
   */
  check_diagnostic_data_consistency: {
    Args: Record<string, never>;
    Returns: Array<{
      check_name: string;
      status: string;
      details: Record<string, unknown>;
    }>;
  };

  /**
   * Проверка, является ли пользователь участником диагностического этапа
   */
  is_diagnostic_stage_participant: {
    Args: {
      _stage_id: string;
      _user_id: string;
    };
    Returns: boolean;
  };

  // ========== ВСТРЕЧИ ==========

  /**
   * Проверка консистентности данных встреч
   */
  check_meetings_data_consistency: {
    Args: Record<string, never>;
    Returns: Array<{
      check_name: string;
      status: string;
      details: Record<string, unknown>;
    }>;
  };

  /**
   * Проверка, является ли пользователь участником этапа встреч
   */
  is_meeting_stage_participant: {
    Args: {
      _stage_id: string;
      _user_id: string;
    };
    Returns: boolean;
  };

  // ========== УТИЛИТЫ ==========

  /**
   * Получение периода оценки (H1/H2)
   */
  get_evaluation_period: {
    Args: { created_date: string };
    Returns: string;
  };

  /**
   * Получение пользователя с ролью по email
   */
  get_user_with_role: {
    Args: { user_email: string };
    Returns: Array<{
      id: string;
      full_name: string;
      email: string;
      role_name: string;
    }>;
  };

  /**
   * Проверка наличия auth записи для пользователя
   */
  check_user_has_auth: {
    Args: { user_email: string };
    Returns: boolean;
  };

  // ========== КАРЬЕРНЫЙ ТРЕК ==========

  /**
   * Расчёт gap-анализа для карьерного трека
   */
  calculate_career_gap: {
    Args: {
      p_user_id: string;
      p_grade_id: string;
    };
    Returns: Array<{
      competency_type: string;
      competency_id: string;
      competency_name: string;
      current_level: number;
      target_level: number;
      gap: number;
      is_ready: boolean;
    }>;
  };
}

/**
 * Type-safe wrapper для supabase.rpc()
 * Используйте этот тип для корректной типизации RPC-вызовов
 */
export type SupabaseRPC = <
  FunctionName extends keyof SupabaseRPCFunctions
>(
  fn: FunctionName,
  args: SupabaseRPCFunctions[FunctionName]['Args']
) => Promise<{
  data: SupabaseRPCFunctions[FunctionName]['Returns'] | null;
  error: any | null;
}>;

/**
 * Корректные аргументы для has_permission
 * @deprecated Используйте SupabaseRPCFunctions['has_permission']['Args']
 */
export type HasPermissionArgs = SupabaseRPCFunctions['has_permission']['Args'];
