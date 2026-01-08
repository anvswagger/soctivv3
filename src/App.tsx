import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public route */}
                  <Route path="/" element={<Auth />} />

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
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
