/**
 * SeoEditor — SEO + Open Graph fields for the landing page.
 *
 * Promoted from the inline `SeoCardFields` inside `LandingPageEditor.tsx`.
 * Editable fields: title, description, ogImage, ogImageAlt.
 */
import { Field, TextareaField } from '../fields';
import type { SoctivLandingConfig } from '@/types/soctivLandingConfig';

export function SeoEditor({
    config,
    onChange,
}: {
    config: SoctivLandingConfig;
    onChange: (next: SoctivLandingConfig) => void;
}) {
    const s = config.seo;
    const set = (patch: Partial<SoctivLandingConfig['seo']>) =>
        onChange({ ...config, seo: { ...s, ...patch } });
    return (
        <div className="space-y-3">
            <Field
                label="عنوان SEO"
                value={s.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="50-60 حرفًا"
            />
            <TextareaField
                label="وصف SEO"
                value={s.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="150-160 حرفًا"
                rows={2}
            />
            <Field
                label="رابط صورة OG"
                value={s.ogImage}
                onChange={(e) => set({ ogImage: e.target.value })}
                dir="ltr"
                placeholder="https://..."
            />
            <Field
                label="نص بديل لصورة OG"
                value={s.ogImageAlt}
                onChange={(e) => set({ ogImageAlt: e.target.value })}
                placeholder="صورة المنتج"
            />
        </div>
    );
}
