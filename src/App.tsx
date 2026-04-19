/**
 * Root application component.
 * Sets up global providers (query persistence, theme, auth, error boundary)
 * and defines the client-side route tree with lazy-loaded pages.
 */
import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createIndexedDBPersister, DEFAULT_PERSIST_MAX_AGE_MS } from '@/lib/queryPersistence';
import { QueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
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

function AuthCheckRedirect({ children }: { children: React.ReactNode }) {
  const { user, loading, authRoutingReady } = useAuth();
  
  if (loading && !user) {
    return <PageLoader />;
  }
  
  if (user && authRoutingReady) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

// Eager load - Auth page (first thing users see)
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";

// --- Lazy-loaded Pages ---
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const Orders = lazy(() => import("./pages/Orders"));
const ConfirmedOrders = lazy(() => import("./pages/ConfirmedOrders"));
const Products = lazy(() => import("@/pages/Products"));
const Reports = lazy(() => import("@/pages/Reports"));
const SMS = lazy(() => import("./pages/SMS"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Users = lazy(() => import("./pages/Users"));
const Clients = lazy(() => import("./pages/Clients"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminPermissions = lazy(() => import("./pages/AdminPermissions"));
const WebhookSettings = lazy(() => import("./pages/WebhookSettings"));
const ProductOnboarding = lazy(() => import("./pages/ProductOnboarding"));
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

// --- Component ---
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
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-background focus:px-4 focus:py-2 focus:rounded-md focus:ring-2 focus:ring-ring focus:text-foreground"
              >
                Skip to main content
              </a>
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
                         <Route path="/" element={
                           <AuthCheckRedirect>
                             <Landing />
                           </AuthCheckRedirect>
                         } />
                         <Route path="/auth" element={<Auth />} />
                         <Route path="/book/:token" element={<PublicBooking />} />

                        {/* Product Onboarding route */}
                        <Route path="/product-onboarding" element={
                          <ProtectedRoute>
                            <ProductOnboarding />
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
                          <Navigate to="/orders" replace />
                        } />

                        <Route path="/confirmed-orders" element={
                          <ProtectedRoute requireAdminAccess="appointments">
                            <ConfirmedOrders />
                          </ProtectedRoute>
                        } />

                        <Route path="/appointments" element={
                          <Navigate to="/confirmed-orders" replace />
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
