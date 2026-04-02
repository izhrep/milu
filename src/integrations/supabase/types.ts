export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      access_denied_logs: {
        Row: {
          action_attempted: string | null
          created_at: string | null
          id: string
          ip_address: unknown
          permission_name: string | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
          user_role: Database["public"]["Enums"]["app_role"] | null
        }
        Insert: {
          action_attempted?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          permission_name?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Update: {
          action_attempted?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          permission_name?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "access_denied_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_activity_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_name: string | null
          entity_type: string
          id: string
          user_id: string
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_name?: string | null
          entity_type: string
          id?: string
          user_id: string
          user_name: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      answer_categories: {
        Row: {
          comment_required: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          question_type: string
          updated_at: string
        }
        Insert: {
          comment_required?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          question_type?: string
          updated_at?: string
        }
        Update: {
          comment_required?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          question_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      answer_category_snapshots: {
        Row: {
          comment_required: boolean | null
          diagnostic_id: string
          entity_id: string
          id: string
          name: string
          question_type: string | null
        }
        Insert: {
          comment_required?: boolean | null
          diagnostic_id: string
          entity_id: string
          id?: string
          name: string
          question_type?: string | null
        }
        Update: {
          comment_required?: boolean | null
          diagnostic_id?: string
          entity_id?: string
          id?: string
          name?: string
          question_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answer_category_snapshots_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_result_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answer_category_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "answer_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action_type: string
          admin_id: string | null
          created_at: string | null
          details: Json | null
          field: string | null
          id: string
          new_value: string | null
          old_value: string | null
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      career_track_steps: {
        Row: {
          career_track_id: string
          created_at: string
          description: string | null
          duration_months: number | null
          grade_id: string
          id: string
          step_order: number
          updated_at: string
        }
        Insert: {
          career_track_id: string
          created_at?: string
          description?: string | null
          duration_months?: number | null
          grade_id: string
          id?: string
          step_order: number
          updated_at?: string
        }
        Update: {
          career_track_id?: string
          created_at?: string
          description?: string | null
          duration_months?: number | null
          grade_id?: string
          id?: string
          step_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_track_steps_career_track_id_fkey"
            columns: ["career_track_id"]
            isOneToOne: false
            referencedRelation: "career_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_track_steps_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
        ]
      }
      career_tracks: {
        Row: {
          created_at: string
          description: string | null
          duration_months: number | null
          id: string
          name: string
          target_position_id: string | null
          track_type_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_months?: number | null
          id?: string
          name: string
          target_position_id?: string | null
          track_type_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_months?: number | null
          id?: string
          name?: string
          target_position_id?: string | null
          track_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_tracks_target_position_id_fkey"
            columns: ["target_position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_tracks_track_type_id_fkey"
            columns: ["track_type_id"]
            isOneToOne: false
            referencedRelation: "track_types"
            referencedColumns: ["id"]
          },
        ]
      }
      category_hard_skills: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      category_soft_skills: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      certifications: {
        Row: {
          cost: number | null
          created_at: string
          description: string | null
          id: string
          name: string
          provider: string | null
          updated_at: string
          validity_period_months: number | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          provider?: string | null
          updated_at?: string
          validity_period_months?: number | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          provider?: string | null
          updated_at?: string
          validity_period_months?: number | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      competency_levels: {
        Row: {
          created_at: string
          description: string | null
          id: string
          level: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          level: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          level?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      development_plan_tasks: {
        Row: {
          career_track_id: string | null
          career_track_step_id: string | null
          created_at: string
          goal: string
          hard_skill_id: string | null
          how_to: string
          id: string
          measurable_result: string
          priority: string
          soft_skill_id: string | null
          task_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          career_track_id?: string | null
          career_track_step_id?: string | null
          created_at?: string
          goal: string
          hard_skill_id?: string | null
          how_to: string
          id?: string
          measurable_result: string
          priority: string
          soft_skill_id?: string | null
          task_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          career_track_id?: string | null
          career_track_step_id?: string | null
          created_at?: string
          goal?: string
          hard_skill_id?: string | null
          how_to?: string
          id?: string
          measurable_result?: string
          priority?: string
          soft_skill_id?: string | null
          task_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_plan_tasks_career_track_id_fkey"
            columns: ["career_track_id"]
            isOneToOne: false
            referencedRelation: "career_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_plan_tasks_career_track_step_id_fkey"
            columns: ["career_track_step_id"]
            isOneToOne: false
            referencedRelation: "career_track_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_plan_tasks_hard_skill_id_fkey"
            columns: ["hard_skill_id"]
            isOneToOne: false
            referencedRelation: "hard_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_plan_tasks_soft_skill_id_fkey"
            columns: ["soft_skill_id"]
            isOneToOne: false
            referencedRelation: "soft_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_plan_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_plan_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      development_plans: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          start_date: string | null
          status: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          status?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "development_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      development_tasks: {
        Row: {
          competency_level_id: string | null
          created_at: string
          how_to: string
          id: string
          measurable_result: string
          quality_id: string | null
          skill_id: string | null
          task_goal: string
          task_name: string
          task_order: number
          updated_at: string
        }
        Insert: {
          competency_level_id?: string | null
          created_at?: string
          how_to: string
          id?: string
          measurable_result: string
          quality_id?: string | null
          skill_id?: string | null
          task_goal: string
          task_name: string
          task_order?: number
          updated_at?: string
        }
        Update: {
          competency_level_id?: string | null
          created_at?: string
          how_to?: string
          id?: string
          measurable_result?: string
          quality_id?: string | null
          skill_id?: string | null
          task_goal?: string
          task_name?: string
          task_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_tasks_competency_level_id_fkey"
            columns: ["competency_level_id"]
            isOneToOne: false
            referencedRelation: "competency_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_tasks_hard_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "hard_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_tasks_soft_skill_id_fkey"
            columns: ["quality_id"]
            isOneToOne: false
            referencedRelation: "soft_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_config_templates: {
        Row: {
          comment_rules: Json
          created_at: string
          created_by: string | null
          description: string | null
          hard_scale_max: number
          hard_scale_min: number
          hard_scale_reversed: boolean
          hard_skills_enabled: boolean
          id: string
          johari_rules: Json
          name: string
          open_questions_config: Json
          soft_scale_max: number
          soft_scale_min: number
          soft_scale_reversed: boolean
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          comment_rules?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          hard_scale_max?: number
          hard_scale_min?: number
          hard_scale_reversed?: boolean
          hard_skills_enabled?: boolean
          id?: string
          johari_rules?: Json
          name: string
          open_questions_config?: Json
          soft_scale_max?: number
          soft_scale_min?: number
          soft_scale_reversed?: boolean
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          comment_rules?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          hard_scale_max?: number
          hard_scale_min?: number
          hard_scale_reversed?: boolean
          hard_skills_enabled?: boolean
          id?: string
          johari_rules?: Json
          name?: string
          open_questions_config?: Json
          soft_scale_max?: number
          soft_scale_min?: number
          soft_scale_reversed?: boolean
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_config_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_result_snapshots: {
        Row: {
          created_at: string
          data_hash: string
          evaluated_user_id: string
          id: string
          is_current: boolean
          reason: string | null
          stage_id: string
          version: number
        }
        Insert: {
          created_at?: string
          data_hash: string
          evaluated_user_id: string
          id?: string
          is_current?: boolean
          reason?: string | null
          stage_id: string
          version?: number
        }
        Update: {
          created_at?: string
          data_hash?: string
          evaluated_user_id?: string
          id?: string
          is_current?: boolean
          reason?: string | null
          stage_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_result_snapshots_evaluated_user_id_fkey"
            columns: ["evaluated_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_result_snapshots_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_snapshot_jobs: {
        Row: {
          attempts: number
          created_at: string
          evaluated_user_id: string
          id: string
          last_error: string | null
          processed_at: string | null
          reason: string | null
          stage_id: string
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          evaluated_user_id: string
          id?: string
          last_error?: string | null
          processed_at?: string | null
          reason?: string | null
          stage_id: string
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          evaluated_user_id?: string
          id?: string
          last_error?: string | null
          processed_at?: string | null
          reason?: string | null
          stage_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_snapshot_jobs_evaluated_user_id_fkey"
            columns: ["evaluated_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_snapshot_jobs_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_snapshot_runs: {
        Row: {
          error_count: number
          error_message: string | null
          finished_at: string | null
          id: string
          inserted_count: number
          processed_subjects: number
          progress_percent: number
          skipped_count: number
          stage_id: string
          started_at: string
          started_by: string
          status: string
          summary_json: Json | null
          total_subjects: number
          versioned_count: number
        }
        Insert: {
          error_count?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          inserted_count?: number
          processed_subjects?: number
          progress_percent?: number
          skipped_count?: number
          stage_id: string
          started_at?: string
          started_by: string
          status?: string
          summary_json?: Json | null
          total_subjects?: number
          versioned_count?: number
        }
        Update: {
          error_count?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          inserted_count?: number
          processed_subjects?: number
          progress_percent?: number
          skipped_count?: number
          stage_id?: string
          started_at?: string
          started_by?: string
          status?: string
          summary_json?: Json | null
          total_subjects?: number
          versioned_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_snapshot_runs_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_stage_participants: {
        Row: {
          created_at: string
          id: string
          stage_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          stage_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          stage_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_stage_participants_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_stage_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_participant_stage"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_stages: {
        Row: {
          config_template_id: string | null
          created_at: string
          created_by: string
          evaluation_period: string | null
          frozen_config: Json | null
          id: string
          is_active: boolean
          parent_id: string | null
          progress_percent: number | null
          status: string
          updated_at: string
        }
        Insert: {
          config_template_id?: string | null
          created_at?: string
          created_by: string
          evaluation_period?: string | null
          frozen_config?: Json | null
          id?: string
          is_active?: boolean
          parent_id?: string | null
          progress_percent?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          config_template_id?: string | null
          created_at?: string
          created_by?: string
          evaluation_period?: string | null
          frozen_config?: Json | null
          id?: string
          is_active?: boolean
          parent_id?: string | null
          progress_percent?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_stages_config_template_id_fkey"
            columns: ["config_template_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_config_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_stages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_user_snapshots: {
        Row: {
          department_name: string | null
          diagnostic_id: string
          entity_id: string
          first_name: string | null
          grade_id: string | null
          grade_name: string | null
          id: string
          last_name: string | null
          middle_name: string | null
          position_category_name: string | null
          position_name: string | null
        }
        Insert: {
          department_name?: string | null
          diagnostic_id: string
          entity_id: string
          first_name?: string | null
          grade_id?: string | null
          grade_name?: string | null
          id?: string
          last_name?: string | null
          middle_name?: string | null
          position_category_name?: string | null
          position_name?: string | null
        }
        Update: {
          department_name?: string | null
          diagnostic_id?: string
          entity_id?: string
          first_name?: string | null
          grade_id?: string | null
          grade_name?: string | null
          id?: string
          last_name?: string | null
          middle_name?: string | null
          position_category_name?: string | null
          position_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_user_snapshots_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_result_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_user_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_stage_snapshots: {
        Row: {
          assignments_json: Json
          created_at: string
          evaluated_user_id: string
          hard_results_json: Json
          id: number
          johari_json: Json
          metrics_json: Json
          snapshot_tag: string
          soft_results_json: Json
          stage_id: string
        }
        Insert: {
          assignments_json: Json
          created_at?: string
          evaluated_user_id: string
          hard_results_json: Json
          id?: number
          johari_json: Json
          metrics_json: Json
          snapshot_tag: string
          soft_results_json: Json
          stage_id: string
        }
        Update: {
          assignments_json?: Json
          created_at?: string
          evaluated_user_id?: string
          hard_results_json?: Json
          id?: number
          johari_json?: Json
          metrics_json?: Json
          snapshot_tag?: string
          soft_results_json?: Json
          stage_id?: string
        }
        Relationships: []
      }
      grade_qualities: {
        Row: {
          created_at: string
          grade_id: string
          id: string
          quality_id: string
          target_level: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade_id: string
          id?: string
          quality_id: string
          target_level: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade_id?: string
          id?: string
          quality_id?: string
          target_level?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_qualities_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_qualities_soft_skill_id_fkey"
            columns: ["quality_id"]
            isOneToOne: false
            referencedRelation: "soft_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_quality_snapshots: {
        Row: {
          diagnostic_id: string
          entity_id: string
          grade_id: string
          id: string
          quality_id: string
          target_level: number
        }
        Insert: {
          diagnostic_id: string
          entity_id: string
          grade_id: string
          id?: string
          quality_id: string
          target_level: number
        }
        Update: {
          diagnostic_id?: string
          entity_id?: string
          grade_id?: string
          id?: string
          quality_id?: string
          target_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "grade_quality_snapshots_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_result_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_quality_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "grade_qualities"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_skill_snapshots: {
        Row: {
          diagnostic_id: string
          entity_id: string
          grade_id: string
          id: string
          skill_id: string
          target_level: number
        }
        Insert: {
          diagnostic_id: string
          entity_id: string
          grade_id: string
          id?: string
          skill_id: string
          target_level: number
        }
        Update: {
          diagnostic_id?: string
          entity_id?: string
          grade_id?: string
          id?: string
          skill_id?: string
          target_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "grade_skill_snapshots_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_result_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_skill_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "grade_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_skills: {
        Row: {
          created_at: string
          grade_id: string
          id: string
          skill_id: string
          target_level: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade_id: string
          id?: string
          skill_id: string
          target_level: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade_id?: string
          id?: string
          skill_id?: string
          target_level?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_skills_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_skills_hard_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "hard_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          certification_id: string | null
          created_at: string
          description: string | null
          id: string
          key_tasks: string | null
          level: number
          max_salary: number | null
          min_salary: number | null
          name: string
          parent_grade_id: string | null
          position_category_id: string | null
          position_id: string | null
          updated_at: string
        }
        Insert: {
          certification_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key_tasks?: string | null
          level: number
          max_salary?: number | null
          min_salary?: number | null
          name: string
          parent_grade_id?: string | null
          position_category_id?: string | null
          position_id?: string | null
          updated_at?: string
        }
        Update: {
          certification_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key_tasks?: string | null
          level?: number
          max_salary?: number | null
          min_salary?: number | null
          name?: string
          parent_grade_id?: string | null
          position_category_id?: string | null
          position_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_parent_grade_id_fkey"
            columns: ["parent_grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_position_category_id_fkey"
            columns: ["position_category_id"]
            isOneToOne: false
            referencedRelation: "position_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      hard_skill_answer_option_snapshots: {
        Row: {
          answer_category_id: string | null
          description: string | null
          diagnostic_id: string
          entity_id: string
          id: string
          level_value: number | null
          numeric_value: number
          order_index: number | null
          title: string
        }
        Insert: {
          answer_category_id?: string | null
          description?: string | null
          diagnostic_id: string
          entity_id: string
          id?: string
          level_value?: number | null
          numeric_value: number
          order_index?: number | null
          title: string
        }
        Update: {
          answer_category_id?: string | null
          description?: string | null
          diagnostic_id?: string
          entity_id?: string
          id?: string
          level_value?: number | null
          numeric_value?: number
          order_index?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "hard_skill_answer_option_snapshots_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_result_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hard_skill_answer_option_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "hard_skill_answer_options"
            referencedColumns: ["id"]
          },
        ]
      }
      hard_skill_answer_options: {
        Row: {
          answer_category_id: string | null
          created_at: string
          description: string | null
          id: string
          level_value: number
          numeric_value: number
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          answer_category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          level_value?: number
          numeric_value: number
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          answer_category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          level_value?: number
          numeric_value?: number
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hard_skill_answer_options_answer_category_id_fkey"
            columns: ["answer_category_id"]
            isOneToOne: false
            referencedRelation: "answer_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      hard_skill_category_snapshots: {
        Row: {
          description: string | null
          diagnostic_id: string
          entity_id: string
          id: string
          name: string
        }
        Insert: {
          description?: string | null
          diagnostic_id: string
          entity_id: string
          id?: string
          name: string
        }
        Update: {
          description?: string | null
          diagnostic_id?: string
          entity_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "hard_skill_category_snapshots_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_result_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hard_skill_category_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "category_hard_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      hard_skill_question_snapshots: {
        Row: {
          answer_category_id: string | null
          comment_required_override: boolean | null
          diagnostic_id: string
          entity_id: string
          id: string
          order_index: number | null
          question_text: string
          skill_id: string | null
          visibility_restriction_enabled: boolean | null
          visibility_restriction_type: string | null
        }
        Insert: {
          answer_category_id?: string | null
          comment_required_override?: boolean | null
          diagnostic_id: string
          entity_id: string
          id?: string
          order_index?: number | null
          question_text: string
          skill_id?: string | null
          visibility_restriction_enabled?: boolean | null
          visibility_restriction_type?: string | null
        }
        Update: {
          answer_category_id?: string | null
          comment_required_override?: boolean | null
          diagnostic_id?: string
          entity_id?: string
          id?: string
          order_index?: number | null
          question_text?: string
          skill_id?: string | null
          visibility_restriction_enabled?: boolean | null
          visibility_restriction_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hard_skill_question_snapshots_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_result_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hard_skill_question_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "hard_skill_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      hard_skill_questions: {
        Row: {
          answer_category_id: string | null
          comment_required_override: boolean | null
          created_at: string
          id: string
          order_index: number | null
          question_text: string
          skill_id: string | null
          updated_at: string
          visibility_restriction_enabled: boolean | null
          visibility_restriction_type: string | null
        }
        Insert: {
          answer_category_id?: string | null
          comment_required_override?: boolean | null
          created_at?: string
          id?: string
          order_index?: number | null
          question_text: string
          skill_id?: string | null
          updated_at?: string
          visibility_restriction_enabled?: boolean | null
          visibility_restriction_type?: string | null
        }
        Update: {
          answer_category_id?: string | null
          comment_required_override?: boolean | null
          created_at?: string
          id?: string
          order_index?: number | null
          question_text?: string
          skill_id?: string | null
          updated_at?: string
          visibility_restriction_enabled?: boolean | null
          visibility_restriction_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hard_skill_questions_answer_category_id_fkey"
            columns: ["answer_category_id"]
            isOneToOne: false
            referencedRelation: "answer_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hard_skill_questions_hard_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "hard_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      hard_skill_results: {
        Row: {
          answer_option_id: string | null
          assignment_id: string | null
          comment: string | null
          created_at: string
          diagnostic_stage_id: string | null
          evaluated_user_id: string
          evaluating_user_id: string | null
          evaluation_period: string | null
          id: string
          is_anonymous_comment: boolean | null
          is_draft: boolean | null
          is_skip: boolean | null
          question_id: string
          raw_numeric_value: number | null
          updated_at: string
        }
        Insert: {
          answer_option_id?: string | null
          assignment_id?: string | null
          comment?: string | null
          created_at?: string
          diagnostic_stage_id?: string | null
          evaluated_user_id: string
          evaluating_user_id?: string | null
          evaluation_period?: string | null
          id?: string
          is_anonymous_comment?: boolean | null
          is_draft?: boolean | null
          is_skip?: boolean | null
          question_id: string
          raw_numeric_value?: number | null
          updated_at?: string
        }
        Update: {
          answer_option_id?: string | null
          assignment_id?: string | null
          comment?: string | null
          created_at?: string
          diagnostic_stage_id?: string | null
          evaluated_user_id?: string
          evaluating_user_id?: string | null
          evaluation_period?: string | null
          id?: string
          is_anonymous_comment?: boolean | null
          is_draft?: boolean | null
          is_skip?: boolean | null
          question_id?: string
          raw_numeric_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hard_skill_results_answer_option_id_fkey"
            columns: ["answer_option_id"]
            isOneToOne: false
            referencedRelation: "hard_skill_answer_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hard_skill_results_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "survey_360_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hard_skill_results_diagnostic_stage_id_fkey"
            columns: ["diagnostic_stage_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hard_skill_results_evaluating_user_id_fkey"
            columns: ["evaluating_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hard_skill_results_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "hard_skill_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hard_skill_results_user_id_fkey"
            columns: ["evaluated_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hard_skill_snapshots: {
        Row: {
          category_id: string | null
          category_name: string | null
          description: string | null
          diagnostic_id: string
          entity_id: string
          id: string
          name: string
          sub_category_id: string | null
          subcategory_name: string | null
        }
        Insert: {
          category_id?: string | null
          category_name?: string | null
          description?: string | null
          diagnostic_id: string
          entity_id: string
          id?: string
          name: string
          sub_category_id?: string | null
          subcategory_name?: string | null
        }
        Update: {
          category_id?: string | null
          category_name?: string | null
          description?: string | null
          diagnostic_id?: string
          entity_id?: string
          id?: string
          name?: string
          sub_category_id?: string | null
          subcategory_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hard_skill_snapshots_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_result_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hard_skill_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "hard_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      hard_skill_subcategory_snapshots: {
        Row: {
          category_id: string | null
          category_name: string | null
          diagnostic_id: string
          entity_id: string
          id: string
          name: string
        }
        Insert: {
          category_id?: string | null
          category_name?: string | null
          diagnostic_id: string
          entity_id: string
          id?: string
          name: string
        }
        Update: {
          category_id?: string | null
          category_name?: string | null
          diagnostic_id?: string
          entity_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "hard_skill_subcategory_snapshots_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_result_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hard_skill_subcategory_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "sub_category_hard_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      hard_skills: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          sub_category_id: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sub_category_id?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sub_category_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hard_skills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_hard_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hard_skills_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_category_hard_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      johari_ai_snapshots: {
        Row: {
          ai_text: string | null
          comments_classification: Json | null
          created_at: string | null
          created_by: string | null
          data_hash: string
          evaluated_user_id: string
          id: string
          is_reviewed: boolean | null
          metrics_json: Json
          model: string | null
          prompt_version: string | null
          respondent_scope: string
          reviewed_at: string | null
          reviewed_by: string | null
          stage_id: string
          version: number
        }
        Insert: {
          ai_text?: string | null
          comments_classification?: Json | null
          created_at?: string | null
          created_by?: string | null
          data_hash: string
          evaluated_user_id: string
          id?: string
          is_reviewed?: boolean | null
          metrics_json: Json
          model?: string | null
          prompt_version?: string | null
          respondent_scope?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          stage_id: string
          version?: number
        }
        Update: {
          ai_text?: string | null
          comments_classification?: Json | null
          created_at?: string | null
          created_by?: string | null
          data_hash?: string
          evaluated_user_id?: string
          id?: string
          is_reviewed?: boolean | null
          metrics_json?: Json
          model?: string | null
          prompt_version?: string | null
          respondent_scope?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          stage_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "johari_ai_snapshots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "johari_ai_snapshots_evaluated_user_id_fkey"
            columns: ["evaluated_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "johari_ai_snapshots_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "johari_ai_snapshots_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturers: {
        Row: {
          brand: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          brand: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          brand?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      meeting_artifacts: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          id: string
          is_deleted: boolean
          meeting_id: string
          mime_type: string
          source_stage_id: string | null
          source_type: string | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          id?: string
          is_deleted?: boolean
          meeting_id: string
          mime_type: string
          source_stage_id?: string | null
          source_type?: string | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          is_deleted?: boolean
          meeting_id?: string
          mime_type?: string
          source_stage_id?: string | null
          source_type?: string | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_artifacts_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "one_on_one_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_decisions: {
        Row: {
          created_at: string
          created_by: string
          decision_text: string
          id: string
          is_completed: boolean
          meeting_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          decision_text: string
          id?: string
          is_completed?: boolean
          meeting_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          decision_text?: string
          id?: string
          is_completed?: boolean
          meeting_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_decisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_decisions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "one_on_one_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_manager_fields: {
        Row: {
          created_at: string | null
          id: string
          meeting_id: string
          mgr_development_comment: string | null
          mgr_news: string | null
          mgr_praise: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          meeting_id: string
          mgr_development_comment?: string | null
          mgr_news?: string | null
          mgr_praise?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          meeting_id?: string
          mgr_development_comment?: string | null
          mgr_news?: string | null
          mgr_praise?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_manager_fields_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "one_on_one_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_notifications: {
        Row: {
          created_at: string | null
          error: string | null
          id: string
          meeting_id: string | null
          recipient_id: string
          scenario_id: string
          scheduled_at: string
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          id?: string
          meeting_id?: string | null
          recipient_id: string
          scenario_id: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          error?: string | null
          id?: string
          meeting_id?: string | null
          recipient_id?: string
          scenario_id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notifications_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "one_on_one_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_private_notes: {
        Row: {
          created_at: string | null
          id: string
          manager_id: string
          meeting_id: string
          private_note: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          manager_id: string
          meeting_id: string
          private_note?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          manager_id?: string
          meeting_id?: string
          private_note?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_private_notes_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_private_notes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "one_on_one_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_reschedules: {
        Row: {
          id: string
          meeting_id: string
          new_date: string
          previous_date: string
          rescheduled_at: string
          rescheduled_by: string
        }
        Insert: {
          id?: string
          meeting_id: string
          new_date: string
          previous_date: string
          rescheduled_at?: string
          rescheduled_by: string
        }
        Update: {
          id?: string
          meeting_id?: string
          new_date?: string
          previous_date?: string
          rescheduled_at?: string
          rescheduled_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_reschedules_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "one_on_one_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_reschedules_rescheduled_by_fkey"
            columns: ["rescheduled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_stage_participants: {
        Row: {
          created_at: string
          id: string
          stage_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          stage_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          stage_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_stage_participants_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "meeting_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_stage_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_stages: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_stages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_stages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parent_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_status_current: {
        Row: {
          meeting_id: string
          mode: string
          reason: string | null
          status: string
          status_updated_at: string
          status_updated_by: string | null
        }
        Insert: {
          meeting_id: string
          mode?: string
          reason?: string | null
          status: string
          status_updated_at?: string
          status_updated_by?: string | null
        }
        Update: {
          meeting_id?: string
          mode?: string
          reason?: string | null
          status?: string
          status_updated_at?: string
          status_updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_status_current_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "one_on_one_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      one_on_one_meetings: {
        Row: {
          approved_at: string | null
          created_at: string
          created_by: string | null
          emp_mood: string | null
          emp_news: string | null
          emp_problems: string | null
          emp_questions: string | null
          emp_successes: string | null
          employee_id: string
          energy_gained: string | null
          energy_lost: string | null
          goal_and_agenda: string | null
          id: string
          ideas_and_suggestions: string | null
          manager_comment: string | null
          manager_id: string
          meeting_date: string | null
          meeting_link: string | null
          meeting_summary: string | null
          previous_decisions_debrief: string | null
          return_reason: string | null
          returned_at: string | null
          stage_end_snapshot_at: string | null
          stage_id: string | null
          status: string
          status_at_stage_end: string | null
          stoppers: string | null
          submitted_at: string | null
          summary_saved_at: string | null
          summary_saved_by: string | null
          summary_version: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          created_by?: string | null
          emp_mood?: string | null
          emp_news?: string | null
          emp_problems?: string | null
          emp_questions?: string | null
          emp_successes?: string | null
          employee_id: string
          energy_gained?: string | null
          energy_lost?: string | null
          goal_and_agenda?: string | null
          id?: string
          ideas_and_suggestions?: string | null
          manager_comment?: string | null
          manager_id: string
          meeting_date?: string | null
          meeting_link?: string | null
          meeting_summary?: string | null
          previous_decisions_debrief?: string | null
          return_reason?: string | null
          returned_at?: string | null
          stage_end_snapshot_at?: string | null
          stage_id?: string | null
          status?: string
          status_at_stage_end?: string | null
          stoppers?: string | null
          submitted_at?: string | null
          summary_saved_at?: string | null
          summary_saved_by?: string | null
          summary_version?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          created_by?: string | null
          emp_mood?: string | null
          emp_news?: string | null
          emp_problems?: string | null
          emp_questions?: string | null
          emp_successes?: string | null
          employee_id?: string
          energy_gained?: string | null
          energy_lost?: string | null
          goal_and_agenda?: string | null
          id?: string
          ideas_and_suggestions?: string | null
          manager_comment?: string | null
          manager_id?: string
          meeting_date?: string | null
          meeting_link?: string | null
          meeting_summary?: string | null
          previous_decisions_debrief?: string | null
          return_reason?: string | null
          returned_at?: string | null
          stage_end_snapshot_at?: string | null
          stage_id?: string | null
          status?: string
          status_at_stage_end?: string | null
          stoppers?: string | null
          submitted_at?: string | null
          summary_saved_at?: string | null
          summary_saved_by?: string | null
          summary_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_on_one_meetings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_one_meetings_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_one_meetings_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "meeting_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_on_one_meetings_summary_saved_by_fkey"
            columns: ["summary_saved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      open_question_results: {
        Row: {
          answer_text: string
          assignment_id: string
          created_at: string
          diagnostic_stage_id: string
          evaluated_user_id: string
          evaluating_user_id: string
          id: string
          is_anonymous: boolean
          is_draft: boolean
          open_question_id: string
          updated_at: string
        }
        Insert: {
          answer_text?: string
          assignment_id: string
          created_at?: string
          diagnostic_stage_id: string
          evaluated_user_id: string
          evaluating_user_id: string
          id?: string
          is_anonymous?: boolean
          is_draft?: boolean
          open_question_id: string
          updated_at?: string
        }
        Update: {
          answer_text?: string
          assignment_id?: string
          created_at?: string
          diagnostic_stage_id?: string
          evaluated_user_id?: string
          evaluating_user_id?: string
          id?: string
          is_anonymous?: boolean
          is_draft?: boolean
          open_question_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_question_results_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "survey_360_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_question_results_diagnostic_stage_id_fkey"
            columns: ["diagnostic_stage_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_question_results_evaluated_user_id_fkey"
            columns: ["evaluated_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_question_results_evaluating_user_id_fkey"
            columns: ["evaluating_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_question_results_open_question_id_fkey"
            columns: ["open_question_id"]
            isOneToOne: false
            referencedRelation: "open_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      open_questions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_required: boolean
          order_index: number
          question_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          order_index?: number
          question_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          order_index?: number
          question_text?: string
          updated_at?: string
        }
        Relationships: []
      }
      parent_stages: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          is_active: boolean
          period: string
          reminder_date: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          is_active?: boolean
          period: string
          reminder_date: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          is_active?: boolean
          period?: string
          reminder_date?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      permission_group_permissions: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          permission_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          permission_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          permission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_group_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "permission_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_group_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_groups: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          label: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          label: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          label?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          resource: string
          updated_at: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          resource: string
          updated_at?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          resource?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      position_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          created_at: string
          id: string
          name: string
          position_category_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position_category_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position_category_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_position_category_id_fkey"
            columns: ["position_category_id"]
            isOneToOne: false
            referencedRelation: "position_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_id: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      soft_skill_answer_option_snapshots: {
        Row: {
          answer_category_id: string | null
          description: string | null
          diagnostic_id: string
          entity_id: string
          id: string
          level_value: number | null
          numeric_value: number
          order_index: number | null
          title: string
        }
        Insert: {
          answer_category_id?: string | null
          description?: string | null
          diagnostic_id: string
          entity_id: string
          id?: string
          level_value?: number | null
          numeric_value: number
          order_index?: number | null
          title: string
        }
        Update: {
          answer_category_id?: string | null
          description?: string | null
          diagnostic_id?: string
          entity_id?: string
          id?: string
          level_value?: number | null
          numeric_value?: number
          order_index?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "soft_skill_answer_option_snapshots_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_result_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soft_skill_answer_option_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "soft_skill_answer_options"
            referencedColumns: ["id"]
          },
        ]
      }
      soft_skill_answer_options: {
        Row: {
          answer_category_id: string | null
          created_at: string
          description: string | null
          id: string
          level_value: number
          numeric_value: number
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          answer_category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          level_value?: number
          numeric_value: number
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          answer_category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          level_value?: number
          numeric_value?: number
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "soft_skill_answer_options_answer_category_id_fkey"
            columns: ["answer_category_id"]
            isOneToOne: false
            referencedRelation: "answer_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      soft_skill_category_snapshots: {
        Row: {
          description: string | null
          diagnostic_id: string
          entity_id: string
          id: string
          name: string
        }
        Insert: {
          description?: string | null
          diagnostic_id: string
          entity_id: string
          id?: string
          name: string
        }
        Update: {
          description?: string | null
          diagnostic_id?: string
          entity_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "soft_skill_category_snapshots_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_result_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soft_skill_category_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "category_soft_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      soft_skill_question_snapshots: {
        Row: {
          answer_category_id: string | null
          behavioral_indicators: string | null
          category: string | null
          comment_required_override: boolean | null
          diagnostic_id: string
          entity_id: string
          id: string
          order_index: number | null
          quality_id: string | null
          question_text: string
          visibility_restriction_enabled: boolean | null
          visibility_restriction_type: string | null
        }
        Insert: {
          answer_category_id?: string | null
          behavioral_indicators?: string | null
          category?: string | null
          comment_required_override?: boolean | null
          diagnostic_id: string
          entity_id: string
          id?: string
          order_index?: number | null
          quality_id?: string | null
          question_text: string
          visibility_restriction_enabled?: boolean | null
          visibility_restriction_type?: string | null
        }
        Update: {
          answer_category_id?: string | null
          behavioral_indicators?: string | null
          category?: string | null
          comment_required_override?: boolean | null
          diagnostic_id?: string
          entity_id?: string
          id?: string
          order_index?: number | null
          quality_id?: string | null
          question_text?: string
          visibility_restriction_enabled?: boolean | null
          visibility_restriction_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "soft_skill_question_snapshots_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_result_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soft_skill_question_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "soft_skill_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      soft_skill_questions: {
        Row: {
          answer_category_id: string | null
          behavioral_indicators: string | null
          category: string | null
          comment_required_override: boolean | null
          created_at: string
          id: string
          order_index: number | null
          quality_id: string | null
          question_text: string
          updated_at: string
          visibility_restriction_enabled: boolean | null
          visibility_restriction_type: string | null
        }
        Insert: {
          answer_category_id?: string | null
          behavioral_indicators?: string | null
          category?: string | null
          comment_required_override?: boolean | null
          created_at?: string
          id?: string
          order_index?: number | null
          quality_id?: string | null
          question_text: string
          updated_at?: string
          visibility_restriction_enabled?: boolean | null
          visibility_restriction_type?: string | null
        }
        Update: {
          answer_category_id?: string | null
          behavioral_indicators?: string | null
          category?: string | null
          comment_required_override?: boolean | null
          created_at?: string
          id?: string
          order_index?: number | null
          quality_id?: string | null
          question_text?: string
          updated_at?: string
          visibility_restriction_enabled?: boolean | null
          visibility_restriction_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_survey_360_questions_soft_skill"
            columns: ["quality_id"]
            isOneToOne: false
            referencedRelation: "soft_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soft_skill_questions_answer_category_id_fkey"
            columns: ["answer_category_id"]
            isOneToOne: false
            referencedRelation: "answer_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soft_skill_questions_soft_skill_id_fkey"
            columns: ["quality_id"]
            isOneToOne: false
            referencedRelation: "soft_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      soft_skill_results: {
        Row: {
          answer_option_id: string | null
          assignment_id: string | null
          comment: string | null
          created_at: string
          diagnostic_stage_id: string | null
          evaluated_user_id: string
          evaluating_user_id: string
          evaluation_period: string | null
          id: string
          is_anonymous_comment: boolean | null
          is_draft: boolean | null
          is_skip: boolean | null
          question_id: string
          raw_numeric_value: number | null
          updated_at: string
        }
        Insert: {
          answer_option_id?: string | null
          assignment_id?: string | null
          comment?: string | null
          created_at?: string
          diagnostic_stage_id?: string | null
          evaluated_user_id: string
          evaluating_user_id: string
          evaluation_period?: string | null
          id?: string
          is_anonymous_comment?: boolean | null
          is_draft?: boolean | null
          is_skip?: boolean | null
          question_id: string
          raw_numeric_value?: number | null
          updated_at?: string
        }
        Update: {
          answer_option_id?: string | null
          assignment_id?: string | null
          comment?: string | null
          created_at?: string
          diagnostic_stage_id?: string | null
          evaluated_user_id?: string
          evaluating_user_id?: string
          evaluation_period?: string | null
          id?: string
          is_anonymous_comment?: boolean | null
          is_draft?: boolean | null
          is_skip?: boolean | null
          question_id?: string
          raw_numeric_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "soft_skill_results_answer_option_id_fkey"
            columns: ["answer_option_id"]
            isOneToOne: false
            referencedRelation: "soft_skill_answer_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soft_skill_results_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "survey_360_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soft_skill_results_diagnostic_stage_id_fkey"
            columns: ["diagnostic_stage_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soft_skill_results_evaluated_user_id_fkey"
            columns: ["evaluated_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soft_skill_results_evaluating_user_id_fkey"
            columns: ["evaluating_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soft_skill_results_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "soft_skill_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      soft_skill_snapshots: {
        Row: {
          category_id: string | null
          category_name: string | null
          description: string | null
          diagnostic_id: string
          entity_id: string
          id: string
          name: string
          sub_category_id: string | null
          subcategory_name: string | null
        }
        Insert: {
          category_id?: string | null
          category_name?: string | null
          description?: string | null
          diagnostic_id: string
          entity_id: string
          id?: string
          name: string
          sub_category_id?: string | null
          subcategory_name?: string | null
        }
        Update: {
          category_id?: string | null
          category_name?: string | null
          description?: string | null
          diagnostic_id?: string
          entity_id?: string
          id?: string
          name?: string
          sub_category_id?: string | null
          subcategory_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "soft_skill_snapshots_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_result_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soft_skill_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "soft_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      soft_skill_subcategory_snapshots: {
        Row: {
          category_id: string | null
          category_name: string | null
          diagnostic_id: string
          entity_id: string
          id: string
          name: string
        }
        Insert: {
          category_id?: string | null
          category_name?: string | null
          diagnostic_id: string
          entity_id: string
          id?: string
          name: string
        }
        Update: {
          category_id?: string | null
          category_name?: string | null
          diagnostic_id?: string
          entity_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "soft_skill_subcategory_snapshots_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_result_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soft_skill_subcategory_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "sub_category_soft_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      soft_skills: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          sub_category_id: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sub_category_id?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sub_category_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "soft_skills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_soft_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soft_skills_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "sub_category_soft_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_category_hard_skills: {
        Row: {
          category_hard_skill_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category_hard_skill_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category_hard_skill_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_category_hard_skills_category_hard_skill_id_fkey"
            columns: ["category_hard_skill_id"]
            isOneToOne: false
            referencedRelation: "category_hard_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_category_soft_skills: {
        Row: {
          category_soft_skill_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category_soft_skill_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category_soft_skill_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_category_soft_skills_category_soft_skill_id_fkey"
            columns: ["category_soft_skill_id"]
            isOneToOne: false
            referencedRelation: "category_soft_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_360_assignments: {
        Row: {
          added_by_manager: boolean | null
          approved_at: string | null
          approved_by: string | null
          assigned_date: string
          assignment_type: string | null
          created_at: string
          diagnostic_stage_id: string | null
          evaluated_user_id: string
          evaluating_user_id: string
          id: string
          is_manager_participant: boolean | null
          rejected_at: string | null
          rejection_reason: string | null
          stage_end_snapshot_at: string | null
          status: string
          status_at_stage_end: string | null
          updated_at: string
        }
        Insert: {
          added_by_manager?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_date?: string
          assignment_type?: string | null
          created_at?: string
          diagnostic_stage_id?: string | null
          evaluated_user_id: string
          evaluating_user_id: string
          id?: string
          is_manager_participant?: boolean | null
          rejected_at?: string | null
          rejection_reason?: string | null
          stage_end_snapshot_at?: string | null
          status?: string
          status_at_stage_end?: string | null
          updated_at?: string
        }
        Update: {
          added_by_manager?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_date?: string
          assignment_type?: string | null
          created_at?: string
          diagnostic_stage_id?: string | null
          evaluated_user_id?: string
          evaluating_user_id?: string
          id?: string
          is_manager_participant?: boolean | null
          rejected_at?: string | null
          rejection_reason?: string | null
          stage_end_snapshot_at?: string | null
          status?: string
          status_at_stage_end?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_360_assignments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_360_assignments_diagnostic_stage_id_fkey"
            columns: ["diagnostic_stage_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_assignment_snapshots: {
        Row: {
          assignment_type: string | null
          diagnostic_id: string
          entity_id: string
          evaluating_user_id: string | null
          evaluator_first_name: string | null
          evaluator_last_name: string | null
          evaluator_position_category_name: string | null
          id: string
        }
        Insert: {
          assignment_type?: string | null
          diagnostic_id: string
          entity_id: string
          evaluating_user_id?: string | null
          evaluator_first_name?: string | null
          evaluator_last_name?: string | null
          evaluator_position_category_name?: string | null
          id?: string
        }
        Update: {
          assignment_type?: string | null
          diagnostic_id?: string
          entity_id?: string
          evaluating_user_id?: string | null
          evaluator_first_name?: string | null
          evaluator_last_name?: string | null
          evaluator_position_category_name?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_assignment_snapshots_diagnostic_id_fkey"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_result_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_assignment_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "survey_360_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignment_id: string | null
          assignment_type: string | null
          category: string | null
          competency_ref: string | null
          created_at: string
          deadline: string | null
          description: string | null
          diagnostic_stage_id: string | null
          id: string
          kpi_expected_level: number | null
          kpi_result_level: number | null
          priority: string | null
          stage_end_snapshot_at: string | null
          status: string
          status_at_stage_end: string | null
          task_type: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_id?: string | null
          assignment_type?: string | null
          category?: string | null
          competency_ref?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          diagnostic_stage_id?: string | null
          id?: string
          kpi_expected_level?: number | null
          kpi_result_level?: number | null
          priority?: string | null
          stage_end_snapshot_at?: string | null
          status?: string
          status_at_stage_end?: string | null
          task_type?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_id?: string | null
          assignment_type?: string | null
          category?: string | null
          competency_ref?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          diagnostic_stage_id?: string | null
          id?: string
          kpi_expected_level?: number | null
          kpi_result_level?: number | null
          priority?: string | null
          stage_end_snapshot_at?: string | null
          status?: string
          status_at_stage_end?: string | null
          task_type?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tasks_diagnostic_stage"
            columns: ["diagnostic_stage_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      template_scale_labels: {
        Row: {
          id: string
          label_text: string
          level_value: number
          order_index: number
          skill_type: string
          template_id: string
        }
        Insert: {
          id?: string
          label_text: string
          level_value: number
          order_index?: number
          skill_type: string
          template_id: string
        }
        Update: {
          id?: string
          label_text?: string
          level_value?: number
          order_index?: number
          skill_type?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_scale_labels_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_config_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      track_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      trade_points: {
        Row: {
          address: string
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_assessment_results: {
        Row: {
          assessment_date: string | null
          assessment_period: string | null
          created_at: string | null
          diagnostic_stage_id: string | null
          id: string
          manager_assessment: number | null
          peers_average: number | null
          quality_id: string | null
          self_assessment: number | null
          skill_id: string | null
          total_responses: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assessment_date?: string | null
          assessment_period?: string | null
          created_at?: string | null
          diagnostic_stage_id?: string | null
          id?: string
          manager_assessment?: number | null
          peers_average?: number | null
          quality_id?: string | null
          self_assessment?: number | null
          skill_id?: string | null
          total_responses?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assessment_date?: string | null
          assessment_period?: string | null
          created_at?: string | null
          diagnostic_stage_id?: string | null
          id?: string
          manager_assessment?: number | null
          peers_average?: number | null
          quality_id?: string | null
          self_assessment?: number | null
          skill_id?: string | null
          total_responses?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_assessment_results_diagnostic_stage_id_fkey"
            columns: ["diagnostic_stage_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_assessment_results_quality_id_fkey"
            columns: ["quality_id"]
            isOneToOne: false
            referencedRelation: "soft_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_assessment_results_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "hard_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_assessment_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_career_progress: {
        Row: {
          career_track_id: string
          created_at: string
          current_step_id: string | null
          id: string
          selected_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          career_track_id: string
          created_at?: string
          current_step_id?: string | null
          id?: string
          selected_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          career_track_id?: string
          created_at?: string
          current_step_id?: string | null
          id?: string
          selected_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_career_progress_career_track_id"
            columns: ["career_track_id"]
            isOneToOne: false
            referencedRelation: "career_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_career_progress_current_step_id"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "career_track_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_career_progress_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_career_ratings: {
        Row: {
          calculated_at: string
          career_track_id: string
          created_at: string
          evaluation_period: string | null
          grade_id: string
          id: string
          s_final: number
          s_hard: number
          s_soft: number
          updated_at: string
          user_id: string
        }
        Insert: {
          calculated_at?: string
          career_track_id: string
          created_at?: string
          evaluation_period?: string | null
          grade_id: string
          id?: string
          s_final?: number
          s_hard?: number
          s_soft?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          calculated_at?: string
          career_track_id?: string
          created_at?: string
          evaluation_period?: string | null
          grade_id?: string
          id?: string
          s_final?: number
          s_hard?: number
          s_soft?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_career_ratings_career_track_id_fkey"
            columns: ["career_track_id"]
            isOneToOne: false
            referencedRelation: "career_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_career_ratings_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_career_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_effective_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_effective_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          id: string
          phone: string | null
          store_number: string | null
          updated_at: string
          user_id: string
          work_address: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          phone?: string | null
          store_number?: string | null
          updated_at?: string
          user_id: string
          work_address?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          phone?: string | null
          store_number?: string | null
          updated_at?: string
          user_id?: string
          work_address?: string | null
        }
        Relationships: []
      }
      user_qualities: {
        Row: {
          created_at: string
          current_level: number
          id: string
          last_assessed_at: string | null
          notes: string | null
          quality_id: string
          target_level: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_level?: number
          id?: string
          last_assessed_at?: string | null
          notes?: string | null
          quality_id: string
          target_level?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_level?: number
          id?: string
          last_assessed_at?: string | null
          notes?: string | null
          quality_id?: string
          target_level?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_qualities_quality_id_fkey"
            columns: ["quality_id"]
            isOneToOne: false
            referencedRelation: "soft_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_skills: {
        Row: {
          created_at: string
          current_level: number
          id: string
          last_assessed_at: string | null
          notes: string | null
          skill_id: string
          target_level: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_level?: number
          id?: string
          last_assessed_at?: string | null
          notes?: string | null
          skill_id: string
          target_level?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_level?: number
          id?: string
          last_assessed_at?: string | null
          notes?: string | null
          skill_id?: string
          target_level?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "hard_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      user_trade_points: {
        Row: {
          assigned_at: string
          created_at: string
          id: string
          trade_point_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          id?: string
          trade_point_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          id?: string
          trade_point_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_trade_points_trade_point_id"
            columns: ["trade_point_id"]
            isOneToOne: false
            referencedRelation: "trade_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_trade_points_user_id"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          bitrix_bot_enabled: boolean | null
          bitrix_bot_status: string | null
          bitrix_user_id: string | null
          cookies_consent: boolean | null
          cookies_consent_at: string | null
          created_at: string
          department_id: string | null
          email: string
          employee_number: string
          first_name: string | null
          grade_id: string | null
          hr_bp_id: string | null
          id: string
          last_login_at: string | null
          last_name: string | null
          manager_id: string | null
          middle_name: string | null
          position_id: string | null
          start_date: string | null
          status: boolean
          timezone: string
          timezone_manual: boolean
          updated_at: string
        }
        Insert: {
          bitrix_bot_enabled?: boolean | null
          bitrix_bot_status?: string | null
          bitrix_user_id?: string | null
          cookies_consent?: boolean | null
          cookies_consent_at?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          employee_number: string
          first_name?: string | null
          grade_id?: string | null
          hr_bp_id?: string | null
          id?: string
          last_login_at?: string | null
          last_name?: string | null
          manager_id?: string | null
          middle_name?: string | null
          position_id?: string | null
          start_date?: string | null
          status?: boolean
          timezone?: string
          timezone_manual?: boolean
          updated_at?: string
        }
        Update: {
          bitrix_bot_enabled?: boolean | null
          bitrix_bot_status?: string | null
          bitrix_user_id?: string | null
          cookies_consent?: boolean | null
          cookies_consent_at?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          employee_number?: string
          first_name?: string | null
          grade_id?: string | null
          hr_bp_id?: string | null
          id?: string
          last_login_at?: string | null
          last_name?: string | null
          manager_id?: string | null
          middle_name?: string | null
          position_id?: string | null
          start_date?: string | null
          status?: boolean
          timezone?: string
          timezone_manual?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_hr_bp_id_fkey"
            columns: ["hr_bp_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_supervisor_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_cleanup_all_data: { Args: never; Returns: Json }
      admin_delete_all_from_table: {
        Args: { table_name: string }
        Returns: Json
      }
      backfill_diagnostic_snapshots: { Args: never; Returns: number }
      calculate_career_gap: {
        Args: { p_grade_id: string; p_user_id: string }
        Returns: {
          competency_id: string
          competency_name: string
          competency_type: string
          current_level: number
          gap: number
          is_ready: boolean
          target_level: number
        }[]
      }
      calculate_diagnostic_stage_progress: {
        Args: { stage_id_param: string }
        Returns: number
      }
      can_manage_users: { Args: { _user_id: string }; Returns: boolean }
      can_view_snapshot: {
        Args: { _snapshot_evaluated_user_id: string }
        Returns: boolean
      }
      can_view_users: { Args: { _user_id: string }; Returns: boolean }
      check_and_deactivate_expired_stages: { Args: never; Returns: undefined }
      check_and_finalize_expired_stages: { Args: never; Returns: undefined }
      check_answer_category_usage: {
        Args: { _category_id: string }
        Returns: boolean
      }
      check_career_data_consistency: {
        Args: never
        Returns: {
          check_name: string
          details: Json
          status: string
        }[]
      }
      check_diagnostic_data_consistency: {
        Args: never
        Returns: {
          check_name: string
          details: Json
          status: string
        }[]
      }
      check_diagnostic_invariants: {
        Args: { stage_id_param: string }
        Returns: {
          check_name: string
          details: Json
          status: string
        }[]
      }
      check_meetings_data_consistency: {
        Args: never
        Returns: {
          check_name: string
          details: Json
          status: string
        }[]
      }
      create_or_refresh_diagnostic_snapshot: {
        Args: {
          p_evaluated_user_id: string
          p_reason?: string
          p_stage_id: string
        }
        Returns: undefined
      }
      finalize_expired_stage: {
        Args: { p_stage_id: string }
        Returns: undefined
      }
      get_all_permissions: {
        Args: never
        Returns: {
          action: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          resource: string
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "permissions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_current_session_user: { Args: never; Returns: string }
      get_current_user_id: { Args: never; Returns: string }
      get_current_user_manager_id: { Args: never; Returns: string }
      get_evaluated_user_grade_id: {
        Args: { p_assignment_id: string; p_user_id: string }
        Returns: string
      }
      get_evaluation_period: { Args: { created_date: string }; Returns: string }
      get_hard_skill_results_safe: {
        Args: { p_evaluated_user_id: string; p_stage_id?: string }
        Returns: {
          answer_option_id: string
          assignment_id: string
          comment: string
          created_at: string
          diagnostic_stage_id: string
          evaluated_user_id: string
          evaluating_user_id: string
          evaluation_period: string
          id: string
          is_anonymous_comment: boolean
          is_draft: boolean
          is_skip: boolean
          question_id: string
          raw_numeric_value: number
          updated_at: string
        }[]
      }
      get_hr_bp_company_department_ids: {
        Args: { _user_id: string }
        Returns: {
          department_id: string
        }[]
      }
      get_management_subtree_ids: {
        Args: { _manager_id: string }
        Returns: string[]
      }
      get_my_assignment_stats: {
        Args: { _evaluated_user_id: string; _stage_id?: string }
        Returns: {
          completed_evaluators: number
          pending_evaluators: number
          total_evaluators: number
        }[]
      }
      get_open_question_results_safe: {
        Args: { p_evaluated_user_id: string; p_stage_id?: string }
        Returns: {
          answer_text: string
          assignment_id: string
          created_at: string
          diagnostic_stage_id: string
          evaluated_user_id: string
          evaluating_user_id: string
          id: string
          is_anonymous: boolean
          is_draft: boolean
          open_question_id: string
          updated_at: string
        }[]
      }
      get_recommended_development_tasks: {
        Args: { p_grade_id: string; p_limit?: number; p_user_id: string }
        Returns: {
          competency_id: string
          competency_name: string
          competency_type: string
          current_level: number
          gap: number
          how_to: string
          measurable_result: string
          target_level: number
          task_goal: string
          task_id: string
          task_name: string
          task_order: number
        }[]
      }
      get_respondent_profiles: {
        Args: { p_user_ids: string[] }
        Returns: {
          first_name: string
          id: string
          last_name: string
          middle_name: string
          position_category_id: string
          position_category_name: string
          position_name: string
        }[]
      }
      get_role_permissions: {
        Args: never
        Returns: {
          created_at: string | null
          id: string
          permission_id: string | null
          role: Database["public"]["Enums"]["app_role"]
        }[]
        SetofOptions: {
          from: "*"
          to: "role_permissions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_soft_skill_results_safe: {
        Args: { p_evaluated_user_id: string; p_stage_id?: string }
        Returns: {
          answer_option_id: string
          assignment_id: string
          comment: string
          created_at: string
          diagnostic_stage_id: string
          evaluated_user_id: string
          evaluating_user_id: string
          evaluation_period: string
          id: string
          is_anonymous_comment: boolean
          is_draft: boolean
          is_skip: boolean
          question_id: string
          raw_numeric_value: number
          updated_at: string
        }[]
      }
      get_stage_status_by_dates: {
        Args: { end_date: string; start_date: string }
        Returns: string
      }
      get_user_department_id: { Args: { _user_id: string }; Returns: string }
      get_user_display_names: {
        Args: { p_user_ids: string[] }
        Returns: {
          first_name: string
          id: string
          last_name: string
          middle_name: string
        }[]
      }
      get_user_manager_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_with_role: {
        Args: { user_email: string }
        Returns: {
          email: string
          full_name: string
          id: string
          role_name: string
        }[]
      }
      get_users_for_peer_selection: {
        Args: { _current_user_id: string }
        Returns: {
          department_id: string
          email: string
          first_name: string
          id: string
          last_name: string
          middle_name: string
          position_id: string
        }[]
      }
      get_users_with_roles: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          last_login_at: string
          role: Database["public"]["Enums"]["app_role"]
          status: boolean
          updated_at: string
        }[]
      }
      has_permission:
        | { Args: { _permission_name: string }; Returns: boolean }
        | {
            Args: { _permission_name: string; _user_id: string }
            Returns: boolean
          }
      is_diagnostic_stage_participant: {
        Args: { _stage_id: string; _user_id: string }
        Returns: boolean
      }
      is_evaluated_peer: {
        Args: { _evaluated_id: string; _evaluator_id: string }
        Returns: boolean
      }
      is_in_management_subtree: {
        Args: { _manager_id: string; _target_id: string }
        Returns: boolean
      }
      is_meeting_participant: {
        Args: { _meeting_id: string; _user_id: string }
        Returns: boolean
      }
      is_meeting_stage_participant: {
        Args: { _stage_id: string; _user_id: string }
        Returns: boolean
      }
      is_owner:
        | {
            Args: { _record_user_id: string; _user_id: string }
            Returns: boolean
          }
        | { Args: { user_id_to_check: string }; Returns: boolean }
      is_stage_expired:
        | { Args: { deadline_date: string }; Returns: boolean }
        | { Args: { stage_id: string }; Returns: boolean }
      is_users_manager:
        | { Args: { _manager_id: string; _user_id: string }; Returns: boolean }
        | { Args: { target_user_id: string }; Returns: boolean }
      log_access_denied: {
        Args: {
          _action_attempted?: string
          _permission_name: string
          _resource_id?: string
          _resource_type?: string
        }
        Returns: undefined
      }
      log_admin_action: {
        Args: {
          _action_type: string
          _admin_id: string
          _details?: Json
          _field?: string
          _new_value?: string
          _old_value?: string
          _target_user_id: string
        }
        Returns: string
      }
      process_diagnostic_snapshot_job: {
        Args: { p_job_id: string }
        Returns: undefined
      }
      process_meeting_status: { Args: never; Returns: undefined }
      process_meeting_tasks: { Args: never; Returns: undefined }
      recommend_career_tracks: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          compatibility_score: number
          steps_count: number
          target_position_name: string
          total_gap: number
          track_id: string
          track_name: string
          track_type_name: string
        }[]
      }
      refresh_role_effective_permissions: {
        Args: { target_role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      refresh_user_effective_permissions: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      reopen_expired_stage: { Args: { stage_id: string }; Returns: undefined }
      review_johari_snapshot: {
        Args: { p_snapshot_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "employee"
        | "manager"
        | "hr_bp"
      stage_type: "parent" | "diagnostic" | "meetings"
      survey_selection_type: "colleague" | "supervisor" | "department"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "employee", "manager", "hr_bp"],
      stage_type: ["parent", "diagnostic", "meetings"],
      survey_selection_type: ["colleague", "supervisor", "department"],
    },
  },
} as const
