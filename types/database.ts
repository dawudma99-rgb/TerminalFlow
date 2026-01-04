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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          id: string
          organization_id: string
          container_id: string
          list_id: string | null
          event_type: string
          severity: string
          title: string
          message: string | null
          metadata: Json | null
          created_by_user_id: string | null
          created_at: string
          seen_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          container_id: string
          list_id?: string | null
          event_type: string
          severity?: string
          title: string
          message?: string | null
          metadata?: Json | null
          created_by_user_id?: string | null
          created_at?: string
          seen_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          container_id?: string
          list_id?: string | null
          event_type?: string
          severity?: string
          title?: string
          message?: string | null
          metadata?: Json | null
          created_by_user_id?: string | null
          created_at?: string
          seen_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "container_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_defaults: {
        Row: {
          carrier_name: string
          defaults: Json
          id: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          carrier_name: string
          defaults: Json
          id?: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          carrier_name?: string
          defaults?: Json
          id?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carrier_defaults_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      container_audit: {
        Row: {
          action: string
          container_id: string
          deleted_at: string
          id: string
          organization_id: string | null
          payload: Json
          user_id: string | null
        }
        Insert: {
          action?: string
          container_id: string
          deleted_at?: string
          id?: string
          organization_id?: string | null
          payload: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          container_id?: string
          deleted_at?: string
          id?: string
          organization_id?: string | null
          payload?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      container_history: {
        Row: {
          action: string | null
          changed_by: string | null
          container_id: string
          created_at: string
          details: Json | null
          event_type: string | null
          id: string
          list_id: string | null
          organization_id: string | null
          payload: Json | null
          summary: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          changed_by?: string | null
          container_id: string
          created_at?: string
          details?: Json | null
          event_type?: string | null
          id?: string
          list_id?: string | null
          organization_id?: string | null
          payload?: Json | null
          summary?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          changed_by?: string | null
          container_id?: string
          created_at?: string
          details?: Json | null
          event_type?: string | null
          id?: string
          list_id?: string | null
          organization_id?: string | null
          payload?: Json | null
          summary?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "container_history_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
        ]
      }
      container_lists: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: []
      }
      containers: {
        Row: {
          actual_fee_paid: number
          arrival_date: string
          assigned_to: string | null
          bl_number: string | null
          carrier: string | null
          container_no: string
          container_size: string | null
          created_at: string
          deleted_at: string | null
          demurrage_fee_if_late: number
          demurrage_tiers: Json | null
          detention_fee_rate: number
          detention_free_days: number
          detention_tiers: Json | null
          empty_return_date: string | null
          free_days: number
          gate_out_date: string | null
          has_detention: boolean
          id: string
          is_closed: boolean
          weekend_chargeable: boolean
          last_free_day: string | null
          lfd_date: string | null
          list_id: string | null
          milestone: string | null
          notes: string | null
          organization_id: string
          pol: string | null
          pod: string
          status: string | null
          updated_at: string
          user_id: string | null
          version: number
        }
        Insert: {
          actual_fee_paid?: number
          arrival_date: string
          assigned_to?: string | null
          bl_number?: string | null
          carrier?: string | null
          container_no: string
          container_size?: string | null
          created_at?: string
          deleted_at?: string | null
          demurrage_fee_if_late?: number
          demurrage_tiers?: Json | null
          detention_fee_rate?: number
          detention_free_days?: number
          detention_tiers?: Json | null
          empty_return_date?: string | null
          free_days?: number
          gate_out_date?: string | null
          has_detention?: boolean
          id?: string
          is_closed?: boolean
          last_free_day?: string | null
          lfd_date?: string | null
          list_id?: string | null
          milestone?: string | null
          notes?: string | null
          organization_id: string
          pol?: string | null
          pod: string
          status?: string | null
          updated_at?: string
          user_id?: string | null
          version?: number
          weekend_chargeable?: boolean
        }
        Update: {
          actual_fee_paid?: number
          arrival_date?: string
          assigned_to?: string | null
          bl_number?: string | null
          carrier?: string | null
          container_no?: string
          container_size?: string | null
          created_at?: string
          deleted_at?: string | null
          demurrage_fee_if_late?: number
          demurrage_tiers?: Json | null
          detention_fee_rate?: number
          detention_free_days?: number
          detention_tiers?: Json | null
          empty_return_date?: string | null
          free_days?: number
          gate_out_date?: string | null
          has_detention?: boolean
          id?: string
          is_closed?: boolean
          last_free_day?: string | null
          lfd_date?: string | null
          list_id?: string | null
          milestone?: string | null
          notes?: string | null
          organization_id?: string
          pol?: string | null
          pod?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
          version?: number
          weekend_chargeable?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "containers_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "container_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "containers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_drafts: {
        Row: {
          id: string
          organization_id: string
          container_id: string
          event_type: string
          status: string
          to_email: string | null
          subject: string
          body_text: string
          metadata: Json | null
          generated_at: string
          sent_at: string | null
          skipped_at: string | null
          created_by_user_id: string | null
          approved_by_user_id: string | null
          last_error: string | null
          sent_to_emails: string[] | null
        }
        Insert: {
          id?: string
          organization_id: string
          container_id: string
          event_type: string
          status?: string
          to_email?: string | null
          subject: string
          body_text: string
          metadata?: Json | null
          generated_at?: string
          sent_at?: string | null
          skipped_at?: string | null
          created_by_user_id?: string | null
          approved_by_user_id?: string | null
          last_error?: string | null
          sent_to_emails?: string[] | null
        }
        Update: {
          id?: string
          organization_id?: string
          container_id?: string
          event_type?: string
          status?: string
          to_email?: string | null
          subject?: string
          body_text?: string
          metadata?: Json | null
          generated_at?: string
          sent_at?: string | null
          skipped_at?: string | null
          created_by_user_id?: string | null
          approved_by_user_id?: string | null
          last_error?: string | null
          sent_to_emails?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          current_list_id: string | null
          email: string | null
          id: string
          organization_id: string
          role: string | null
          settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_list_id?: string | null
          email?: string | null
          id: string
          organization_id: string
          role?: string | null
          settings?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_list_id?: string | null
          email?: string | null
          id?: string
          organization_id?: string
          role?: string | null
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_list_fk"
            columns: ["current_list_id"]
            isOneToOne: false
            referencedRelation: "container_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
