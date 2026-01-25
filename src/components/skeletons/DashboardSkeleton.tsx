
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "../layout/AppSidebar";
import { AppHeader } from "../layout/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
    return (
        <SidebarProvider>
            <div className="min-h-screen flex w-full bg-background" dir="rtl">
                {/* We can't reuse AppSidebar exactly because it might have data dependencies, 
            but for now we assume it's safe or we could mock it. 
            To be safe and reduce flicker, we'll just show the structure. */}
                <AppSidebar />

                <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
                    <AppHeader />

                    <main className="flex-1 p-6 lg:p-8 overflow-auto max-w-7xl mx-auto w-full">
                        <div className="space-y-6">
                            {/* Header Skeleton */}
                            <div className="flex justify-between items-center">
                                <div className="space-y-2">
                                    <Skeleton className="h-8 w-48" />
                                    <Skeleton className="h-4 w-64" />
                                </div>
                                <Skeleton className="h-10 w-32" />
                            </div>

                            {/* Stats/Cards Skeleton */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Skeleton className="h-32 w-full rounded-xl" />
                                <Skeleton className="h-32 w-full rounded-xl" />
                                <Skeleton className="h-32 w-full rounded-xl" />
                            </div>

                            {/* Main Content Skeleton */}
                            <Skeleton className="h-[400px] w-full rounded-xl" />
                        </div>
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
}
