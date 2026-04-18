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
      admin_access_permissions: {
        Row: {
          can_appointments: boolean
          can_clients: boolean
          can_leads: boolean
          can_library: boolean
          can_notifications: boolean
          can_settings: boolean
          can_sms: boolean
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_appointments?: boolean
          can_clients?: boolean
          can_leads?: boolean
          can_library?: boolean
          can_notifications?: boolean
          can_settings?: boolean
          can_sms?: boolean
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_appointments?: boolean
          can_clients?: boolean
          can_leads?: boolean
          can_library?: boolean
          can_notifications?: boolean
          can_settings?: boolean
          can_sms?: boolean
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_access_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_clients: {
        Row: {
          client_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          client_id: string | null
          created_at: string
          event_name: string | null
          event_type: string
          id: string
          lead_id: string | null
          metadata: Json | null
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          event_name?: string | null
          event_type: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          event_name?: string | null
          event_type?: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_limits: {
        Row: {
          bucket_key: string
          request_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket_key: string
          request_count?: number
          updated_at?: string
          window_start: string
        }
        Update: {
          bucket_key?: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      app_runtime_settings: {
        Row: {
          id: number
          service_role_key: string
          supabase_url: string
          updated_at: string
        }
        Insert: {
          id: number
          service_role_key: string
          supabase_url: string
          updated_at?: string
        }
        Update: {
          id?: number
          service_role_key?: string
          supabase_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      appointment_reminder_cron_runs: {
        Row: {
          details: Json
          id: string
          message: string | null
          outcome: string
          request_id: number | null
          run_at: string
        }
        Insert: {
          details?: Json
          id?: string
          message?: string | null
          outcome: string
          request_id?: number | null
          run_at?: string
        }
        Update: {
          details?: Json
          id?: string
          message?: string | null
          outcome?: string
          request_id?: number | null
          run_at?: string
        }
        Relationships: []
      }
      appointment_reminder_trigger_log: {
        Row: {
          appointment_id: string
          created_at: string
          details: Json | null
          error_message: string | null
          id: string
          status: string
          trigger_type: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          status: string
          trigger_type: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          status?: string
          trigger_type?: string
        }
        Relationships: []
      }
      appointment_reminders: {
        Row: {
          appointment_id: string
          created_at: string
          error_message: string | null
          id: string
          reminder_type: string
          sent_at: string
          sms_log_id: string | null
          status: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          reminder_type: string
          sent_at?: string
          sms_log_id?: string | null
          status?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          reminder_type?: string
          sent_at?: string
          sms_log_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reminders_sms_log_id_fkey"
            columns: ["sms_log_id"]
            isOneToOne: false
            referencedRelation: "sms_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          client_id: string | null
          created_at: string
          duration_minutes: number
          id: string
          lead_id: string
          location: string | null
          notes: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          lead_id: string
          location?: string | null
          notes?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          lead_id?: string
          location?: string | null
          notes?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_events: {
        Row: {
          client_id: string
          created_at: string
          id: string
          rejection_reason: string | null
          request_id: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["approval_status"]
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          rejection_reason?: string | null
          request_id?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status: Database["public"]["Enums"]["approval_status"]
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          rejection_reason?: string | null
          request_id?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_events_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          approved_at: string | null
          attempt: number
          client_id: string
          id: string
          last_reviewed_at: string | null
          rejected_at: string | null
          rejection_reason: string | null
          reviewer_assigned_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          sla_due_at: string
          sla_hours: number
          status: Database["public"]["Enums"]["approval_status"]
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          attempt?: number
          client_id: string
          id?: string
          last_reviewed_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          reviewer_assigned_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          sla_due_at?: string
          sla_hours?: number
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          attempt?: number
          client_id?: string
          id?: string
          last_reviewed_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          reviewer_assigned_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          sla_due_at?: string
          sla_hours?: number
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_rules: {
        Row: {
          calendar_config_id: string | null
          created_at: string | null
          day_of_week: number | null
          end_time: string
          id: string
          is_available: boolean | null
          specific_date: string | null
          start_time: string
        }
        Insert: {
          calendar_config_id?: string | null
          created_at?: string | null
          day_of_week?: number | null
          end_time: string
          id?: string
          is_available?: boolean | null
          specific_date?: string | null
          start_time: string
        }
        Update: {
          calendar_config_id?: string | null
          created_at?: string | null
          day_of_week?: number | null
          end_time?: string
          id?: string
          is_available?: boolean | null
          specific_date?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_calendar_config_id_fkey"
            columns: ["calendar_config_id"]
            isOneToOne: false
            referencedRelation: "calendar_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_slot_locks: {
        Row: {
          calendar_config_id: string | null
          created_at: string | null
          expires_at: string
          id: string
          lock_token: string
          scheduled_at: string
        }
        Insert: {
          calendar_config_id?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          lock_token?: string
          scheduled_at: string
        }
        Update: {
          calendar_config_id?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          lock_token?: string
          scheduled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_slot_locks_calendar_config_id_fkey"
            columns: ["calendar_config_id"]
            isOneToOne: false
            referencedRelation: "calendar_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_types: {
        Row: {
          calendar_config_id: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          name_ar: string
          name_en: string
        }
        Insert: {
          calendar_config_id?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name_ar: string
          name_en: string
        }
        Update: {
          calendar_config_id?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name_ar?: string
          name_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_types_calendar_config_id_fkey"
            columns: ["calendar_config_id"]
            isOneToOne: false
            referencedRelation: "calendar_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_configs: {
        Row: {
          allow_cancellation: boolean | null
          buffer_minutes: number | null
          calendar_title: string | null
          client_id: string | null
          company_name: string | null
          created_at: string | null
          custom_location: string | null
          description: string | null
          embed_enabled: boolean | null
          id: string
          is_public: boolean | null
          logo_url: string | null
          primary_color: string | null
          require_confirmation: boolean | null
          secondary_color: string | null
          share_token: string | null
          show_company_logo: boolean | null
          show_location: boolean | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          allow_cancellation?: boolean | null
          buffer_minutes?: number | null
          calendar_title?: string | null
          client_id?: string | null
          company_name?: string | null
          created_at?: string | null
          custom_location?: string | null
          description?: string | null
          embed_enabled?: boolean | null
          id?: string
          is_public?: boolean | null
          logo_url?: string | null
          primary_color?: string | null
          require_confirmation?: boolean | null
          secondary_color?: string | null
          share_token?: string | null
          show_company_logo?: boolean | null
          show_location?: boolean | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          allow_cancellation?: boolean | null
          buffer_minutes?: number | null
          calendar_title?: string | null
          client_id?: string | null
          company_name?: string | null
          created_at?: string | null
          custom_location?: string | null
          description?: string | null
          embed_enabled?: boolean | null
          id?: string
          is_public?: boolean | null
          logo_url?: string | null
          primary_color?: string | null
          require_confirmation?: boolean | null
          secondary_color?: string | null
          share_token?: string | null
          show_company_logo?: boolean | null
          show_location?: boolean | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_configs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          client_id: string | null
          created_at: string
          duration: number
          id: string
          lead_id: string
          notes: string | null
          status: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          duration?: number
          id?: string
          lead_id: string
          notes?: string | null
          status: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          duration?: number
          id?: string
          lead_id?: string
          notes?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_media: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          file_id: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          source: string
          thumbnail_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          file_id: string
          file_name: string
          file_size?: number | null
          file_type?: string
          file_url: string
          id?: string
          source?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          file_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          source?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_media_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          achievements: string | null
          address: string | null
          company_name: string
          created_at: string
          facebook_url: string | null
          headquarters: string | null
          id: string
          industry: string | null
          min_contract_value: string | null
          notes: string | null
          onboarding_completed: boolean | null
          phone: string | null
          promotional_offer: string | null
          specialty: string | null
          strength: string | null
          updated_at: string
          user_id: string
          webhook_code: string
          website: string | null
          work_area: string | null
        }
        Insert: {
          achievements?: string | null
          address?: string | null
          company_name: string
          created_at?: string
          facebook_url?: string | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          min_contract_value?: string | null
          notes?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          promotional_offer?: string | null
          specialty?: string | null
          strength?: string | null
          updated_at?: string
          user_id: string
          webhook_code?: string
          website?: string | null
          work_area?: string | null
        }
        Update: {
          achievements?: string | null
          address?: string | null
          company_name?: string
          created_at?: string
          facebook_url?: string | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          min_contract_value?: string | null
          notes?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          promotional_offer?: string | null
          specialty?: string | null
          strength?: string | null
          updated_at?: string
          user_id?: string
          webhook_code?: string
          website?: string | null
          work_area?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_dead_letters: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          job_name: string | null
          payload: Json | null
          resolved_at: string | null
          resolved_by: string | null
          source: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_name?: string | null
          payload?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          source: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_name?: string | null
          payload?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_dead_letters_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_runs: {
        Row: {
          details: Json | null
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          job_name: string
          job_type: string
          started_at: string
          status: string
        }
        Insert: {
          details?: Json | null
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          job_type?: string
          started_at?: string
          status: string
        }
        Update: {
          details?: Json | null
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          job_type?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_user_id: string | null
          client_id: string | null
          created_at: string
          email: string | null
          first_contact_at: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          product_id: string | null
          quantity: number
          source: string | null
          stage: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          worktype: string | null
          address: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          client_id?: string | null
          created_at?: string
          email?: string | null
          first_contact_at?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
          product_id?: string | null
          quantity?: number
          source?: string | null
          stage?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          worktype?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          client_id?: string | null
          created_at?: string
          email?: string | null
          first_contact_at?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          product_id?: string | null
          quantity?: number
          source?: string | null
          stage?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          worktype?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      name_translations: {
        Row: {
          arabic_name: string
          created_at: string | null
          english_name: string
        }
        Insert: {
          arabic_name: string
          created_at?: string | null
          english_name: string
        }
        Update: {
          arabic_name?: string
          created_at?: string | null
          english_name?: string
        }
        Relationships: []
      }
      notification_appointment_no_show_markers: {
        Row: {
          appointment_id: string
          client_id: string | null
          created_at: string
          lead_id: string | null
          no_show_at: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          client_id?: string | null
          created_at?: string
          lead_id?: string | null
          no_show_at: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          client_id?: string | null
          created_at?: string
          lead_id?: string | null
          no_show_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_appointment_no_show_markers_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_appointment_no_show_markers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_appointment_no_show_markers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_automation_event_dispatches: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          event_key: string
          event_type: string
          id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          event_key?: string
          event_type: string
          id?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_key?: string
          event_type?: string
          id?: string
        }
        Relationships: []
      }
      notification_automation_rules: {
        Row: {
          client_id_filter: string | null
          created_at: string
          created_by: string | null
          enabled: boolean
          event_type: string
          id: string
          message_template: string
          name: string
          notification_type: string
          only_event_client: boolean
          send_in_app: boolean
          send_push: boolean
          target_roles: Database["public"]["Enums"]["app_role"][]
          timing_anchor: string
          timing_mode: string
          timing_unit: string | null
          timing_value: number | null
          title_template: string
          updated_at: string
          url: string
        }
        Insert: {
          client_id_filter?: string | null
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          event_type: string
          id?: string
          message_template: string
          name: string
          notification_type?: string
          only_event_client?: boolean
          send_in_app?: boolean
          send_push?: boolean
          target_roles?: Database["public"]["Enums"]["app_role"][]
          timing_anchor?: string
          timing_mode?: string
          timing_unit?: string | null
          timing_value?: number | null
          title_template: string
          updated_at?: string
          url?: string
        }
        Update: {
          client_id_filter?: string | null
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          event_type?: string
          id?: string
          message_template?: string
          name?: string
          notification_type?: string
          only_event_client?: boolean
          send_in_app?: boolean
          send_push?: boolean
          target_roles?: Database["public"]["Enums"]["app_role"][]
          timing_anchor?: string
          timing_mode?: string
          timing_unit?: string | null
          timing_value?: number | null
          title_template?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_automation_rules_client_id_filter_fkey"
            columns: ["client_id_filter"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_delivery_metrics: {
        Row: {
          actor_user_id: string | null
          client_id: string | null
          created_at: string
          event_type: string | null
          id: string
          in_app_sent: number
          mode: string
          push_failed: number
          push_sent: number
          push_skipped_reason: string | null
          rule_id: string | null
          source: string | null
          subscriptions_disabled: number
          subscriptions_found: number
          targets: number
        }
        Insert: {
          actor_user_id?: string | null
          client_id?: string | null
          created_at?: string
          event_type?: string | null
          id?: string
          in_app_sent?: number
          mode?: string
          push_failed?: number
          push_sent?: number
          push_skipped_reason?: string | null
          rule_id?: string | null
          source?: string | null
          subscriptions_disabled?: number
          subscriptions_found?: number
          targets?: number
        }
        Update: {
          actor_user_id?: string | null
          client_id?: string | null
          created_at?: string
          event_type?: string | null
          id?: string
          in_app_sent?: number
          mode?: string
          push_failed?: number
          push_sent?: number
          push_skipped_reason?: string | null
          rule_id?: string | null
          source?: string | null
          subscriptions_disabled?: number
          subscriptions_found?: number
          targets?: number
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_metrics_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_delivery_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          name: string
          target_roles: Database["public"]["Enums"]["app_role"][]
          title: string
          type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          name: string
          target_roles?: Database["public"]["Enums"]["app_role"][]
          title: string
          type?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          name?: string
          target_roles?: Database["public"]["Enums"]["app_role"][]
          title?: string
          type?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"] | null
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          approval_status?:
            | Database["public"]["Enums"]["approval_status"]
            | null
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          price: number
          sku: string | null
          code: string | null
          category: string | null
          stock_quantity: number
          image_url: string | null
          is_active: boolean
          client_id: string | null
          return_rate: number | null
          offer: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price?: number
          sku?: string | null
          code?: string | null
          category?: string | null
          stock_quantity?: number
          image_url?: string | null
          is_active?: boolean
          client_id?: string | null
          return_rate?: number | null
          offer?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          price?: number
          sku?: string | null
          code?: string | null
          category?: string | null
          stock_quantity?: number
          image_url?: string | null
          is_active?: boolean
          client_id?: string | null
          return_rate?: number | null
          offer?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
          is_active: boolean
          last_seen_at: string
          p256dh: string
          platform: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          p256dh: string
          platform?: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          p256dh?: string
          platform?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          api_message_id: string | null
          cost: number | null
          created_at: string
          error_message: string | null
          id: string
          lead_id: string | null
          message: string
          phone_number: string
          sent_at: string | null
          sent_by: string
          status: Database["public"]["Enums"]["sms_status"]
          template_id: string | null
        }
        Insert: {
          api_message_id?: string | null
          cost?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          message: string
          phone_number: string
          sent_at?: string | null
          sent_by: string
          status?: Database["public"]["Enums"]["sms_status"]
          template_id?: string | null
        }
        Update: {
          api_message_id?: string | null
          cost?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          message?: string
          phone_number?: string
          sent_at?: string | null
          sent_by?: string
          status?: Database["public"]["Enums"]["sms_status"]
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sms_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_gold_points: {
        Row: {
          earned_at: string
          id: string
          lead_id: string
          points: number
          user_id: string
        }
        Insert: {
          earned_at?: string
          id?: string
          lead_id: string
          points?: number
          user_id: string
        }
        Update: {
          earned_at?: string
          id?: string
          lead_id?: string
          points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_gold_points_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_items: {
        Row: {
          category: string | null
          client_id: string
          content: string
          created_at: string | null
          id: string
          is_favorite: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          client_id: string
          content: string
          created_at?: string | null
          id?: string
          is_favorite?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          client_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_favorite?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vault_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          client_id: string | null
          created_at: string
          error_message: string | null
          id: string
          lead_id: string | null
          payload: Json | null
          provider: string
          status: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          payload?: Json | null
          provider?: string
          status: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          payload?: Json | null
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_has_client_access: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      claim_approval_request: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      cleanup_expired_locks: { Args: never; Returns: undefined }
      consume_rate_limit: {
        Args: {
          p_bucket_key: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      decrement_stock: {
        Args: {
          p_product_id: string
          p_quantity: number
        }
        Returns: boolean
      }
      debug_trigger_reminder_for_appointment: {
        Args: { p_appointment_id: string }
        Returns: Json
      }
      fire_notification_automation_event: {
        Args: { event_name: string; old_payload?: Json; payload: Json }
        Returns: undefined
      }
      get_app_runtime_settings: {
        Args: never
        Returns: {
          service_role_key: string
          supabase_url: string
        }[]
      }
      get_dashboard_stats:
        | { Args: never; Returns: Json }
        | { Args: { is_admin_query: boolean }; Returns: Json }
      get_super_admin_analytics: {
        Args: { end_at?: string; start_at?: string }
        Returns: Json
      }
      get_user_client_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      run_appointment_reminders_cron: { Args: never; Returns: Json }
      run_notification_automation_timers: { Args: never; Returns: number }
      set_approval_status: {
        Args: {
          p_rejection_reason?: string
          p_reviewer_id?: string
          p_reviewer_notes?: string
          p_status: Database["public"]["Enums"]["approval_status"]
          p_user_id: string
        }
        Returns: undefined
      }
      submit_approval_request: {
        Args: { p_client_id?: string; p_user_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "client"
      appointment_status: "scheduled" | "completed" | "cancelled" | "no_show"
      approval_status: "pending" | "approved" | "rejected"
      lead_status:
        | "new"
        | "contacting"
        | "appointment_booked"
        | "interviewed"
        | "no_show"
        | "sold"
        | "cancelled"
      sms_status: "pending" | "sent" | "delivered" | "failed"
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
      app_role: ["super_admin", "admin", "client"],
      appointment_status: ["scheduled", "completed", "cancelled", "no_show"],
      approval_status: ["pending", "approved", "rejected"],
      lead_status: [
        "new",
        "contacting",
        "appointment_booked",
        "interviewed",
        "no_show",
        "sold",
        "cancelled",
      ],
      sms_status: ["pending", "sent", "delivered", "failed"],
    },
  },
} as const
