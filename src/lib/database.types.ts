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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      departments: {
        Row: {
          created_at: string
          default_routing_position: number | null
          id: string
          is_archived: boolean
          lead_user_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_routing_position?: number | null
          id?: string
          is_archived?: boolean
          lead_user_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_routing_position?: number | null
          id?: string
          is_archived?: boolean
          lead_user_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_lead_user_id_fkey"
            columns: ["lead_user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_lead_user_id_fkey"
            columns: ["lead_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string
          file_name: string
          file_size_bytes: number
          file_type: Database["public"]["Enums"]["file_type"]
          id: string
          inspection_id: string | null
          job_id: string | null
          project_id: string
          storage_path: string
          thumbnail_path: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size_bytes: number
          file_type: Database["public"]["Enums"]["file_type"]
          id?: string
          inspection_id?: string | null
          job_id?: string | null
          project_id: string
          storage_path: string
          thumbnail_path?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size_bytes?: number
          file_type?: Database["public"]["Enums"]["file_type"]
          id?: string
          inspection_id?: string | null
          job_id?: string | null
          project_id?: string
          storage_path?: string
          thumbnail_path?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          created_at: string
          decided_at: string
          decision: Database["public"]["Enums"]["inspection_decision"]
          id: string
          inspector_id: string
          job_stage_id: string
          note_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string
          decision: Database["public"]["Enums"]["inspection_decision"]
          id?: string
          inspector_id: string
          job_stage_id: string
          note_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string
          decision?: Database["public"]["Enums"]["inspection_decision"]
          id?: string
          inspector_id?: string
          job_stage_id?: string
          note_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_job_stage_id_fkey"
            columns: ["job_stage_id"]
            isOneToOne: false
            referencedRelation: "job_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      job_stages: {
        Row: {
          approved_at: string | null
          created_at: string
          department_id: string
          entered_at: string | null
          id: string
          job_id: string
          sequence: number
          status: Database["public"]["Enums"]["stage_status"]
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          department_id: string
          entered_at?: string | null
          id?: string
          job_id: string
          sequence: number
          status?: Database["public"]["Enums"]["stage_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          department_id?: string
          entered_at?: string | null
          id?: string
          job_id?: string
          sequence?: number
          status?: Database["public"]["Enums"]["stage_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_stages_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_stages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_stages_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_stages_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          current_stage_id: string | null
          description: string | null
          id: string
          job_code: string
          name: string
          project_id: string
          qr_code_uuid: string
          queue_position: number | null
          status: Database["public"]["Enums"]["job_status"]
          suffix: string | null
          total_labor_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_stage_id?: string | null
          description?: string | null
          id?: string
          job_code: string
          name: string
          project_id: string
          qr_code_uuid?: string
          queue_position?: number | null
          status?: Database["public"]["Enums"]["job_status"]
          suffix?: string | null
          total_labor_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_stage_id?: string | null
          description?: string | null
          id?: string
          job_code?: string
          name?: string
          project_id?: string
          qr_code_uuid?: string
          queue_position?: number | null
          status?: Database["public"]["Enums"]["job_status"]
          suffix?: string | null
          total_labor_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "job_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_logs: {
        Row: {
          admin_override: boolean
          clocked_in_at: string
          clocked_out_at: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          job_id: string
          project_id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_override?: boolean
          clocked_in_at?: string
          clocked_out_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          job_id: string
          project_id: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_override?: boolean
          clocked_in_at?: string
          clocked_out_at?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          job_id?: string
          project_id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          arrived_at: string | null
          created_at: string
          description: string | null
          id: string
          is_arrived: boolean
          is_ordered: boolean
          job_id: string
          name: string
          ordered_at: string | null
          qr_code_uuid: string | null
          quantity: number
          sheet_row_ref: string | null
          supplier: string | null
          sync_source: Database["public"]["Enums"]["sync_source"]
          unit: string | null
          updated_at: string
        }
        Insert: {
          arrived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_arrived?: boolean
          is_ordered?: boolean
          job_id: string
          name: string
          ordered_at?: string | null
          qr_code_uuid?: string | null
          quantity: number
          sheet_row_ref?: string | null
          supplier?: string | null
          sync_source?: Database["public"]["Enums"]["sync_source"]
          unit?: string | null
          updated_at?: string
        }
        Update: {
          arrived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_arrived?: boolean
          is_ordered?: boolean
          job_id?: string
          name?: string
          ordered_at?: string | null
          qr_code_uuid?: string | null
          quantity?: number
          sheet_row_ref?: string | null
          supplier?: string | null
          sync_source?: Database["public"]["Enums"]["sync_source"]
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string
          created_at: string
          en_text: string | null
          es_text: string | null
          id: string
          job_id: string | null
          original_language: Database["public"]["Enums"]["language"]
          original_text: string
          project_id: string
          ru_text: string | null
          task_id: string | null
          translation_status: Database["public"]["Enums"]["translation_status"]
          updated_at: string
        }
        Insert: {
          author_id: string
          created_at?: string
          en_text?: string | null
          es_text?: string | null
          id?: string
          job_id?: string | null
          original_language: Database["public"]["Enums"]["language"]
          original_text: string
          project_id: string
          ru_text?: string | null
          task_id?: string | null
          translation_status?: Database["public"]["Enums"]["translation_status"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          en_text?: string | null
          es_text?: string | null
          id?: string
          job_id?: string | null
          original_language?: Database["public"]["Enums"]["language"]
          original_text?: string
          project_id?: string
          ru_text?: string | null
          task_id?: string | null
          translation_status?: Database["public"]["Enums"]["translation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body_en: string
          body_es: string
          body_ru: string
          created_at: string
          id: string
          is_read: boolean
          related_job_id: string | null
          related_task_id: string | null
          sent_at: string
          title_en: string
          title_es: string
          title_ru: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          body_en: string
          body_es: string
          body_ru: string
          created_at?: string
          id?: string
          is_read?: boolean
          related_job_id?: string | null
          related_task_id?: string | null
          sent_at?: string
          title_en: string
          title_es: string
          title_ru: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          body_en?: string
          body_es?: string
          body_ru?: string
          created_at?: string
          id?: string
          is_read?: boolean
          related_job_id?: string | null
          related_task_id?: string | null
          sent_at?: string
          title_en?: string
          title_es?: string
          title_ru?: string
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_job_id_fkey"
            columns: ["related_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_name: string
          created_at: string
          description: string | null
          estimate_rocket_id: string | null
          id: string
          name: string
          priority_rank: number | null
          qr_code_uuid: string
          scheduled_end: string | null
          scheduled_start: string | null
          status: Database["public"]["Enums"]["project_status"]
          thumbnail_url: string | null
          total_labor_minutes: number
          updated_at: string
          work_order_number: string | null
        }
        Insert: {
          client_name: string
          created_at?: string
          description?: string | null
          estimate_rocket_id?: string | null
          id?: string
          name: string
          priority_rank?: number | null
          qr_code_uuid?: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          thumbnail_url?: string | null
          total_labor_minutes?: number
          updated_at?: string
          work_order_number?: string | null
        }
        Update: {
          client_name?: string
          created_at?: string
          description?: string | null
          estimate_rocket_id?: string | null
          id?: string
          name?: string
          priority_rank?: number | null
          qr_code_uuid?: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          thumbnail_url?: string | null
          total_labor_minutes?: number
          updated_at?: string
          work_order_number?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          actual_minutes: number
          approved_by: string | null
          assigned_user_id: string | null
          created_at: string
          created_by: string
          due_date: string | null
          estimated_hours: number | null
          id: string
          instructions: string | null
          job_id: string
          job_stage_id: string
          name: string
          status: Database["public"]["Enums"]["task_status"]
          updated_at: string
        }
        Insert: {
          actual_minutes?: number
          approved_by?: string | null
          assigned_user_id?: string | null
          created_at?: string
          created_by: string
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          instructions?: string | null
          job_id: string
          job_stage_id: string
          name: string
          status?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
        }
        Update: {
          actual_minutes?: number
          approved_by?: string | null
          assigned_user_id?: string | null
          created_at?: string
          created_by?: string
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          instructions?: string | null
          job_id?: string
          job_stage_id?: string
          name?: string
          status?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_job_stage_id_fkey"
            columns: ["job_stage_id"]
            isOneToOne: false
            referencedRelation: "job_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active_task_id: string | null
          avatar_url: string | null
          created_at: string
          department_id: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          language: Database["public"]["Enums"]["language"]
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          active_task_id?: string | null
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          language?: Database["public"]["Enums"]["language"]
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          active_task_id?: string | null
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          language?: Database["public"]["Enums"]["language"]
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_active_task_id_fkey"
            columns: ["active_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      user_directory: {
        Row: {
          avatar_url: string | null
          department_id: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          role: Database["public"]["Enums"]["user_role"] | null
        }
        Insert: {
          avatar_url?: string | null
          department_id?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Update: {
          avatar_url?: string | null
          department_id?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auth_department_id: { Args: never; Returns: string }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      user_department: { Args: { target: string }; Returns: string }
    }
    Enums: {
      file_type: "photo" | "pdf"
      inspection_decision: "approved" | "rejected"
      job_status: "queued" | "in_production" | "complete" | "cancelled"
      language: "en" | "ru" | "es"
      notification_type:
        | "task_assigned"
        | "task_assigned_dept"
        | "task_approval_request"
        | "task_approved"
        | "task_rejected"
        | "stage_pending_inspection"
        | "stage_approved"
        | "stage_rejected"
        | "job_arrived_in_queue"
        | "task_due_soon"
        | "task_overdue"
        | "material_arrived_all"
        | "project_created"
        | "note_added"
        | "clock_in_long"
      project_status:
        | "estimate"
        | "scheduled"
        | "in_progress"
        | "on_hold"
        | "complete"
        | "delivered"
      stage_status:
        | "upcoming"
        | "queued"
        | "in_progress"
        | "pending_inspection"
        | "approved"
        | "rejected"
      sync_source: "app" | "sheet"
      task_status:
        | "pending_approval"
        | "unstarted"
        | "in_progress"
        | "paused"
        | "completed"
        | "cancelled"
      translation_status: "pending" | "done" | "failed"
      user_role: "admin" | "lead" | "staff"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      file_type: ["photo", "pdf"],
      inspection_decision: ["approved", "rejected"],
      job_status: ["queued", "in_production", "complete", "cancelled"],
      language: ["en", "ru", "es"],
      notification_type: [
        "task_assigned",
        "task_assigned_dept",
        "task_approval_request",
        "task_approved",
        "task_rejected",
        "stage_pending_inspection",
        "stage_approved",
        "stage_rejected",
        "job_arrived_in_queue",
        "task_due_soon",
        "task_overdue",
        "material_arrived_all",
        "project_created",
        "note_added",
        "clock_in_long",
      ],
      project_status: [
        "estimate",
        "scheduled",
        "in_progress",
        "on_hold",
        "complete",
        "delivered",
      ],
      stage_status: [
        "upcoming",
        "queued",
        "in_progress",
        "pending_inspection",
        "approved",
        "rejected",
      ],
      sync_source: ["app", "sheet"],
      task_status: [
        "pending_approval",
        "unstarted",
        "in_progress",
        "paused",
        "completed",
        "cancelled",
      ],
      translation_status: ["pending", "done", "failed"],
      user_role: ["admin", "lead", "staff"],
    },
  },
} as const
