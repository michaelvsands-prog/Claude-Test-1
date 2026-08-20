/*
 * holdings.js — parse the holdings .xlsx via SheetJS and build the identifier
 * lookup used by the vendor-file scan. Main thread only.
 * Depends on the global XLSX (vendor/xlsx.full.min.js) and CoverageNormalize.
 */
(function (global) {
  'use strict';

  var N = global.CoverageNormalize;

  /**
   * Parse the workbook. Returns
   * {sheetNames, sheets: {name -> rows}} where rows is an array of arrays
   * (row 0 may be a header).
   */
  function parseWorkbook(file) {
    return file.arrayBuffer().then(function (buf) {
      var wb = XLSX.read(buf, { type: 'array' });
      var sheets = {};
      for (var i = 0; i < wb.SheetNames.length; i++) {
        var name = wb.SheetNames[i];
        sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' });
      }
      return { sheetNames: wb.SheetNames, sheets: sheets };
    });
  }

  /**
   * Build the lookup from holdings rows and a confirmed column mapping.
   * rows: array of arrays. mapping: {isin, sedol, cusip, ticker} -> col index or null.
   * hasHeader: boolean.
   *
   * Returns {
   *   sets: {isin, sedol, cusip, tickerExact, tickerRoot}  // arrays, worker-ready
   *   valueToRows: Map<'idType|value', number[]>            // holding row indices
   *   holdingCount, headerRow, dataRows
   * }
   */
  function buildLookup(rows, mapping, hasHeader) {
    var headerRow = hasHeader && rows.length > 0 ? rows[0] : null;
    var dataRows = hasHeader ? rows.slice(1) : rows.slice();
    // Drop fully-empty trailing rows (common in Excel exports).
    dataRows = dataRows.filter(function (r) {
      for (var i = 0; i < r.length; i++) if (String(r[i]).trim() !== '') return true;
      return false;
    });

    var sets = { isin: [], sedol: [], cusip: [], tickerExact: [], tickerRoot: [] };
    var seen = { isin: {}, sedol: {}, cusip: {}, tickerExact: {}, tickerRoot: {} };
    var valueToRows = new Map();

    function index(setName, idType, value, rowIdx) {
      if (!value) return;
      if (!seen[setName][value]) {
        seen[setName][value] = 1;
        sets[setName].push(value);
      }
      var key = idType + '|' + value;
      var list = valueToRows.get(key);
      if (!list) { list = []; valueToRows.set(key, list); }
      if (list.indexOf(rowIdx) === -1) list.push(rowIdx);
    }

    for (var r = 0; r < dataRows.length; r++) {
      var row = dataRows[r];
      if (mapping.isin != null) index('isin', 'isin', N.normId(row[mapping.isin]), r);
      if (mapping.sedol != null) index('sedol', 'sedol', N.normId(row[mapping.sedol]), r);
      if (mapping.cusip != null) index('cusip', 'cusip', N.normId(row[mapping.cusip]), r);
      if (mapping.ticker != null) {
        var t = N.normTicker(row[mapping.ticker]);
        index('tickerExact', 'ticker', t.exact, r);
        if (t.root && t.root !== t.exact) index('tickerRoot', 'ticker', t.root, r);
      }
    }

    return {
      sets: sets,
      valueToRows: valueToRows,
      holdingCount: dataRows.length,
      headerRow: headerRow,
      dataRows: dataRows
    };
  }

  global.CoverageHoldings = {
    parseWorkbook: parseWorkbook,
    buildLookup: buildLookup
  };
})(typeof self !== 'undefined' ? self : globalThis);
