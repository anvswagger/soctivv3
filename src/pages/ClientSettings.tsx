import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Copy, RefreshCw, Settings, Building2, User, Webhook, Loader2 } from 'lucide-react';

const db = supabase as any;

export default function ClientSettings() {
  const { client, profile, refreshUserData } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [webhookCode, setWebhookCode] = useState('');

  useEffect(() => {
    if (client) {
      fetchWebhookCode();
    }
  }, [client]);

  const fetchWebhookCode = async () => {
    if (!client?.id) return;
    const { data } = await db.from('clients').select('webhook_code').eq('id', client.id).single();
    if (data) setWebhookCode(data.webhook_code);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'تم النسخ', description: `تم نسخ ${label}` });
  };

  const regenerateWebhookCode = async () => {
    if (!client?.id) return;
    setLoading(true);
    
    // Generate new random code
    const newCode = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
    
    const { error } = await db.from('clients').update({ webhook_code: newCode }).eq('id', client.id);
    
    if (error) {
      toast({ title: 'خطأ', description: 'فشل في تجديد الرمز', variant: 'destructive' });
    } else {
      setWebhookCode(newCode);
      toast({ title: 'تم التجديد', description: 'تم تجديد رمز Webhook بنجاح' });
    }
    setLoading(false);
  };

  const webhookUrl = `https://yplbixiwtxhaeohombcf.supabase.co/functions/v1/facebook-leads-webhook`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">الإعدادات</h1>
          <p className="text-muted-foreground">إدارة إعدادات حسابك</p>
        </div>

        {/* Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              المعلومات الشخصية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input value={profile?.full_name || ''} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>رقم الهاتف</Label>
                <Input value={profile?.phone || ''} readOnly className="bg-muted" dir="ltr" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              معلومات الشركة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>اسم الشركة</Label>
                <Input value={client?.company_name || ''} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>القطاع</Label>
                <Input value={client?.industry || '-'} readOnly className="bg-muted" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              إعدادات Webhook
            </CardTitle>
            <CardDescription>
              استخدم هذه الإعدادات لربط نظامك مع Facebook Lead Ads عبر Make.com
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>رمز العميل (Client Code)</Label>
              <div className="flex gap-2">
                <Input value={webhookCode} readOnly className="font-mono bg-muted" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookCode, 'رمز العميل')}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={regenerateWebhookCode} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>رابط Webhook</Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="font-mono text-sm bg-muted" dir="ltr" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrl, 'رابط Webhook')}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">تعليمات الإعداد في Make.com:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>أنشئ سيناريو جديد في Make.com</li>
                <li>أضف وحدة Facebook Lead Ads كمحفز</li>
                <li>أضف وحدة HTTP Request</li>
                <li>اختر Method: POST</li>
                <li>الصق رابط Webhook في حقل URL</li>
                <li>أضف Headers: Content-Type = application/json</li>
                <li>في Body، أرسل JSON بالشكل التالي:</li>
              </ol>
              <pre className="bg-background p-3 rounded text-xs overflow-x-auto" dir="ltr">
{`{
  "client_code": "${webhookCode || 'YOUR_CLIENT_CODE'}",
  "first_name": "{{firstName}}",
  "last_name": "{{lastName}}",
  "email": "{{email}}",
  "phone": "{{phone}}",
  "source": "Facebook Lead Ads"
}`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
