/**
 * WebhookEditor — webhook URL for the order POST.
 *
 * client_code and product_code are auto-stamped at publish time from the
 * `clients.webhook_code` and `products.code` rows. The user only needs to
 * configure the URL itself (defaults to the existing facebook-leads-webhook).
 */
import { Field } from '../fields';
import type { SoctivLandingConfig } from '@/types/soctivLandingConfig';

export function WebhookEditor({
    config,
    onChange,
}: {
    config: SoctivLandingConfig;
    onChange: (next: SoctivLandingConfig) => void;
}) {
    const w = config.webhook;
    const set = (patch: Partial<SoctivLandingConfig['webhook']>) =>
        onChange({ ...config, webhook: { ...w, ...patch } });

    return (
        <div className="space-y-3">
            <Field
                label="رابط الـ Webhook"
                value={w.url}
                onChange={(e) => set({ url: e.target.value })}
                dir="ltr"
                placeholder="https://<project>.functions.supabase.co/facebook-leads-webhook"
                hint="يتلقى طلب العميل (الاسم، الهاتف، الكمية، العنوان...)"
            />
            <div className="grid grid-cols-2 gap-2">
                <Field
                    label="مصدر الطلب (notes)"
                    value={w.source}
                    onChange={(e) => set({ source: e.target.value })}
                    placeholder="Landing Page"
                />
                <Field
                    label="ملف صفحة الشكر"
                    value={w.thankYouUrl}
                    onChange={(e) => set({ thankYouUrl: e.target.value })}
                    dir="ltr"
                    placeholder="thank-you.html"
                />
            </div>
            <p className="text-xs text-muted-foreground">
                client_code و product_code يُحفران تلقائيًا من بيانات العميل والمنتج
                عند النشر إلى Netlify (لا تحتاج إلى ضبطهما يدويًا).
            </p>
        </div>
    );
}
