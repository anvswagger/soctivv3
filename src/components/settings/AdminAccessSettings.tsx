import { useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldCheck, UserCog } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  ADMIN_ACCESS_KEYS,
  ADMIN_ACCESS_LABELS,
  DEFAULT_ADMIN_ACCESS_PERMISSIONS,
  type AdminAccessKey,
  type AdminAccessPermissions,
  adminAccessPermissionsToRow,
  rowToAdminAccessPermissions,
} from '@/lib/adminAccess';

const db = supabase as any;

interface AdminUserRow {
  user_id: string;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export function AdminAccessSettings() {
  const { toast } = useToast();
  const [admins, setAdmins] = useState<AdminUserRow[]>([]);
  const [permissionsByUserId, setPermissionsByUserId] = useState<Record<string, AdminAccessPermissions>>({});
  const [loading, setLoading] = useState(true);
  const [savingToggle, setSavingToggle] = useState<string | null>(null);

  const hasAdmins = admins.length > 0;

  const missingPermissionsCount = useMemo(() => {
    return admins.filter((admin) => !permissionsByUserId[admin.user_id]).length;
  }, [admins, permissionsByUserId]);

  const loadAdminAccess = async () => {
    setLoading(true);

    try {
      const [adminsRes, permissionsRes] = await Promise.all([
        db
          .from('user_roles')
          .select('user_id, profile:profiles(full_name, avatar_url)')
          .eq('role', 'admin'),
        db.from('admin_access_permissions').select('*'),
      ]);

      if (adminsRes.error) throw adminsRes.error;
      if (permissionsRes.error) throw permissionsRes.error;

      const adminList = (adminsRes.data || []) as AdminUserRow[];
      const permissionsList = (permissionsRes.data || []) as any[];
      const permissionsMapByUserId = new Map(permissionsList.map((row) => [row.user_id, row]));
      const nextPermissionsByUserId: Record<string, AdminAccessPermissions> = {};
      const rowsToSeed: Array<{ user_id: string } & ReturnType<typeof adminAccessPermissionsToRow>> = [];

      adminList.forEach((admin) => {
        const existingRow = permissionsMapByUserId.get(admin.user_id);
        nextPermissionsByUserId[admin.user_id] = rowToAdminAccessPermissions(existingRow);

        if (!existingRow) {
          rowsToSeed.push({
            user_id: admin.user_id,
            ...adminAccessPermissionsToRow(DEFAULT_ADMIN_ACCESS_PERMISSIONS),
          });
        }
      });

      setAdmins(adminList);
      setPermissionsByUserId(nextPermissionsByUserId);

      if (rowsToSeed.length > 0) {
        const { error: seedError } = await db
          .from('admin_access_permissions')
          .upsert(rowsToSeed, { onConflict: 'user_id' });

        if (seedError) {
          console.error('Error seeding admin access permissions:', seedError);
        }
      }
    } catch (error: any) {
      console.error('Error loading admin access settings:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Could not load admin access settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAdminAccess();
  }, []);

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

    const { error } = await db.from('admin_access_permissions').upsert(
      {
        user_id: userId,
        ...adminAccessPermissionsToRow(nextPermissions),
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      setPermissionsByUserId((prev) => ({
        ...prev,
        [userId]: currentPermissions,
      }));

      toast({
        title: 'Error',
        description: error.message || 'Could not update permission',
        variant: 'destructive',
      });
    }

    setSavingToggle(null);
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
          <p>No admins were found to assign access.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Admin Access Control
          </CardTitle>
          <CardDescription>
            Super Admin can turn each module on or off for every admin account.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">Admins: {admins.length}</Badge>
            {missingPermissionsCount > 0 && (
              <Badge variant="outline">Pending rows: {missingPermissionsCount}</Badge>
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
                  {admin.profile?.full_name || 'Admin user'}
                </CardTitle>
                <CardDescription className="font-mono text-xs">{admin.user_id}</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {ADMIN_ACCESS_KEYS.map((accessKey) => {
                    const toggleId = `${admin.user_id}:${accessKey}`;
                    const isSaving = savingToggle === toggleId;

                    return (
                      <div
                        key={accessKey}
                        className="flex items-center justify-between rounded-lg border px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{ADMIN_ACCESS_LABELS[accessKey]}</p>
                          <p className="text-xs text-muted-foreground">Module access</p>
                        </div>
                        <div className="flex items-center gap-2">
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
