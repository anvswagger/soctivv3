/**
 * Runtime for the published Soctiv landing page.
 *
 * Runs in the browser. Responsibilities:
 *   1. Quantity stepper (clamped to pricing.maxQty).
 *   2. Phone validation against form.phoneRegex + auto-formatting.
 *   3. Live price breakdown (subtotal / free delivery / discount / total).
 *   4. Submitting the form to webhook.url with the payload shape that
 *      `facebook-leads-webhook` expects:
 *        client_code, full_name, phone, quantity, product_code,
 *        source, notes, first_name, last_name, address, normalized_phone
 *   5. Forwarding `setUserData` + `lead`/`purchase` to window.SOCTIV_TRACK
 *      (installed by pixel.js).
 *   6. Reading `soctiv_last_order` from sessionStorage on thank-you.html
 *      and rendering the confirmation state + firing Purchase.
 *
 * Reads runtime config from `window.__SOCTIV_CONFIG__` (injected by the
 * publish edge function as a script tag block before this file is loaded).
 *
 * NOTE: this file gets INLINED into a script tag in the rendered HTML.
 * Do NOT put the literal text of the script closing tag anywhere in this
 * file (not even in comments) — it will prematurely close the outer script
 * tag and leak the rest of the JS code into the page body as visible text.
 */
(function () {
    'use strict';

    // ─── Config ─────────────────────────────────────────────────────────────
    // NOTE: must run AFTER the inline script that sets window.__SOCTIV_CONFIG__,
    // injected by the publish edge function. If `__SOCTIV_CONFIG__` is
    // missing we fall back to safe defaults (an empty tiers ARRAY, not an object —
    // `for (const tier of ...)` would otherwise throw "object is not iterable").
    const CFG = window.__SOCTIV_CONFIG__ || {};
    const PRODUCT = CFG.product || {};
    const PRICING = CFG.pricing || { tiers: [], maxQty: 5, discountLabel: 'التخفيض' };
    const FORM = CFG.form || {};
    const WEBHOOK = CFG.webhook || { url: '', clientCode: '', productCode: '', source: 'Landing Page', thankYouUrl: 'thank-you.html' };
    const TRACKING = CFG.tracking || { debug: false };

    // Defensive: pricing.tiers may have been authored as an object map instead
    // of an array. Normalize to an array so the for-of never throws.
    const tiersRaw = Array.isArray(PRICING.tiers) ? PRICING.tiers : [];
    const TIER_MAP = {};
    for (const tier of tiersRaw) {
        if (tier && typeof tier === 'object' && tier.quantity != null) {
            TIER_MAP[tier.quantity] = tier.price;
        }
    }
    const UNIT_PRICE = Number(PRODUCT.value) || 0;
    const MAX_QTY = Number(PRICING.maxQty) || 5;
    const getPrice = (qty) => (TIER_MAP[qty] != null ? TIER_MAP[qty] : Math.round(qty * UNIT_PRICE * 100) / 100);

    function formatLYD(n) {
        return (Math.round(Number(n) * 100) / 100) + ' ' + (PRODUCT.currencySymbol || 'د.ل');
    }

    // ─── Helpers ────────────────────────────────────────────────────────────
    function $(id) { return document.getElementById(id); }

    function splitName(full) {
        const parts = String(full || '').trim().split(/\s+/);
        const first = parts[0] || '';
        const last = parts.length > 1 ? parts.slice(1).join(' ') : '';
        return { first, last };
    }

    function normalizePhone(raw) {
        const digits = String(raw || '').replace(/\D/g, '');
        if (digits.length === 10 && digits.startsWith('09')) return '+218' + digits.slice(1);
        if (digits.length === 12 && digits.startsWith('218')) return '+' + digits;
        if (digits.length === 9 && digits.startsWith('9')) return '+218' + digits;
        return '+' + digits;
    }

    function buildNotes(qty, total, name, phone, location) {
        return [
            `${qty} × ${PRODUCT.nameArabic || PRODUCT.name || ''}`,
            `الإجمالي: ${total} ${PRODUCT.currencySymbol || 'د.ل'}`,
            `الدفع: عند الاستلام`,
            `الاسم: ${name || '—'}`,
            `الهاتف: ${phone || '—'}`,
            `العنوان: ${location || '—'}`,
        ].join('\n');
    }

    // ─── Page detection ─────────────────────────────────────────────────────
    const isOrderForm = !!document.getElementById('order-form');
    const isThankYou = !!document.getElementById('success') || !!document.getElementById('empty');
    const isPrivacy = !!document.getElementById('privacy');

    if (isOrderForm) initOrderForm();
    if (isThankYou) initThankYou();
    initCommon();

    // ─── Common: footer year + reveal-on-scroll ─────────────────────────────
    function initCommon() {
        const yearEl = document.getElementById('year');
        if (yearEl) yearEl.textContent = new Date().getFullYear();

        const revealTargets = document.querySelectorAll(
            '.hero__inner, .order, .objections__grid, .proof__grid, .footer__row'
        );
        if (revealTargets.length && 'IntersectionObserver' in window) {
            revealTargets.forEach((el) => el.classList.add('reveal'));
            const io = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('is-visible');
                            io.unobserve(entry.target);
                        }
                    });
                },
                { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
            );
            revealTargets.forEach((el) => io.observe(el));
        }
    }

    // ─── Order form (index.html) ────────────────────────────────────────────
    function initOrderForm() {
        const form = document.getElementById('order-form');
        if (!form) return;

        const qtyMinus = $('qty-minus');
        const qtyPlus = $('qty-plus');
        const qtyValue = $('qty-value');
        const unitPriceEl = $('unit-price');
        const bdQty = $('bd-qty');
        const bdSubtotal = $('bd-subtotal');
        const bdDiscountRow = $('bd-discount-row');
        const bdDiscount = $('bd-discount');
        const bdTotal = $('bd-total');
        const submitBtn = $('submit-btn');

        const qtyState = { qty: 1 };
        const phoneInput = $('f-phone');
        const requiredFields = form.querySelectorAll('[required]');
        const firstErrSel = '.field.is-error .field__input, .field.is-error .field__textarea';

        function setError(wrap, on) {
            if (wrap) wrap.classList.toggle('is-error', !!on);
        }

        function updateQty() {
            const qty = qtyState.qty;
            const subtotal = UNIT_PRICE * qty;
            const price = getPrice(qty);
            const savings = subtotal - price;

            qtyValue.textContent = qty;
            if (qtyMinus) qtyMinus.disabled = qty <= 1;
            if (qtyPlus) qtyPlus.disabled = qty >= MAX_QTY;

            const perPiece = Math.round((price / qty) * 100) / 100;
            if (unitPriceEl) unitPriceEl.textContent = perPiece;
            if (bdQty) bdQty.textContent = qty;
            if (bdSubtotal) bdSubtotal.textContent = formatLYD(subtotal);
            if (bdTotal) bdTotal.textContent = formatLYD(price);

            if (savings > 0) {
                if (bdDiscountRow) bdDiscountRow.hidden = false;
                if (bdDiscount) bdDiscount.textContent = '−' + formatLYD(savings);
            } else {
                if (bdDiscountRow) bdDiscountRow.hidden = true;
            }
        }

        if (qtyMinus) qtyMinus.addEventListener('click', () => {
            if (qtyState.qty > 1) { qtyState.qty--; updateQty(); onQtyChange(); }
        });
        if (qtyPlus) qtyPlus.addEventListener('click', () => {
            if (qtyState.qty < MAX_QTY) { qtyState.qty++; updateQty(); onQtyChange(); }
        });

        // Phone auto-format
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                let formatted = digits;
                if (digits.length > 3) formatted = digits.slice(0, 3) + ' ' + digits.slice(3);
                if (digits.length > 6) formatted = digits.slice(0, 3) + ' ' + digits.slice(3, 6) + ' ' + digits.slice(6);
                e.target.value = formatted;
            });
        }

        // Validation
        const phoneRe = (FORM.phoneRegex || '^09[0-9]{8}$').startsWith('/')
            ? new RegExp(FORM.phoneRegex.slice(1, -1))
            : new RegExp(FORM.phoneRegex || '^09[0-9]{8}$');
        const nameMinLen = Number(FORM.nameMinLength) || 3;
        const locMinLen = Number(FORM.locationMinLength) || 5;

        function validate() {
            let ok = true;
            requiredFields.forEach((el) => {
                const v = (el.value || '').trim();
                let bad = !v;
                if (!bad && el.id === 'f-phone') bad = !phoneRe.test(v.replace(/\s+/g, ''));
                if (!bad && el.id === 'f-name') bad = v.length < nameMinLen;
                if (!bad && el.id === 'f-location') bad = v.length < locMinLen;
                setError(el.closest('.field'), bad);
                if (bad) ok = false;
            });
            return ok;
        }

        form.addEventListener('input', (e) => {
            if (e.target.matches('.field__input, .field__textarea')) {
                setError(e.target.closest('.field'), false);
            }
        });

        // Submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validate()) {
                const firstErr = form.querySelector(firstErrSel);
                if (firstErr) firstErr.focus();
                return;
            }

            const name = (form.querySelector('#f-name').value || '').trim();
            const phone = (form.querySelector('#f-phone').value || '').trim().replace(/\s+/g, '');
            const location = (form.querySelector('#f-location').value || '').trim();
            const qty = qtyState.qty;
            const total = getPrice(qty);
            const oid = 'LY-' + Date.now().toString(36).toUpperCase().slice(-6);

            const { first, last } = splitName(name);
            const normalized = normalizePhone(phone);

            const data = {
                qty,
                total,
                name,
                phone,
                location,
                payment: 'COD',
                orderId: oid,
                createdAt: new Date().toISOString(),
            };

            // Disable submit + show in-flight text
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.dataset.originalText = submitBtn.textContent;
                submitBtn.textContent = FORM.submittingText || 'جاري الإرسال…';
            }

            // Audit log (best-effort)
            try {
                const orders = JSON.parse(localStorage.getItem('soctiv_orders') || '[]');
                orders.push({ ...data });
                localStorage.setItem('soctiv_orders', JSON.stringify(orders));
            } catch (_) { /* ignore */ }

            // Pass order to the thank-you page via sessionStorage
            try {
                sessionStorage.setItem('soctiv_last_order', JSON.stringify(data));
            } catch (_) { /* ignore */ }

            // Meta Pixel: Advanced Matching + Lead (with keepalive so it survives navigation)
            // Race fix: await setUserData before proceeding so Advanced
            // Matching is applied AND the Lead event fires before the
            // webhook POST / navigation tear-down. Without await, a fast
            // webhook + slow SubtleCrypto drops the Lead on low-end
            // devices (the page unloads before fireLead runs).
            const T = window.SOCTIV_TRACK;
            const fireLead = () => {
                if (!T || !T.lead) return;
                try {
                    T.lead({
                        qty: data.qty,
                        value: data.total,
                        orderId: oid,
                        eventId: 'lead_' + oid,
                    });
                } catch (_) { /* ignore */ }
            };
            // Soft cap the wait — if SubtleCrypto hangs longer than 2s we
            // proceed anyway (fire Lead without AM) so we never block the
            // user from reaching the thank-you page. CAPI re-hashes
            // server-side, so a Lead without browser-side AM is still
            // attributed correctly when the cookie is set.
            const leadWaitPromise = (async () => {
                if (!T || !T.setUserData) {
                    fireLead();
                    return;
                }
                try {
                    await Promise.race([
                        T.setUserData({
                            name: data.name,
                            phone: data.phone,
                            location: data.location,
                            external_id: oid,
                        }),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('am_timeout')), 2000)),
                    ]);
                } catch (_) { /* fall through to fireLead */ }
                fireLead();
            })();

            // ─── POST to webhook, BLOCK on success.
            // Until now this was fire-and-forget (`.catch(() => {})` followed
            // by unconditional redirect), which silently lost every lead when
            // the webhook returned a non-2xx. Now we await the response and
            // only navigate forward on a successful lead insert. Failures
            // surface as an inline error banner above the form so the user
            // can retry without losing their input. The 10s AbortController
            // timeout remains so a stuck webhook doesn't hang the UI forever.
            let leadId = null;
            let failure = null;
            if (WEBHOOK.url) {
                const payload = {
                    client_code: WEBHOOK.clientCode || '',
                    full_name: name,
                    phone: phone,
                    quantity: qty,
                    product_code: WEBHOOK.productCode || PRODUCT.code || '',
                    source: WEBHOOK.source || 'Landing Page',
                    notes: buildNotes(qty, total, name, phone, location),
                    first_name: first,
                    last_name: last,
                    address: location,
                    normalized_phone: normalized,
                };
                const ctrl = ('AbortController' in window) ? new AbortController() : null;
                const timeoutId = ctrl ? setTimeout(() => ctrl.abort(), 10000) : null;
                try {
                    const resp = await fetch(WEBHOOK.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                        mode: 'cors',
                        // keepalive removed: we now AWAIT and care about the
                        // response. keepalive would defeat the new behavior
                        // because it returns an opaque response with no status
                        // we can branch on.
                        signal: ctrl ? ctrl.signal : undefined,
                    });
                    if (!resp.ok) {
                        let body = '';
                        try { body = await resp.text(); } catch (_) { /* ignore */ }
                        failure = {
                            reason: resp.status === 429 ? 'rate_limited' : 'http_error',
                            status: resp.status,
                            body,
                        };
                    } else {
                        const json = await resp.json().catch(() => ({}));
                        leadId = (json && json.lead_id) || null;
                    }
                } catch (err) {
                    const isAbort = err && (err.name === 'AbortError' || /aborted/i.test(String(err && err.message)));
                    failure = { reason: isAbort ? 'timeout' : 'network' };
                } finally {
                    if (timeoutId) clearTimeout(timeoutId);
                }
            }

            if (failure) {
                // Re-enable submit, restore original label, show inline error.
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = submitBtn.dataset.originalText || 'تأكيد الطلب';
                }
                showFormError(failure);
                try {
                    window.parent.postMessage(
                        { type: 'soctiv:lead-failed', ...failure, orderId: oid },
                        '*'
                    );
                } catch (_) { /* ignore */ }
                return;
            }

            // Success — wait for the AM-seeded Lead pixel event to fire
            // (with a 2s soft cap inside leadWaitPromise) before we tear
            // down the page. Without this, the browser-pixel Lead drops
            // whenever SubtleCrypto hashing is slow.
            await leadWaitPromise;

            // Success — notify the parent (preview only) and navigate forward.
            try {
                window.parent.postMessage(
                    { type: 'soctiv:lead-created', leadId, orderId: oid },
                    '*'
                );
            } catch (_) { /* ignore */ }

            // ─── Navigate to thank-you page
            // In published pages: real navigation (window.location.href change).
            // In editor preview / iframe srcDoc: there's no thank-you.html to
            // load (relative URLs resolve against `about:srcdoc/...` and 404),
            // so we swap the iframe document in-place to the rendered thank-you
            // HTML stashed on `window.__SOCTIV_PREVIEW__.thankYouHtml` (which
            // mirrors the deployed thank-you.html byte-for-byte). This lets the
            // user click "Submit" in the editor preview without breaking the
            // iframe (which would go blank/BLOCKED).
            if (window.__SOCTIV_PREVIEW__) {
                showPreviewThankYou(data, oid, leadId);
            } else {
                window.location.href = WEBHOOK.thankYouUrl || 'thank-you.html';
            }
        });

        // ─── Preview-mode thank-you render ───────────────────────────────
        // When the runtime is loaded inside the editor's iframe preview
        // (flag `window.__SOCTIV_PREVIEW__` is set by the editor), real
        // navigation to `thank-you.html` is impossible because the iframe
        // has no real origin and the relative URL resolves to
        // `about:srcdoc/thank-you.html` which doesn't exist. Instead, swap
        // the iframe document to the FULL rendered thank-you HTML that the
        // editor stashed on `window.__SOCTIV_PREVIEW__.thankYouHtml`. The
        // swapped doc contains its own inlined runtime, styles, and palette
        // vars, so it renders identically to what a real visitor would see
        // on the published page.
        //
        // Defined inside initOrderForm so it closes over `submitBtn`.
        function showPreviewThankYou(data, oid, leadId) {
            const preview = window.__SOCTIV_PREVIEW__;
            if (!preview || !preview.thankYouHtml) {
                // Defensive fallback: if the editor didn't ship the
                // thank-you HTML for some reason (stale hot-reload, broken
                // module graph), keep the user in the form with the old
                // inline confirmation rather than rendering nothing.
                return showPreviewConfirmation(data, oid);
            }
            // Stash the just-submitted order in sessionStorage so the new
            // document's initThankYou() (which re-runs inside the swapped
            // doc via the inlined runtime IIFE) can bind the success
            // block from it. The `lead_id` extension is harmless if the
            // runtime doesn't read it — it just travels through.
            try {
                sessionStorage.setItem(
                    'soctiv_last_order',
                    JSON.stringify(Object.assign({}, data, { orderId: oid, lead_id: leadId }))
                );
            } catch (_) { /* ignore */ }
            // Replace the iframe document atomically. `document.write` on
            // a full HTML doc (including <head>, <script>, <style>) closes
            // the current document and opens a new one — the form's submit
            // handler and Meta Pixel in-flight promises are dropped with
            // the old doc. The new doc's IIFE runs synchronously as the
            // HTML is parsed, so initThankYou is bound by the time
            // `document.close()` returns.
            document.open();
            document.write(preview.thankYouHtml);
            document.close();
        }

        // Inline-form error banner — shown when the webhook POST fails.
        // The banner sits directly above the submit button so the user
        // sees it without scrolling, and the retry button restores the
        // form's submit handler without re-entering data.
        function showFormError(failure) {
            let banner = form.querySelector('.form-error');
            if (!banner) {
                banner = document.createElement('div');
                banner.className = 'form-error';
                banner.setAttribute('role', 'alert');
                banner.dir = 'rtl';
                banner.style.cssText =
                    'background:color-mix(in srgb, var(--danger) 14%, transparent);' +
                    'color:var(--danger);border:1px solid var(--danger);' +
                    'border-radius:var(--radius);padding:12px 14px;margin:12px 0;' +
                    'font-size:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
                const submitHolder = form.querySelector('.form-actions') || form.querySelector('#submit-btn')?.parentElement || form;
                submitHolder.parentNode.insertBefore(banner, submitHolder);
            }
            const reasonText = ({
                network: 'تعذّر الاتصال بالخادم',
                timeout: 'انتهت مهلة الإرسال',
                rate_limited: 'تم تجاوز عدد المحاولات، حاول لاحقاً',
                http_error: 'فشل في إنشاء الطلب',
            })[failure.reason] || 'حدث خطأ غير متوقع';
            // Surface the actual server response (status + body) so the
            // user can tell WHY the order failed. Truncated to keep the
            // banner tidy; the full body is also posted to the parent via
            // `soctiv:lead-failed` and shown in the editor toast.
            const statusPart = failure.status ? ' (' + escapeHtml(String(failure.status)) + ')' : '';
            let detailPart = '';
            if (failure.body && failure.reason === 'http_error') {
                let body = String(failure.body).trim();
                // Strip large JSON blobs to a single-line summary
                if (body.length > 160) body = body.slice(0, 157) + '…';
                // Escape HTML so a malicious or unexpected server response
                // can't inject markup into our banner
                detailPart = '<small style="display:block;margin-top:6px;opacity:.85;font-family:monospace;word-break:break-all;direction:ltr;text-align:left;">' +
                    escapeHtml(body) + '</small>';
            }
            banner.innerHTML =
                '<span>' + escapeHtml(reasonText) + escapeHtml(statusPart) + detailPart + '</span>' +
                '<button type="button" class="form-error__retry" style="' +
                    'margin-inline-start:auto;background:var(--danger);color:#fff;border:0;' +
                    'border-radius:var(--radius-sm);padding:6px 14px;font-weight:600;cursor:pointer;">' +
                    'حاول مرة أخرى</button>';
            const retryBtn = banner.querySelector('.form-error__retry');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    banner.remove();
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = submitBtn.dataset.originalText || 'تأكيد الطلب';
                    }
                    try { form.requestSubmit(); } catch (_) {
                        // Very old browsers: dispatch a submit event manually
                        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                    }
                });
            }
        }

        // Defensive fallback: the old in-iframe confirmation card, used
        // only when `window.__SOCTIV_PREVIEW__.thankYouHtml` is missing.
        // Kept here so a hot-reload that breaks the new flow doesn't
        // regress the UX to "the form disappears".
        function showPreviewConfirmation(data, oid) {
            const orderSection = document.getElementById('order');
            if (!orderSection) return;
            const host = orderSection.querySelector('.container') || orderSection;
            host.innerHTML = `
                <div class="preview-confirm" dir="rtl" style="
                    background: var(--surface, #fff);
                    border: 1px solid var(--line, #e9e4d8);
                    border-radius: 18px;
                    padding: 36px 28px;
                    text-align: center;
                    max-width: 520px;
                    margin: 24px auto;
                    box-shadow: var(--shadow-lg, 0 12px 40px rgba(20,18,12,0.06));
                ">
                    <div style="
                        width:56px;height:56px;border-radius:50%;
                        background:var(--secondary-soft,#e3ebe5);color:var(--success,#3f564a);
                        display:flex;align-items:center;justify-content:center;
                        margin:0 auto 14px;font-size:28px;line-height:1;
                    ">✓</div>
                    <span style="
                        display:inline-block;font-size:12px;font-weight:700;
                        color:var(--on-secondary,#3f564a);
                        background:var(--secondary-soft,#e3ebe5);
                        padding:4px 12px;border-radius:999px;margin-bottom:10px;
                    ">معاينة — وضع المحرر</span>
                    <h2 style="
                        font-size:22px;font-weight:700;color:var(--ink,#1f1f1c);
                        margin:6px 0 10px;letter-spacing:-0.02em;
                    ">شكراً لك، ${escapeHtml(data.name || 'عميلنا')}!</h2>
                    <p style="
                        color:var(--muted,#7a786f);line-height:1.6;
                        font-size:14px;margin:0 0 18px;
                    ">في الصفحة المنشورة، ستنتقل إلى صفحة التأكيد هنا. رقم الطلب:</p>
                    <div style="
                        display:inline-flex;align-items:center;gap:8px;
                        background:var(--surface-2,#efeae0);color:var(--ink,#1f1f1c);
                        padding:8px 16px;border-radius:10px;
                        font-family:'IBM Plex Sans Arabic',monospace;
                        font-weight:600;font-size:15px;letter-spacing:0.04em;
                        margin-bottom:18px;
                    ">
                        <span style="font-size:11px;color:var(--muted);">رقم الطلب</span>
                        <span>${escapeHtml(oid)}</span>
                    </div>
                    <div style="
                        display:grid;grid-template-columns:repeat(2,1fr);
                        gap:8px;text-align:right;font-size:13px;
                        background:var(--surface-2,#efeae0);
                        border-radius:12px;padding:14px;margin-top:6px;
                    ">
                        <div><div style="color:var(--muted);font-size:11px;">الكمية</div><div style="font-weight:600;">${escapeHtml(String(data.qty))} قطعة</div></div>
                        <div><div style="color:var(--muted);font-size:11px;">الإجمالي</div><div style="font-weight:600;">${escapeHtml(formatLYD(data.total))}</div></div>
                        <div><div style="color:var(--muted);font-size:11px;">الهاتف</div><div style="font-weight:600;" dir="ltr">${escapeHtml(data.phone)}</div></div>
                        <div><div style="color:var(--muted);font-size:11px;">العنوان</div><div style="font-weight:600;">${escapeHtml(data.location)}</div></div>
                    </div>
                    <div style="
                        margin-top:16px;font-size:11px;color:var(--muted);
                        line-height:1.5;
                    ">هذا معاينة فقط. اضغط <strong>نشر</strong> في الأعلى لنشر الصفحة الحقيقية.</div>
                </div>
            `;
            orderSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Meta Pixel helpers used on the order page
        function onQtyChange() {
            if (window.SOCTIV_TRACK && window.SOCTIV_TRACK.addToCart) {
                try {
                    window.SOCTIV_TRACK.addToCart({
                        value: getPrice(qtyState.qty),
                        num_items: qtyState.qty,
                    });
                } catch (_) { /* ignore */ }
            }
        }

        // Initial paint + ViewContent
        updateQty();
        setTimeout(() => {
            if (window.SOCTIV_TRACK && window.SOCTIV_TRACK.viewContent) {
                try { window.SOCTIV_TRACK.viewContent(); } catch (_) { /* ignore */ }
            }
        }, 50);

        // InitiateCheckout on hero CTA click OR first name focus
        let checkoutFired = false;
        const fireCheckout = () => {
            if (checkoutFired || !window.SOCTIV_TRACK || !window.SOCTIV_TRACK.initiateCheckout) return;
            checkoutFired = true;
            try {
                window.SOCTIV_TRACK.initiateCheckout({
                    num_items: qtyState.qty,
                    value: getPrice(qtyState.qty),
                });
            } catch (_) { /* ignore */ }
        };
        document.querySelector('.hero__cta')?.addEventListener('click', (e) => {
            // Intercept the click in BOTH preview and published modes so
            // the scroll behavior is consistent and we can:
            //   1. Run a smooth animated scroll to #order (the user can see
            //      the page glide down to the form, not jump instantly).
            //   2. Focus the first input after the scroll completes, so the
            //      form is immediately interactive (caret blinks on the
            //      first field — confirms the form is "alive").
            //   3. In preview mode, prevent the iframe from navigating to
            //      `about:srcdoc#order` (which counts as a real navigation
            //      and would render the iframe as BLOCKED by the sandbox).
            //
            // We always preventDefault — on the published site, the default
            // anchor behavior would also work, but it relies on CSS
            // `scroll-behavior: smooth` and varies across browsers / WebViews.
            // Programmatic `window.scrollTo({ behavior: 'smooth' })` is
            // universally supported and gives us one consistent animation.
            e.preventDefault();
            const order = document.getElementById('order');
            if (order) {
                const rect = order.getBoundingClientRect();
                const currentY = window.scrollY || document.documentElement.scrollTop || 0;
                const targetTop = currentY + rect.top;
                // Pick the smoothest available mechanism:
                //   - `window.scrollTo({ behavior: 'smooth' })` is the modern API
                //     and the one most reliably honored across browsers.
                //   - `scrollIntoView` is older but a great fallback.
                // We do NOT use `behavior: 'instant'` — the whole point of
                // this handler is to provide an animated scroll, which the
                // default anchor behavior alone doesn't reliably deliver.
                //
                // IMPORTANT: do NOT follow these with a synchronous
                // `element.scrollTop = targetTop` fallback. Even though
                // some browsers (older Android WebViews) no-op the smooth
                // call, setting `scrollTop` synchronously IMMEDIATELY after
                // overrides any in-progress smooth animation and turns the
                // scroll into an instant jump. The first sample at 50ms
                // would already show the final position, with no animation
                // visible. If the browser doesn't support `behavior: 'smooth'`,
                // the user just sees no scroll at all — better than a jump
                // that misleads the user about the page being responsive.
                if ('scrollTo' in window) {
                    try { window.scrollTo({ top: targetTop, behavior: 'smooth' }); } catch (_) { /* fall through */ }
                }
                try {
                    order.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } catch (_) { /* smooth scroll unsupported in this browser */ }
                // Defer focus so it doesn't cancel the smooth scroll on some
                // browsers — and so the focus lands AFTER the user has seen
                // the page scroll to the form (better visual cue). The
                // 450ms delay roughly matches the default smooth-scroll
                // duration; if the browser is faster, the focus still
                // works fine, just slightly after the animation.
                setTimeout(() => {
                    const firstInput = document.getElementById('f-name');
                    if (firstInput) firstInput.focus({ preventScroll: true });
                }, 450);
            }
            fireCheckout();
        });
        document.getElementById('f-name')?.addEventListener('focus', fireCheckout, { once: true });

        // AddPaymentInfo when a valid Libyan phone is entered
        let paymentFired = false;
        if (phoneInput) {
            phoneInput.addEventListener('blur', () => {
                if (paymentFired) return;
                const v = (phoneInput.value || '').replace(/\s+/g, '');
                if (phoneRe.test(v)) {
                    paymentFired = true;
                    if (window.SOCTIV_TRACK && window.SOCTIV_TRACK.addPaymentInfo) {
                        try { window.SOCTIV_TRACK.addPaymentInfo(); } catch (_) { /* ignore */ }
                    }
                }
            });
        }

        // Order section visibility signal (engagement)
        if ('IntersectionObserver' in window) {
            const orderSection = document.getElementById('order');
            if (orderSection) {
                const oo = new IntersectionObserver((entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) oo.disconnect();
                    });
                }, { threshold: 0.25 });
                oo.observe(orderSection);
            }
        }
    }

    // ─── Thank-you page ─────────────────────────────────────────────────────
    function initThankYou() {
        let order = null;
        try {
            const raw = sessionStorage.getItem('soctiv_last_order');
            if (raw) order = JSON.parse(raw);
        } catch (_) { /* ignore */ }

        const successEl = document.getElementById('success');
        const emptyEl = document.getElementById('empty');

        if (!order || !order.orderId) {
            if (emptyEl) emptyEl.hidden = false;
            return;
        }

        const name = (order.name || '').trim();
        const nameEl = document.getElementById('cust-name');
        if (nameEl) nameEl.textContent = name || 'عميلنا';

        const oidEl = document.getElementById('order-id');
        if (oidEl) oidEl.textContent = order.orderId;

        const sumQty = document.getElementById('sum-qty');
        if (sumQty) sumQty.textContent = (order.qty || 1) + ' قطعة';

        const sumTotal = document.getElementById('sum-total');
        if (sumTotal) sumTotal.textContent = formatLYD(order.total || 0);

        const sumPhone = document.getElementById('sum-phone');
        if (sumPhone) {
            const d = String(order.phone || '').replace(/\D/g, '');
            sumPhone.textContent = d.length === 10
                ? d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6)
                : (order.phone || '—');
        }

        const sumLoc = document.getElementById('sum-location');
        if (sumLoc) sumLoc.textContent = order.location || '—';

        if (successEl) successEl.hidden = false;
        document.title = 'شكراً لك — تم استلام طلبك #' + order.orderId + ' | ' + (PRODUCT.code || 'soctiv');

        // Meta Pixel: Advanced Matching + Purchase
        const T = window.SOCTIV_TRACK;
        const firePurchase = () => {
            if (!T || !T.purchase) return;
            try {
                T.purchase({
                    qty: order.qty || 1,
                    value: order.total || 0,
                    orderId: order.orderId,
                    eventId: 'purchase_' + order.orderId,
                });
            } catch (_) { /* ignore */ }
        };
        if (T && T.setUserData) {
            try {
                T.setUserData({
                    name: order.name,
                    phone: order.phone,
                    location: order.location,
                    external_id: order.orderId,
                }).then(firePurchase).catch(firePurchase);
            } catch (_) { firePurchase(); }
        }
    }

    // ─── Shared escape helper used by both the order form's preview
    // confirmation and any other preview-mode UI. Hoisted to IIFE scope.
    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
})();
