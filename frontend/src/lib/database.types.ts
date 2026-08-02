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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bill_payments: {
        Row: {
          amount: number | null
          bill_id: string
          created_at: string
          id: string
          period_month: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          bill_id: string
          created_at?: string
          id?: string
          period_month: string
          user_id: string
        }
        Update: {
          amount?: number | null
          bill_id?: string
          created_at?: string
          id?: string
          period_month?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "finance_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          author: string
          cover_image: string | null
          created_at: string
          date_finished: string | null
          date_started: string | null
          genre: string | null
          id: string
          notes: string | null
          rating: number | null
          status: Database["public"]["Enums"]["book_status"]
          title: string
          user_id: string
        }
        Insert: {
          author: string
          cover_image?: string | null
          created_at?: string
          date_finished?: string | null
          date_started?: string | null
          genre?: string | null
          id?: string
          notes?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["book_status"]
          title: string
          user_id: string
        }
        Update: {
          author?: string
          cover_image?: string | null
          created_at?: string
          date_finished?: string | null
          date_started?: string | null
          genre?: string | null
          id?: string
          notes?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["book_status"]
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_goals: {
        Row: {
          completed: boolean
          created_at: string
          current_value: number
          id: string
          metric: string
          period: Database["public"]["Enums"]["goal_period"]
          points_reward: number
          target_value: number
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          current_value?: number
          id?: string
          metric: string
          period: Database["public"]["Enums"]["goal_period"]
          points_reward: number
          target_value: number
          title: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          current_value?: number
          id?: string
          metric?: string
          period?: Database["public"]["Enums"]["goal_period"]
          points_reward?: number
          target_value?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          duration_minutes: number
          exercise_date: string
          id: string
          intensity: Database["public"]["Enums"]["intensity_level"] | null
          notes: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes: number
          exercise_date: string
          id?: string
          intensity?: Database["public"]["Enums"]["intensity_level"] | null
          notes?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          exercise_date?: string
          id?: string
          intensity?: Database["public"]["Enums"]["intensity_level"] | null
          notes?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_bills: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          due_date: string
          frequency: string
          id: string
          name: string
          notes: string | null
          paid: boolean
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          due_date: string
          frequency: string
          id?: string
          name: string
          notes?: string | null
          paid?: boolean
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          due_date?: string
          frequency?: string
          id?: string
          name?: string
          notes?: string | null
          paid?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_bills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_investments: {
        Row: {
          amount: number
          asset: string
          created_at: string
          id: string
          investment_date: string
          notes: string | null
          platform: string
          user_id: string
        }
        Insert: {
          amount: number
          asset: string
          created_at?: string
          id?: string
          investment_date: string
          notes?: string | null
          platform: string
          user_id: string
        }
        Update: {
          amount?: number
          asset?: string
          created_at?: string
          id?: string
          investment_date?: string
          notes?: string | null
          platform?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_investments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_savings: {
        Row: {
          created_at: string
          current_amount: number
          id: string
          name: string
          notes: string | null
          target_amount: number
          target_date: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          current_amount?: number
          id?: string
          name: string
          notes?: string | null
          target_amount: number
          target_date?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          current_amount?: number
          id?: string
          name?: string
          notes?: string | null
          target_amount?: number
          target_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_savings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_completions: {
        Row: {
          created_at: string
          goal_id: string
          id: string
          period_start: string
          points_awarded: number
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_id: string
          id?: string
          period_start: string
          points_awarded?: number
          user_id: string
        }
        Update: {
          created_at?: string
          goal_id?: string
          id?: string
          period_start?: string
          points_awarded?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_completions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          category: string | null
          completed: boolean
          created_at: string
          description: string | null
          id: string
          period: Database["public"]["Enums"]["goal_period"]
          points: number
          target_date: string
          title: string
          user_id: string
        }
        Insert: {
          category?: string | null
          completed?: boolean
          created_at?: string
          description?: string | null
          id?: string
          period: Database["public"]["Enums"]["goal_period"]
          points: number
          target_date: string
          title: string
          user_id: string
        }
        Update: {
          category?: string | null
          completed?: boolean
          created_at?: string
          description?: string | null
          id?: string
          period?: Database["public"]["Enums"]["goal_period"]
          points?: number
          target_date?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_completions: {
        Row: {
          created_at: string
          habit_id: string
          id: string
          local_date: string
          points_awarded: number
          user_id: string
        }
        Insert: {
          created_at?: string
          habit_id: string
          id?: string
          local_date: string
          points_awarded?: number
          user_id: string
        }
        Update: {
          created_at?: string
          habit_id?: string
          id?: string
          local_date?: string
          points_awarded?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_completions_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_freezes: {
        Row: {
          created_at: string
          habit_id: string
          id: string
          local_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          habit_id: string
          id?: string
          local_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          habit_id?: string
          id?: string
          local_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_freezes_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_freezes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          archived: boolean
          category: string | null
          color: string | null
          created_at: string
          freeze_budget: number
          icon: string | null
          id: string
          points: number
          schedule_interval_days: number | null
          schedule_kind: Database["public"]["Enums"]["habit_schedule_kind"]
          schedule_times_per_week: number | null
          schedule_weekdays: number[] | null
          start_date: string
          title: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          category?: string | null
          color?: string | null
          created_at?: string
          freeze_budget?: number
          icon?: string | null
          id?: string
          points?: number
          schedule_interval_days?: number | null
          schedule_kind?: Database["public"]["Enums"]["habit_schedule_kind"]
          schedule_times_per_week?: number | null
          schedule_weekdays?: number[] | null
          start_date?: string
          title: string
          user_id: string
        }
        Update: {
          archived?: boolean
          category?: string | null
          color?: string | null
          created_at?: string
          freeze_budget?: number
          icon?: string | null
          id?: string
          points?: number
          schedule_interval_days?: number | null
          schedule_kind?: Database["public"]["Enums"]["habit_schedule_kind"]
          schedule_times_per_week?: number | null
          schedule_weekdays?: number[] | null
          start_date?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      list_items: {
        Row: {
          checked: boolean
          created_at: string
          id: string
          list_id: string
          text: string
          user_id: string
        }
        Insert: {
          checked?: boolean
          created_at?: string
          id?: string
          list_id: string
          text: string
          user_id: string
        }
        Update: {
          checked?: boolean
          created_at?: string
          id?: string
          list_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "user_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      points_history: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["points_entry_kind"]
          monetary_value: number
          points: number
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["points_entry_kind"]
          monetary_value: number
          points: number
          source: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["points_entry_kind"]
          monetary_value?: number
          points?: number
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          conversion_rate: number
          created_at: string
          currency_symbol: string
          display_name: string | null
          email: string
          id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          conversion_rate?: number
          created_at?: string
          currency_symbol?: string
          display_name?: string | null
          email: string
          id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          conversion_rate?: number
          created_at?: string
          currency_symbol?: string
          display_name?: string | null
          email?: string
          id?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          created_at: string
          id: string
          local_date: string
          points_awarded: number
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          local_date: string
          points_awarded?: number
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          local_date?: string
          points_awarded?: number
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          category: string | null
          completed: boolean
          created_at: string
          due_date: string | null
          id: string
          inbox: boolean
          points: number
          title: string
          user_id: string
        }
        Insert: {
          category?: string | null
          completed?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          inbox?: boolean
          points?: number
          title: string
          user_id: string
        }
        Update: {
          category?: string | null
          completed?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          inbox?: boolean
          points?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lists: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      points_summary: {
        Args: never
        Returns: {
          entry_count: number
          lifetime_money: number
          lifetime_points: number
          unspent_money: number
          unspent_points: number
        }[]
      }
    }
    Enums: {
      book_status: "want_to_read" | "reading" | "finished"
      goal_period: "weekly" | "monthly"
      habit_schedule_kind:
        | "daily"
        | "weekdays"
        | "times_per_week"
        | "every_n_days"
      intensity_level: "Light" | "Moderate" | "Intense"
      points_entry_kind: "earn" | "reversal" | "redemption"
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
      book_status: ["want_to_read", "reading", "finished"],
      goal_period: ["weekly", "monthly"],
      habit_schedule_kind: [
        "daily",
        "weekdays",
        "times_per_week",
        "every_n_days",
      ],
      intensity_level: ["Light", "Moderate", "Intense"],
      points_entry_kind: ["earn", "reversal", "redemption"],
    },
  },
} as const
