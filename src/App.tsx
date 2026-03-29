import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createIndexedDBPersister, DEFAULT_PERSIST_MAX_AGE_MS } from '@/lib/queryPersistence';
import { QueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeConfigProvider } from "@/components/theme-config-provider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { SessionTimeoutHandler } from "@/components/SessionTimeoutHandler";
import { QUERY_POLICY } from '@/lib/queryPolicy';
const CommandMenu = lazy(() =>
  import("./components/CommandMenu").then((module) => ({ default: module.CommandMenu }))
);

// Eager load - Auth page (first thing users see)
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy load - All other pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const Orders = lazy(() => import("./pages/Leads"));
const ConfirmedOrders = lazy(() => import("./pages/Appointments"));
const Products = lazy(() => import("@/pages/Products"));
const Reports = lazy(() => import("@/pages/Reports"));
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
const FocusMode = lazy(() => import("./pages/FocusMode"));
const PublicBooking = lazy(() => import("./pages/PublicBooking"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: QUERY_POLICY.appDefaults,
  },
});

const persister = createIndexedDBPersister();
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev';

function App() {
  return (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, buster: APP_VERSION, maxAge: DEFAULT_PERSIST_MAX_AGE_MS }}
      >
        <ThemeProvider>
          <ThemeConfigProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AuthProvider>
                  <SessionTimeoutHandler>
                    <AnalyticsTracker />
                    <Suspense fallback={null}>
                      <CommandMenu />
                    </Suspense>
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        {/* Public route */}
                        <Route path="/" element={<Auth />} />
                        <Route path="/auth" element={<Auth />} />
                        <Route path="/book/:token" element={<PublicBooking />} />

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

                        <Route path="/orders" element={
                          <ProtectedRoute requireAdminAccess="leads">
                            <Orders />
                          </ProtectedRoute>
                        } />

                        <Route path="/leads" element={
                          <ProtectedRoute requireAdminAccess="leads">
                            <Orders />
                          </ProtectedRoute>
                        } />

                        <Route path="/confirmed-orders" element={
                          <ProtectedRoute requireAdminAccess="appointments">
                            <ConfirmedOrders />
                          </ProtectedRoute>
                        } />

                        <Route path="/appointments" element={
                          <ProtectedRoute requireAdminAccess="appointments">
                            <ConfirmedOrders />
                          </ProtectedRoute>
                        } />

                        <Route path="/products" element={
                          <ProtectedRoute requireAdminAccess="leads">
                            <Products />
                          </ProtectedRoute>
                        } />

                        <Route path="/reports" element={
                          <ProtectedRoute requireSuperAdmin>
                            <Reports />
                          </ProtectedRoute>
                        } />

                        <Route path="/focus-mode" element={
                          <ProtectedRoute requireAdminAccess="leads">
                            <FocusMode />
                          </ProtectedRoute>
                        } />

                        <Route path="/sms" element={
                          <ProtectedRoute requireAdminAccess="sms">
                            <SMS />
                          </ProtectedRoute>
                        } />

                        <Route path="/notifications" element={
                          <ProtectedRoute requireAdminAccess="notifications">
                            <Notifications />
                          </ProtectedRoute>
                        } />

                        <Route path="/settings" element={
                          <ProtectedRoute requireAdminAccess="settings">
                            <Settings />
                          </ProtectedRoute>
                        } />

                        <Route path="/webhook-settings" element={
                          <ProtectedRoute>
                            <WebhookSettings />
                          </ProtectedRoute>
                        } />

                        <Route path="/library" element={
                          <ProtectedRoute requireAdminAccess="library">
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
                          <ProtectedRoute requireAdmin requireAdminAccess="clients">
                            <Clients />
                          </ProtectedRoute>
                        } />

                        {/* 404 */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </SessionTimeoutHandler>
                </AuthProvider>
              </BrowserRouter>
            </TooltipProvider>
          </ThemeConfigProvider>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
