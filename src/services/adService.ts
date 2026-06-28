/**
 * Ad Builder — Service layer.
 *
 * Responsibilities:
 *  - `generateAd` — build prompt → call Google AI Studio → parse → return draft
 *    (no DB write; the UI decides when to persist via `createAd`).
 *  - `listAds` / `listExistingTopics` — read queries.
 *  - `createAd` / `updateAd` / `deleteAd` — write queries.
 *
 * Provider: Google AI Studio (via `callGoogleAI`). The apiKey + model are
 * sourced from `loadAIConfig()` so super admins can rotate keys in Settings
 * without redeploying.
 *
 * Implementation note: every Supabase call in this file goes through
 * `(supabase as any)` to opt out of the typed PostgrestFilterBuilder's
 * overly-strict `__InternalSupabase`-flavored column generics — the same
 * pattern used by `adminAuditService.ts`. The runtime shape is correct; the
 * ad types are still applied at the call boundary via `as AdRow` casts.
 */
import { callGoogleAI } from './googleAiService';
import { loadAIConfig } from './aiConfigService';
import { buildAdPrompt, toMessages } from './adPrompt';
import { parseAdOutput } from './adParser';
import { supabase } from '@/integrations/supabase/client';
import {
    type Ad,
    type AdRow,
    type AdInsert,
    type AdUpdate,
    type GenerateAdOptions,
    type GeneratedAdDraft,
    type ListAdsOptions,
    adFromRow,
} from '@/types/ads';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Generation ───────────────────────────────────────────────────────────

const AD_GENERATION_TEMPERATURE = 0.85; // vs DNA's 0.3 — creative variety in hooks/copy
// Arabic is token-heavy and we ask for a topic + 5 hooks + full body + headline.
// 4096 (the global default) can truncate longer scripts mid-sentence, which the
// parser then flags as `partial`. Give the model real room.
const AD_GENERATION_MAX_TOKENS = 8192;

/**
 * Generate a single ad. Returns a draft — no DB write.
 * Throws on cancellation (DOMException AbortError) so the hook can catch it.
 */
export async function generateAd(opts: GenerateAdOptions): Promise<GeneratedAdDraft> {
    const { dna, angle, durationSeconds, existingTopics, signal } = opts;

    // Surface a config error early so the UI can show a clear "configure API key" toast.
    const config = loadAIConfig();
    if (!config.googleAI.apiKey) {
        throw new Error(
            'مفتاح Google AI API غير مهيأ. أضفه في الإعدادات > إعدادات الذكاء الاصطناعي.',
        );
    }

    const built = buildAdPrompt({ dna, angle, durationSeconds, existingTopics });
    console.log(
        `[Ads] Generating ad for angle="${angle.angleName}", duration=${durationSeconds}s, avoidTopics=${existingTopics.length}, systemLen=${built.systemLength}`,
    );

    const raw = await callGoogleAI(toMessages(built), {
        temperature: AD_GENERATION_TEMPERATURE,
        maxTokens: AD_GENERATION_MAX_TOKENS,
        signal,
    });

    const parsed = parseAdOutput(raw);

    return {
        topic: parsed.topic,
        hooks: parsed.hooks,
        copy: parsed.copy,
        headline: parsed.headline,
        rawOutput: parsed.raw,
        partial: parsed.partial,
    };
}

// ─── Reads ────────────────────────────────────────────────────────────────

/**
 * List ads. Pass `productId` to scope to one product (used by `/ads/:productId`).
 * Pass `angleName` to filter further within that product. Super admins see all.
 */
export async function listAds(opts: ListAdsOptions = {}): Promise<Ad[]> {
    // Branch on the filter shape so each call site can use a single chained
    // builder (avoids losing literal column types on reassignment).
    const filters: string[] = [];
    if (opts.productId) filters.push(`product_id=eq.${opts.productId}`);
    if (opts.angleName) filters.push(`angle_name=eq.${opts.angleName}`);

    let builder = db.from('ads').select('*').order('created_at', { ascending: false });
    if (opts.productId) builder = builder.eq('product_id', opts.productId);
    if (opts.angleName) builder = builder.eq('angle_name', opts.angleName);

    const { data, error } = await builder;
    if (error) throw error;
    return ((data ?? []) as AdRow[]).map(adFromRow);
}

/**
 * Variation input — the list of topics the AI must NOT repeat.
 * Returns distinct topics for the given (product, angle), newest first.
 */
export async function listExistingTopics(opts: {
    productId: string;
    angleName: string;
    signal?: AbortSignal;
}): Promise<string[]> {
    if (opts.signal?.aborted) return [];

    const { data, error } = await db
        .from('ads')
        .select('topic')
        .eq('product_id', opts.productId)
        .eq('angle_name', opts.angleName)
        .order('created_at', { ascending: false });

    if (opts.signal?.aborted) return [];
    if (error) throw error;
    if (!data) return [];

    // Distinct, preserving newest-first order.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of data as Array<{ topic: string }>) {
        const t = row.topic;
        if (!seen.has(t)) {
            seen.add(t);
            out.push(t);
        }
    }
    return out;
}

// ─── Writes ───────────────────────────────────────────────────────────────

export async function createAd(row: AdInsert): Promise<Ad> {
    const { data, error } = await db
        .from('ads')
        .insert(row)
        .select('*')
        .single();
    if (error) throw error;
    return adFromRow(data as AdRow);
}

export async function updateAd(id: string, changes: AdUpdate): Promise<Ad> {
    const { data, error } = await db
        .from('ads')
        .update(changes)
        .eq('id', id)
        .select('*')
        .single();
    if (error) throw error;
    return adFromRow(data as AdRow);
}

export async function deleteAd(id: string): Promise<void> {
    const { error } = await db.from('ads').delete().eq('id', id);
    if (error) throw error;
}

// ─── Helpers (used by the UI) ─────────────────────────────────────────────

/**
 * List products that have a DNA row. Used to populate the product dropdown.
 */
export async function listProductsWithDna(): Promise<{ id: string; name: string }[]> {
    const { data, error } = await db
        .from('product_dna')
        .select('product_id, products(id, name)')
        .not('product_id', 'is', null);

    if (error) throw error;
    if (!data) return [];

    // Flatten and dedupe by product id (one DNA per product, but be safe).
    const seen = new Set<string>();
    const out: { id: string; name: string }[] = [];
    type Row = { products: { id: string; name: string } | null };
    for (const row of data as unknown as Row[]) {
        const product = row.products;
        if (product && !seen.has(product.id)) {
            seen.add(product.id);
            out.push(product);
        }
    }
    return out;
}