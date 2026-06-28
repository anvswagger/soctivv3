/**
 * EditorShell — full-screen takeover layout for the landing page editor.
 *
 * Hides the app sidebar/header so the editor has the full viewport to
 * itself. Renders:
 *
 *   ┌───────────────────────────────────────────────┐
 *   │  PublishBar (sticky top, with title + Publish) │
 *   ├───────────────────────────┬───────────────────┤
 *   │                           │                   │
 *   │      SettingsTabs         │      PreviewPane  │
 *   │    (sidebar, ~440px)      │   (live iframe)   │
 *   │      (visually LEFT)      │   (visually RIGHT)│
 *   │                           │                   │
 *   └───────────────────────────┴───────────────────┘
 *
 * The wrapper keeps `dir="rtl"` so Arabic content flows correctly, but
 * the two-pane body follows the Figma / Webflow / Framer convention of
 * **settings on the LEFT, viewer on the RIGHT** — which is what users
 * expect from a builder. We achieve this by rendering `PreviewPane`
 * FIRST in the DOM, then `SettingsTabs` SECOND; the RTL flex order
 * flips them visually so the panel ends up on the left.
 *
 * Why DOM-order swap (not `flex-row-reverse`):
 *   `flex-row-reverse` would flip visually but leave DOM order reversed,
 *   breaking Tab navigation and screen-reader order. The DOM swap keeps
 *   reading order matching visual order.
 *
 * On mobile: SettingsTabs collapses to a Sheet drawer that slides in from
 * the LEFT edge (consistent with the desktop layout — the panel is on
 * the left, so the drawer comes from the left).
 */
import { useState } from 'react';
import { Settings, X } from 'lucide-react';
import { PublishBar, type AutoSaveState } from './PublishBar';
import {
    PreviewPane,
    type PreviewLeadCreatedPayload,
    type PreviewLeadFailedPayload,
} from './PreviewPane';
import { SettingsTabs, type SettingsTabId, type DomainEditorSectionProps } from './SettingsTabs';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import type {
    SoctivLandingConfig,
    SoctivSectionKey,
} from '@/types/soctivLandingConfig';

interface EditorShellProps {
    config: SoctivLandingConfig;
    onChange: (next: SoctivLandingConfig) => void;
    /** Database row fields used for status + URL display. */
    pageData?: {
        status?: string | null;
        published_url?: string | null;
    } | null;
    autoSaveState: AutoSaveState;
    onPublish: () => void;
    publishing: boolean;
    onBack: () => void;
    onRefreshPreview: () => void;
    refreshingPreview?: boolean;
    previewHtml: string;
    iframeMountKey: string;
    previewLoading?: boolean;
    onRegenerateSection: (
        sectionKey: SoctivSectionKey,
        guidance: string
    ) => Promise<void>;
    regeneratingSection: SoctivSectionKey | null;
    defaultTab?: SettingsTabId;
    /** Phase 6: optional subdomain (`my-brand` → `my-brand.soctiv.ly`) and
     *  customDomain (`shop.example.com`). Pass-through to PublishBar. */
    subdomain?: string | null;
    customDomain?: string | null;
    /** Computed external publish URL — derived from custom_domain or
     *  subdomain by the editor. Used by PublishBar to show the URL the
     *  page will live at, both before and after publish. */
    publishedBaseUrl?: string | null;
    /** Auto-derived subdomain proposal (slug of brand/product name) the
     *  user can accept with one click in the PublishBar. */
    suggestedSubdomain?: string | null;
    /** Save the accepted suggestion through the same domain mutation
     *  the DomainEditor uses, so the React Query cache invalidates and
     *  the whole editor re-renders with the new subdomain. */
    onAcceptSuggestion?: (subdomain: string) => Promise<void> | void;
    /** Phase 6: optional domain editor props for the Setup tab. When
     *  omitted, the Setup tab simply hides the Domain section. */
    domain?: DomainEditorSectionProps;
    /** Called when the in-iframe form submit succeeds. The runtime posts
     *  `soctiv:lead-created` with the lead id from the webhook response;
     *  we forward it so the parent can show a toast and (optionally)
     *  navigate to the leads pipeline. */
    onLeadCreated?: (payload: PreviewLeadCreatedPayload) => void;
    /** Called when the in-iframe form submit fails (webhook error,
     *  timeout, rate-limit). Forwards the structured failure so the parent
     *  can show a destructive toast. */
    onLeadFailed?: (payload: PreviewLeadFailedPayload) => void;
}

export function EditorShell({
    config,
    onChange,
    pageData,
    autoSaveState,
    onPublish,
    publishing,
    onBack,
    onRefreshPreview,
    refreshingPreview,
    previewHtml,
    iframeMountKey,
    previewLoading,
    onRegenerateSection,
    regeneratingSection,
    defaultTab = 'content',
    subdomain,
    customDomain,
    publishedBaseUrl,
    suggestedSubdomain,
    onAcceptSuggestion,
    domain,
    onLeadCreated,
    onLeadFailed,
}: EditorShellProps) {
    const [mobileOpen, setMobileOpen] = useState(false);

    const isPublished = pageData?.status === 'published' || pageData?.status === 'live';
    const publishedUrl = pageData?.published_url ?? null;
    const title = config.product.nameArabic || config.hero.headline || 'صفحة هبوط';

    return (
        <div
            dir="rtl"
            className="fixed inset-0 z-40 bg-background flex flex-col overflow-hidden"
        >
            <PublishBar
                title={title}
                onTitleChange={(next) =>
                    onChange({ ...config, hero: { ...config.hero, headline: next } })
                }
                isPublished={isPublished}
                publishedUrl={publishedUrl}
                publishedBaseUrl={publishedBaseUrl ?? null}
                autoSaveState={autoSaveState}
                publishing={publishing}
                onPublish={onPublish}
                onRefreshPreview={onRefreshPreview}
                refreshing={refreshingPreview}
                onBack={onBack}
                subdomain={subdomain}
                customDomain={customDomain}
                suggestedSubdomain={suggestedSubdomain ?? null}
                onAcceptSuggestion={onAcceptSuggestion}
            />

            {/* Two-pane body. We deliberately render PreviewPane FIRST and
                SettingsTabs SECOND in the DOM so the RTL flex order places
                the settings sidebar on the LEFT and the live viewer on the
                RIGHT (Figma / Webflow / Framer convention). */}
            <div className="flex-1 flex overflow-hidden">
                {/* Preview — visually RIGHT (hidden on mobile, shown on md+) */}
                <div className="hidden md:flex flex-1 min-w-0">
                    <PreviewPane
                        html={previewHtml}
                        iframeMountKey={iframeMountKey}
                        loading={previewLoading}
                        onLeadCreated={onLeadCreated}
                        onLeadFailed={onLeadFailed}
                    />
                </div>

                {/* Settings sidebar — visually LEFT (always visible on md+).
                    `border-l` is logical-start, which in RTL is the right
                    edge of the panel — i.e. the seam between the panel and
                    the preview, exactly where we want the divider. */}
                <div className="hidden md:flex w-[400px] lg:w-[440px] shrink-0 border-l border-border">
                    <SettingsTabs
                        config={config}
                        onChange={onChange}
                        regeneratingSection={regeneratingSection}
                        onRegenerate={onRegenerateSection}
                        defaultTab={defaultTab}
                        domain={domain}
                    />
                </div>

                {/* Mobile-only: preview is the default visible panel */}
                <div className="flex md:hidden flex-1 min-w-0">
                    <PreviewPane
                        html={previewHtml}
                        iframeMountKey={iframeMountKey}
                        loading={previewLoading}
                        onLeadCreated={onLeadCreated}
                        onLeadFailed={onLeadFailed}
                    />
                </div>
            </div>

            {/* Mobile: floating button to open settings drawer.
                Anchored bottom-LEFT to match the new drawer side. */}
            <div className="md:hidden fixed bottom-4 left-4 z-30">
                <Button
                    size="lg"
                    onClick={() => setMobileOpen(true)}
                    className="h-12 px-4 gap-2 shadow-xl bg-gradient-to-r from-brand-cyan to-brand-accent text-brand-darker font-bold"
                >
                    <Settings className="h-4 w-4" />
                    الإعدادات
                </Button>
            </div>

            {/* Mobile settings drawer — slides in from the LEFT edge to
                match the desktop layout (sidebar is on the left). */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetContent
                    side="left"
                    className="w-[88vw] sm:w-[420px] p-0 flex flex-col"
                >
                    <div className="flex items-center justify-between p-3 border-b border-border">
                        <SheetTitle className="text-base font-semibold">الإعدادات</SheetTitle>
                        <button
                            type="button"
                            onClick={() => setMobileOpen(false)}
                            className="p-2 rounded-md hover:bg-muted"
                            aria-label="إغلاق"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="flex-1 min-h-0">
                        <SettingsTabs
                            config={config}
                            onChange={onChange}
                            regeneratingSection={regeneratingSection}
                            onRegenerate={onRegenerateSection}
                            defaultTab={defaultTab}
                            domain={domain}
                        />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
