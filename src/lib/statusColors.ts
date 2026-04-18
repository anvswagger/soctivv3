import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

// Lead statuses to badge variants
export const leadStatusVariant: Record<string, BadgeVariant> = {
  new: 'info',
  contacting: 'warning',
  appointment_booked: 'default',
  interviewed: 'secondary',
  no_show: 'destructive',
  sold: 'success',
  cancelled: 'outline',
};

// Appointment statuses to badge variants
const appointmentStatusVariant: Record<string, BadgeVariant> = {
  pending: 'warning',
  confirmed: 'success',
  completed: 'success',
  cancelled: 'destructive',
  no_show: 'destructive',
  scheduled: 'info',
};

// Lead status to human-readable Arabic label
export const leadStatusLabels: Record<string, string> = {
  new: 'جديد',
  contacting: 'قيد التواصل',
  appointment_booked: 'مؤكد',
  interviewed: 'تمت المقابلة',
  no_show: 'مرتجع',
  sold: 'تم التسليم',
  cancelled: 'ملغي',
};

// Appointment status to human-readable Arabic label
export const appointmentStatusLabels: Record<string, string> = {
  pending: 'في الانتظار',
  confirmed: 'مؤكد',
  completed: 'تم التسليم',
  cancelled: 'راجع',
  no_show: 'راجع',
  scheduled: 'محجوز',
};

// Get badge variant for a lead status
export function getLeadStatusVariant(status: string): BadgeVariant {
  return leadStatusVariant[status.toLowerCase().trim()] || 'secondary';
}

// Get badge variant for an appointment status
export function getAppointmentStatusVariant(status: string): BadgeVariant {
  return appointmentStatusVariant[status.toLowerCase().trim()] || 'secondary';
}

// Get Arabic label for a lead status
export function getLeadStatusLabel(status: string): string {
  return leadStatusLabels[status.toLowerCase().trim()] || status;
}

// Get Arabic label for an appointment status
export function getAppointmentStatusLabel(status: string): string {
  return appointmentStatusLabels[status.toLowerCase().trim()] || status;
}
