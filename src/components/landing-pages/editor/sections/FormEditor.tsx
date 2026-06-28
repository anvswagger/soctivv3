/**
 * FormEditor — single-step order form labels + submit button text.
 *
 * Minimal surface. Phone regex, name/location min lengths, and the
 * "submitting…" copy are not exposed — they have market defaults baked
 * into `buildDefaultSoctivConfig` and never need to change. If a client
 * ever needs to customize them, we can re-surface as a power-user toggle.
 */
import { Field } from '../fields';
import type { SoctivLandingConfig } from '@/types/soctivLandingConfig';

export function FormEditor({
    config,
    onChange,
}: {
    config: SoctivLandingConfig;
    onChange: (next: SoctivLandingConfig) => void;
}) {
    const f = config.form;
    const set = (patch: Partial<SoctivLandingConfig['form']>) =>
        onChange({ ...config, form: { ...f, ...patch } });

    return (
        <div className="space-y-3">
            <Field
                label="نص زر الإرسال"
                value={f.submitText}
                onChange={(e) => set({ submitText: e.target.value })}
            />
            <Field
                label="تسمية الاسم"
                value={f.nameField}
                onChange={(e) => set({ nameField: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
                <Field
                    label="تسمية الهاتف"
                    value={f.phoneField}
                    onChange={(e) => set({ phoneField: e.target.value })}
                />
                <Field
                    label="placeholder الهاتف"
                    value={f.phonePlaceholder}
                    onChange={(e) => set({ phonePlaceholder: e.target.value })}
                    dir="ltr"
                />
            </div>
            <Field
                label="تسمية العنوان"
                value={f.locationField}
                onChange={(e) => set({ locationField: e.target.value })}
            />
        </div>
    );
}