import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Phone, Calendar, MessageSquare, Zap, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { hapticLight } from '@/lib/haptics';
import { cn } from '@/lib/utils';

interface QuickActionProps {
    icon: any;
    title: string;
    description: string;
    onClick: () => void;
    color: string;
    variant?: 'default' | 'outline' | 'secondary' | 'ghost';
}

function QuickAction({ icon: Icon, title, description, onClick, color, variant = 'outline' }: QuickActionProps) {
    return (
        <Button
            variant={variant}
            className={cn(
                "h-auto flex-col items-start gap-2 p-6 transition-all hover:shadow-lg active:scale-[0.98] border-2",
                "group relative overflow-hidden",
                color
            )}
            onClick={onClick}
        >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background/50 backdrop-blur-sm group-hover:scale-110 transition-transform">
                <Icon className="h-6 w-6" />
            </div>
            <div className="text-right w-full">
                <h3 className="font-bold text-lg">{title}</h3>
                <p className="text-xs text-muted-foreground font-normal opacity-70">{description}</p>
            </div>
            <div className="absolute top-2 left-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Zap className="h-12 w-12" />
            </div>
        </Button>
    );
}

export function ClientQuickHub() {
    const navigate = useNavigate();

    const actions = [
        {
            icon: Users,
            title: 'مشاهدة العملاء',
            description: 'متابعة حالة جميع العملاء في النظام',
            onClick: () => { hapticLight(); navigate('/leads'); },
            color: 'border-blue-500/20 hover:bg-blue-500/5 text-blue-600 dark:text-blue-400',
        },
        {
            icon: Calendar,
            title: 'المواعيد القادمة',
            description: 'عرض ومتابعة جدول المواعيد',
            onClick: () => { hapticLight(); navigate('/appointments'); },
            color: 'border-purple-500/20 hover:bg-purple-500/5 text-purple-600 dark:text-purple-400',
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">المهام السريعة</h2>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                    اطلب المساعدة <Search className="h-3 w-3" />
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
                {actions.map((action, index) => (
                    <QuickAction key={index} {...action} />
                ))}
            </div>

            <Card className="bg-primary/5 border-primary/20 overflow-hidden relative">
                <CardContent className="p-8">
                    <div className="max-w-md space-y-4">
                        <h3 className="text-xl font-bold text-primary">هل تحتاج مساعدة</h3>
                        <p className="text-muted-foreground leading-relaxed">
                            يمكنكم التواصل معنا مباشرة عبر الواتساب للحصول على الدعم الفني أو الاستفسار عن أي ميزة.
                        </p>
                        <Button
                            onClick={() => { hapticLight(); window.open('https://wa.me/218914180440', '_blank'); }}
                            variant="default"
                            className="font-semibold px-6 bg-green-600 hover:bg-green-700 text-white border-none"
                        >
                            واتساب
                        </Button>
                    </div>
                    <div className="absolute -bottom-10 -left-10 opacity-10 rotate-12">
                        <Zap className="h-64 w-64 text-primary" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
