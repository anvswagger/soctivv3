import { ArrowLeft, Calendar, MessageSquare, TrendingUp, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import soctivLogo from '@/assets/soctiv-logo.jpeg';

const features = [
  {
    icon: Users,
    title: 'إدارة العملاء',
    description: 'تتبع وإدارة جميع العملاء المحتملين بسهولة',
  },
  {
    icon: Calendar,
    title: 'جدولة المواعيد',
    description: 'نظام متكامل لإدارة وتنظيم المواعيد',
  },
  {
    icon: MessageSquare,
    title: 'رسائل SMS',
    description: 'إرسال رسائل نصية مباشرة للعملاء',
  },
  {
    icon: TrendingUp,
    title: 'تقارير وإحصائيات',
    description: 'تحليلات شاملة لمتابعة الأداء',
  },
];

const Index = () => {

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-primary opacity-5" />
        <div className="container mx-auto px-4 py-20 lg:py-32">
          <div className="text-center max-w-3xl mx-auto space-y-8">
            <img 
              src={soctivLogo} 
              alt="سوكتيف" 
              className="w-24 h-24 rounded-2xl shadow-soft animate-scale-in object-contain mx-auto"
            />
            
            <h1 className="text-4xl lg:text-6xl font-heading font-bold text-foreground animate-fade-in">
              سوكتيف
              <span className="text-primary"> لإدارة العملاء</span>
            </h1>
            
            <p className="text-lg lg:text-xl text-muted-foreground animate-fade-in">
              منصة احترافية لإدارة العملاء المحتملين والمواعيد والتواصل عبر الرسائل النصية بكل سهولة وفعالية
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
              <a href="/auth?tab=signup">
                <Button size="lg" className="gap-2 text-lg px-8 shadow-soft w-full">
                  إنشاء حساب
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </a>
              <a href="/auth?tab=login">
                <Button variant="outline" size="lg" className="text-lg px-8 w-full">
                  تسجيل الدخول
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-heading font-bold mb-4">
              كل ما تحتاجه في مكان واحد
            </h2>
            <p className="text-muted-foreground text-lg">
              أدوات متقدمة لإدارة أعمالك بكفاءة عالية
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="border-0 shadow-soft hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="h-7 w-7 text-accent-foreground" />
                  </div>
                  <h3 className="font-heading font-bold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Trust Section */}
      <div className="py-16 container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-6 w-6 text-success" />
            <span className="text-sm font-medium text-success">آمن وموثوق</span>
          </div>
          <p className="text-muted-foreground">
            بياناتك محمية بأعلى معايير الأمان. نستخدم تشفيراً متقدماً لحماية جميع معلوماتك.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          © {new Date().getFullYear()} سوكتيف. جميع الحقوق محفوظة.
        </div>
      </footer>
    </div>
  );
};

export default Index;
