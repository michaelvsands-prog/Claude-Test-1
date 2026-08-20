/*
 * detect.js — delimiter / header / identifier-column detection.
 * Shared between the page and the Web Worker (classic script, global export).
 * Depends on CoverageNormalize (normalize.js) being loaded first.
 */
(function (global) {
  'use strict';

  var N = global.CoverageNormalize;

  var SAMPLE_BYTES = 262144; // 256 KB
  var CANDIDATE_DELIMITERS = ['|', '\t', ',', ';'];

  /** Read the first 256 KB of a File, strip BOM, drop the truncated last line. */
  function takeSample(file) {
    return file.slice(0, SAMPLE_BYTES).text().then(function (text) {
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      var lines = text.split('\n');
      if (file.size > SAMPLE_BYTES && lines.length > 1) lines.pop(); // last line may be cut mid-row
      var out = [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.charAt(line.length - 1) === '\r') line = line.slice(0, -1);
        if (line.length > 0) out.push(line);
      }
      return out;
    });
  }

  /**
   * Pick the delimiter whose per-line field count is > 1 and most consistent
   * across the sample. Ties break in CANDIDATE_DELIMITERS priority order.
   * Returns {delimiter, fieldCount, confident}.
   */
  function detectDelimiter(lines) {
    var sample = lines.slice(0, 50);
    var best = null;
    for (var d = 0; d < CANDIDATE_DELIMITERS.length; d++) {
      var delim = CANDIDATE_DELIMITERS[d];
      var counts = [];
      for (var i = 0; i < sample.length; i++) counts.push(sample[i].split(delim).length);
      var mean = 0, j;
      for (j = 0; j < counts.length; j++) mean += counts[j];
      mean /= counts.length;
      if (mean <= 1.05) continue; // delimiter basically absent
      var variance = 0;
      for (j = 0; j < counts.length; j++) variance += (counts[j] - mean) * (counts[j] - mean);
      variance /= counts.length;
      var score = variance; // lower is better
      if (best === null || score < best.score) {
        best = { delimiter: delim, fieldCount: Math.round(mean), score: score };
      }
    }
    if (!best) return { delimiter: null, fieldCount: 1, confident: false };
    return { delimiter: best.delimiter, fieldCount: best.fieldCount, confident: best.score < 0.5 };
  }

  /** Do fields in the sample look quoted? */
  function detectQuoting(lines, delimiter) {
    var quoted = 0, checked = 0;
    for (var i = 0; i < Math.min(lines.length, 20); i++) {
      var fields = lines[i].split(delimiter);
      for (var f = 0; f < fields.length; f++) {
        var v = fields[f];
        if (v.length >= 2) {
          checked++;
          if (v.charAt(0) === '"' && v.charAt(v.length - 1) === '"') quoted++;
        }
      }
    }
    return checked > 0 && quoted / checked > 0.5;
  }

  /** Fast split for unquoted data. */
  function splitLine(line, delimiter) {
    return line.split(delimiter);
  }

  /**
   * Quote-aware splitter: handles "a|b" and doubled "" escapes.
   * Multi-line quoted fields are out of scope.
   */
  function splitLineQuoted(line, delimiter) {
    var fields = [];
    var cur = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var c = line.charAt(i);
      if (inQuotes) {
        if (c === '"') {
          if (line.charAt(i + 1) === '"') { cur += '"'; i++; }
          else inQuotes = false;
        } else cur += c;
      } else if (c === '"' && cur === '') {
        inQuotes = true;
      } else if (c === delimiter) {
        fields.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    fields.push(cur);
    return fields;
  }

  // Header keywords per identifier type, in match-priority order (exact-ish
  // names first, looser ones later).
  var HEADER_PATTERNS = {
    isin: [/^ISIN(_?(CD|CODE|NO|NUM|ID))?$/, /ISIN/],
    sedol: [/^SEDOL(_?(CD|CODE|NO|NUM|ID))?$/, /SEDOL/],
    cusip: [/^CUSIP(_?(CD|CODE|NO|NUM|ID))?$/, /CUSIP/],
    ticker: [/^(TICKER|TICKR|SYMBOL|SYM)(_?(CD|CODE))?$/, /TICKER|TICKR|SYMBOL|\bRIC\b|BBG/]
  };

  function headerCell(v) {
    return String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-]+/g, '_');
  }

  /** Does any cell of the first row look like a known header keyword? */
  function rowHasHeaderKeywords(row) {
    for (var i = 0; i < row.length; i++) {
      var h = headerCell(row[i]);
      for (var t in HEADER_PATTERNS) {
        if (HEADER_PATTERNS[t][1].test(h)) return true;
      }
    }
    return false;
  }

  /**
   * First row is a header if it contains identifier keywords, or if its cells
   * fail identifier/number patterns that later rows pass.
   */
  function detectHeader(rows) {
    if (rows.length === 0) return false;
    if (rowHasHeaderKeywords(rows[0])) return true;
    if (rows.length < 3) return false;
    // Compare "identifier-or-number-ness" of row 0 vs rows 1..n per column.
    var cols = rows[0].length;
    var headerish = 0, comparable = 0;
    for (var c = 0; c < cols; c++) {
      var firstLooks = cellLooksData(rows[0][c]);
      var laterLooks = 0, laterTotal = 0;
      for (var r = 1; r < Math.min(rows.length, 20); r++) {
        if (c < rows[r].length) {
          laterTotal++;
          if (cellLooksData(rows[r][c])) laterLooks++;
        }
      }
      if (laterTotal > 0 && laterLooks / laterTotal > 0.8) {
        comparable++;
        if (!firstLooks) headerish++;
      }
    }
    return comparable > 0 && headerish / comparable > 0.5;
  }

  function cellLooksData(v) {
    var s = N.normId(v);
    if (!s) return false;
    if (/^-?[0-9][0-9.,]*$/.test(s)) return true;
    if (N.looksLikeIsin(s) || N.looksLikeSedol(s) || N.looksLikeCusip(s)) return true;
    return false;
  }

  /**
   * Guess which column holds each identifier type.
   * rows: array of field-arrays (already split). header: boolean.
   * Returns {isin, sedol, cusip, ticker} -> column index or null.
   */
  function guessColumns(rows, hasHeader) {
    var result = { isin: null, sedol: null, cusip: null, ticker: null };
    if (rows.length === 0) return result;
    var t, i;

    if (hasHeader) {
      var header = rows[0];
      // Two passes: exact-ish names first so "ISIN" beats "PARENT_ISIN".
      for (var pass = 0; pass < 2; pass++) {
        for (t in HEADER_PATTERNS) {
          if (result[t] !== null) continue;
          for (i = 0; i < header.length; i++) {
            if (usedColumn(result, i)) continue;
            if (HEADER_PATTERNS[t][pass].test(headerCell(header[i]))) {
              result[t] = i;
              break;
            }
          }
        }
      }
    }

    // Value-pattern vote for anything not found by header name.
    var dataRows = hasHeader ? rows.slice(1, 201) : rows.slice(0, 200);
    if (dataRows.length === 0) return result;
    var cols = 0;
    for (i = 0; i < dataRows.length; i++) cols = Math.max(cols, dataRows[i].length);

    var stats = []; // per column: counts of pattern hits
    for (i = 0; i < cols; i++) stats.push({ isin: 0, sedol: 0, cusip: 0, sedolValid: 0, nonEmpty: 0 });
    for (var r = 0; r < dataRows.length; r++) {
      var row = dataRows[r];
      for (var c = 0; c < row.length; c++) {
        var s = N.normId(row[c]);
        if (!s) continue;
        var st = stats[c];
        st.nonEmpty++;
        if (N.looksLikeIsin(s)) st.isin++;
        if (N.looksLikeSedol(s)) { st.sedol++; if (N.validSedol(s)) st.sedolValid++; }
        if (N.looksLikeCusip(s)) st.cusip++;
      }
    }

    if (result.isin === null) result.isin = bestColumn(stats, result, function (st) {
      return st.nonEmpty > 0 && st.isin / st.nonEmpty > 0.8 ? st.isin : 0;
    });
    if (result.sedol === null) result.sedol = bestColumn(stats, result, function (st) {
      // SEDOL pattern is ambiguous (7 alnum) — demand valid check digits too.
      return st.nonEmpty > 0 && st.sedol / st.nonEmpty > 0.8 && st.sedolValid / Math.max(st.sedol, 1) > 0.7 ? st.sedol : 0;
    });
    if (result.cusip === null) result.cusip = bestColumn(stats, result, function (st) {
      // 9-alnum is ambiguous with ISIN prefixes stripped etc. — only take a
      // column that is NOT already mostly ISINs.
      return st.nonEmpty > 0 && st.cusip / st.nonEmpty > 0.8 && st.isin / st.nonEmpty < 0.5 ? st.cusip : 0;
    });
    // Tickers have no reliable value pattern — header-name detection only.

    return result;
  }

  function usedColumn(result, i) {
    return result.isin === i || result.sedol === i || result.cusip === i || result.ticker === i;
  }

  function bestColumn(stats, result, scoreFn) {
    var best = null, bestScore = 0;
    for (var i = 0; i < stats.length; i++) {
      if (usedColumn(result, i)) continue;
      var score = scoreFn(stats[i]);
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  /** Convenience: full detection pass over a sample's lines. */
  function analyzeSample(lines) {
    var d = detectDelimiter(lines);
    if (!d.delimiter) {
      return { delimiter: null, quoted: false, hasHeader: false, columns: { isin: null, sedol: null, cusip: null, ticker: null }, rows: [], fieldCount: 1 };
    }
    var quoted = detectQuoting(lines, d.delimiter);
    var split = quoted ? splitLineQuoted : splitLine;
    var rows = [];
    for (var i = 0; i < Math.min(lines.length, 201); i++) rows.push(split(lines[i], d.delimiter));
    var hasHeader = detectHeader(rows);
    var columns = guessColumns(rows, hasHeader);
    return { delimiter: d.delimiter, fieldCount: d.fieldCount, confident: d.confident, quoted: quoted, hasHeader: hasHeader, columns: columns, rows: rows };
  }

  global.CoverageDetect = {
    takeSample: takeSample,
    detectDelimiter: detectDelimiter,
    detectQuoting: detectQuoting,
    detectHeader: detectHeader,
    guessColumns: guessColumns,
    splitLine: splitLine,
    splitLineQuoted: splitLineQuoted,
    analyzeSample: analyzeSample
  };
})(typeof self !== 'undefined' ? self : globalThis);
