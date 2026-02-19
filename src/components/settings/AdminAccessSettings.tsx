import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldCheck, UserCog } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ADMIN_ACCESS_KEYS,
  ADMIN_ACCESS_LABELS,
  DEFAULT_ADMIN_ACCESS_PERMISSIONS,
  type AdminAccessKey,
  type AdminAccessPermissions,
  type AdminAccessRow,
  adminAccessPermissionsToRow,
  rowToAdminAccessPermissions,
} from '@/lib/adminAccess';

const db = supabase;

interface AdminUserRow {
  user_id: string;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface ClientOptionRow {
  id: string;
  company_name: string | null;
}

interface AdminClientAssignmentRow {
  user_id: string;
  client_id: string;
}

export function AdminAccessSettings() {
  const { toast } = useToast();
  const [admins, setAdmins] = useState<AdminUserRow[]>([]);
  const [clients, setClients] = useState<ClientOptionRow[]>([]);
  const [permissionsByUserId, setPermissionsByUserId] = useState<Record<string, AdminAccessPermissions>>({});
  const [assignmentsByUserId, setAssignmentsByUserId] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingToggle, setSavingToggle] = useState<string | null>(null);
  const [savingClientAssignment, setSavingClientAssignment] = useState<string | null>(null);

  const hasAdmins = admins.length > 0;

  const missingPermissionsCount = useMemo(() => {
    return admins.filter((admin) => !permissionsByUserId[admin.user_id]).length;
  }, [admins, permissionsByUserId]);

  const loadAdminAccess = useCallback(async () => {
    setLoading(true);

    try {
      const [adminsRes, permissionsRes, clientsRes, assignmentsRes] = await Promise.all([
        db
          .from('user_roles')
          .select('user_id, profile:profiles!user_roles_user_id_fkey_profiles(full_name, avatar_url)')
          .eq('role', 'admin'),
        db.from('admin_access_permissions').select('*'),
        db.from('clients').select('id, company_name').order('company_name', { ascending: true }),
        db.from('admin_clients').select('user_id, client_id'),
      ]);

      if (adminsRes.error) throw adminsRes.error;
      if (permissionsRes.error) throw permissionsRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;

      const adminList = (adminsRes.data as unknown as AdminUserRow[]) || [];
      const permissionsList = (permissionsRes.data as unknown as AdminAccessRow[]) || [];
      const clientList = (clientsRes.data || []) as ClientOptionRow[];
      const assignmentRows = (assignmentsRes.data || []) as AdminClientAssignmentRow[];
      const permissionsMapByUserId = new Map(permissionsList.map((row) => [row.user_id, row]));
      const nextPermissionsByUserId: Record<string, AdminAccessPermissions> = {};
      const nextAssignmentsByUserId: Record<string, string[]> = {};
      const rowsToSeed: Array<{ user_id: string } & ReturnType<typeof adminAccessPermissionsToRow>> = [];

      adminList.forEach((admin) => {
        const existingRow = permissionsMapByUserId.get(admin.user_id);
        nextPermissionsByUserId[admin.user_id] = rowToAdminAccessPermissions(existingRow);
        nextAssignmentsByUserId[admin.user_id] = [];

        if (!existingRow) {
          rowsToSeed.push({
            user_id: admin.user_id,
            ...adminAccessPermissionsToRow(DEFAULT_ADMIN_ACCESS_PERMISSIONS),
          });
        }
      });

      assignmentRows.forEach((assignment) => {
        if (!nextAssignmentsByUserId[assignment.user_id]) {
          nextAssignmentsByUserId[assignment.user_id] = [];
        }
        if (!nextAssignmentsByUserId[assignment.user_id].includes(assignment.client_id)) {
          nextAssignmentsByUserId[assignment.user_id].push(assignment.client_id);
        }
      });

      setAdmins(adminList);
      setClients(clientList);
      setPermissionsByUserId(nextPermissionsByUserId);
      setAssignmentsByUserId(nextAssignmentsByUserId);

      if (rowsToSeed.length > 0) {
        const { error: seedError } = await db
          .from('admin_access_permissions' as any)
          .upsert(rowsToSeed, { onConflict: 'user_id' });

        if (seedError) {
          console.error('Error seeding admin access permissions:', seedError);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'تعذر تحميل صلاحيات وصول المسؤولين';
      console.error('Error loading admin access settings:', error);
      toast({
        title: 'خطأ',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadAdminAccess();
  }, [loadAdminAccess]);

  const updatePermission = async (userId: string, accessKey: AdminAccessKey, value: boolean) => {
    const currentPermissions = permissionsByUserId[userId] || { ...DEFAULT_ADMIN_ACCESS_PERMISSIONS };
    const nextPermissions = {
      ...currentPermissions,
      [accessKey]: value,
    };

    setPermissionsByUserId((prev) => ({
      ...prev,
      [userId]: nextPermissions,
    }));

    const toggleId = `${userId}:${accessKey}`;
    setSavingToggle(toggleId);

    const { error } = await db.from('admin_access_permissions' as any).upsert(
      {
        user_id: userId,
        ...adminAccessPermissionsToRow(nextPermissions),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      setPermissionsByUserId((prev) => ({
        ...prev,
        [userId]: currentPermissions,
      }));

      toast({
        title: 'خطأ',
        description: error.message || 'تعذر تحديث الصلاحية',
        variant: 'destructive',
      });
    }

    setSavingToggle(null);
  };

  const updateClientAssignment = async (userId: string, clientId: string, checked: boolean) => {
    const existingAssignments = assignmentsByUserId[userId] || [];
    const nextAssignments = checked
      ? Array.from(new Set([...existingAssignments, clientId]))
      : existingAssignments.filter((id) => id !== clientId);

    setAssignmentsByUserId((prev) => ({
      ...prev,
      [userId]: nextAssignments,
    }));

    const toggleId = `${userId}:${clientId}`;
    setSavingClientAssignment(toggleId);

    let error: { code?: string; message: string } | null = null;

    if (checked) {
      const result = await db.from('admin_clients').insert({ user_id: userId, client_id: clientId });
      if (result.error && result.error.code !== '23505') {
        error = result.error;
      }
    } else {
      const result = await db.from('admin_clients').delete().match({ user_id: userId, client_id: clientId });
      if (result.error) {
        error = result.error;
      }
    }

    if (error) {
      setAssignmentsByUserId((prev) => ({
        ...prev,
        [userId]: existingAssignments,
      }));
      toast({
        title: 'خطأ',
        description: error.message || 'تعذر تحديث صلاحيات العملاء',
        variant: 'destructive',
      });
    }

    setSavingClientAssignment(null);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!hasAdmins) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <UserCog className="h-10 w-10 mx-auto mb-4 opacity-40" />
          <p>لا يوجد مسؤولون لتعيين الصلاحيات لهم.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ShieldCheck className="h-5 w-5" />
            التحكم بصلاحيات المسؤولين
          </CardTitle>
          <CardDescription>
            يمكن للسوبر أدمن تفعيل أو إيقاف كل قسم لكل حساب مسؤول.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">عدد المسؤولين: {admins.length}</Badge>
            {missingPermissionsCount > 0 && (
              <Badge variant="outline">سجلات قيد الإنشاء: {missingPermissionsCount}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {admins.map((admin) => {
          const permissions = permissionsByUserId[admin.user_id] || { ...DEFAULT_ADMIN_ACCESS_PERMISSIONS };

          return (
            <Card key={admin.user_id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {admin.profile?.full_name || 'مسؤول بدون اسم'}
                </CardTitle>
                <CardDescription className="font-mono text-xs">{admin.user_id}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                  {ADMIN_ACCESS_KEYS.map((accessKey) => {
                    const toggleId = `${admin.user_id}:${accessKey}`;
                    const isSaving = savingToggle === toggleId;

                    return (
                      <div
                        key={accessKey}
                        className="flex items-center justify-between rounded-lg border px-3 py-2"
                      >
                        <div className="min-w-0 pr-3">
                          <p className="text-sm font-medium truncate">{ADMIN_ACCESS_LABELS[accessKey]}</p>
                          <p className="text-xs text-muted-foreground">صلاحية الوصول</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                          <Switch
                            checked={permissions[accessKey]}
                            disabled={isSaving}
                            onCheckedChange={(checked) => {
                              void updatePermission(admin.user_id, accessKey, checked);
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">صلاحية الليدز حسب العميل</p>
                    <Badge variant="outline">
                      {assignmentsByUserId[admin.user_id]?.length || 0} عميل
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    المسؤول سيرى ليدز العملاء المحددين فقط. إذا لم تحدد أي عميل فلن يرى أي ليدز.
                  </p>

                  {clients.length === 0 ? (
                    <div className="text-xs text-muted-foreground border rounded-lg px-3 py-2">
                      لا يوجد عملاء متاحون للتخصيص حالياً.
                    </div>
                  ) : (
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                      {clients.map((client) => {
                        const clientName = client.company_name || 'عميل بدون اسم';
                        const toggleId = `${admin.user_id}:${client.id}`;
                        const isSavingClient = savingClientAssignment === toggleId;
                        const isChecked = (assignmentsByUserId[admin.user_id] || []).includes(client.id);

                        return (
                          <label
                            key={`${admin.user_id}-${client.id}`}
                            htmlFor={toggleId}
                            className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer"
                          >
                            <Checkbox
                              id={toggleId}
                              checked={isChecked}
                              disabled={isSavingClient}
                              onCheckedChange={(nextValue) => {
                                void updateClientAssignment(admin.user_id, client.id, Boolean(nextValue));
                              }}
                            />
                            <span className="text-sm truncate flex-1">{clientName}</span>
                            {isSavingClient && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
