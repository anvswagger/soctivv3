import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Profile, AppRole, ApprovalStatus } from '@/types/database';
import { Check, X, Shield, Loader2, Users, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const { isSuperAdmin, user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRoles | null>(null);

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

  const handleDeleteClick = (userToDelete: UserWithRoles) => {
    setUserToDelete(userToDelete);
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    setDeletingUserId(userToDelete.id);
    setDeleteDialogOpen(false);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast({ title: 'خطأ', description: 'يرجى تسجيل الدخول مرة أخرى', variant: 'destructive' });
        return;
      }

      const response = await supabase.functions.invoke('delete-user', {
        body: { user_id: userToDelete.id },
      });

      if (response.error) {
        throw new Error(response.error.message || 'فشل في حذف المستخدم');
      }

      toast({ title: 'تم الحذف', description: 'تم حذف المستخدم بنجاح' });
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({ 
        title: 'خطأ', 
        description: error instanceof Error ? error.message : 'فشل في حذف المستخدم', 
        variant: 'destructive' 
      });
    } finally {
      setDeletingUserId(null);
      setUserToDelete(null);
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
                  {users.map((userItem) => (
                    <TableRow key={userItem.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={userItem.avatar_url || undefined} />
                            <AvatarFallback>{userItem.full_name?.charAt(0) || 'U'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{userItem.full_name || 'بدون اسم'}</p>
                            <p className="text-sm text-muted-foreground">{userItem.phone || '-'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={approvalColors[userItem.approval_status]}>{approvalLabels[userItem.approval_status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Select value={userItem.roles[0] || 'client'} onValueChange={(value: AppRole) => updateUserRole(userItem.id, value)}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="client">عميل</SelectItem>
                            <SelectItem value="admin">مسؤول</SelectItem>
                            <SelectItem value="super_admin">مسؤول رئيسي</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {userItem.approval_status === 'pending' && (
                            <>
                              <Button size="sm" variant="default" className="gap-1" onClick={() => updateApprovalStatus(userItem.id, 'approved')}>
                                <Check className="h-4 w-4" />قبول
                              </Button>
                              <Button size="sm" variant="destructive" className="gap-1" onClick={() => updateApprovalStatus(userItem.id, 'rejected')}>
                                <X className="h-4 w-4" />رفض
                              </Button>
                            </>
                          )}
                          {userItem.id !== user?.id && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteClick(userItem)}
                              disabled={deletingUserId === userItem.id}
                            >
                              {deletingUserId === userItem.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              حذف
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف المستخدم</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المستخدم "{userToDelete?.full_name || 'بدون اسم'}"؟
              <br />
              هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
