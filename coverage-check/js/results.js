/*
 * results.js — match aggregation, summary stats, results rendering, CSV export.
 * Main thread only. Depends on nothing but the DOM.
 */
(function (global) {
  'use strict';

  var ID_PRECEDENCE = ['isin', 'sedol', 'cusip', 'ticker']; // best -> worst confidence
  var ID_LABELS = { isin: 'ISIN', sedol: 'SEDOL', cusip: 'CUSIP', ticker: 'Ticker' };

  /**
   * Aggregation model. Created once per run.
   * holdingCount: number of holdings data rows.
   */
  function createAggregator(holdingCount) {
    var perHolding = new Array(holdingCount);
    for (var i = 0; i < holdingCount; i++) {
      perHolding[i] = { matched: false, types: {}, files: {} }; // files: fileName -> {idType:1}
    }
    return { perHolding: perHolding, holdingCount: holdingCount };
  }

  /**
   * Apply a batch of worker matches.
   * matches: [{idType, value}]; fileName: vendor file name;
   * valueToRows: Map<'idType|value', rowIdx[]>.
   */
  function applyMatches(agg, matches, fileName, valueToRows) {
    for (var m = 0; m < matches.length; m++) {
      var idType = matches[m].idType;
      var rows = valueToRows.get(idType + '|' + matches[m].value);
      if (!rows) continue;
      for (var r = 0; r < rows.length; r++) {
        var h = agg.perHolding[rows[r]];
        h.matched = true;
        h.types[idType] = 1;
        if (!h.files[fileName]) h.files[fileName] = {};
        h.files[fileName][idType] = 1;
      }
    }
  }

  function bestType(types) {
    for (var i = 0; i < ID_PRECEDENCE.length; i++) {
      if (types[ID_PRECEDENCE[i]]) return ID_PRECEDENCE[i];
    }
    return null;
  }

  /** Summary numbers + breakdowns. */
  function summarize(agg, fileNames) {
    var matched = 0;
    var byType = { isin: 0, sedol: 0, cusip: 0, ticker: 0 };
    var byBestType = { isin: 0, sedol: 0, cusip: 0, ticker: 0 };
    var byFile = {};
    var i, f;
    for (f = 0; f < fileNames.length; f++) byFile[fileNames[f]] = 0;

    for (i = 0; i < agg.perHolding.length; i++) {
      var h = agg.perHolding[i];
      if (!h.matched) continue;
      matched++;
      for (var t in h.types) byType[t]++;
      var best = bestType(h.types);
      if (best) byBestType[best]++;
      for (var fn in h.files) {
        if (byFile[fn] === undefined) byFile[fn] = 0;
        byFile[fn]++;
      }
    }
    return {
      total: agg.holdingCount,
      matched: matched,
      unmatched: agg.holdingCount - matched,
      coveragePct: agg.holdingCount > 0 ? (100 * matched / agg.holdingCount) : 0,
      byType: byType,
      byBestType: byBestType,
      byFile: byFile
    };
  }

  /**
   * Build detail rows for the table and CSV.
   * dataRows: holdings data rows (arrays); headerRow: header cells or null;
   * mapping: {isin,sedol,cusip,ticker} -> col or null.
   * Returns {columns:[names], rows:[{cells:[], matched, matchType, tickerOnly, files:''}]}
   */
  function buildDetail(agg, dataRows, headerRow, mapping) {
    var idCols = [];
    var types = ['isin', 'sedol', 'cusip', 'ticker'];
    for (var t = 0; t < types.length; t++) {
      if (mapping[types[t]] != null) idCols.push({ type: types[t], col: mapping[types[t]] });
    }
    // Include a best-effort "name" column: first mapped-to-nothing column with
    // long-ish text, else column 0.
    var nameCol = guessNameColumn(dataRows, headerRow, mapping);

    var columns = [];
    if (nameCol != null) columns.push(headerRow ? String(headerRow[nameCol]) : 'Column ' + (nameCol + 1));
    for (var c = 0; c < idCols.length; c++) {
      columns.push(headerRow ? String(headerRow[idCols[c].col]) : ID_LABELS[idCols[c].type]);
    }

    var rows = [];
    for (var r = 0; r < dataRows.length; r++) {
      var h = agg.perHolding[r];
      var cells = [];
      if (nameCol != null) cells.push(String(dataRows[r][nameCol] == null ? '' : dataRows[r][nameCol]));
      for (var c2 = 0; c2 < idCols.length; c2++) {
        var v = dataRows[r][idCols[c2].col];
        cells.push(String(v == null ? '' : v));
      }
      var best = h.matched ? bestType(h.types) : null;
      rows.push({
        cells: cells,
        matched: h.matched,
        matchType: best ? ID_LABELS[best] : '',
        tickerOnly: h.matched && best === 'ticker',
        files: Object.keys(h.files).sort().join('; ')
      });
    }
    return { columns: columns, rows: rows };
  }

  function guessNameColumn(dataRows, headerRow, mapping) {
    var used = {};
    for (var k in mapping) if (mapping[k] != null) used[mapping[k]] = 1;
    if (headerRow) {
      for (var i = 0; i < headerRow.length; i++) {
        if (used[i]) continue;
        var h = String(headerRow[i]).toUpperCase();
        if (/NAME|DESC|SECURITY|ISSUER/.test(h)) return i;
      }
    }
    // Fallback: first unused column.
    var cols = 0;
    for (var r = 0; r < Math.min(dataRows.length, 20); r++) cols = Math.max(cols, dataRows[r].length);
    for (var c = 0; c < cols; c++) if (!used[c]) return c;
    return null;
  }

  /** RFC-4180 CSV from detail rows. filter: 'all' | 'unmatched'. */
  function toCsv(detail, filter) {
    var esc = function (v) {
      var s = String(v == null ? '' : v);
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    var lines = [];
    lines.push(detail.columns.concat(['Matched', 'Match Type', 'Vendor Files']).map(esc).join(','));
    for (var r = 0; r < detail.rows.length; r++) {
      var row = detail.rows[r];
      if (filter === 'unmatched' && row.matched) continue;
      lines.push(row.cells.concat([row.matched ? 'Yes' : 'No', row.matchType, row.files]).map(esc).join(','));
    }
    return lines.join('\r\n') + '\r\n';
  }

  function downloadCsv(csvText, filename) {
    var blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  global.CoverageResults = {
    createAggregator: createAggregator,
    applyMatches: applyMatches,
    summarize: summarize,
    buildDetail: buildDetail,
    toCsv: toCsv,
    downloadCsv: downloadCsv,
    ID_LABELS: ID_LABELS
  };
})(typeof self !== 'undefined' ? self : globalThis);
