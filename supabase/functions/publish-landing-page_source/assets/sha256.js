/**
 * soctiv-tracking — SHA-256 helper (browser)
 * Uses SubtleCrypto when available; falls back to a tiny pure-JS SHA-256
 * so the module never throws on older browsers / insecure contexts.
 *
 * Public API:
 *   window.SOCTIV.sha256(string) -> Promise<string>   (lowercase hex)
 *   window.SOCTIV.hashPII(obj)    -> Promise<object>  (hashes known PII keys)
 */
(function () {
  'use strict';

  // Keys Meta expects to receive pre-hashed (lowercase, trimmed before hashing).
  // Anything outside this list is passed through unchanged.
  var PII_KEYS = ['em', 'ph', 'fn', 'ln', 'ct', 'st', 'zp', 'country', 'external_id'];

  // -------- Pure-JS SHA-256 (fallback) --------
  // Adapted from the well-known public-domain implementation. Used only when
  // SubtleCrypto is unavailable (older browsers, http:// previews, etc.).
  function sha256Sync(message) {
    var K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    var H = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];

    function rotr(n, x) { return (x >>> n) | (x << (32 - n)); }
    function toBytes(str) {
      var bytes = [];
      for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if (c < 0x80) bytes.push(c);
        else if (c < 0x800) { bytes.push(0xc0 | (c >> 6)); bytes.push(0x80 | (c & 0x3f)); }
        else { bytes.push(0xe0 | (c >> 12)); bytes.push(0x80 | ((c >> 6) & 0x3f)); bytes.push(0x80 | (c & 0x3f)); }
      }
      return bytes;
    }
    function fromBytes(bytes) {
      var hex = '';
      for (var i = 0; i < bytes.length; i++) hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
      return hex;
    }

    var bytes = toBytes(message);
    var l = bytes.length;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var bitLen = l * 8;
    for (var i = 7; i >= 0; i--) bytes.push((bitLen >>> (i * 8)) & 0xff);

    var w = new Array(64);
    for (var block = 0; block < bytes.length; block += 64) {
      for (var t = 0; t < 16; t++) {
        w[t] = (bytes[block + t * 4] << 24) | (bytes[block + t * 4 + 1] << 16) |
               (bytes[block + t * 4 + 2] << 8) | bytes[block + t * 4 + 3];
      }
      for (var t2 = 16; t2 < 64; t2++) {
        var s0 = rotr(7, w[t2 - 15]) ^ rotr(18, w[t2 - 15]) ^ (w[t2 - 15] >>> 3);
        var s1 = rotr(17, w[t2 - 2]) ^ rotr(19, w[t2 - 2]) ^ (w[t2 - 2] >>> 10);
        w[t2] = (w[t2 - 16] + s0 + w[t2 - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (var t3 = 0; t3 < 64; t3++) {
        var S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + K[t3] + w[t3]) | 0;
        var S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return fromBytes(H.map(function (n) {
      return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
    }).reduce(function (a, b) { return a.concat(b); }, []));
  }

  function normalize(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function hash(value) {
    var v = normalize(value);
    if (!v) return Promise.resolve('');
    if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
      var enc = new TextEncoder();
      return window.crypto.subtle.digest('SHA-256', enc.encode(v)).then(function (buf) {
        var bytes = new Uint8Array(buf);
        var hex = '';
        for (var i = 0; i < bytes.length; i++) hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
        return hex;
      });
    }
    return Promise.resolve(sha256Sync(v));
  }

  function hashPII(obj) {
    obj = obj || {};
    var out = {};
    var promises = [];
    Object.keys(obj).forEach(function (key) {
      var val = obj[key];
      if (val == null || val === '') {
        out[key] = '';
        return;
      }
      if (PII_KEYS.indexOf(key) !== -1) {
        promises.push(hash(val).then(function (h) { out[key] = h; }));
      } else {
        out[key] = val;
      }
    });
    return Promise.all(promises).then(function () { return out; });
  }

  window.SOCTIV = window.SOCTIV || {};
  window.SOCTIV.sha256 = hash;
  window.SOCTIV.hashPII = hashPII;
})();
