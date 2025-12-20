import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Users, ArrowLeft } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8" dir="rtl">
      <div className="text-center space-y-6 max-w-md">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto">
          <Users className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-4xl font-heading font-bold">نظام إدارة العملاء المحتملين</h1>
        <p className="text-muted-foreground">منصة متكاملة لإدارة العملاء المحتملين والمواعيد والتواصل عبر الرسائل</p>
        <Button asChild size="lg" className="gap-2">
          <Link to="/auth">
            ابدأ الآن
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default Index;