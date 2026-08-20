/*
 * scanner-worker.js — Web Worker entry point.
 * Protocol (main -> worker):
 *   {type:'init', holdings:{isin:[], sedol:[], cusip:[], tickerExact:[], tickerRoot:[]}}
 *   {type:'scan', fileIndex, file:File, config:{delimiter, hasHeader, quoted, columns}}
 *   {type:'cancel'}
 * Protocol (worker -> main):
 *   {type:'progress', fileIndex, bytesProcessed, totalBytes, rows, matchCount}
 *   {type:'matches',  fileIndex, matches:[{idType, value}]}
 *   {type:'done',     fileIndex, stats:{rows, bytes, badLines, matchCount, cancelled, elapsedMs}}
 *   {type:'error',    fileIndex, message}
 */
importScripts('normalize.js', 'detect.js', 'scan-core.js');

var lookup = null;
var cancelled = false;

self.onmessage = function (e) {
  var msg = e.data;
  if (msg.type === 'init') {
    lookup = {
      isin: new Set(msg.holdings.isin),
      sedol: new Set(msg.holdings.sedol),
      cusip: new Set(msg.holdings.cusip),
      tickerExact: new Set(msg.holdings.tickerExact),
      tickerRoot: new Set(msg.holdings.tickerRoot)
    };
    cancelled = false;
  } else if (msg.type === 'cancel') {
    cancelled = true;
  } else if (msg.type === 'scan') {
    if (!lookup) {
      self.postMessage({ type: 'error', fileIndex: msg.fileIndex, message: 'Worker not initialized' });
      return;
    }
    var fileIndex = msg.fileIndex;
    var totalBytes = msg.file.size;
    var started = Date.now();
    CoverageScan.scanFile(msg.file, msg.config, lookup, {
      onProgress: function (bytes, rows, matchCount) {
        self.postMessage({ type: 'progress', fileIndex: fileIndex, bytesProcessed: bytes, totalBytes: totalBytes, rows: rows, matchCount: matchCount });
      },
      onMatches: function (matches) {
        self.postMessage({ type: 'matches', fileIndex: fileIndex, matches: matches });
      },
      shouldCancel: function () { return cancelled; },
      yieldToUI: null
    }).then(function (stats) {
      stats.elapsedMs = Date.now() - started;
      self.postMessage({ type: 'done', fileIndex: fileIndex, stats: stats });
    }, function (err) {
      self.postMessage({ type: 'error', fileIndex: fileIndex, message: err && err.message ? err.message : String(err) });
    });
  }
};
