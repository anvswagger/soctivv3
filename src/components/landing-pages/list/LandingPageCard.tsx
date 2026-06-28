/**
 * LandingPageCard — visual card showing one landing page.
 *
 * Visual hierarchy (top → bottom):
 *   1. Top accent stripe (3px) — palette accent color, dashed for drafts,
 *      amber for legacy, muted for empty. Brand identity at a glance.
 *   2. Thumbnail (160px) — scaled iframe of the rendered page.
 *      Status pill top-right (RTL). No overlay buttons — the card body
 *      below carries every primary action.
 *   3. Body — CLIENT NAME as the headline (the list is grouped by client,
 *      so the store is the primary identifier) and PRODUCT NAME as the
 *      sub-headline. Meta row carries timestamp + status micro-badge.
 *   4. Footer action strip — two visible primary buttons:
 *        · تعديل  (Edit, opens the editor)
 *        · مراجعة (Review, opens /preview/:id in a new tab)
 *      plus a kebab carrying only true secondary actions
 *      (open the published URL when live, delete).
 *
 * Click semantics:
 *   - Thumbnail + body → editor (`<Link to={editHref}>`).
 *   - تعديل / مراجعة buttons are outside the Link and stopPropagation.
 *
 * Why drop the eye icon:
 *   The previous version had three ways to reach the preview — the eye
 *   icon on the thumbnail, the eye icon in the footer, AND the labeled
 *   "مراجعة" button. All three opened the same route, so the eye icons
 *   were duplicate affordances. Keeping one labeled button gives a single
 *   source of truth and removes visual noise.
 */
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import React from "react";
import { Check, Copy, ExternalLink, Globe, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MiniPreview } from "./MiniPreview";
import { cn } from "@/lib/utils";
import {
  SOCTIV_PALETTES,
  type SoctivLandingConfig,
} from "@/types/soctivLandingConfig";

export type LandingPageStatus = "live" | "legacy" | "draft" | "empty";

export interface LandingPageCardData {
  id: string;
  title: string;
  productName: string;
  storeName: string;
  status: LandingPageStatus;
  publishedUrl: string | null;
  /** The clean external URL of the live page — what the user shares and
   *  what the privacy link in the published footer uses as its base.
   *  Computed from (custom_domain → subdomain.soctiv.ly → published_url). */
  subdomain?: string | null;
  customDomain?: string | null;
  updatedAt: string; // ISO
  config: SoctivLandingConfig | null;
}

/**
 * Compute the EXTERNAL URL of a published page — what the user sees
 * in the browser bar and what they share. Mirrors the priority in
 * `publish-landing-page/index.ts`:
 *   custom_domain → subdomain.soctiv.ly → published_url
 *
 * Kept here so the card list can show a clean URL even if
 * `published_url` was set to the older Netlify fallback.
 */
function externalUrlFor(page: LandingPageCardData): string | null {
  if (page.customDomain) return `https://${page.customDomain}`;
  if (page.subdomain) return `https://${page.subdomain}.soctiv.ly`;
  return page.publishedUrl ? page.publishedUrl.replace(/\/+$/, '') : null;
}

interface LandingPageCardProps {
  page: LandingPageCardData;
  onDelete: (id: string) => void;
}

const STATUS_PILLS: Record<
  LandingPageStatus,
  { label: string; className: string }
> = {
  live: {
    label: "منشور",
    className:
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
  },
  draft: {
    label: "مسودة",
    className: "bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30",
  },
  legacy: {
    label: "قالب قديم",
    className:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  empty: {
    label: "لم يبدأ بعد",
    className: "bg-muted text-muted-foreground border-border",
  },
};

/** Stripe color + style per status. Falls back to palette accent when config
 *  is available; otherwise muted. */
/**
 * Small URL strip rendered below the body of a live landing-page card.
 * Click-to-copy the absolute URL — the user shares this with Meta as the
 * link in their ad, pastes it in WhatsApp, etc.
 */
function UrlStrip({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);
  const clean = url.replace(/^https?:\/\//, "");
  const copy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    } catch {
      // ignore
    }
  };
  return (
    <div
      dir="ltr"
      className="mt-2 flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1.5 text-[11px] font-mono text-foreground/85"
      onClick={(e) => e.stopPropagation()}
    >
      <Globe className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden="true" />
      <span className="truncate flex-1" title={url}>
        {clean}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label="نسخ الرابط"
        className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-500" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}

function getStripe(page: LandingPageCardData): {
  backgroundImage: string;
  backgroundColor: string;
} {
  if (page.status === "legacy") {
    return {
      backgroundImage: "none",
      backgroundColor: "#f59e0b", // amber-500
    };
  }
  if (page.status === "empty" || !page.config?.theme?.palette) {
    return {
      backgroundImage: "none",
      backgroundColor: "hsl(var(--border))",
    };
  }
  const tokens = SOCTIV_PALETTES[page.config.theme.palette];
  const accent = tokens?.["--accent"] || "#9a7e57";
  return {
    backgroundImage: "none",
    backgroundColor: accent,
  };
}

export function LandingPageCard({ page, onDelete }: LandingPageCardProps) {
  const pill = STATUS_PILLS[page.status];
  const navigate = useNavigate();
  const editHref = `/landing-pages/${page.id}/edit`;
  const previewHref = `/preview/${page.id}`;
  const externalUrl = externalUrlFor(page);
  const canPreview = !!externalUrl;
  const stripe = getStripe(page);

  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-card/70 backdrop-blur-sm overflow-hidden shadow-sm hover:shadow-card-hover hover:border-brand-cyan/40 transition-all duration-200">
      {/* Top accent stripe — 3px, full width. Visual brand identity. */}
      <div
        aria-hidden="true"
        className="h-[3px] w-full shrink-0"
        style={{
          backgroundImage: stripe.backgroundImage,
          backgroundColor: stripe.backgroundColor,
        }}
      />

      {/* Thumbnail — fixed 160px tall, scales the iframe.
                Whole thumbnail is a Link → opens the editor. Footer actions
                sit in a sibling region and stopPropagation on click. */}
      <Link
        to={editHref}
        aria-label={`افتح صفحة ${page.productName || page.title}`}
        className="relative block w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60"
        style={
          {
            height: 160,
            // Mini-preview iframe is 320 wide; scale to fit the
            // container so the rendered page fills the thumbnail.
            ["--lp-mini-scale" as any]: "var(--lp-mini-scale-160)",
          } as React.CSSProperties
        }
      >
        <MiniPreview config={page.config} />

        {/* Hover overlay — subtle "click to edit" cue */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        {/* Status pill — top-right (RTL) */}
        <span
          className={cn(
            "absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium backdrop-blur pointer-events-none",
            pill.className,
          )}
        >
          {pill.label}
        </span>
      </Link>

      {/* Body — also clickable (Link). Footer buttons below stop
                propagation so they don't double-fire the navigation. */}
      <Link
        to={editHref}
        className="flex-1 px-4 pt-3 pb-2 flex flex-col gap-1 focus-visible:outline-none focus-visible:bg-muted/30"
      >
        {/* Headline: CLIENT (store) name — primary identifier.
                    A landing-page list is a list of clients, so the store
                    name is what users scan for. */}
        <h3 className="font-heading font-bold text-base leading-snug line-clamp-1 text-foreground group-hover:text-brand-cyan transition-colors">
          {page.storeName || (
            <span className="text-muted-foreground/70 font-normal italic">
              بدون اسم متجر
            </span>
          )}
        </h3>

        {/* Sub-headline: PRODUCT name — the actual landing page topic. */}
        <p className="text-sm font-semibold text-foreground/85 line-clamp-1">
          {page.productName || page.title || (
            <span className="text-muted-foreground/70 font-normal italic">
              بدون اسم منتج
            </span>
          )}
        </p>

        {/* Meta row — relative timestamp + status micro-badge. */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground/85 mt-1">
          <span>
            {formatDistanceToNow(new Date(page.updatedAt), {
              addSuffix: true,
              locale: ar,
            })}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 font-medium",
              page.status === "live" &&
                "text-emerald-700 dark:text-emerald-300",
              page.status === "draft" && "text-sky-700 dark:text-sky-300",
              page.status === "legacy" && "text-amber-700 dark:text-amber-300",
              page.status === "empty" && "text-muted-foreground",
            )}
          >
            {page.status === "live" && "منشور على soctiv.ly"}
            {page.status === "draft" && "مسودة جاهزة للنشر"}
            {page.status === "legacy" && "يحتاج إعادة توليد"}
            {page.status === "empty" && "لم يبدأ بعد"}
          </span>
        </div>

        {/* External URL strip — only on live cards. Shows the clean
            <brand>.soctiv.ly (or custom_domain) URL the privacy link
            in the published footer resolves to, with a click-to-copy
            affordance. We deliberately do NOT make this whole row a
            link — the user might tap a card to edit, not to navigate
            to the live URL. */}
        {externalUrl && page.status === "live" && (
          <UrlStrip url={externalUrl} />
        )}
      </Link>

      {/* Footer action strip — primary actions visible on the right
                (RTL start); kebab (open-published / delete) on the left
                (RTL end). */}
      <div
        className="flex items-center justify-between gap-1.5 px-2 py-2 border-t border-border bg-muted/30"
        onClick={(e) => e.stopPropagation()}
      >
        {/* RTL start: primary actions — Edit + Review */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate(editHref);
            }}
            aria-label="تعديل الصفحة"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-background/70 hover:bg-background text-foreground text-xs font-semibold transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>تعديل</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(previewHref, "_blank", "noopener,noreferrer");
            }}
            aria-label="مراجعة الصفحة في تبويب جديد"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-gradient-to-l from-brand-cyan to-brand-accent text-brand-darker text-xs font-bold shadow-sm hover:shadow-md hover:scale-[1.02] transition-all"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>مراجعة</span>
          </button>
        </div>

        {/* RTL end: kebab — true secondary actions only. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="المزيد من الإجراءات"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[170px]">
            {canPreview && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  // Open the EXTERNAL URL (subdomain.soctiv.ly or
                  // custom_domain), not the bare published_url which
                  // may be the older Netlify fallback. Same as
                  // PublishBar's "View live" button.
                  window.open(
                    externalUrl!,
                    "_blank",
                    "noopener,noreferrer",
                  );
                }}
                className="flex items-center gap-2 cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                فتح المنشور الفعلي
              </DropdownMenuItem>
            )}
            {canPreview && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onDelete(page.id);
              }}
              className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
