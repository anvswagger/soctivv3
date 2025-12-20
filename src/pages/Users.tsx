import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Profile, AppRole, ApprovalStatus } from '@/types/database';
import { Check, X, Shield, Loader2, Users } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const db = supabase as any;

const roleLabels: Record<AppRole, string> = {
  super_admin: 'مسؤول رئيسي',
  admin: 'مسؤول',
  client: 'عميل',
};

const approvalLabels: Record<ApprovalStatus, string> = {
  pending: 'قيد المراجعة',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
};

const approvalColors: Record<ApprovalStatus, string> = {
  pending: 'bg-warning text-warning-foreground',
  approved: 'bg-success text-success-foreground',
  rejected: 'bg-destructive text-destructive-foreground',
};

interface UserWithRoles extends Profile {
  roles: AppRole[];
}

export default function UsersPage() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error: profilesError } = await db.from('profiles').select('*').order('created_at', { ascending: false });
    if (profilesError) {
      toast({ title: 'خطأ', description: 'فشل في تحميل المستخدمين', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const { data: allRoles, error: rolesError } = await db.from('user_roles').select('user_id, role');
    if (rolesError) {
      toast({ title: 'خطأ', description: 'فشل في تحميل الصلاحيات', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const usersWithRoles = (profiles || []).map((profile: Profile) => ({
      ...profile,
      roles: (allRoles || []).filter((r: any) => r.user_id === profile.id).map((r: any) => r.role as AppRole),
    }));

    setUsers(usersWithRoles);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateApprovalStatus = async (userId: string, status: ApprovalStatus) => {
    const { error } = await db.from('profiles').update({ approval_status: status }).eq('id', userId);
    if (error) {
      toast({ title: 'خطأ', description: 'فشل في تحديث الحالة', variant: 'destructive' });
    } else {
      toast({ title: 'تم التحديث', description: 'تم تحديث حالة المستخدم بنجاح' });
      fetchUsers();
    }
  };

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    // Remove existing roles
    await db.from('user_roles').delete().eq('user_id', userId);
    // Add new role
    const { error } = await db.from('user_roles').insert({ user_id: userId, role: newRole });
    if (error) {
      toast({ title: 'خطأ', description: 'فشل في تحديث الصلاحية', variant: 'destructive' });
    } else {
      toast({ title: 'تم التحديث', description: 'تم تحديث صلاحية المستخدم بنجاح' });
      fetchUsers();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">إدارة المستخدمين</h1>
          <p className="text-muted-foreground">مراجعة وإدارة حسابات المستخدمين</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />المستخدمين</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">لا يوجد مستخدمين</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المستخدم</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الصلاحية</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback>{user.full_name?.charAt(0) || 'U'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.full_name || 'بدون اسم'}</p>
                            <p className="text-sm text-muted-foreground">{user.phone || '-'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={approvalColors[user.approval_status]}>{approvalLabels[user.approval_status]}</Badge>
                      </TableCell>
                      <TableCell>
                        {isSuperAdmin ? (
                          <Select value={user.roles[0] || 'client'} onValueChange={(value: AppRole) => updateUserRole(user.id, value)}>
                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="client">عميل</SelectItem>
                              <SelectItem value="admin">مسؤول</SelectItem>
                              <SelectItem value="super_admin">مسؤول رئيسي</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Shield className="h-4 w-4" />
                            {roleLabels[user.roles[0]] || 'عميل'}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.approval_status === 'pending' && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="default" className="gap-1" onClick={() => updateApprovalStatus(user.id, 'approved')}>
                              <Check className="h-4 w-4" />قبول
                            </Button>
                            <Button size="sm" variant="destructive" className="gap-1" onClick={() => updateApprovalStatus(user.id, 'rejected')}>
                              <X className="h-4 w-4" />رفض
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}