export type AppRole = 'super_admin' | 'admin' | 'client';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export type SmsStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  approval_status: ApprovalStatus;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  company_name: string;
  industry: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface Lead {
  id: string;
  client_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  source: string | null;
  notes: string | null;
  worktype: string | null;
  stage: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
}

export interface Appointment {
  id: string;
  lead_id: string;
  client_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
  lead?: Lead;
  client?: Client;
}

export interface SmsTemplate {
  id: string;
  name: string;
  content: string;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SmsLog {
  id: string;
  lead_id: string;
  template_id: string | null;
  phone_number: string;
  message: string;
  status: SmsStatus;
  sent_at: string | null;
  sent_by: string;
  created_at: string;
  lead?: Lead;
  template?: SmsTemplate;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface UserWithRole extends Profile {
  roles: AppRole[];
  client?: Client;
}