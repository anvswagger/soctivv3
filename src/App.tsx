import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Appointments from "./pages/Appointments";
import SMS from "./pages/SMS";
import Notifications from "./pages/Notifications";
import Users from "./pages/Users";
import Clients from "./pages/Clients";
import Settings from "./pages/Settings";
import AdminPermissions from "./pages/AdminPermissions";
import WebhookSettings from "./pages/WebhookSettings";
import ClientSettings from "./pages/ClientSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/sms" element={<SMS />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/users" element={
                <ProtectedRoute requireAdmin>
                  <Users />
                </ProtectedRoute>
              } />
              <Route path="/clients" element={
                <ProtectedRoute requireAdmin>
                  <Clients />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin-permissions" element={
                <ProtectedRoute requireSuperAdmin>
                  <AdminPermissions />
                </ProtectedRoute>
              } />
              <Route path="/webhook-settings" element={<WebhookSettings />} />
              <Route path="/client-settings" element={<ClientSettings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
