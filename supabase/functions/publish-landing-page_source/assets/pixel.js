/**
 * soctiv-tracking — browser pixel + CAPI client
 * --------------------------------------------------------------------------
 * Loads the Meta Pixel, captures first-party data (fbp, fbc, UTMs), and fires
 * standard ecommerce events on both the browser pixel and the Conversion API
 * with a shared event_id so Meta deduplicates them server-side.
 *
 * Public API (window.SOCTIV_TRACK):
 *   .pageview()                       — auto-fired once on init
 *   .viewContent(data)                — landing/offer view
 *   .initiateCheckout(data)           — start of order flow
 *   .addToCart(data)                  — quantity change
 *   .addPaymentInfo(data)             — payment step (COD)
 *   .lead(data)                       — form submit (primary COD conversion)
 *   .purchase(data)                   — order placed (predicted)
 *   .setUserData(pii)                 — Advanced Matching (re-init with hashed PII)
 *   .eventId(prefix)                  — generate a unique event id
 *   .debug(on)                        — verbose console logging
 *
 * Relies on SOCTIV_TRACK_CONFIG (set by tracking-config.js) and
 * SOCTIV.sha256 / SOCTIV.hashPII (set by sha256.js).
 */
(function () {
  'use strict';

  // ---------- Config ----------
  var CFG = window.SOCTIV_TRACK_CONFIG || {};
  var PIXEL_ID = CFG.pixelId;
  var CAPI_URL = CFG.capiUrl;
  var TEST_EVENT_CODE = CFG.testEventCode || '';
  var DEBUG = !!CFG.debug;
  // Per-page HMAC token + page id, computed server-side by
  // publish-landing-page (HMAC-SHA256(CAPI_SHARED_SECRET, page_id)). When
  // empty, the capi-proxy skips the signature check (dev only).
  var PAGE_TOKEN = CFG.pageToken || '';
  var PAGE_ID = CFG.pageId || '';
  var PRODUCT = CFG.product || {
    id: 'HEADPHONES-001',
    name: 'سماعات لاسلكية احترافية',
    category: 'Electronics',
    currency: 'LYD',
    value: 89
  };

  // ---------- fbq stub bootstrap (queue until pixel loads) ----------
  // Standard Meta Pixel snippet — must run before any fbq('track') calls.
  if (!window.fbq) {
    var n = window.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = n;
    n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
  }

  // ---------- State ----------
  var state = {
    initFired: false,
    userData: {},       // raw PII (will be hashed before sending)
    userDataHashed: null,
    captured: {
      fbp: null,
      fbc: null,
      utm: {},
      referrer: '',
      landingPath: ''
    }
  };

  // ---------- Helpers ----------
  function log() {
    if (!DEBUG) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift('%c[soctiv-tracking]', 'color:#3f564a;font-weight:700');
    console.log.apply(console, args);
  }

  function genId(prefix) {
    var r = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx').replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0;
          var v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
    return (prefix ? prefix + '_' : '') + r;
  }

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[-.+]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function readQuery() {
    var q = {};
    try {
      var sp = new URLSearchParams(window.location.search);
      sp.forEach(function (v, k) { q[k] = v; });
    } catch (e) { /* IE/old browsers — ignore */ }
    return q;
  }

  // ---------- First-party data capture ----------
  // Done once on script load. Persists fbp/fbc + UTMs in a cookie so they
  // survive navigation to thank-you.html.
  function captureFirstParty() {
    // Meta cookies (set by fbq on first PageView)
    state.captured.fbp = getCookie('_fbp');
    state.captured.fbc = getCookie('_fbc');

    // UTMs + click ids
    var q = readQuery();
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
     'fbclid', 'gclid', 'msclkid', 'dclid'].forEach(function (k) {
      if (q[k]) state.captured.utm[k] = q[k];
    });

    state.captured.referrer = document.referrer || '';
    state.captured.landingPath = window.location.pathname;

    // Persist for cross-page handoff
    try {
      sessionStorage.setItem('soctiv_track', JSON.stringify({
        fbp: state.captured.fbp,
        fbc: state.captured.fbc,
        utm: state.captured.utm,
        landingPath: state.captured.landingPath,
        ts: Date.now()
      }));
    } catch (e) { /* ignore */ }
  }

  function readPersisted() {
    try {
      var raw = sessionStorage.getItem('soctiv_track');
      if (raw) return JSON.parse(raw) || {};
    } catch (e) { /* ignore */ }
    return {};
  }

  // ---------- PII normalization ----------
  // Meta requires: lowercase, trimmed, no spaces in some fields.
  // For phones, we strip non-digits then prefix the country code (Libya = +218).
  // MUST stay in sync with `client_runtime.js#normalizePhone` (kept as a
  // mirror copy because the runtime cannot require() from pixel.js). The
  // 9-digit "9…" Libyan branch was missing here — divergence previously
  // caused pixel.js to mishandle 9-digit inputs starting with digits other
  // than 9 (e.g. "123456789" → "+218123456789"). See M3 review finding.
  function normalizePhone(raw) {
    if (!raw) return '';
    var digits = String(raw).replace(/\D/g, '');
    if (!digits) return '';
    // Libyan mobile: 10 digits starting with 09. E.164 = +218 + 9 digits (drop the 0).
    if (digits.length === 10 && digits.charAt(0) === '0') {
      return '+218' + digits.slice(1);
    }
    // 9-digit Libyan without leading 0 (user typed "9XXXXXXXX"). E.164 = +218 + 9 digits.
    if (digits.length === 9 && digits.charAt(0) === '9') {
      return '+218' + digits;
    }
    // If it already has a country code, keep as-is.
    if (digits.length === 12 && digits.indexOf('218') === 0) return '+' + digits;
    if (digits.length > 10) return '+' + digits;
    // Unknown shape — fall back to prepending Libya country code rather
    // than dropping the value silently (better attribution signal than empty).
    return '+218' + digits;
  }

  function splitName(full) {
    full = String(full || '').trim().replace(/\s+/g, ' ');
    if (!full) return { fn: '', ln: '' };
    var parts = full.split(' ');
    if (parts.length === 1) return { fn: parts[0], ln: '' };
    return { fn: parts[0], ln: parts.slice(1).join(' ') };
  }

  function splitLocation(loc) {
    loc = String(loc || '').trim();
    if (!loc) return { city: '', address: '' };
    // Heuristic: take the last comma-separated chunk as the city.
    var idx = loc.lastIndexOf('،');
    if (idx === -1) idx = loc.lastIndexOf(',');
    if (idx === -1) return { city: loc, address: loc };
    return {
      city: loc.slice(idx + 1).trim(),
      address: loc.trim()
    };
  }

  // ---------- Pixel init ----------
  function initPixel(advancedMatching) {
    if (!PIXEL_ID) {
      console.warn('[soctiv-tracking] No pixelId — events will not fire on the browser pixel.');
      return;
    }
    if (advancedMatching && Object.keys(advancedMatching).length) {
      // Re-init with Advanced Matching data (hashed). This is idempotent —
      // subsequent events will use the latest user data.
      window.fbq('init', PIXEL_ID, advancedMatching);
    } else {
      window.fbq('init', PIXEL_ID);
    }
    state.initFired = true;
  }

  // ---------- CAPI send ----------
  function postToCAPI(payload) {
    if (!CAPI_URL) {
      log('CAPI url not set — skipping server event.');
      return Promise.resolve(null);
    }
    // Attach the per-page signature + page_id so the capi-proxy can verify
    // the request came from a page we actually published. The proxy recomputes
    // HMAC(CAPI_SHARED_SECRET, page_id) and rejects if it doesn't match.
    // When PAGE_TOKEN is empty (CAPI_SHARED_SECRET unset on the publish
    // function), the proxy skips the check (dev only).
    var headers = { 'Content-Type': 'application/json' };
    if (PAGE_TOKEN) headers['X-Soctiv-Signature'] = PAGE_TOKEN;
    var signedPayload = Object.assign({}, payload);
    if (PAGE_ID) signedPayload.page_id = PAGE_ID;
    // keepalive:true is critical — it lets the request complete even after
    // the page navigates away (which happens right after Lead fires).
    try {
      return fetch(CAPI_URL, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(signedPayload),
        keepalive: true,
        credentials: 'omit',
        mode: 'cors'
      }).then(function (r) {
        if (!r.ok) {
          log('CAPI non-2xx', r.status);
          return null;
        }
        return r.json().catch(function () { return null; });
      }).then(function (data) {
        if (DEBUG && data) log('CAPI response', data);
        return data;
      }).catch(function (err) {
        log('CAPI network error (continuing)', err && err.message);
        return null;
      });
    } catch (e) {
      log('CAPI threw (continuing)', e && e.message);
      return Promise.resolve(null);
    }
  }

  // ---------- Build + fire a single event (both channels) ----------
  // Payload contract (must match the CAPI proxy in
  // supabase/functions/capi-proxy/index.ts AND the standalone
  // LANIDNG PAGE SOCTIV/api/_lib/meta.js):
  //
  //   {
  //     event: { event_name, event_id, event_time, event_source_url,
  //              action_source, custom_data },
  //     user_data: { em, ph, fn, ln, ... (hashed), fbp, fbc },
  //     pixel_id: '1234567890',              // optional — per-page pixel routing
  //     test_event_code: 'TEST12345'         // optional
  //   }
  //
  // CRITICAL: do NOT send a flat payload (event_name at the top level).
  // Both CAPI handlers reject it with `missing_event`. This was the root
  // cause of CAPI being silently 100% broken for every published page.
  function fire(eventName, customData, userData, opts) {
    opts = opts || {};
    var eventId = opts.eventId || genId('evt');
    var eventTime = opts.eventTime || Math.floor(Date.now() / 1000);

    // Browser pixel
    if (PIXEL_ID) {
      try {
        // fbq('track', name, data, options) — options.eventID enables dedup.
        var fbqOpts = { eventID: eventId };
        window.fbq('trackSingle', PIXEL_ID, eventName, customData || {}, fbqOpts);
        log('fbq', eventName, { event_id: eventId, custom: customData });
      } catch (e) {
        log('fbq threw', e && e.message);
      }
    }

    // CAPI — only if we have any user data worth sending
    var mergedUser = mergeUserData(userData);
    if (Object.keys(mergedUser).length > 0) {
      var payload = {
        event: {
          event_name: eventName,
          event_id: eventId,
          event_time: eventTime,
          event_source_url: window.location.href,
          action_source: 'website',
          custom_data: customData || {}
        },
        user_data: mergedUser
      };
      // Per-page pixel routing — the CAPI proxy uses this to forward to
      // the correct Meta pixel (the editor lets each landing page set its
      // own pixelId). Falls back to the proxy's META_PIXEL_ID env var if
      // omitted (single-pixel deployments).
      if (PIXEL_ID) payload.pixel_id = PIXEL_ID;
      if (TEST_EVENT_CODE) payload.test_event_code = TEST_EVENT_CODE;
      postToCAPI(payload);
    } else {
      log('CAPI skipped — no user data attached for', eventName);
    }

    return eventId;
  }

  function mergeUserData(extra) {
    extra = extra || {};
    var merged = {};
    var src = state.userData || {};
    Object.keys(src).forEach(function (k) { if (src[k]) merged[k] = src[k]; });
    Object.keys(extra).forEach(function (k) { if (extra[k]) merged[k] = extra[k]; });

    // Auto-attach fbp/fbc if available (never hashed, sent as-is per Meta spec).
    //
    // Re-read the cookies at event time, not just at script load. The cookies
    // are set by fbq() on the first PageView, which fires AFTER this script
    // loads — so `state.captured.fbp` is null for the very first event of a
    // fresh session. Without this re-read, the CAPI Lead event would land
    // at Meta with no fbp/fbc, tanking EMQ and breaking click attribution
    // for that conversion.
    var fbp = state.captured.fbp || getCookie('_fbp') || (readPersisted().fbp);
    var fbc = state.captured.fbc || getCookie('_fbc') || (readPersisted().fbc);
    if (fbp) merged.fbp = fbp;
    if (fbc) merged.fbc = fbc;

    return merged;
  }

  // ---------- Public API ----------
  var API = {};

  API.eventId = function (prefix) { return genId(prefix); };
  API.debug = function (on) { DEBUG = !!on; };

  API.setUserData = function (pii) {
    pii = pii || {};
    var n = splitName(pii.name);
    var loc = splitLocation(pii.location);
    state.userData = {
      em: pii.email || '',
      ph: normalizePhone(pii.phone),
      fn: n.fn,
      ln: n.ln,
      ct: loc.city,
      // Libya has no formal states. Sending the city as `st` is a common
      // but incorrect workaround that pollutes Meta's geo signals (Meta
      // matches `st` against its own state/province list). Empty is the
      // correct value — Meta will still use `ct` (city) and `country`.
      st: '',
      zp: pii.zip || '',
      country: 'ly',
      external_id: pii.external_id || ''
    };
    // Hash and re-init pixel with Advanced Matching.
    if (window.SOCTIV && window.SOCTIV.hashPII) {
      return window.SOCTIV.hashPII(state.userData).then(function (hashed) {
        state.userDataHashed = hashed;
        initPixel(hashed);
        log('Advanced Matching ready', hashed);
        return hashed;
      });
    }
    // CRITICAL: if SHA-256 is unavailable (sha256.js failed to load, very
    // old browser, or http:// origin blocking SubtleCrypto), do NOT pass
    // raw PII to fbq. The CAPI proxy will still re-hash server-side, so
    // server-side Advanced Matching still works — but sending un-hashed
    // PII to the browser pixel is both a privacy violation and would be
    // rejected by Meta's ingestion anyway (they require hashed values).
    console.warn('[soctiv-tracking] SHA-256 unavailable — Advanced Matching disabled; CAPI server-side hashing still applies.');
    initPixel();
    return Promise.resolve(null);
  };

  API.pageview = function () {
    initPixel();            // no AM at first paint
    if (PIXEL_ID) {
      try { window.fbq('trackSingle', PIXEL_ID, 'PageView'); } catch (e) { /* ignore */ }
    }
    log('PageView');
  };

  API.viewContent = function (data) {
    return fire('ViewContent', Object.assign({
      content_ids: [PRODUCT.id],
      content_name: PRODUCT.name,
      content_type: 'product',
      content_category: PRODUCT.category,
      value: PRODUCT.value,
      currency: PRODUCT.currency
    }, data || {}));
  };

  API.initiateCheckout = function (data) {
    return fire('InitiateCheckout', Object.assign({
      content_ids: [PRODUCT.id],
      content_name: PRODUCT.name,
      content_type: 'product',
      content_category: PRODUCT.category,
      num_items: 1,
      currency: PRODUCT.currency
    }, data || {}));
  };

  API.addToCart = function (data) {
    return fire('AddToCart', Object.assign({
      content_ids: [PRODUCT.id],
      content_name: PRODUCT.name,
      content_type: 'product',
      content_category: PRODUCT.category,
      currency: PRODUCT.currency
    }, data || {}));
  };

  API.addPaymentInfo = function (data) {
    return fire('AddPaymentInfo', Object.assign({
      content_ids: [PRODUCT.id],
      content_name: PRODUCT.name,
      content_type: 'product',
      content_category: PRODUCT.category,
      payment_method: 'cod',
      currency: PRODUCT.currency
    }, data || {}));
  };

  API.lead = function (data) {
    // Lead is the primary conversion for COD. Always include the order data.
    var d = data || {};
    var custom = {
      content_ids: [PRODUCT.id],
      content_name: PRODUCT.name,
      content_type: 'product',
      content_category: PRODUCT.category,
      num_items: d.qty || 1,
      value: d.value || 0,
      currency: PRODUCT.currency,
      payment_method: 'cod'
    };
    if (d.orderId) custom.order_id = d.orderId;
    return fire('Lead', custom, d.userData || {}, { eventId: d.eventId });
  };

  API.purchase = function (data) {
    var d = data || {};
    var custom = {
      content_ids: [PRODUCT.id],
      content_name: PRODUCT.name,
      content_type: 'product',
      contents: [{
        id: PRODUCT.id,
        quantity: d.qty || 1,
        item_price: (d.value && d.qty) ? (d.value / d.qty) : PRODUCT.value
      }],
      content_category: PRODUCT.category,
      num_items: d.qty || 1,
      value: d.value || 0,
      currency: PRODUCT.currency,
      payment_method: 'cod'
    };
    if (d.orderId) custom.order_id = d.orderId;
    return fire('Purchase', custom, d.userData || {}, { eventId: d.eventId });
  };

  // ---------- Boot ----------
  captureFirstParty();

  // Expose API
  window.SOCTIV_TRACK = API;

  // Fire the auto PageView on next tick so fbq is fully wired.
  function bootPageView() {
    API.pageview();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPageView, { once: true });
  } else {
    bootPageView();
  }

  // Load the Meta Pixel SDK asynchronously. This is the official snippet.
  // We inject it after our stub so fbq() calls above are queued properly.
  if (PIXEL_ID) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    s.crossOrigin = 'anonymous';
    var firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(s, firstScript);
    } else {
      document.head.appendChild(s);
    }
  } else {
    console.warn('[soctiv-tracking] Set window.SOCTIV_TRACK_CONFIG.pixelId to start tracking.');
  }
})();
