import { Database } from "@/integrations/supabase/types";

// Type Aliases - Single Source of Truth
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Client = Database['public']['Tables']['clients']['Row'];
export type Lead = Database['public']['Tables']['leads']['Row'];
export type Appointment = Database['public']['Tables']['appointments']['Row'];
export type SmsTemplate = Database['public']['Tables']['sms_templates']['Row'];
export type SmsLog = Database['public']['Tables']['sms_logs']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type UserRole = Database['public']['Tables']['user_roles']['Row'];

// Enums
export type AppRole = Database['public']['Enums']['app_role'];
export type ApprovalStatus = Database['public']['Enums']['approval_status'];
export type LeadStatus = Database['public']['Enums']['lead_status'];
export type AppointmentStatus = Database['public']['Enums']['appointment_status'];
export type SmsStatus = Database['public']['Enums']['sms_status'];

// Extended Types (Frontend specific)
export interface UserWithRole extends Profile {
  roles: AppRole[];
  client?: Client | null;
}