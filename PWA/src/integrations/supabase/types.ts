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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_emails: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          alert_message: string
          alert_type: string
          created_at: string
          device_id: string | null
          id: string
          severity: string
        }
        Insert: {
          alert_message: string
          alert_type: string
          created_at?: string
          device_id?: string | null
          id?: string
          severity?: string
        }
        Update: {
          alert_message?: string
          alert_type?: string
          created_at?: string
          device_id?: string | null
          id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          calibration_mode: boolean
          created_at: string
          device_name: string | null
          id: string
          pending_command: string | null
          system_key: string
          tank_height: number | null
          tank_height_unit: string | null
          user_id: string | null
        }
        Insert: {
          calibration_mode?: boolean
          created_at?: string
          device_name?: string | null
          id?: string
          pending_command?: string | null
          system_key: string
          tank_height?: number | null
          tank_height_unit?: string | null
          user_id?: string | null
        }
        Update: {
          calibration_mode?: boolean
          created_at?: string
          device_name?: string | null
          id?: string
          pending_command?: string | null
          system_key?: string
          tank_height?: number | null
          tank_height_unit?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          anomaly_alerts: boolean | null
          created_at: string
          display_name: string | null
          email: string | null
          high_tds_alerts: boolean | null
          id: string
          low_water_alerts: boolean | null
          pump_status_alerts: boolean | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          anomaly_alerts?: boolean | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          high_tds_alerts?: boolean | null
          id?: string
          low_water_alerts?: boolean | null
          pump_status_alerts?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          anomaly_alerts?: boolean | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          high_tds_alerts?: boolean | null
          id?: string
          low_water_alerts?: boolean | null
          pump_status_alerts?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pump_settings: {
        Row: {
          critical_threshold: number
          device_id: string | null
          id: string
          lower_threshold: number
          pump_mode: string
          pump_status: string
          updated_at: string
          upper_threshold: number
        }
        Insert: {
          critical_threshold?: number
          device_id?: string | null
          id?: string
          lower_threshold?: number
          pump_mode?: string
          pump_status?: string
          updated_at?: string
          upper_threshold?: number
        }
        Update: {
          critical_threshold?: number
          device_id?: string | null
          id?: string
          lower_threshold?: number
          pump_mode?: string
          pump_status?: string
          updated_at?: string
          upper_threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "pump_settings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      sensor_data: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          pump_mode: string
          pump_runtime: number | null
          pump_status: string
          tds_value: number
          water_level: number
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          pump_mode?: string
          pump_runtime?: number | null
          pump_status?: string
          tds_value: number
          water_level: number
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          pump_mode?: string
          pump_runtime?: number | null
          pump_status?: string
          tds_value?: number
          water_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "sensor_data_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      claim_first_admin: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
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
