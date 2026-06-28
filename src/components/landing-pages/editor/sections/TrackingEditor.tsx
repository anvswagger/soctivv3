/**
 * TrackingEditor — Meta Pixel + CAPI configuration.
 *
 * Re-scoped for the Soctiv HTML's pixel.js / sha256.js stack:
 *   - pixelId: digits-only Meta Pixel ID
 *   - capiUrl: where pixel.js forwards events (defaults to Supabase capi-proxy)
 *   - testEventCode: optional, for Events Manager Test Events
 *   - debug: verbose console logging in pixel.js
 */
import { Field } from '../fields';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { SoctivLandingConfig } from '@/types/soctivLandingConfig';

export function TrackingEditor({
    config,
    onChange,
}: {
    config: SoctivLandingConfig;
    onChange: (next: SoctivLandingConfig) => void;
}) {
    const t = config.tracking;
    const set = (patch: Partial<SoctivLandingConfig['tracking']>) =>
        onChange({ ...config, tracking: { ...t, ...patch } });

    const enabled = !!t.pixelId;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                    <Label className="text-xs">تفعيل Meta Pixel + CAPI</Label>
                    <p className="text-xs text-muted-foreground">
                        تتبّع PageView وViewContent وLead وPurchase عبر المتصفح والخادم
                    </p>
                </div>
                <Switch
                    checked={enabled}
                    onCheckedChange={(v) => {
                        if (!v) set({ pixelId: '' });
                    }}
                />
            </div>
            <Field
                label="معرّف Meta Pixel"
                value={t.pixelId}
                onChange={(e) => set({ pixelId: e.target.value.replace(/\D/g, '') })}
                dir="ltr"
                placeholder="1234567890"
                hint="من Events Manager → Data Sources → Pixel ID"
                disabled={!enabled}
            />
            <Field
                label="رابط CAPI"
                value={t.capiUrl}
                onChange={(e) => set({ capiUrl: e.target.value })}
                dir="ltr"
                placeholder="https://<project>.supabase.co/functions/v1/capi-proxy"
                hint="نقطة نهاية Conversion API. اتركه فارغًا لاستخدام الافتراضي."
                disabled={!enabled}
            />
            <Field
                label="كود اختبار (Test Event Code)"
                value={t.testEventCode}
                onChange={(e) => set({ testEventCode: e.target.value })}
                dir="ltr"
                placeholder="TEST12345"
                hint="من Events Manager → Test Events. اتركه فارغًا في الإنتاج."
                disabled={!enabled}
            />
            <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                    <Label className="text-xs">وضع Debug</Label>
                    <p className="text-xs text-muted-foreground">
                        console.log مفصّل لكل حدث
                    </p>
                </div>
                <Switch
                    checked={t.debug}
                    onCheckedChange={(v) => set({ debug: v })}
                    disabled={!enabled}
                />
            </div>
        </div>
    );
}
