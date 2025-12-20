import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings as SettingsIcon, Database, Shield, Bell } from 'lucide-react';

export default function Settings() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">إعدادات النظام</h1>
          <p className="text-muted-foreground">إدارة إعدادات النظام العامة</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><SettingsIcon className="h-5 w-5" />الإعدادات العامة</CardTitle>
              <CardDescription>إعدادات التطبيق الأساسية</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">سيتم إضافة المزيد من الإعدادات قريباً</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />قاعدة البيانات</CardTitle>
              <CardDescription>إدارة البيانات والنسخ الاحتياطي</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">سيتم إضافة أدوات النسخ الاحتياطي قريباً</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />الأمان</CardTitle>
              <CardDescription>إعدادات الأمان والخصوصية</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">سيتم إضافة إعدادات الأمان قريباً</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />الإشعارات</CardTitle>
              <CardDescription>إعدادات الإشعارات والتنبيهات</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">سيتم إضافة إعدادات الإشعارات قريباً</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}