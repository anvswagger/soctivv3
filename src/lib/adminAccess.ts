export type AdminAccessKey =
  | 'leads'
  | 'appointments'
  | 'library'
  | 'clients'
  | 'settings'
  | 'sms'
  | 'notifications';

export type AdminAccessPermissions = Record<AdminAccessKey, boolean>;

export interface AdminAccessRow {
  user_id: string;
  can_leads: boolean;
  can_appointments: boolean;
  can_library: boolean;
  can_clients: boolean;
  can_settings: boolean;
  can_sms: boolean;
  can_notifications: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export const ADMIN_ACCESS_KEYS: AdminAccessKey[] = [
  'leads',
  'appointments',
  'library',
  'clients',
  'settings',
  'sms',
  'notifications',
];

export const ADMIN_ACCESS_LABELS: Record<AdminAccessKey, string> = {
  leads: 'Leads',
  appointments: 'Appointments',
  library: 'Library',
  clients: 'Clients',
  settings: 'Settings',
  sms: 'SMS',
  notifications: 'Notifications',
};

export const DEFAULT_ADMIN_ACCESS_PERMISSIONS: AdminAccessPermissions = {
  leads: true,
  appointments: true,
  library: true,
  clients: true,
  settings: true,
  sms: true,
  notifications: true,
};

export function rowToAdminAccessPermissions(row?: Partial<AdminAccessRow> | null): AdminAccessPermissions {
  if (!row) return { ...DEFAULT_ADMIN_ACCESS_PERMISSIONS };

  return {
    leads: row.can_leads ?? true,
    appointments: row.can_appointments ?? true,
    library: row.can_library ?? true,
    clients: row.can_clients ?? true,
    settings: row.can_settings ?? true,
    sms: row.can_sms ?? true,
    notifications: row.can_notifications ?? true,
  };
}

export function adminAccessPermissionsToRow(permissions: AdminAccessPermissions) {
  return {
    can_leads: permissions.leads,
    can_appointments: permissions.appointments,
    can_library: permissions.library,
    can_clients: permissions.clients,
    can_settings: permissions.settings,
    can_sms: permissions.sms,
    can_notifications: permissions.notifications,
  };
}
