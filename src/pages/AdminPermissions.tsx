import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Shield, Users, Save, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { hapticLight, hapticSuccess } from '@/lib/haptics';

export default function AdminPermissions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  // Fetch all admins
  const { data: admins, isLoading: adminsLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          profile:profiles(full_name, avatar_url)
        `)
        .eq('role', 'admin');
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });

  // Fetch all clients
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['all-clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, company_name');
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });

  // Fetch current assignments
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['admin-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_clients').select('*');
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });

  const toggleAssignment = useMutation({
    mutationFn: async ({ userId, clientId, checked }: { userId: string, clientId: string, checked: boolean }) => {
      if (checked) {
        const { error } = await supabase.from('admin_clients').insert({ user_id: userId, client_id: clientId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('admin_clients').delete().match({ user_id: userId, client_id: clientId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-assignments'] });
      hapticSuccess();
    },
    onError: (error: any) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    }
  });

  const isLoading = adminsLoading || clientsLoading || assignmentsLoading;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-heading font-bold">صلاحيات المسؤولين</h1>
            <p className="text-muted-foreground">تخصيص الشركات للمسؤولين (المسؤولون)</p>
          </div>
          <Shield className="h-10 w-10 text-primary opacity-20" />
        </div>

        <div className="grid gap-6">
          {admins?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 opacity-20 mb-4" />
                <p>لا يوجد مسؤولين حالياً ليتم تخصيصهم</p>
              </CardContent>
            </Card>
          ) : (
            admins?.map((admin: any) => (
              <Card key={admin.user_id} className="overflow-hidden border-primary/10">
                <CardHeader className="bg-primary/5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {admin.profile?.full_name?.charAt(0) || 'م'}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{admin.profile?.full_name || 'مستخدم بدون اسم'}</CardTitle>
                        <CardDescription>{admin.user_id}</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <h4 className="text-sm font-semibold mb-4 text-muted-foreground">الشركات المخصصة:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clients?.map((client) => {
                      const isAssigned = assignments?.some(
                        (a: any) => a.user_id === admin.user_id && a.client_id === client.id
                      );
                      return (
                        <div
                          key={client.id}
                          className={`flex items-center space-x-3 space-x-reverse p-3 rounded-lg border transition-all ${isAssigned ? 'border-primary bg-primary/5' : 'border-border bg-card'
                            }`}
                        >
                          <Checkbox
                            id={`${admin.user_id}-${client.id}`}
                            checked={isAssigned}
                            onCheckedChange={(checked) => {
                              hapticLight();
                              toggleAssignment.mutate({
                                userId: admin.user_id,
                                clientId: client.id,
                                checked: !!checked
                              });
                            }}
                          />
                          <label
                            htmlFor={`${admin.user_id}-${client.id}`}
                            className="text-sm font-medium leading-none cursor-pointer flex-1"
                          >
                            {client.company_name}
                          </label>
                          {isAssigned && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
