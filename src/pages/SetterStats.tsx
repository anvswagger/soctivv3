import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SetterStats() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">إحصائيات الأداء</h1>
          <p className="text-muted-foreground">تتبع أداء فريق المبيعات</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>قريباً</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              هذه الصفحة قيد التطوير وستكون متاحة قريباً.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
