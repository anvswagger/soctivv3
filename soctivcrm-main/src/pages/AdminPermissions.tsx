import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, Users, Key } from 'lucide-react';

export default function AdminPermissions() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">صلاحيات المسؤولين</h1>
          <p className="text-muted-foreground">إدارة صلاحيات ومستويات الوصول</p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />مستويات الصلاحيات</CardTitle>
              <CardDescription>الصلاحيات المتاحة في النظام</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold flex items-center gap-2"><Key className="h-4 w-4" />مسؤول رئيسي (Super Admin)</h4>
                <p className="text-sm text-muted-foreground mt-1">وصول كامل لجميع الميزات والإعدادات، إدارة المسؤولين والمستخدمين</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4" />مسؤول (Admin)</h4>
                <p className="text-sm text-muted-foreground mt-1">إدارة المستخدمين والعملاء، الموافقة على الحسابات الجديدة</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4" />عميل (Client)</h4>
                <p className="text-sm text-muted-foreground mt-1">إدارة العملاء المحتملين والمواعيد الخاصة به فقط</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}