import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LayoutTemplate, Edit, Trash2, Loader2, ExternalLink } from 'lucide-react';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/EmptyState';

export default function LandingPages() {
    const { client, isAdmin } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: landingPages = [], isLoading } = useQuery({
        queryKey: ['landing_pages', isAdmin ? 'all' : client?.id],
        queryFn: async () => {
            let query = supabase
                .from('landing_pages')
                .select('*, products(name)')
                .order('created_at', { ascending: false });

            if (!isAdmin && client?.id) {
                query = query.eq('client_id', client.id);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('landing_pages').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['landing_pages'] });
            toast({ title: 'تم الحذف', description: 'تم حذف صفحة الهبوط بنجاح' });
        },
        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            toast({ title: 'خطأ', description: message || 'فشل في حذف صفحة الهبوط', variant: 'destructive' });
        },
    });

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-heading font-bold">صفحات الهبوط</h1>
                        <p className="text-muted-foreground">إدارة صفحات الهبوط لمنتجاتك</p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : landingPages.length === 0 ? (
                            <EmptyState
                                icon={LayoutTemplate}
                                title="لا توجد صفحات هبوط حتى الآن"
                                description="انتقل إلى صفحة المنتجات (Product DNA) لإنشاء صفحة هبوط جديدة."
                                action={
                                    <Button onClick={() => navigate('/products')}>
                                        الذهاب للمنتجات
                                    </Button>
                                }
                            />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-right">العنوان</TableHead>
                                        <TableHead className="text-right">المنتج</TableHead>
                                        <TableHead className="text-right">النطاق الفرعي</TableHead>
                                        <TableHead className="text-right">الحالة</TableHead>
                                        <TableHead className="text-right">الإجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {landingPages.map((page) => (
                                        <TableRow key={page.id}>
                                            <TableCell className="font-medium">{page.title}</TableCell>
                                            <TableCell>{page.products?.name || '-'}</TableCell>
                                            <TableCell>
                                                {page.subdomain ? (
                                                    <a href={`http://${page.subdomain}.soctiv.ly`} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                                        {page.subdomain}.soctiv.ly <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                ) : page.custom_domain ? (
                                                    <a href={`http://${page.custom_domain}`} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                                        {page.custom_domain} <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={page.status === 'published' ? 'default' : 'secondary'}>
                                                    {page.status === 'published' ? 'منشور' : 'مسودة'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => navigate(`/landing-pages/${page.id}/edit`)}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(page.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
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
        </DashboardLayout>
    );
}
