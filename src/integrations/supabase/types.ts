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
  public: {
    Tables: {
      contractors: {
        Row: {
          company_name: string
          contact_number: string | null
          contact_person: string | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          contractor_code: string | null
          created_at: string
          id: string
          license_number: string | null
          nature_of_work: string | null
          phone: string | null
          updated_at: string
          work_place: string | null
        }
        Insert: {
          company_name: string
          contact_number?: string | null
          contact_person?: string | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          contractor_code?: string | null
          created_at?: string
          id?: string
          license_number?: string | null
          nature_of_work?: string | null
          phone?: string | null
          updated_at?: string
          work_place?: string | null
        }
        Update: {
          company_name?: string
          contact_number?: string | null
          contact_person?: string | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          contractor_code?: string | null
          created_at?: string
          id?: string
          license_number?: string | null
          nature_of_work?: string | null
          phone?: string | null
          updated_at?: string
          work_place?: string | null
        }
        Relationships: []
      }
      custom_roles: {
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
      daily_manpower: {
        Row: {
          category_id: string
          contractor_id: string
          created_at: string
          created_by: string | null
          deficiency_manpower: number
          department_id: string
          entry_date: string
          headcount: number
          id: string
          l1_action_at: string | null
          l1_approver_id: string | null
          l1_remarks: string | null
          l2_action_at: string | null
          l2_approver_id: string | null
          l2_remarks: string | null
          ot_hours: number | null
          project_id: string
          rejected_by_level: number | null
          rejection_remarks: string | null
          remarks: string | null
          security_count: number
          sheet_id: string | null
          sheet_type: string
          status: Database["public"]["Enums"]["approval_status"]
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
          weather_condition: string | null
        }
        Insert: {
          category_id: string
          contractor_id: string
          created_at?: string
          created_by?: string | null
          deficiency_manpower?: number
          department_id: string
          entry_date: string
          headcount?: number
          id?: string
          l1_action_at?: string | null
          l1_approver_id?: string | null
          l1_remarks?: string | null
          l2_action_at?: string | null
          l2_approver_id?: string | null
          l2_remarks?: string | null
          ot_hours?: number | null
          project_id: string
          rejected_by_level?: number | null
          rejection_remarks?: string | null
          remarks?: string | null
          security_count?: number
          sheet_id?: string | null
          sheet_type?: string
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          weather_condition?: string | null
        }
        Update: {
          category_id?: string
          contractor_id?: string
          created_at?: string
          created_by?: string | null
          deficiency_manpower?: number
          department_id?: string
          entry_date?: string
          headcount?: number
          id?: string
          l1_action_at?: string | null
          l1_approver_id?: string | null
          l1_remarks?: string | null
          l2_action_at?: string | null
          l2_approver_id?: string | null
          l2_remarks?: string | null
          ot_hours?: number | null
          project_id?: string
          rejected_by_level?: number | null
          rejection_remarks?: string | null
          remarks?: string | null
          security_count?: number
          sheet_id?: string | null
          sheet_type?: string
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          weather_condition?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_manpower_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "worker_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_manpower_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_manpower_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_manpower_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_manpower_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "daily_manpower_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_manpower_sheets: {
        Row: {
          created_at: string
          current_level: number
          entry_date: string
          id: string
          project_id: string
          rejection_remarks: string | null
          sheet_code: string
          sheet_type: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          total_levels: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_level?: number
          entry_date: string
          id?: string
          project_id: string
          rejection_remarks?: string | null
          sheet_code?: string
          sheet_type?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          total_levels?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_level?: number
          entry_date?: string
          id?: string
          project_id?: string
          rejection_remarks?: string | null
          sheet_code?: string
          sheet_type?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          total_levels?: number
          updated_at?: string
        }
        Relationships: []
      }
      department_categories: {
        Row: {
          category_id: string
          created_at: string
          department_id: string
          id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          department_id: string
          id?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          department_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "worker_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_categories_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          department_code: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_code?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_code?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_config: {
        Row: {
          app_password: string
          cc_recipients: string[]
          enabled: boolean
          encryption: string
          from_email: string
          from_name: string
          id: string
          smtp_host: string
          smtp_port: number
          updated_at: string
          updated_by: string | null
          username: string
        }
        Insert: {
          app_password?: string
          cc_recipients?: string[]
          enabled?: boolean
          encryption?: string
          from_email?: string
          from_name?: string
          id?: string
          smtp_host?: string
          smtp_port?: number
          updated_at?: string
          updated_by?: string | null
          username?: string
        }
        Update: {
          app_password?: string
          cc_recipients?: string[]
          enabled?: boolean
          encryption?: string
          from_email?: string
          from_name?: string
          id?: string
          smtp_host?: string
          smtp_port?: number
          updated_at?: string
          updated_by?: string | null
          username?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          login_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          login_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          login_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_approval_config: {
        Row: {
          approval_enabled: boolean
          created_at: string
          id: string
          l1_user_id: string | null
          l2_user_id: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          approval_enabled?: boolean
          created_at?: string
          id?: string
          l1_user_id?: string | null
          l2_user_id?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          approval_enabled?: boolean
          created_at?: string
          id?: string
          l1_user_id?: string | null
          l2_user_id?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_approval_levels: {
        Row: {
          approver_user_id: string
          created_at: string
          id: string
          label: string | null
          level_no: number
          project_id: string
          updated_at: string
        }
        Insert: {
          approver_user_id: string
          created_at?: string
          id?: string
          label?: string | null
          level_no: number
          project_id: string
          updated_at?: string
        }
        Update: {
          approver_user_id?: string
          created_at?: string
          id?: string
          label?: string | null
          level_no?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_approval_levels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          project_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          project_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          project_id?: string
        }
        Relationships: []
      }
      project_contractors: {
        Row: {
          contractor_id: string
          created_at: string
          id: string
          project_id: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          id?: string
          project_id: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_contractors_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contractors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          project_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          project_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          code: string | null
          created_at: string
          division: string | null
          id: string
          location: string | null
          name: string
          project_group: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          division?: string | null
          id?: string
          location?: string | null
          name: string
          project_group?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          division?: string | null
          id?: string
          location?: string | null
          name?: string
          project_group?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_screen_permissions: {
        Row: {
          created_at: string
          id: string
          permission: Database["public"]["Enums"]["permission_level"]
          role_id: string
          screen_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission?: Database["public"]["Enums"]["permission_level"]
          role_id: string
          screen_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: Database["public"]["Enums"]["permission_level"]
          role_id?: string
          screen_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_screen_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_approval_history: {
        Row: {
          action: string
          action_at: string
          approver_user_id: string
          id: string
          level_no: number
          remarks: string | null
          sheet_id: string
        }
        Insert: {
          action: string
          action_at?: string
          approver_user_id: string
          id?: string
          level_no: number
          remarks?: string | null
          sheet_id: string
        }
        Update: {
          action?: string
          action_at?: string
          approver_user_id?: string
          id?: string
          level_no?: number
          remarks?: string | null
          sheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheet_approval_history_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "daily_manpower_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_custom_roles: {
        Row: {
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_projects: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      worker_attendance: {
        Row: {
          category_id: string | null
          check_in: string | null
          check_out: string | null
          contractor_id: string
          created_at: string
          created_by: string | null
          department_id: string | null
          entry_date: string
          id: string
          project_id: string
          remarks: string | null
          worker_name: string
        }
        Insert: {
          category_id?: string | null
          check_in?: string | null
          check_out?: string | null
          contractor_id: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          entry_date: string
          id?: string
          project_id: string
          remarks?: string | null
          worker_name: string
        }
        Update: {
          category_id?: string | null
          check_in?: string | null
          check_out?: string | null
          contractor_id?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          entry_date?: string
          id?: string
          project_id?: string
          remarks?: string | null
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_attendance_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "worker_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_attendance_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_attendance_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_attendance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_categories: {
        Row: {
          category_code: string | null
          category_group: string | null
          created_at: string
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category_code?: string | null
          category_group?: string | null
          created_at?: string
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category_code?: string | null
          category_group?: string | null
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      email_config_public: {
        Row: {
          cc_recipients: string[] | null
          enabled: boolean | null
          encryption: string | null
          from_email: string | null
          from_name: string | null
          has_password: boolean | null
          id: string | null
          smtp_host: string | null
          smtp_port: number | null
          updated_at: string | null
          updated_by: string | null
          username: string | null
        }
        Insert: {
          cc_recipients?: string[] | null
          enabled?: boolean | null
          encryption?: string | null
          from_email?: string | null
          from_name?: string | null
          has_password?: never
          id?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          updated_at?: string | null
          updated_by?: string | null
          username?: string | null
        }
        Update: {
          cc_recipients?: string[] | null
          enabled?: boolean | null
          encryption?: string | null
          from_email?: string | null
          from_name?: string | null
          has_password?: never
          id?: string | null
          smtp_host?: string | null
          smtp_port?: number | null
          updated_at?: string | null
          updated_by?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_sheet: {
        Args: { _remarks?: string; _sheet_id: string }
        Returns: {
          created_at: string
          current_level: number
          entry_date: string
          id: string
          project_id: string
          rejection_remarks: string | null
          sheet_code: string
          sheet_type: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          total_levels: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "daily_manpower_sheets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_email_for_login_id: { Args: { _login_id: string }; Returns: string }
      get_globally_assigned_contractor_ids: { Args: never; Returns: string[] }
      get_screen_permission: {
        Args: { _screen_key: string; _user_id: string }
        Returns: Database["public"]["Enums"]["permission_level"]
      }
      get_user_display_info: {
        Args: { _user_ids: string[] }
        Returns: {
          display_name: string
          login_id: string
          user_id: string
        }[]
      }
      has_project_access: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_screen_edit: {
        Args: { _screen_key: string; _user_id: string }
        Returns: boolean
      }
      is_current_sheet_approver: {
        Args: { _sheet_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_l1: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_l2: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_level_approver: {
        Args: { _level: number; _project_id: string; _user_id: string }
        Returns: boolean
      }
      list_assignable_projects: {
        Args: never
        Returns: {
          code: string
          id: string
          name: string
        }[]
      }
      reject_sheet: {
        Args: { _remarks: string; _sheet_id: string }
        Returns: {
          created_at: string
          current_level: number
          entry_date: string
          id: string
          project_id: string
          rejection_remarks: string | null
          sheet_code: string
          sheet_type: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          total_levels: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "daily_manpower_sheets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_sheet: {
        Args: { _sheet_id: string }
        Returns: {
          created_at: string
          current_level: number
          entry_date: string
          id: string
          project_id: string
          rejection_remarks: string | null
          sheet_code: string
          sheet_type: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          total_levels: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "daily_manpower_sheets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "supervisor"
        | "manager"
        | "project_coordinator"
        | "project_manager"
      approval_status:
        | "draft"
        | "pending_l1"
        | "pending_l2"
        | "approved"
        | "rejected"
      contract_type: "item_rate" | "nmr"
      permission_level: "none" | "view" | "edit"
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
      app_role: [
        "admin",
        "supervisor",
        "manager",
        "project_coordinator",
        "project_manager",
      ],
      approval_status: [
        "draft",
        "pending_l1",
        "pending_l2",
        "approved",
        "rejected",
      ],
      contract_type: ["item_rate", "nmr"],
      permission_level: ["none", "view", "edit"],
    },
  },
} as const
