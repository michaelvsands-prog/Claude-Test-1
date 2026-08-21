/*
 * normalize.js — identifier normalization, shared between the page and the
 * Web Worker (classic script; attaches to the global object).
 */
(function (global) {
  'use strict';

  var PLACEHOLDERS = { '': 1, 'N/A': 1, 'NA': 1, 'NULL': 1, 'NONE': 1, '-': 1, '--': 1, '.': 1, '#N/A': 1 };

  // Suffixes that are safe to strip after a dot/colon — real exchange codes,
  // so class shares like BRK.B are left intact.
  var EXCHANGE_SUFFIXES = {
    'L': 1, 'N': 1, 'O': 1, 'OQ': 1, 'K': 1, 'P': 1, 'A': 1, 'AS': 1, 'AX': 1,
    'BR': 1, 'CO': 1, 'DE': 1, 'F': 1, 'HE': 1, 'HK': 1, 'KS': 1, 'LN': 1,
    'LS': 1, 'MC': 1, 'MI': 1, 'PA': 1, 'S': 1, 'SI': 1, 'ST': 1, 'SW': 1,
    'T': 1, 'TO': 1, 'TW': 1, 'US': 1, 'UN': 1, 'UW': 1, 'V': 1, 'VI': 1
  };

  /** Trim, uppercase, strip wrapping quotes; '' for empty/placeholder values. */
  function normId(v) {
    if (v == null) return '';
    var s = String(v).trim();
    if (s.length >= 2 && s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') {
      s = s.slice(1, -1).trim();
    }
    s = s.toUpperCase();
    if (PLACEHOLDERS[s]) return '';
    return s;
  }

  /**
   * Ticker normalization. Returns {exact, root}. `root` strips one trailing
   * exchange qualifier: a whitespace-separated suffix ("AAPL US" -> "AAPL",
   * "VOD LN EQUITY" -> "VOD"), a colon suffix ("AAPL:US" -> "AAPL"), or a
   * whitelisted dot/hyphen suffix ("VOD.L" -> "VOD", "TSLA-US" -> "TSLA",
   * FactSet-style "BRK.B-US" -> "BRK.B"). Unknown dot/hyphen suffixes are
   * kept (BRK.B and BRK-B stay intact). root === exact when nothing was
   * stripped.
   */
  function normTicker(v) {
    var exact = normId(v);
    if (!exact) return { exact: '', root: '' };
    var root = exact;

    // "AAPL US" / "VOD LN Equity" — keep the first token.
    var sp = root.indexOf(' ');
    if (sp > 0) {
      root = root.slice(0, sp);
    } else {
      var sep = -1, i;
      for (i = root.length - 1; i > 0; i--) {
        var c = root.charAt(i);
        if (c === '.' || c === ':' || c === '-') { sep = i; break; }
      }
      if (sep > 0) {
        var suffix = root.slice(sep + 1);
        if (root.charAt(sep) === ':' || EXCHANGE_SUFFIXES[suffix]) {
          root = root.slice(0, sep);
        }
      }
    }
    return { exact: exact, root: root };
  }

  var RE_ISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
  var RE_SEDOL = /^[A-Z0-9]{7}$/;
  var RE_CUSIP = /^[A-Z0-9]{9}$/;

  function looksLikeIsin(s) { return RE_ISIN.test(s); }
  function looksLikeSedol(s) { return RE_SEDOL.test(s); }
  function looksLikeCusip(s) { return RE_CUSIP.test(s); }

  /** SEDOL weighted check digit (weights 1,3,1,7,3,9; digit makes sum % 10 == 0). */
  function validSedol(s) {
    if (!RE_SEDOL.test(s)) return false;
    var weights = [1, 3, 1, 7, 3, 9, 1];
    var sum = 0;
    for (var i = 0; i < 7; i++) {
      var c = s.charCodeAt(i);
      var v = c >= 48 && c <= 57 ? c - 48 : c - 55; // 0-9, A=10..Z=35
      if (c >= 65 && c <= 90 && 'AEIOU'.indexOf(s.charAt(i)) !== -1) return false; // no vowels
      sum += v * weights[i];
    }
    return sum % 10 === 0;
  }

  /** ISIN Luhn check over digitized characters. */
  function validIsin(s) {
    if (!RE_ISIN.test(s)) return false;
    var digits = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      digits += (c >= 65 && c <= 90) ? String(c - 55) : s.charAt(i);
    }
    var sum = 0, dbl = true;
    for (var j = digits.length - 2; j >= 0; j--) {
      var d = digits.charCodeAt(j) - 48;
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
      dbl = !dbl;
    }
    var check = (10 - (sum % 10)) % 10;
    return check === digits.charCodeAt(digits.length - 1) - 48;
  }

  global.CoverageNormalize = {
    normId: normId,
    normTicker: normTicker,
    looksLikeIsin: looksLikeIsin,
    looksLikeSedol: looksLikeSedol,
    looksLikeCusip: looksLikeCusip,
    validSedol: validSedol,
    validIsin: validIsin
  };
})(typeof self !== 'undefined' ? self : globalThis);
