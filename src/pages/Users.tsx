import { useMemo, useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ApprovalRequest, Profile, AppRole, ApprovalStatus } from '@/types/database';
import { Check, X, Shield, Loader2, Users, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, formatNumber } from '@/lib/format';
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

type RpcError = { message?: string } | null;
type UserRoleRow = { user_id: string; role: AppRole };
type ApprovalRequestRow = ApprovalRequest & {
  profiles?: { full_name: string | null; phone: string | null } | null;
  clients?: { company_name: string | null } | null;
  reviewer?: { full_name: string | null } | null;
};

type ApprovalRequestsTableQuery = {
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => Promise<{ data: ApprovalRequestRow[] | null; error: RpcError }>;
  };
};

type SetApprovalStatusRpc = (
  fn: 'set_approval_status',
  params: {
    p_user_id: string;
    p_status: ApprovalStatus;
    p_reviewer_id?: string | null;
    p_reviewer_notes: string | null;
    p_rejection_reason: string | null;
  }
) => Promise<{ error: RpcError }>;

type ClaimApprovalRequestRpc = (
  fn: 'claim_approval_request',
  params: { p_user_id: string }
) => Promise<{ error: RpcError }>;

type SubmitApprovalRequestRpc = (
  fn: 'submit_approval_request',
  params: { p_user_id: string; p_client_id?: string | null }
) => Promise<{ error: RpcError }>;

type UsersSupabaseClient = {
  from: (table: string) => ApprovalRequestsTableQuery;
  rpc: SetApprovalStatusRpc & ClaimApprovalRequestRpc & SubmitApprovalRequestRpc;
};

const usersSupabase = supabase as unknown as UsersSupabaseClient;
const approvalRequestsTable = (): ApprovalRequestsTableQuery => usersSupabase.from('approval_requests');

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
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequestRow[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(true);
  const [reviewInputs, setReviewInputs] = useState<Record<string, { notes: string; reason: string }>>({});
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'unassigned' | 'mine' | 'overdue'>('all');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserWithRoles | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (profilesError) {
      toast({ title: 'خطأ', description: 'فشل في تحميل المستخدمين', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const { data: allRoles, error: rolesError } = await supabase.from('user_roles').select('user_id, role');
    if (rolesError) {
      toast({ title: 'خطأ', description: 'فشل في تحميل الصلاحيات', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const roleRows = ((allRoles || []) as UserRoleRow[]);
    const usersWithRoles = (profiles || []).map((profile: Profile) => ({
      ...profile,
      roles: roleRows.filter((row) => row.user_id === profile.id).map((row) => row.role),
    }));

    setUsers(usersWithRoles);
    setLoading(false);
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchUsers();
  }, [isSuperAdmin]);

  const fetchApprovalRequests = async () => {
    setApprovalsLoading(true);
    const { data, error } = await approvalRequestsTable()
      .select(
        'id,user_id,client_id,status,attempt,submitted_at,sla_hours,sla_due_at,reviewer_id,reviewer_assigned_at,reviewer_notes,rejection_reason,last_reviewed_at,approved_at,rejected_at,updated_at,profiles:profiles!approval_requests_user_id_fkey(full_name,phone),clients:clients!approval_requests_client_id_fkey(company_name),reviewer:profiles!approval_requests_reviewer_id_fkey(full_name)'
      )
      .order('sla_due_at', { ascending: true });

    if (error) {
      toast({ title: 'خطأ', description: 'فشل في تحميل قائمة الموافقات', variant: 'destructive' });
      setApprovalsLoading(false);
      return;
    }

    const requests = data || [];
    setApprovalRequests(requests);
    setReviewInputs((prev) => {
      const next = { ...prev };
      for (const req of requests) {
        if (!next[req.user_id]) {
          next[req.user_id] = {
            notes: req.reviewer_notes || '',
            reason: req.rejection_reason || '',
          };
        }
      }
      return next;
    });
    setApprovalsLoading(false);
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchApprovalRequests();
  }, [isSuperAdmin]);

  const updateApprovalStatus = async (userId: string, status: ApprovalStatus) => {
    if (!user?.id) {
      toast({ title: 'خطأ', description: 'يرجى تسجيل الدخول مرة أخرى', variant: 'destructive' });
      return;
    }

    const notes = reviewInputs[userId]?.notes || null;
    const reason = reviewInputs[userId]?.reason || null;
    if (status === 'rejected' && !reason) {
      toast({ title: 'مطلوب سبب الرفض', description: 'يرجى كتابة سبب واضح للرفض قبل الإرسال.', variant: 'destructive' });
      return;
    }

    const attemptSetStatus = async () =>
      usersSupabase.rpc('set_approval_status', {
        p_user_id: userId,
        p_status: status,
        p_reviewer_id: user.id,
        p_reviewer_notes: notes,
        p_rejection_reason: reason,
      });

    let { error } = await attemptSetStatus();

    // Legacy edge-case recovery: pending profile exists but approval_requests row is missing.
    if (error?.message?.toLowerCase().includes('approval request not found')) {
      const { error: submitError } = await usersSupabase.rpc('submit_approval_request', {
        p_user_id: userId,
        p_client_id: null,
      });

      if (!submitError) {
        ({ error } = await attemptSetStatus());
      }
    }

    if (error) {
      toast({ title: 'خطأ', description: error.message || 'فشل في تحديث الحالة', variant: 'destructive' });
      return;
    }

    toast({ title: 'تم التحديث', description: 'تم تحديث حالة المستخدم بنجاح' });
    fetchUsers();
    fetchApprovalRequests();
  };

  const claimApprovalRequest = async (userId: string) => {
    const { error } = await usersSupabase.rpc('claim_approval_request', { p_user_id: userId });
    if (error) {
      toast({ title: 'خطأ', description: error.message || 'فشل في الاستلام', variant: 'destructive' });
      return;
    }
    toast({ title: 'تم الاستلام', description: 'تم حجز هذا الطلب لك.' });
    fetchApprovalRequests();
  };

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    // Remove existing roles
    await supabase.from('user_roles').delete().eq('user_id', userId);
    // Add new role
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: newRole });
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
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      const accessToken = refreshed.session?.access_token ?? session?.session?.access_token;

      if (!accessToken) {
        if (refreshError) {
          console.warn('Failed to refresh auth session before delete:', refreshError.message);
        }
        toast({ title: 'خطأ', description: 'يرجى تسجيل الدخول مرة أخرى', variant: 'destructive' });
        return;
      }

      const response = await supabase.functions.invoke('delete-user', {
        headers: {
          Authorization: 'Bearer ' + accessToken,
        },
        body: { user_id: userToDelete.id },
      });

      if (response.error) {
        let functionErrorMessage = response.error.message || 'فشل في حذف المستخدم';
        const responseContext = (response.error as { context?: Response }).context;

        if (responseContext) {
          try {
            const payload = await responseContext.clone().json() as { error?: string; details?: string; message?: string };
            functionErrorMessage = payload.error || payload.details || payload.message || functionErrorMessage;
          } catch {
            // Ignore parse failures and keep fallback message.
          }
        }

        throw new Error(functionErrorMessage);
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

  const pendingApprovals = useMemo(() => {
    const base = approvalRequests.filter((req) => req.status === 'pending');
    if (approvalFilter === 'unassigned') {
      return base.filter((req) => !req.reviewer_id);
    }
    if (approvalFilter === 'mine') {
      return base.filter((req) => req.reviewer_id === user?.id);
    }
    if (approvalFilter === 'overdue') {
      return base.filter((req) => new Date(req.sla_due_at).getTime() < Date.now());
    }
    return base;
  }, [approvalRequests, approvalFilter, user?.id]);

  const getSlaLabel = (dueAt: string) => {
    const diffMs = new Date(dueAt).getTime() - Date.now();
    const diffHours = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60));
    if (diffMs < 0) {
      return `متأخر ${formatNumber(diffHours)} ساعة`;
    }
    return `متبقي ${formatNumber(diffHours)} ساعة`;
  };

  if (!isSuperAdmin) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-2 text-center">
          <h1 className="text-2xl font-heading font-bold">غير مصرح</h1>
          <p className="text-muted-foreground">هذه الصفحة متاحة للمسؤول الرئيسي فقط.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">إدارة المستخدمين</h1>
          <p className="text-muted-foreground">مراجعة وإدارة حسابات المستخدمين</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                طابور الموافقات
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={approvalFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setApprovalFilter('all')}
                >
                  الكل
                </Button>
                <Button
                  size="sm"
                  variant={approvalFilter === 'unassigned' ? 'default' : 'outline'}
                  onClick={() => setApprovalFilter('unassigned')}
                >
                  غير معين
                </Button>
                <Button
                  size="sm"
                  variant={approvalFilter === 'mine' ? 'default' : 'outline'}
                  onClick={() => setApprovalFilter('mine')}
                >
                  معين لي
                </Button>
                <Button
                  size="sm"
                  variant={approvalFilter === 'overdue' ? 'default' : 'outline'}
                  onClick={() => setApprovalFilter('overdue')}
                >
                  متأخر
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {approvalsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : pendingApprovals.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">لا توجد طلبات موافقة حالياً</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-right">الشركة</TableHead>
                    <TableHead className="text-right">تم الإرسال</TableHead>
                    <TableHead className="text-right">SLA</TableHead>
                    <TableHead className="text-right">المراجع</TableHead>
                    <TableHead className="text-right">المحاولة</TableHead>
                    <TableHead className="text-right">ملاحظات المراجع</TableHead>
                    <TableHead className="text-right">سبب الرفض</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingApprovals.map((req) => {
                    const notes = reviewInputs[req.user_id]?.notes || '';
                    const reason = reviewInputs[req.user_id]?.reason || '';
                    const slaOverdue = new Date(req.sla_due_at).getTime() < Date.now();
                    const profile = req.profiles;
                    const client = req.clients;
                    const reviewer = req.reviewer;
                    return (
                      <TableRow key={req.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{profile?.full_name || 'بدون اسم'}</p>
                            <p className="text-sm text-muted-foreground">{profile?.phone || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{client?.company_name || '-'}</TableCell>
                        <TableCell>{formatDateTime(req.submitted_at)}</TableCell>
                        <TableCell>
                          <Badge className={slaOverdue ? 'bg-destructive text-destructive-foreground' : 'bg-warning text-warning-foreground'}>
                            {getSlaLabel(req.sla_due_at)}
                          </Badge>
                          <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(req.sla_due_at)}</div>
                        </TableCell>
                        <TableCell>
                          {req.reviewer_id ? (
                            <div className="text-sm">{reviewer?.full_name || 'بدون اسم'}</div>
                          ) : (
                            <Badge variant="outline">غير معين</Badge>
                          )}
                        </TableCell>
                        <TableCell>{req.attempt}</TableCell>
                        <TableCell className="min-w-[220px]">
                          <Textarea
                            value={notes}
                            onChange={(e) =>
                              setReviewInputs((prev) => ({
                                ...prev,
                                [req.user_id]: { notes: e.target.value, reason },
                              }))
                            }
                            placeholder="ملاحظاتك للمراجعة"
                            className="min-h-[80px]"
                          />
                        </TableCell>
                        <TableCell className="min-w-[220px]">
                          <Textarea
                            value={reason}
                            onChange={(e) =>
                              setReviewInputs((prev) => ({
                                ...prev,
                                [req.user_id]: { notes, reason: e.target.value },
                              }))
                            }
                            placeholder="سبب الرفض (يظهر للعميل)"
                            className="min-h-[80px]"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {!req.reviewer_id && (
                              <Button size="sm" variant="outline" onClick={() => claimApprovalRequest(req.user_id)}>
                                استلام
                              </Button>
                            )}
                            <Button size="sm" variant="default" className="gap-1" onClick={() => updateApprovalStatus(req.user_id, 'approved')}>
                              <Check className="h-4 w-4" />قبول
                            </Button>
                            <Button size="sm" variant="destructive" className="gap-1" onClick={() => updateApprovalStatus(req.user_id, 'rejected')}>
                              <X className="h-4 w-4" />رفض
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

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
                            <AvatarFallback>{userItem.full_name?.charAt(0) || 'م'}</AvatarFallback>
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
              هل أنت متأكد من حذف المستخدم "{userToDelete?.full_name || 'بدون اسم'}"طں
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










