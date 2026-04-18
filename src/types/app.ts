import { Lead, Client, Appointment } from './database';

export type LeadWithRelations = Omit<Lead, 'client'> & {
    client?: { id: string; company_name: string } | null;
    product?: { name: string } | null;
};

export type AppointmentWithRelations = Omit<Appointment, 'lead' | 'client'> & {
    lead?: {
        id: string;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
        email: string | null;
        status: string;
        source: string | null;
        notes: string | null;
        created_at: string;
        client_id: string | null;
    } | null;
    client?: { company_name: string } | null;
};

export interface PaginatedResponse<T> {
    data: T[];
    count: number;
}

export interface LeadsFilter {
    search?: string;
    clientId?: string | string[];
    startDate?: string;
    endDate?: string;
    status?: string | null;
}
