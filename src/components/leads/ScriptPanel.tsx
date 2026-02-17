import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, FileText, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ScriptPanelProps {
    clientId?: string;
}

export function ScriptPanel({ clientId }: ScriptPanelProps) {
    const { toast } = useToast();
    const [vaultItems, setVaultItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function fetchScripts() {
            if (!clientId) return;
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('vault_items')
                    .select('*')
                    .eq('client_id', clientId)
                    .order('is_favorite', { ascending: false });

                if (error) throw error;
                setVaultItems(data || []);
            } catch (error) {
                console.error('Error fetching scripts:', error);
                toast({
                    title: 'خطأ',
                    description: 'فشل في تحميل السكربتات. يرجى المحاولة مرة أخرى.',
                    variant: 'destructive'
                });
            } finally {
                setLoading(false);
            }
        }

        fetchScripts();
    }, [clientId]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: "تم النسخ",
            description: "تم نسخ النص إلى الحافظة",
        });
    };

    if (loading) {
        return (
            <Card className="h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </Card>
        );
    }

    return (
        <Card className="h-full border-none shadow-none flex flex-col bg-transparent">
            <CardHeader className="px-0 pt-0">
                <CardTitle className="flex items-center gap-2 text-xl">
                    <FileText className="h-5 w-5 text-primary" />
                    سكربت البيع والمواد المرجعية
                </CardTitle>
                <CardDescription>استخدم هذه المواد لمساعدتك في المكالمة</CardDescription>
            </CardHeader>
            <CardContent className="px-0 flex-1 overflow-hidden">
                {vaultItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                        <Sparkles className="h-8 w-8 opacity-20" />
                        <p>لا يوجد سكربتات مسجلة لهذا العميل</p>
                    </div>
                ) : (
                    <ScrollArea className="h-full pr-4" dir="rtl">
                        <div className="space-y-4">
                            {vaultItems.map((item) => (
                                <Card key={item.id} className="border bg-card/50">
                                    <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between space-y-0">
                                        <div>
                                            <CardTitle className="text-sm font-semibold">{item.title}</CardTitle>
                                            <p className="text-[10px] text-muted-foreground">{item.category}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => copyToClipboard(item.content)}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </CardHeader>
                                    <CardContent className="p-3 pt-0">
                                        <p className="text-sm whitespace-pre-wrap text-foreground/80 leading-relaxed">
                                            {item.content}
                                        </p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
