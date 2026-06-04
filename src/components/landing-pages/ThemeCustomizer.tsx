/**
 * Theme Customizer
 *
 * Color and font pickers for customizing landing page appearance.
 * Used in the editor sidebar.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LandingPageTheme } from "@/types/landingPage";

interface ThemeCustomizerProps {
    theme: LandingPageTheme;
    onChange: (theme: LandingPageTheme) => void;
}

const FONT_OPTIONS = [
    { value: "Inter", label: "Inter" },
    { value: "Cairo", label: "Cairo (عربي)" },
    { value: "Tajawal", label: "Tajawal (عربي)" },
    { value: "Noto Sans Arabic", label: "Noto Sans Arabic" },
    { value: "IBM Plex Sans Arabic", label: "IBM Plex Sans Arabic" },
    { value: "system-ui", label: "System Default" },
];

const BORDER_RADIUS_OPTIONS = [
    { value: "0px", label: "مربع" },
    { value: "4px", label: "轻微" },
    { value: "8px", label: "دائري" },
    { value: "12px", label: "دائري أكثر" },
    { value: "16px", label: "دائري جداً" },
    { value: "9999px", label: "كبسولة" },
];

function ColorField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="space-y-2">
            <Label className="text-sm">{label}</Label>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer p-0"
                />
                <Input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="font-mono text-xs flex-1"
                    dir="ltr"
                />
            </div>
        </div>
    );
}

export function ThemeCustomizer({ theme, onChange }: ThemeCustomizerProps) {
    const update = (key: keyof LandingPageTheme, value: string) => {
        onChange({ ...theme, [key]: value });
    };

    return (
        <div className="space-y-5">
            <h3 className="font-semibold text-lg">الألوان والتصميم</h3>

            <ColorField
                label="اللون الأساسي"
                value={theme.primaryColor}
                onChange={(v) => update("primaryColor", v)}
            />
            <ColorField
                label="اللون الثانوي"
                value={theme.secondaryColor}
                onChange={(v) => update("secondaryColor", v)}
            />
            <ColorField
                label="لون التمييز"
                value={theme.accentColor}
                onChange={(v) => update("accentColor", v)}
            />
            <ColorField
                label="لون الخلفية"
                value={theme.backgroundColor}
                onChange={(v) => update("backgroundColor", v)}
            />
            <ColorField
                label="لون النص"
                value={theme.textColor}
                onChange={(v) => update("textColor", v)}
            />

            <div className="space-y-2">
                <Label className="text-sm">خط العناوين</Label>
                <Select
                    value={theme.headingFont}
                    onValueChange={(v) => update("headingFont", v)}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {FONT_OPTIONS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                                {f.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label className="text-sm">خط النص</Label>
                <Select
                    value={theme.bodyFont}
                    onValueChange={(v) => update("bodyFont", v)}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {FONT_OPTIONS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                                {f.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label className="text-sm">شكل الحواف</Label>
                <Select
                    value={theme.borderRadius}
                    onValueChange={(v) => update("borderRadius", v)}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {BORDER_RADIUS_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                                {r.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}