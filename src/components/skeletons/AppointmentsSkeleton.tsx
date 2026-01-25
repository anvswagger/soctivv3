import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Skeleton loader for the Appointments page.
 * Mimics the calendar + list layout to prevent layout shift.
 */
export function AppointmentsSkeleton() {
    return (
        <div className="grid md:grid-cols-2 gap-6">
            {/* Calendar Skeleton */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-24" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[300px] w-full rounded-md" />
                </CardContent>
            </Card>

            {/* Appointments List Skeleton */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="p-4 border rounded-lg space-y-2">
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <Skeleton className="h-5 w-32" />
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                                <Skeleton className="h-6 w-16 rounded-full" />
                            </div>
                            <div className="flex gap-2 mt-2">
                                <Skeleton className="h-8 w-16" />
                                <Skeleton className="h-8 w-16" />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

/**
 * Skeleton for the table view of appointments.
 */
export function AppointmentsTableSkeleton() {
    return (
        <div className="space-y-3 p-6">
            {/* Header */}
            <div className="flex gap-4 border-b pb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
            </div>
            {/* Rows */}
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-4 py-3 border-b">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <div className="flex gap-2">
                        <Skeleton className="h-8 w-8 rounded" />
                        <Skeleton className="h-8 w-8 rounded" />
                    </div>
                </div>
            ))}
        </div>
    );
}
