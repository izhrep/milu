import { supabase } from '@/integrations/supabase/client';

export interface AdminLogEntry {
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_name?: string;
  details?: Record<string, any>;
}

export class AdminLogger {
  /**
   * Логирование действия администратора
   */
  static async log(entry: AdminLogEntry): Promise<void> {
    try {
      const { error } = await supabase
        .from('admin_activity_logs')
        .insert({
          user_id: entry.user_id,
          user_name: entry.user_name,
          action: entry.action,
          entity_type: entry.entity_type,
          entity_name: entry.entity_name,
          details: entry.details || null
        });

      if (error) {
        console.error('Admin logging error:', error);
      }
    } catch (err) {
      console.error('Admin logging exception:', err);
    }
  }

  /**
   * Логирование создания записи
   */
  static async logCreate(
    userId: string,
    userName: string,
    entityType: string,
    entityName: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      user_id: userId,
      user_name: userName,
      action: 'create',
      entity_type: entityType,
      entity_name: entityName,
      details
    });
  }

  /**
   * Логирование обновления записи
   */
  static async logUpdate(
    userId: string,
    userName: string,
    entityType: string,
    entityName: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      user_id: userId,
      user_name: userName,
      action: 'update',
      entity_type: entityType,
      entity_name: entityName,
      details
    });
  }

  /**
   * Логирование удаления записи
   */
  static async logDelete(
    userId: string,
    userName: string,
    entityType: string,
    entityName: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      user_id: userId,
      user_name: userName,
      action: 'delete',
      entity_type: entityType,
      entity_name: entityName,
      details
    });
  }

  /**
   * Получение логов за период
   */
  static async getLogs(
    startDate?: Date,
    endDate?: Date,
    entityType?: string
  ): Promise<any[]> {
    try {
      let query = supabase
        .from('admin_activity_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching admin logs:', err);
      return [];
    }
  }
}
