/*
 * scan-core.js — streaming line scanner for multi-GB delimited files.
 * Shared between the Web Worker and the main-thread fallback.
 * Depends on CoverageNormalize and CoverageDetect.
 */
(function (global) {
  'use strict';

  var N = global.CoverageNormalize;
  var D = global.CoverageDetect;

  var PROGRESS_INTERVAL_MS = 250;
  var MATCH_BATCH_SIZE = 200;

  /**
   * Stream `file` once, checking configured identifier columns against the
   * holdings lookup sets.
   *
   * config: {delimiter, hasHeader, quoted, columns:{isin,sedol,cusip,ticker}}
   *   or, with autoColumns:true, every field of every row is probed and
   *   `columns` is ignored.
   * lookup: {isin:Set, sedol:Set, cusip:Set, tickerExact:Set, tickerRoot:Set}
   * callbacks: {
   *   onProgress(bytesProcessed, rows, matchCount),
   *   onMatches([{idType, value, col}]),   // deduped per file, batched
   *   shouldCancel() -> boolean,
   *   yieldToUI() -> Promise | null        // main-thread fallback only
   * }
   * Returns Promise<{rows, bytes, badLines, matchCount, cancelled}>.
   */
  function scanFile(file, config, lookup, callbacks) {
    var split = config.quoted ? D.splitLineQuoted : D.splitLine;
    var delimiter = config.delimiter;
    var auto = !!config.autoColumns;
    var cols = config.columns || {};

    // Precompute the column probes: [colIndex, idType] (manual mode only)
    var probes = [];
    if (!auto) {
      if (cols.isin != null) probes.push([cols.isin, 'isin']);
      if (cols.sedol != null) probes.push([cols.sedol, 'sedol']);
      if (cols.cusip != null) probes.push([cols.cusip, 'cusip']);
      if (cols.ticker != null) probes.push([cols.ticker, 'ticker']);
    }
    var maxCol = 0;
    for (var p = 0; p < probes.length; p++) maxCol = Math.max(maxCol, probes[p][0]);

    var reported = {}; // "idType|value" -> 1, per-file dedupe (bounded by holdings size)
    var matchBuffer = [];
    var stats = { rows: 0, bytes: 0, badLines: 0, matchCount: 0, cancelled: false };
    var firstLine = true;
    var lastProgress = 0;

    function processLine(line) {
      if (line.length === 0) return;
      if (firstLine) {
        firstLine = false;
        if (line.charCodeAt(0) === 0xFEFF) line = line.slice(1);
        if (config.hasHeader) return; // skip header row (not counted as data)
      }
      stats.rows++;
      var fields = split(line, delimiter);
      if (auto) {
        for (var f = 0; f < fields.length; f++) {
          var rawField = fields[f];
          // Identifiers are <=12 chars; skip long text fields (names etc.)
          // before paying for normalization. 24 allows quotes/padding.
          if (rawField.length === 0 || rawField.length > 24) continue;
          var av = N.normId(rawField);
          if (!av) continue;
          var len = av.length;
          if (len === 12 && N.looksLikeIsin(av) && lookup.isin.has(av)) recordMatch('isin', av, f);
          if (len === 7 && lookup.sedol.has(av)) recordMatch('sedol', av, f);
          if (len === 9 && lookup.cusip.has(av)) recordMatch('cusip', av, f);
          // Length gate keeps long text fields (security names) out of the
          // ticker path so name words can't collide with ticker roots.
          if (len <= 12) {
            if (lookup.tickerExact.has(av)) {
              recordMatch('ticker', av, f);
            } else {
              var at = N.normTicker(av);
              if (at.root !== at.exact && lookup.tickerRoot.has(at.root)) recordMatch('ticker', at.root, f);
            }
          }
        }
        return;
      }
      if (fields.length <= maxCol) { stats.badLines++; return; }
      for (var i = 0; i < probes.length; i++) {
        var idType = probes[i][1];
        var col = probes[i][0];
        var raw = fields[col];
        if (idType === 'ticker') {
          var t = N.normTicker(raw);
          if (!t.exact) continue;
          if (lookup.tickerExact.has(t.exact)) recordMatch('ticker', t.exact, col);
          else if (lookup.tickerRoot.has(t.root)) recordMatch('ticker', t.root, col);
        } else {
          var v = N.normId(raw);
          if (v && lookup[idType].has(v)) recordMatch(idType, v, col);
        }
      }
    }

    function recordMatch(idType, value, col) {
      var key = idType + '|' + value;
      if (reported[key]) return;
      reported[key] = 1;
      stats.matchCount++;
      matchBuffer.push({ idType: idType, value: value, col: col });
      if (matchBuffer.length >= MATCH_BATCH_SIZE) flushMatches();
    }

    function flushMatches() {
      if (matchBuffer.length > 0) {
        callbacks.onMatches(matchBuffer);
        matchBuffer = [];
      }
    }

    function maybeProgress(force) {
      var now = Date.now();
      if (force || now - lastProgress >= PROGRESS_INTERVAL_MS) {
        lastProgress = now;
        callbacks.onProgress(stats.bytes, stats.rows, stats.matchCount);
      }
    }

    var reader = file.stream().getReader();
    var decoder = new TextDecoder('utf-8'); // lossy on bad bytes, strips UTF-8 BOM
    var remainder = '';

    function finish() {
      // Drain the decoder and flush a final line without trailing newline.
      remainder += decoder.decode();
      if (remainder.length > 0) {
        var line = remainder;
        if (line.charAt(line.length - 1) === '\r') line = line.slice(0, -1);
        processLine(line);
        remainder = '';
      }
      flushMatches();
      maybeProgress(true);
      return stats;
    }

    function pump() {
      if (callbacks.shouldCancel && callbacks.shouldCancel()) {
        stats.cancelled = true;
        flushMatches();
        return reader.cancel().then(function () { return stats; }, function () { return stats; });
      }
      return reader.read().then(function (result) {
        if (result.done) return finish();
        var chunk = result.value;
        stats.bytes += chunk.byteLength;
        var text = remainder + decoder.decode(chunk, { stream: true });
        var start = 0;
        var nl;
        while ((nl = text.indexOf('\n', start)) !== -1) {
          var line = text.slice(start, nl);
          if (line.charAt(line.length - 1) === '\r') line = line.slice(0, -1);
          processLine(line);
          start = nl + 1;
        }
        remainder = start === 0 ? text : text.slice(start);
        maybeProgress(false);
        var y = callbacks.yieldToUI ? callbacks.yieldToUI() : null;
        return y ? y.then(pump) : pump();
      });
    }

    return pump();
  }

  global.CoverageScan = { scanFile: scanFile };
})(typeof self !== 'undefined' ? self : globalThis);
