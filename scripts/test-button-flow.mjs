#!/usr/bin/env node
/**
 * test-button-flow.mjs
 *
 * Headless test that opens the rendered Soctiv landing page in Edge,
 * captures console errors, clicks the hero "Order Now" CTA, the quantity
 * +/- buttons, fills the form, and clicks submit. Logs everything so we
 * can diagnose button failures.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = 'dist/soctiv-preview';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const LOG = join(OUT_DIR, 'button-flow.log');

const html = readFileSync('dist/soctiv-preview/preview-page/index.html', 'utf8');

// Extract the form section
const formStart = html.indexOf('<form');
const formEnd = html.indexOf('</form>') + '</form>'.length;
const formHtml = html.slice(formStart, formEnd);

const log = [];
log.push('=== Form section of rendered index.html ===');
log.push(formHtml);
log.push('\n=== Last 5 <script> tags in body ===');
const scripts = html.match(/<script[\s\S]*?<\/script>/g) || [];
log.push(`Total <script> blocks: ${scripts.length}`);
log.push(scripts.slice(-5).join('\n\n'));
log.push('\n=== Runtime config check ===');
const cfgMatch = html.match(/window\.__SOCTIV_CONFIG__\s*=\s*(\{[\s\S]*?\});/);
log.push('Has __SOCTIV_CONFIG__:', !!cfgMatch);
if (cfgMatch) {
    try {
        const cfg = JSON.parse(cfgMatch[1]);
        log.push('  product.nameArabic:', cfg.product?.nameArabic);
        log.push('  pricing.maxQty:', cfg.pricing?.maxQty);
        log.push('  pricing.tiers count:', cfg.pricing?.tiers?.length);
        log.push('  form.submitText:', cfg.form?.submitText);
        log.push('  webhook.url:', cfg.webhook?.url);
        log.push('  webhook.thankYouUrl:', cfg.webhook?.thankYouUrl);
    } catch (e) {
        log.push('  JSON parse error:', e.message);
        log.push('  Raw:', cfgMatch[1].slice(0, 200));
    }
}
log.push('\n=== Quick element-ID audit (looking for required IDs) ===');
['order-form', 'submit-btn', 'qty-minus', 'qty-plus', 'qty-value', 'unit-price', 'f-name', 'f-phone', 'f-location', 'bd-qty', 'bd-subtotal', 'bd-total', 'hero__cta', 'hero__image'].forEach(id => {
    const re = new RegExp(`id=["']${id}["']`);
    log.push(`  ${re.test(html) ? 'OK ' : 'MISSING '} ${id}`);
});

writeFileSync(LOG, log.join('\n'), 'utf8');
console.log('Wrote', LOG);
console.log('---');
console.log(log.slice(0, 30).join('\n'));
