import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createIndexedDBPersister } from '@/lib/queryPersistence';
import { QueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";
import { CommandMenu } from "@/components/CommandMenu";

// Eager load - Auth page (first thing users see)
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy load - All other pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const Leads = lazy(() => import("./pages/Leads"));
const Appointments = lazy(() => import("./pages/Appointments"));
const SMS = lazy(() => import("./pages/SMS"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Users = lazy(() => import("./pages/Users"));
const Clients = lazy(() => import("./pages/Clients"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminPermissions = lazy(() => import("./pages/AdminPermissions"));
const WebhookSettings = lazy(() => import("./pages/WebhookSettings"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const Library = lazy(() => import("./pages/Library"));
const SetterStats = lazy(() => import("./pages/SetterStats"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10, // 10 minutes (keep it sticky)
      gcTime: 1000 * 60 * 60 * 24, // 24 hours (survive longer in memory)
      refetchOnWindowFocus: false, // Don't reload when user comes back to tab
      refetchOnMount: false, // Use cache if available on mount
      retry: 1,
    },
  },
});

const persister = createIndexedDBPersister();

function App() {
  return (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister }}
      >
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <CommandMenu />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public route */}
                  <Route path="/" element={<Auth />} />
                  <Route path="/auth" element={<Auth />} />

                  {/* Onboarding route */}
                  <Route path="/onboarding" element={
                    <ProtectedRoute>
                      <Onboarding />
                    </ProtectedRoute>
                  } />

                  {/* Pending Approval route */}
                  <Route path="/pending-approval" element={
                    <ProtectedRoute>
                      <PendingApproval />
                    </ProtectedRoute>
                  } />

                  {/* Protected routes - require authentication */}
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } />

                  <Route path="/leads" element={
                    <ProtectedRoute>
                      <Leads />
                    </ProtectedRoute>
                  } />

                  <Route path="/appointments" element={
                    <ProtectedRoute>
                      <Appointments />
                    </ProtectedRoute>
                  } />

                  <Route path="/sms" element={
                    <ProtectedRoute>
                      <SMS />
                    </ProtectedRoute>
                  } />

                  <Route path="/notifications" element={
                    <ProtectedRoute>
                      <Notifications />
                    </ProtectedRoute>
                  } />

                  <Route path="/settings" element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  } />

                  <Route path="/webhook-settings" element={
                    <ProtectedRoute>
                      <WebhookSettings />
                    </ProtectedRoute>
                  } />

                  <Route path="/library" element={
                    <ProtectedRoute>
                      <Library />
                    </ProtectedRoute>
                  } />

                  {/* Super Admin routes */}
                  <Route path="/super-admin" element={
                    <ProtectedRoute requireSuperAdmin>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  } />

                  <Route path="/users" element={
                    <ProtectedRoute requireSuperAdmin>
                      <Users />
                    </ProtectedRoute>
                  } />

                  <Route path="/admin-permissions" element={
                    <ProtectedRoute requireSuperAdmin>
                      <AdminPermissions />
                    </ProtectedRoute>
                  } />

                  <Route path="/setter-stats" element={
                    <ProtectedRoute requireSuperAdmin>
                      <SetterStats />
                    </ProtectedRoute>
                  } />


                  {/* Admin routes */}
                  <Route path="/clients" element={
                    <ProtectedRoute requireAdmin>
                      <Clients />
                    </ProtectedRoute>
                  } />

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
