/**
 * Mini-templating engine for the publish edge function.
 *
 * Replaces the Handlebars-style `{{path.to.value}}` placeholders and
 * `{{#if condition}}...{{/if}}` blocks in a string with values from a
 * config object. Intentionally tiny — we only need what the Zenon template
 * uses:
 *
 *   - {{path}} → string | number | boolean (rendered as text, HTML-escaped)
 *   - {{{path}}} → string | number | boolean (rendered WITHOUT escaping)
 *   - {{#if path}}...{{/if}} → block kept if path is truthy
 *   - {{#if path}}...{{else}}...{{/if}} → block with else branch
 *   - {{#each list}}...{{/each}} → block repeated per item, exposes {{this}}
 *     and {{this.field}} for the item itself and {{@index}} for the index
 *   - {{__cssVars}} / {{__webhookConfig}} and other double-underscore keys work
 *     via the standard {{path}} syntax
 *
 * Nested `{{#if}}` blocks are supported — the parser walks the string
 * tracking depth, so a `{{/if}}` always matches the closest open `{{#if}}`.
 *
 * No external deps. Designed for the configs we control, not user input.
 */
export type TemplateContext = Record<string, unknown>;

// Matches a single {{#if path}}, {{#each path}}, {{/if}}, {{/each}}, {{else}},
// or {{path}} / {{{path}}} tag. We walk the string ourselves so we can handle
// nesting — the regexes below are only used after we've found a tag and need
// to inspect it.
const TAG_RE = /\{\{(?:#if\s+([@.\w]+)|#each\s+([@.\w]+)|else|\/if|\/each|\{([@.\w]+)\}|([@.\w]+))\}\}/g;

export function renderTemplate(template: string, ctx: TemplateContext): string {
    let out = '';
    let i = 0;
    while (i < template.length) {
        TAG_RE.lastIndex = i;
        const m = TAG_RE.exec(template);
        if (!m) {
            out += template.slice(i);
            break;
        }
        // Copy literal text before this tag.
        out += template.slice(i, m.index);

        // The groups are: [ifPath, eachPath, triplePath, doublePath].
        if (m[1] !== undefined) {
            // {{#if path}}
            const path = m[1];
            const closeStart = findMatchingClose(template, m.index + m[0].length, 'if');
            if (closeStart === -1) {
                // No close — emit the literal tag and continue.
                out += m[0];
                i = m.index + m[0].length;
                continue;
            }
            const closeEnd = closeStart + '{{/if}}'.length;
            const body = template.slice(m.index + m[0].length, closeStart);
            const truthy = isTruthy(getPath(ctx, path));
            const elseIdx = findTopLevelElse(body);
            if (elseIdx === -1) {
                if (truthy) out += renderTemplate(body, ctx);
            } else {
                const thenBranch = body.slice(0, elseIdx);
                const elseBranch = body.slice(elseIdx + '{{else}}'.length);
                out += truthy ? renderTemplate(thenBranch, ctx) : renderTemplate(elseBranch, ctx);
            }
            i = closeEnd;
        } else if (m[2] !== undefined) {
            // {{#each path}}
            const path = m[2];
            const closeStart = findMatchingClose(template, m.index + m[0].length, 'each');
            if (closeStart === -1) {
                out += m[0];
                i = m.index + m[0].length;
                continue;
            }
            const closeEnd = closeStart + '{{/each}}'.length;
            const body = template.slice(m.index + m[0].length, closeStart);
            const value = getPath(ctx, path);
            if (Array.isArray(value) && value.length > 0) {
                for (let idx = 0; idx < value.length; idx++) {
                    const item = value[idx];
                    const itemCtx: TemplateContext = {
                        ...(ctx as object),
                        // Spread item fields so bare {{id}} resolves to item.id
                        // (Handlebars-style implicit `this`). Also expose `this`
                        // explicitly for cases where the field name collides.
                        ...(item && typeof item === 'object' ? (item as object) : {}),
                        this: item,
                        '@index': idx,
                    };
                    out += renderTemplate(body, itemCtx);
                }
            }
            i = closeEnd;
        } else if (m[3] !== undefined) {
            // {{{ path }}} — raw, no HTML escape
            const v = getPath(ctx, m[3]);
            out += v == null ? '' : String(v);
            i = m.index + m[0].length;
        } else if (m[4] !== undefined) {
            // {{ path }} — HTML-escaped
            const v = getPath(ctx, m[4]);
            out += v == null ? '' : htmlEscape(String(v));
            i = m.index + m[0].length;
        } else {
            // {{else}}, {{/if}}, {{/each}} at top level — should never reach here
            // because the parser handles them via findMatchingClose. But if we do,
            // emit them as literal and continue so we don't loop forever.
            out += m[0];
            i = m.index + m[0].length;
        }
    }
    return out;
}

/**
 * Find the start index of the matching `{{/if}}` (or `{{/each}}`) for an
 * opening `{{#if}}` (or `{{#each}}`) tag. Returns -1 if not found.
 *
 * Walks the string tracking depth so nested blocks of the same kind are
 * handled correctly. The `kind` arg is the bare name of the block — "if" or
 * "each".
 */
function findMatchingClose(template: string, from: number, kind: 'if' | 'each'): number {
    const openRe = new RegExp(`\\{\\{#${kind}\\s+([@.\\w]+)\\}\\}`, 'g');
    const closeRe = new RegExp(`\\{\\{/${kind}\\}\\}`, 'g');
    let depth = 1;
    let pos = from;
    while (pos < template.length && depth > 0) {
        openRe.lastIndex = pos;
        closeRe.lastIndex = pos;
        const nextOpen = openRe.exec(template);
        const nextClose = closeRe.exec(template);
        if (!nextClose) return -1;
        if (nextOpen && nextOpen.index < nextClose.index) {
            depth++;
            pos = nextOpen.index + nextOpen[0].length;
        } else {
            depth--;
            if (depth === 0) return nextClose.index;
            pos = nextClose.index + nextClose[0].length;
        }
    }
    return -1;
}

/**
 * Find the index of `{{else}}` at the top level of a block body. Top-level
 * means not nested inside an `{{#if}}` / `{{#each}}` within the same body.
 */
function findTopLevelElse(body: string): number {
    let depth = 0;
    let pos = 0;
    while (pos < body.length) {
        const sub = body.slice(pos);
        const openIf = sub.match(/^\{\{#if\s+[@.\w]+\}\}/);
        const openEach = sub.match(/^\{\{#each\s+[@.\w]+\}\}/);
        const closeIf = sub.match(/^\{\{\/if\}\}/);
        const closeEach = sub.match(/^\{\{\/each\}\}/);
        const elseTag = sub.match(/^\{\{else\}\}/);
        if (openIf || openEach) {
            depth++;
            pos += (openIf || openEach)![0].length;
        } else if (closeIf || closeEach) {
            depth--;
            pos += (closeIf || closeEach)![0].length;
        } else if (elseTag && depth === 0) {
            return pos;
        } else if (elseTag) {
            pos += elseTag[0].length;
        } else {
            pos++;
        }
    }
    return -1;
}

function getPath(ctx: TemplateContext, path: string): unknown {
    if (path === 'this') return ctx.this;
    if (path === '@index') return ctx['@index'];
    const parts = path.split('.');
    let cur: unknown = ctx;
    for (const p of parts) {
        if (cur && typeof cur === 'object') {
            cur = (cur as Record<string, unknown>)[p];
        } else {
            return undefined;
        }
    }
    return cur;
}

function isTruthy(v: unknown): boolean {
    if (v === null || v === undefined || v === false || v === 0 || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
}

function htmlEscape(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
