/**
 * Ad Builder — types for AI-generated ad scripts.
 *
 * Data model:
 *   - Each ad belongs to a product and references one of that product's
 *     DNA marketing angles.
 *   - The `topic` is the AI-picked unique framing that distinguishes this
 *     ad from others written for the same (product, angle) pair.
 *   - `hooks` is always 5 strings (the prompt is locked to 5 hook variations).
 *   - `copy` is the multi-line teleprompter-ready body.
 *   - `headline` is a single short Facebook Ad headline.
 */
import type { Database, Json } from '@/integrations/supabase/types';
import type { ProductDNA, MarketingAngle } from '@/types/productDNA';

export type AdRow = Database['public']['Tables']['ads']['Row'];
export type AdInsert = Database['public']['Tables']['ads']['Insert'];
export type AdUpdate = Database['public']['Tables']['ads']['Update'];

/** Domain-shaped ad — camelCase, hooks as string[]. */
export interface Ad {
    id: string;
    productId: string;
    clientId: string;
    angleName: string;
    topic: string;
    durationSeconds: number;
    hooks: string[];
    copy: string;
    headline: string;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
}

/** Output of the parser — what the AI gave us, post-parsing. */
export interface ParsedAdOutput {
    hooks: string[];
    copy: string;
    headline: string;
    topic: string;
    /** True when the parser fell back (e.g. partial sections). */
    partial: boolean;
    /** Raw AI text — preserved so the UI can offer recovery. */
    raw: string;
}

/** Inputs to the AI generation call. */
export interface GenerateAdOptions {
    dna: ProductDNA;
    angle: MarketingAngle;
    durationSeconds: number;
    /** Topics already used for this (product, angle) — passed to the AI to enforce variation. */
    existingTopics: string[];
    signal?: AbortSignal;
}

/** Return shape of the service-level `generateAd` — no DB write. */
export interface GeneratedAdDraft {
    topic: string;
    hooks: string[];
    copy: string;
    headline: string;
    rawOutput: string;
    partial: boolean;
}

export interface ListAdsOptions {
    productId?: string;
    angleName?: string;
    signal?: AbortSignal;
}

/** Map a snake_case DB row into the camelCase domain shape. */
export const adFromRow = (row: AdRow): Ad => ({
    id: row.id,
    productId: row.product_id,
    clientId: row.client_id,
    angleName: row.angle_name,
    topic: row.topic,
    durationSeconds: row.duration_seconds,
    hooks: coerceHooks(row.hooks),
    copy: row.copy,
    headline: row.headline,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

/** The DB column is JSONB; we always want a string[]. */
function coerceHooks(raw: Json | null | undefined): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((v): v is string => typeof v === 'string');
}