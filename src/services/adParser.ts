/**
 * Ad Builder — Output parser.
 *
 * The AI returns plain text in this strict format:
 *
 *   <optional topic line>
 *   Hook 1: ...
 *   Hook 2: ...
 *   Hook 3: ...
 *   Hook 4: ...
 *   Hook 5: ...
 *   COPY:
 *   ...multi-line body...
 *   Headline: ...
 *
 * The parser is forgiving:
 *  - It strips Markdown code fences if the model wrapped the output.
 *  - It pads missing hooks with empty strings so downstream code never crashes.
 *  - It preserves the raw text so the UI can offer recovery when `partial` is true.
 */
import type { ParsedAdOutput } from '@/types/ads';

const HOOK_REGEX = /^Hook\s+([1-5])\s*:\s*(.+?)\s*$/gm;
const HEADLINE_REGEX = /^Headline\s*:\s*(.+?)\s*$/m;
const COPY_MARKER_REGEX = /^COPY\s*:\s*$/m;
const HOOK_1_MARKER_REGEX = /^Hook\s+1\s*:/m;

export function parseAdOutput(raw: string): ParsedAdOutput {
    const text = normalize(raw);

    const hooks = extractHooks(text);
    const headline = extractHeadline(text);
    const copy = extractCopy(text);
    const topic = extractTopic(text);

    const partial =
        hooks.filter((h) => h.length > 0).length !== 5 ||
        !copy ||
        !headline ||
        !topic;

    return {
        hooks,
        copy,
        headline,
        topic,
        partial,
        raw,
    };
}

/**
 * Strip fenced code blocks, normalize line endings, trim trailing whitespace.
 * Does NOT trim leading content — the topic line may be at the very start.
 */
function normalize(raw: string): string {
    let text = raw.replace(/\r\n/g, '\n');
    // Strip ```...``` fences (with or without language tag)
    text = text.replace(/```(?:[a-zA-Z]*)?\s*([\s\S]*?)```/g, '$1');
    return text.trim();
}

function extractHooks(text: string): string[] {
    const hooks: string[] = ['', '', '', '', ''];
    let match: RegExpExecArray | null;
    HOOK_REGEX.lastIndex = 0;
    while ((match = HOOK_REGEX.exec(text)) !== null) {
        const idx = parseInt(match[1], 10) - 1;
        if (idx >= 0 && idx < 5) {
            hooks[idx] = match[2].trim();
        }
    }
    return hooks;
}

function extractHeadline(text: string): string {
    HEADLINE_REGEX.lastIndex = 0;
    const match = HEADLINE_REGEX.exec(text);
    return match ? match[1].trim() : '';
}

/**
 * Body is everything after the COPY: marker and before the Headline: line.
 * If Headline is missing, we take everything after COPY: until EOF.
 * If COPY is missing, return empty string and let `partial` flag it.
 */
function extractCopy(text: string): string {
    const copyMatch = COPY_MARKER_REGEX.exec(text);
    if (!copyMatch) return '';

    const afterCopy = text.slice(copyMatch.index + copyMatch[0].length);

    const headlineIdx = afterCopy.search(HEADLINE_REGEX);
    const body = headlineIdx === -1 ? afterCopy : afterCopy.slice(0, headlineIdx);

    // Trim trailing blank lines but preserve internal newlines for teleprompter.
    return body.replace(/\s+$/, '').replace(/^\n+/, '');
}

/**
 * Topic is the first non-empty line that appears BEFORE "Hook 1:".
 * The system prompt instructs the AI to start the script with the topic line.
 */
function extractTopic(text: string): string {
    const hook1Match = HOOK_1_MARKER_REGEX.exec(text);
    const before = hook1Match ? text.slice(0, hook1Match.index) : text;

    for (const line of before.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }
    return '';
}