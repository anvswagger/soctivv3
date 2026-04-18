import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';

const routeMapping: Record<string, { ar: string; en: string; path?: string }> = {
  dashboard: { ar: 'لوحة التحكم', en: 'Dashboard', path: '/dashboard' },
  orders: { ar: 'الطلبات', en: 'Orders', path: '/dashboard/orders' },
  'confirmed-orders': { ar: 'الطلبات المؤكدة', en: 'Confirmed Orders', path: '/dashboard/confirmed-orders' },
  products: { ar: 'المنتجات', en: 'Products', path: '/dashboard/products' },
  clients: { ar: 'العملاء', en: 'Clients', path: '/dashboard/clients' },
  appointments: { ar: 'المواعيد', en: 'Appointments', path: '/dashboard/appointments' },
  reports: { ar: 'التقارير', en: 'Reports', path: '/dashboard/reports' },
  settings: { ar: 'الإعدادات', en: 'Settings', path: '/dashboard/settings' },
  users: { ar: 'المستخدمين', en: 'Users', path: '/dashboard/users' },
  library: { ar: 'المكتبة', en: 'Library', path: '/dashboard/library' },
  notifications: { ar: 'الإشعارات', en: 'Notifications', path: '/dashboard/notifications' },
  sms: { ar: 'الرسائل النصية', en: 'SMS', path: '/dashboard/sms' },
  'setter-stats': { ar: 'إحصائيات المبيعات', en: 'Setter Stats', path: '/dashboard/setter-stats' },
  'webhook-settings': { ar: 'إعدادات الويبهوك', en: 'Webhook Settings', path: '/dashboard/webhook-settings' },
  'admin-permissions': { ar: 'صلاحيات المدير', en: 'Admin Permissions', path: '/dashboard/admin-permissions' },
  'pending-approval': { ar: 'الطلبات المعلقة', en: 'Pending Approval', path: '/dashboard/pending-approval' },
  'product-onboarding': { ar: 'إضافة منتج', en: 'Product Onboarding' },
  'focus-mode': { ar: 'وضع التركيز', en: 'Focus Mode' },
};

export function Breadcrumbs() {
  const location = useLocation();
  const params = useParams();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const breadcrumbs = useMemo(() => {
    const pathSegments = location.pathname
      .split('/')
      .filter(Boolean)
      .filter(segment => segment !== 'dashboard' || location.pathname !== '/dashboard');

    // Always start with Dashboard
    const crumbs: Array<{ label: string; path: string; isCurrent: boolean }> = [
      {
        label: routeMapping.dashboard[isRTL ? 'ar' : 'en'],
        path: '/dashboard',
        isCurrent: location.pathname === '/dashboard',
      },
    ];

    let accumulatedPath = '/dashboard';

    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      accumulatedPath += `/${segment}`;

      // Check if it's an ID param
      if (params[segment] || /^\d+$/.test(segment) || segment.length > 20) {
        // This is a dynamic ID segment - get parent label
        const parentSegment = pathSegments[i - 1];
        const parentLabel = routeMapping[parentSegment]?.[isRTL ? 'ar' : 'en'] || parentSegment;
        crumbs.push({
          label: isRTL ? `تفاصيل ${parentLabel}` : `${parentLabel} Details`,
          path: accumulatedPath,
          isCurrent: true,
        });
        continue;
      }

      const routeInfo = routeMapping[segment];
      if (routeInfo) {
        crumbs.push({
          label: routeInfo[isRTL ? 'ar' : 'en'],
          path: routeInfo.path || accumulatedPath,
          isCurrent: i === pathSegments.length - 1,
        });
      }
    }

    return crumbs;
  }, [location.pathname, params, isRTL]);

  // Don't render breadcrumbs on dashboard home
  if (breadcrumbs.length <= 1) return null;

  return (
    <Breadcrumb className="mb-4 px-1" aria-label="مسار التنقل">
      <BreadcrumbList className={cn(isRTL && 'flex-row-reverse')}>
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <div key={crumb.path} className="inline-flex items-center">
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="font-medium">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      to={crumb.path}
                      className="hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm px-1"
                      aria-label={`الذهاب إلى ${crumb.label}`}
                    >
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>

              {!isLast && (
                <BreadcrumbSeparator>
                  {isRTL ? (
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  )}
                </BreadcrumbSeparator>
              )}
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
