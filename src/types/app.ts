import { Lead, Client, Appointment } from './database';

export type LeadWithRelations = Omit<Lead, 'client'> & {
    client?: { id: string; company_name: string } | null;
};

export type AppointmentWithRelations = Omit<Appointment, 'lead' | 'client'> & {
    lead?: {
        first_name: string;
        last_name: string;
        phone: string | null;
        email: string | null;
        source: string | null;
        client_id: string | null;
    } | null;
    client?: { company_name: string } | null;
};
