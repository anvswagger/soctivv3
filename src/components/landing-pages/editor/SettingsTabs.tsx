/**
 * SettingsTabs — the right-side settings panel of the editor.
 *
 * Four logical tabs that group the 10 editable sections:
 *
 *   Content       → Hero, Pricing, Form, Objections  (Hero open, others collapsed)
 *   Design        → Theme                             (open)
 *   Credibility   → Reviews, Trust Strip              (both open)
 *   Setup         → SEO, Tracking (Pixel+CAPI), Webhook (all collapsed)
 *
 * Each tab uses `SectionPanel` (replaces the old `SectionCard`) — clicking
 * the sparkle icon opens an inline guidance input instead of the old
 * `window.prompt`.
 */
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    FileText,
    Palette,
    ShieldCheck,
    Settings as SettingsIcon,
} from 'lucide-react';
import { SectionPanel } from './sections/SectionPanel';
import { HeroEditor } from './sections/HeroEditor';
import { PricingTiersEditor } from './sections/PricingTiersEditor';
import { FormEditor } from './sections/FormEditor';
import { ObjectionsEditor } from './sections/ObjectionsEditor';
import { ReviewsEditor } from './sections/ReviewsEditor';
import { TrustEditor } from './sections/TrustEditor';
import { SeoEditor } from './sections/SeoEditor';
import { ThemeEditor } from './sections/ThemeEditor';
import { TrackingEditor } from './sections/TrackingEditor';
import { WebhookEditor } from './sections/WebhookEditor';
import { DomainEditor } from './sections/DomainEditor';
import type {
    SoctivLandingConfig,
    SoctivSectionKey,
} from '@/types/soctivLandingConfig';
import { cn } from '@/lib/utils';

export type SettingsTabId = 'content' | 'trust' | 'design' | 'setup';

export interface DomainEditorSectionProps {
    subdomain: string | null;
    customDomain: string | null;
    isPublished: boolean;
    saving?: boolean;
    onSaveDomain: (next: { subdomain: string; customDomain: string }) => Promise<void> | void;
}

const TABS: {
    id: SettingsTabId;
    label: string;
    Icon: typeof FileText;
}[] = [
    { id: 'content', label: 'المحتوى', Icon: FileText },
    { id: 'design', label: 'التصميم', Icon: Palette },
    { id: 'trust', label: 'المصداقية', Icon: ShieldCheck },
    { id: 'setup', label: 'الإعدادات', Icon: SettingsIcon },
];

interface SettingsTabsProps {
    config: SoctivLandingConfig;
    onChange: (next: SoctivLandingConfig) => void;
    /** Section keys currently being regenerated. */
    regeneratingSection: SoctivSectionKey | null;
    /** Callback when user submits a regenerate with optional guidance. */
    onRegenerate: (sectionKey: SoctivSectionKey, guidance: string) => Promise<void>;
    defaultTab?: SettingsTabId;
    className?: string;
    /** Phase 6: domain props passed straight through to the Setup tab
     *  DomainEditor. Optional — when omitted the Setup tab simply hides
     *  the Domain section (so this component stays usable for read-only
     *  previews / PreviewPage). */
    domain?: DomainEditorSectionProps;
}

export function SettingsTabs({
    config,
    onChange,
    regeneratingSection,
    onRegenerate,
    defaultTab = 'content',
    className,
    domain,
}: SettingsTabsProps) {
    const [tab, setTab] = useState<SettingsTabId>(defaultTab);

    return (
        <div className={cn('flex flex-col h-full bg-card/40 backdrop-blur-sm', className)}>
            <Tabs
                value={tab}
                onValueChange={(v) => setTab(v as SettingsTabId)}
                className="flex flex-col h-full"
            >
                {/* Sidebar header — small title so the panel reads as
                    "إعدادات الصفحة" at a glance. */}
                <div className="px-4 pt-4 pb-2 border-b border-border bg-card/60 backdrop-blur">
                    <h2 className="text-sm font-semibold text-foreground tracking-tight">
                        إعدادات الصفحة
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        اكتب المحتوى، اختر التصميم، ثم اربط التتبع.
                    </p>
                </div>

                {/* Tab strip — sticky, breathable, no count badges. */}
                <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-3 pt-3">
                    <TabsList className="w-full grid grid-cols-4 h-12 bg-muted/50 p-1 gap-1 rounded-xl">
                        {TABS.map(({ id, label, Icon }) => (
                            <TabsTrigger
                                key={id}
                                value={id}
                                className={cn(
                                    'h-full text-xs font-semibold gap-1.5 px-2 rounded-lg',
                                    'text-muted-foreground',
                                    'hover:text-foreground hover:bg-background/60',
                                    'data-[state=active]:bg-background',
                                    'data-[state=active]:text-foreground',
                                    'data-[state=active]:shadow-sm',
                                    'data-[state=active]:ring-1 data-[state=active]:ring-border',
                                    'transition-all'
                                )}
                            >
                                <Icon className="h-4 w-4 shrink-0" />
                                <span className="truncate">{label}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                {/* Tab content — scrollable */}
                <div className="flex-1 overflow-y-auto">
                    <TabsContent value="content" className="m-0 p-3 space-y-3">
                        <SectionPanel
                            title="البطل"
                            description="العنوان والوصف والزر"
                            regenerable
                            regenerating={regeneratingSection === 'hero'}
                            onRegenerate={(g) => onRegenerate('hero', g)}
                        >
                            <HeroEditor config={config} onChange={onChange} />
                        </SectionPanel>

                        <SectionPanel
                            title="مستويات السعر"
                            description="الكمية والتسمية والسعر"
                            regenerable
                            regenerating={regeneratingSection === 'pricing'}
                            onRegenerate={(g) => onRegenerate('pricing', g)}
                            defaultOpen={false}
                        >
                            <PricingTiersEditor config={config} onChange={onChange} />
                        </SectionPanel>

                        <SectionPanel
                            title="نموذج الطلب"
                            description="عناوين الحقول ونص الزر"
                            regenerable
                            regenerating={regeneratingSection === 'form'}
                            onRegenerate={(g) => onRegenerate('form', g)}
                            defaultOpen={false}
                        >
                            <FormEditor config={config} onChange={onChange} />
                        </SectionPanel>

                        <SectionPanel
                            title="الاعتراضات"
                            description="أسئلة شائعة وإجاباتها"
                            regenerable
                            regenerating={regeneratingSection === 'objections'}
                            onRegenerate={(g) => onRegenerate('objections', g)}
                            defaultOpen={false}
                        >
                            <ObjectionsEditor config={config} onChange={onChange} />
                        </SectionPanel>
                    </TabsContent>

                    <TabsContent value="design" className="m-0 p-3 space-y-3">
                        <SectionPanel
                            title="التصميم"
                            description="لوحة ألوان + عائلة الخط"
                        >
                            <ThemeEditor config={config} onChange={onChange} />
                        </SectionPanel>
                    </TabsContent>

                    <TabsContent value="trust" className="m-0 p-3 space-y-3">
                        <SectionPanel
                            title="آراء العملاء"
                            description="3 تقييمات · مفتاح الإظهار"
                            regenerable
                            regenerating={regeneratingSection === 'reviews'}
                            onRegenerate={(g) => onRegenerate('reviews', g)}
                        >
                            <ReviewsEditor config={config} onChange={onChange} />
                        </SectionPanel>

                        <SectionPanel
                            title="شارات الثقة"
                            description="شارات أعلى وأسفل النموذج · مفتاحان"
                            regenerable
                            regenerating={regeneratingSection === 'trust'}
                            onRegenerate={(g) => onRegenerate('trust', g)}
                        >
                            <TrustEditor config={config} onChange={onChange} />
                        </SectionPanel>
                    </TabsContent>

                    <TabsContent value="setup" className="m-0 p-3 space-y-3">
                        {/* Phase 6: domain management sits at the TOP of Setup
                            because it's the most consequential hosting decision
                            the user makes. Hidden when domain props aren't
                            passed (read-only PreviewPage). */}
                        {domain && (
                            <SectionPanel
                                title="النطاق"
                                description="نطاق فرعي أو نطاق مخصص"
                                compact
                            >
                                <DomainEditor
                                    subdomain={domain.subdomain}
                                    customDomain={domain.customDomain}
                                    isPublished={domain.isPublished}
                                    saving={domain.saving}
                                    onSaveDomain={domain.onSaveDomain}
                                />
                            </SectionPanel>
                        )}

                        <SectionPanel
                            title="SEO"
                            description="البحث والمشاركة"
                            regenerable
                            regenerating={regeneratingSection === 'seo'}
                            onRegenerate={(g) => onRegenerate('seo', g)}
                            compact
                            defaultOpen={false}
                        >
                            <SeoEditor config={config} onChange={onChange} />
                        </SectionPanel>

                        <SectionPanel
                            title="التتبع"
                            description="Meta Pixel + CAPI"
                            compact
                            defaultOpen={false}
                        >
                            <TrackingEditor config={config} onChange={onChange} />
                        </SectionPanel>

                        <SectionPanel
                            title="Webhook"
                            description="رابط استقبال الطلبات"
                            compact
                            defaultOpen={false}
                        >
                            <WebhookEditor config={config} onChange={onChange} />
                        </SectionPanel>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
