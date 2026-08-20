/*
 * app.js — UI orchestration: 4-step wizard, worker lifecycle, main-thread
 * fallback, progress rendering.
 */
(function () {
  'use strict';

  var D = window.CoverageDetect;
  var H = window.CoverageHoldings;
  var R = window.CoverageResults;

  var ID_TYPES = ['isin', 'sedol', 'cusip', 'ticker'];
  var ID_LABELS = { isin: 'ISIN', sedol: 'SEDOL', cusip: 'CUSIP', ticker: 'Ticker' };

  // ---- state ----
  var state = {
    workbook: null,          // {sheetNames, sheets}
    holdingsRows: null,      // rows of the selected sheet
    holdingsMapping: null,   // {isin,sedol,cusip,ticker} -> col|null (confirmed)
    holdingsHasHeader: true,
    lookup: null,            // from CoverageHoldings.buildLookup
    vendorFiles: [],         // [{file, analysis, config, confirmed}]
    agg: null,
    worker: null,
    workerMode: false,
    cancelled: false,
    scanQueue: [],
    currentScan: -1,
    fileStats: [],
    scanStartTime: 0,
    bytesDone: 0,            // bytes of fully finished files
    totalBytes: 0
  };

  function $(id) { return document.getElementById(id); }

  function setStep(n) {
    var steps = document.querySelectorAll('#stepper .step');
    for (var i = 0; i < steps.length; i++) {
      var s = parseInt(steps[i].getAttribute('data-step'), 10);
      steps[i].classList.toggle('current', s === n);
      steps[i].classList.toggle('done', s < n);
    }
    for (var j = 1; j <= 4; j++) {
      $('step-' + j).classList.toggle('hidden', j !== n);
    }
  }

  function fmtBytes(n) {
    if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB';
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
    if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
    return n + ' B';
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ============================================================
  // Step 1 — Holdings
  // ============================================================

  $('holdings-input').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    H.parseWorkbook(file).then(function (wb) {
      state.workbook = wb;
      var picker = $('holdings-sheet-picker');
      var select = $('holdings-sheet');
      select.innerHTML = '';
      for (var i = 0; i < wb.sheetNames.length; i++) {
        var opt = document.createElement('option');
        opt.value = wb.sheetNames[i];
        opt.textContent = wb.sheetNames[i];
        select.appendChild(opt);
      }
      picker.classList.toggle('hidden', wb.sheetNames.length <= 1);
      selectHoldingsSheet(wb.sheetNames[0]);
    }).catch(function (err) {
      alert('Could not read the workbook: ' + err.message);
    });
  });

  $('holdings-sheet').addEventListener('change', function (e) {
    selectHoldingsSheet(e.target.value);
  });

  $('holdings-has-header').addEventListener('change', function () {
    refreshHoldingsGuess();
  });

  function selectHoldingsSheet(name) {
    var rows = state.workbook.sheets[name] || [];
    // Trim fully-empty rows.
    state.holdingsRows = rows.filter(function (r) {
      for (var i = 0; i < r.length; i++) if (String(r[i]).trim() !== '') return true;
      return false;
    });
    if (state.holdingsRows.length === 0) {
      alert('The selected sheet is empty.');
      return;
    }
    var hasHeader = D.detectHeader(state.holdingsRows);
    $('holdings-has-header').checked = hasHeader;
    refreshHoldingsGuess();
    $('holdings-config').classList.remove('hidden');
  }

  function refreshHoldingsGuess() {
    var hasHeader = $('holdings-has-header').checked;
    var guess = D.guessColumns(state.holdingsRows, hasHeader);
    renderMappingControls($('holdings-mapping'), state.holdingsRows, hasHeader, guess, null);
    renderPreviewTable($('holdings-preview'), state.holdingsRows, hasHeader, 10);
  }

  /**
   * Render the four identifier dropdowns into `container`.
   * onChange (optional) fires when any dropdown changes.
   */
  function renderMappingControls(container, rows, hasHeader, guess, onChange) {
    container.innerHTML = '';
    var header = hasHeader && rows.length > 0 ? rows[0] : null;
    var cols = 0;
    for (var i = 0; i < Math.min(rows.length, 20); i++) cols = Math.max(cols, rows[i].length);

    ID_TYPES.forEach(function (t) {
      var label = document.createElement('label');
      label.textContent = ID_LABELS[t];
      var select = document.createElement('select');
      select.setAttribute('data-idtype', t);
      var none = document.createElement('option');
      none.value = '';
      none.textContent = '— not present —';
      select.appendChild(none);
      for (var c = 0; c < cols; c++) {
        var opt = document.createElement('option');
        opt.value = String(c);
        var name = header && String(header[c]).trim() !== '' ? String(header[c]) : 'Column ' + (c + 1);
        opt.textContent = name;
        select.appendChild(opt);
      }
      if (guess[t] != null) select.value = String(guess[t]);
      if (onChange) select.addEventListener('change', onChange);
      label.appendChild(select);
      container.appendChild(label);
    });
  }

  function readMapping(container) {
    var mapping = { isin: null, sedol: null, cusip: null, ticker: null };
    var selects = container.querySelectorAll('select[data-idtype]');
    for (var i = 0; i < selects.length; i++) {
      var v = selects[i].value;
      mapping[selects[i].getAttribute('data-idtype')] = v === '' ? null : parseInt(v, 10);
    }
    return mapping;
  }

  function renderPreviewTable(table, rows, hasHeader, maxRows) {
    var header = hasHeader && rows.length > 0 ? rows[0] : null;
    var dataRows = hasHeader ? rows.slice(1, 1 + maxRows) : rows.slice(0, maxRows);
    var cols = 0;
    var i;
    for (i = 0; i < dataRows.length; i++) cols = Math.max(cols, dataRows[i].length);
    if (header) cols = Math.max(cols, header.length);

    var html = '<thead><tr>';
    for (i = 0; i < cols; i++) {
      var name = header && String(header[i] == null ? '' : header[i]).trim() !== '' ? String(header[i]) : 'Column ' + (i + 1);
      html += '<th>' + escapeHtml(name) + '</th>';
    }
    html += '</tr></thead><tbody>';
    for (i = 0; i < dataRows.length; i++) {
      html += '<tr>';
      for (var c = 0; c < cols; c++) {
        var v = dataRows[i][c];
        html += '<td>' + escapeHtml(v == null ? '' : v) + '</td>';
      }
      html += '</tr>';
    }
    html += '</tbody>';
    table.innerHTML = html;
  }

  $('holdings-confirm').addEventListener('click', function () {
    var mapping = readMapping($('holdings-mapping'));
    if (mapping.isin == null && mapping.sedol == null && mapping.cusip == null && mapping.ticker == null) {
      alert('Select at least one identifier column (ISIN, SEDOL, CUSIP or Ticker).');
      return;
    }
    var hasHeader = $('holdings-has-header').checked;
    state.holdingsMapping = mapping;
    state.holdingsHasHeader = hasHeader;
    state.lookup = H.buildLookup(state.holdingsRows, mapping, hasHeader);
    if (state.lookup.holdingCount === 0) {
      alert('No holdings rows found.');
      return;
    }
    var idCounts = [];
    ID_TYPES.forEach(function (t) {
      var n = t === 'ticker' ? state.lookup.sets.tickerExact.length : state.lookup.sets[t].length;
      if (n > 0) idCounts.push(n + ' ' + ID_LABELS[t] + 's');
    });
    $('holdings-summary').textContent = state.lookup.holdingCount + ' holdings loaded (' + idCounts.join(', ') + ').';
    setStep(2);
  });

  // ============================================================
  // Step 2 — Vendor files
  // ============================================================

  $('vendor-input').addEventListener('change', function (e) {
    var files = Array.prototype.slice.call(e.target.files);
    if (files.length === 0) return;
    state.vendorFiles = files.map(function (f) { return { file: f, analysis: null, config: null }; });
    $('vendor-cards').innerHTML = '';
    $('vendor-confirm').disabled = true;
    $('vendor-summary').textContent = 'Analyzing ' + files.length + ' file(s)…';

    var pending = files.length;
    state.vendorFiles.forEach(function (vf, idx) {
      D.takeSample(vf.file).then(function (lines) {
        vf.analysis = D.analyzeSample(lines);
        vf.analysis.sourceLines = lines;
        renderVendorCard(vf, idx);
      }).catch(function (err) {
        vf.analysis = { error: err.message };
        renderVendorCard(vf, idx);
      }).then(function () {
        pending--;
        if (pending === 0) {
          $('vendor-summary').textContent = 'Review the detected layout for each file, then start the scan.';
          updateVendorConfirm();
        }
      });
    });
  });

  function renderVendorCard(vf, idx) {
    var container = $('vendor-cards');
    var card = document.createElement('div');
    card.className = 'vendor-card';
    card.setAttribute('data-idx', String(idx));

    var a = vf.analysis;
    var head = '<h4>' + escapeHtml(vf.file.name) + '</h4>' +
      '<div class="meta">' + fmtBytes(vf.file.size) + '</div>';

    if (a.error || !a.delimiter) {
      card.innerHTML = head + '<div class="warn-text">' +
        (a.error ? 'Could not read this file: ' + escapeHtml(a.error)
                 : 'Could not detect a delimiter — this file will be skipped.') + '</div>';
      vf.config = null;
      container.appendChild(card);
      return;
    }

    var delimNames = { '|': 'Pipe (|)', '\t': 'Tab', ',': 'Comma (,)', ';': 'Semicolon (;)' };
    var delimSelect = '<label>Delimiter <select class="vendor-delim">';
    for (var d in delimNames) {
      delimSelect += '<option value="' + escapeHtml(d) + '"' + (d === a.delimiter ? ' selected' : '') + '>' + delimNames[d] + '</option>';
    }
    delimSelect += '</select></label>';

    card.innerHTML = head +
      '<div class="mapping-row">' +
      '<div class="mapping vendor-meta-controls">' + delimSelect +
      '<label class="checkbox" style="flex-direction:row;align-items:center;">' +
      '<input type="checkbox" class="vendor-header"' + (a.hasHeader ? ' checked' : '') + '> First row is a header</label>' +
      '</div>' +
      '<div class="mapping vendor-mapping"></div>' +
      '<div class="table-scroll"><table class="vendor-preview"></table></div>' +
      '</div>';
    container.appendChild(card);

    var reanalyze = function () {
      var delim = card.querySelector('.vendor-delim').value;
      var hasHeader = card.querySelector('.vendor-header').checked;
      var split = a.quoted ? D.splitLineQuoted : D.splitLine;
      var rows = [];
      for (var i = 0; i < Math.min(a.sourceLines.length, 201); i++) rows.push(split(a.sourceLines[i], delim));
      var guess = D.guessColumns(rows, hasHeader);
      vf.analysis.rows = rows;
      renderMappingControls(card.querySelector('.vendor-mapping'), rows, hasHeader, guess, function () {
        vf.config = buildConfig();
      });
      renderPreviewTable(card.querySelector('.vendor-preview'), rows, hasHeader, 5);
      vf.config = buildConfig();
    };

    var buildConfig = function () {
      var mapping = readMapping(card.querySelector('.vendor-mapping'));
      return {
        delimiter: card.querySelector('.vendor-delim').value,
        hasHeader: card.querySelector('.vendor-header').checked,
        quoted: a.quoted,
        columns: mapping
      };
    };

    // Keep the raw sample lines so delimiter changes can re-split.
    a.sourceLines = a.sourceLines || null;
    if (!a.sourceLines) {
      D.takeSample(vf.file).then(function (lines) {
        a.sourceLines = lines;
        reanalyze();
        updateVendorConfirm();
      });
    } else {
      reanalyze();
    }

    card.querySelector('.vendor-delim').addEventListener('change', function () { reanalyze(); updateVendorConfirm(); });
    card.querySelector('.vendor-header').addEventListener('change', function () { reanalyze(); updateVendorConfirm(); });
  }

  function updateVendorConfirm() {
    var usable = 0;
    for (var i = 0; i < state.vendorFiles.length; i++) {
      var vf = state.vendorFiles[i];
      if (vf.config && hasAnyColumn(vf.config.columns)) usable++;
    }
    $('vendor-confirm').disabled = usable === 0;
    if (state.vendorFiles.length > 0 && usable < state.vendorFiles.length) {
      $('vendor-summary').textContent = usable + ' of ' + state.vendorFiles.length +
        ' file(s) ready — files without a mapped identifier column will be skipped.';
    }
  }

  function hasAnyColumn(cols) {
    return cols.isin != null || cols.sedol != null || cols.cusip != null || cols.ticker != null;
  }

  // ============================================================
  // Step 3 — Scan
  // ============================================================

  $('vendor-confirm').addEventListener('click', function () {
    // Refresh configs from the DOM in case the user changed dropdowns last.
    var cards = document.querySelectorAll('.vendor-card');
    for (var i = 0; i < cards.length; i++) {
      var idx = parseInt(cards[i].getAttribute('data-idx'), 10);
      var vf = state.vendorFiles[idx];
      var mappingEl = cards[i].querySelector('.vendor-mapping');
      if (vf.config && mappingEl) vf.config.columns = readMapping(mappingEl);
    }
    state.scanQueue = [];
    for (var j = 0; j < state.vendorFiles.length; j++) {
      var v = state.vendorFiles[j];
      if (v.config && hasAnyColumn(v.config.columns)) state.scanQueue.push(j);
    }
    if (state.scanQueue.length === 0) {
      alert('No vendor file has an identifier column mapped.');
      return;
    }
    startScan();
  });

  function startScan() {
    state.agg = R.createAggregator(state.lookup.holdingCount);
    state.cancelled = false;
    state.fileStats = [];
    state.bytesDone = 0;
    state.currentScan = -1;
    state.totalBytes = 0;
    state.scanStartTime = Date.now();
    for (var i = 0; i < state.scanQueue.length; i++) {
      state.totalBytes += state.vendorFiles[state.scanQueue[i]].file.size;
    }
    renderFileProgressRows();
    setStep(3);

    state.workerMode = false;
    if (window.Worker && location.protocol !== 'file:') {
      try {
        state.worker = new Worker('js/scanner-worker.js');
        state.workerMode = true;
      } catch (e) { state.worker = null; }
    }
    $('fallback-banner').classList.toggle('hidden', state.workerMode);

    if (state.workerMode) {
      state.worker.onmessage = onWorkerMessage;
      state.worker.onerror = function (e) {
        // Worker failed to load (e.g. served without JS) — fall back.
        state.worker.terminate();
        state.worker = null;
        state.workerMode = false;
        $('fallback-banner').classList.remove('hidden');
        scanNextMainThread();
      };
      state.worker.postMessage({ type: 'init', holdings: state.lookup.sets });
      scanNextWorker();
    } else {
      scanNextMainThread();
    }
  }

  function renderFileProgressRows() {
    var container = $('file-progress');
    container.innerHTML = '';
    for (var i = 0; i < state.scanQueue.length; i++) {
      var vf = state.vendorFiles[state.scanQueue[i]];
      var row = document.createElement('div');
      row.className = 'file-row';
      row.id = 'file-row-' + i;
      row.innerHTML =
        '<div class="progress-labels"><span>' + escapeHtml(vf.file.name) + '</span>' +
        '<span class="file-stats">' + fmtBytes(vf.file.size) + '</span></div>' +
        '<div class="progress-track"><div class="progress-fill"></div></div>';
      container.appendChild(row);
    }
    $('overall-fill').style.width = '0%';
    $('overall-stats').textContent = '';
  }

  function updateFileProgress(queuePos, bytes, total, done) {
    var row = $('file-row-' + queuePos);
    if (!row) return;
    var pct = total > 0 ? Math.min(100, 100 * bytes / total) : 100;
    var fill = row.querySelector('.progress-fill');
    fill.style.width = pct.toFixed(1) + '%';
    if (done) fill.classList.add('done');
    var elapsed = (Date.now() - state.scanStartTime) / 1000;
    var overallBytes = state.bytesDone + (done ? 0 : bytes);
    var mbps = elapsed > 0 ? (overallBytes / 1048576 / elapsed) : 0;
    row.querySelector('.file-stats').textContent =
      fmtBytes(bytes) + ' / ' + fmtBytes(total) + (done ? ' — done' : '');
    var overallPct = state.totalBytes > 0 ? 100 * overallBytes / state.totalBytes : 100;
    $('overall-fill').style.width = overallPct.toFixed(1) + '%';
    $('overall-stats').textContent = overallPct.toFixed(0) + '% · ' + mbps.toFixed(0) + ' MB/s';
  }

  // ---- worker path ----

  function scanNextWorker() {
    state.currentScan++;
    if (state.cancelled || state.currentScan >= state.scanQueue.length) return finishScan();
    var idx = state.scanQueue[state.currentScan];
    var vf = state.vendorFiles[idx];
    state.worker.postMessage({ type: 'scan', fileIndex: state.currentScan, file: vf.file, config: vf.config });
  }

  function onWorkerMessage(e) {
    var msg = e.data;
    var queuePos = msg.fileIndex;
    var idx = state.scanQueue[queuePos];
    var fileName = state.vendorFiles[idx].file.name;
    if (msg.type === 'progress') {
      updateFileProgress(queuePos, msg.bytesProcessed, msg.totalBytes, false);
    } else if (msg.type === 'matches') {
      R.applyMatches(state.agg, msg.matches, fileName, state.lookup.valueToRows);
    } else if (msg.type === 'done') {
      state.bytesDone += state.vendorFiles[idx].file.size;
      state.fileStats[queuePos] = msg.stats;
      updateFileProgress(queuePos, msg.stats.bytes, state.vendorFiles[idx].file.size, true);
      scanNextWorker();
    } else if (msg.type === 'error') {
      state.fileStats[queuePos] = { error: msg.message };
      updateFileProgress(queuePos, 0, state.vendorFiles[idx].file.size, true);
      scanNextWorker();
    }
  }

  // ---- main-thread fallback path ----

  function scanNextMainThread() {
    state.currentScan++;
    if (state.cancelled || state.currentScan >= state.scanQueue.length) return finishScan();
    var queuePos = state.currentScan;
    var idx = state.scanQueue[queuePos];
    var vf = state.vendorFiles[idx];
    var fileName = vf.file.name;
    var lookup = {
      isin: new Set(state.lookup.sets.isin),
      sedol: new Set(state.lookup.sets.sedol),
      cusip: new Set(state.lookup.sets.cusip),
      tickerExact: new Set(state.lookup.sets.tickerExact),
      tickerRoot: new Set(state.lookup.sets.tickerRoot)
    };
    window.CoverageScan.scanFile(vf.file, vf.config, lookup, {
      onProgress: function (bytes) { updateFileProgress(queuePos, bytes, vf.file.size, false); },
      onMatches: function (matches) { R.applyMatches(state.agg, matches, fileName, state.lookup.valueToRows); },
      shouldCancel: function () { return state.cancelled; },
      yieldToUI: function () { return new Promise(function (res) { setTimeout(res, 0); }); }
    }).then(function (stats) {
      state.bytesDone += vf.file.size;
      state.fileStats[queuePos] = stats;
      updateFileProgress(queuePos, stats.bytes, vf.file.size, true);
      scanNextMainThread();
    }, function (err) {
      state.fileStats[queuePos] = { error: err && err.message ? err.message : String(err) };
      updateFileProgress(queuePos, 0, vf.file.size, true);
      scanNextMainThread();
    });
  }

  $('scan-cancel').addEventListener('click', function () {
    state.cancelled = true;
    if (state.worker) state.worker.postMessage({ type: 'cancel' });
  });

  function finishScan() {
    if (state.worker) {
      state.worker.terminate();
      state.worker = null;
    }
    renderResults();
    setStep(4);
  }

  // ============================================================
  // Step 4 — Results
  // ============================================================

  var detail = null;

  function renderResults() {
    var fileNames = state.scanQueue.map(function (i) { return state.vendorFiles[i].file.name; });
    var summary = R.summarize(state.agg, fileNames);
    detail = R.buildDetail(state.agg, state.lookup.dataRows, state.lookup.headerRow, state.holdingsMapping);

    var cards = $('summary-cards');
    cards.innerHTML =
      card(summary.total, 'Total holdings', '') +
      card(summary.matched, 'Covered by vendor', 'good') +
      card(summary.unmatched, 'Not covered', summary.unmatched > 0 ? 'bad' : '') +
      card(summary.coveragePct.toFixed(1) + '%', 'Coverage', summary.coveragePct >= 90 ? 'good' : '');
    if (state.cancelled) {
      cards.innerHTML += '<div class="banner warn" style="flex-basis:100%">Scan was cancelled — results are partial.</div>';
    }
    var errors = state.fileStats.filter(function (s) { return s && s.error; });
    if (errors.length > 0) {
      cards.innerHTML += '<div class="banner warn" style="flex-basis:100%">' + errors.length + ' file(s) failed to scan — results exclude them.</div>';
    }

    // By identifier type (a holding can match on several types).
    var t = '<thead><tr><th>Identifier</th><th>Holdings matched</th><th>Best-match basis</th></tr></thead><tbody>';
    ID_TYPES.forEach(function (ty) {
      t += '<tr><td>' + ID_LABELS[ty] + '</td><td>' + summary.byType[ty] + '</td><td>' + summary.byBestType[ty] + '</td></tr>';
    });
    $('by-type').innerHTML = t + '</tbody>';

    var f = '<thead><tr><th>Vendor file</th><th>Holdings found</th><th>Rows scanned</th></tr></thead><tbody>';
    for (var i = 0; i < fileNames.length; i++) {
      var st = state.fileStats[i] || {};
      f += '<tr><td>' + escapeHtml(fileNames[i]) + '</td><td>' + (summary.byFile[fileNames[i]] || 0) + '</td><td>' +
        (st.error ? '<span class="warn-text">failed: ' + escapeHtml(st.error) + '</span>' : (st.rows != null ? st.rows.toLocaleString() : '—')) + '</td></tr>';
    }
    $('by-file').innerHTML = f + '</tbody>';

    var tickerOnly = detail.rows.filter(function (r) { return r.tickerOnly; }).length;
    $('ticker-note').classList.toggle('hidden', tickerOnly === 0);
    if (tickerOnly > 0) {
      $('ticker-note').textContent = tickerOnly + ' holding(s) matched on ticker only — ticker matches are lower confidence than ISIN/SEDOL/CUSIP matches.';
    }

    renderDetailTable();
  }

  function card(value, label, cls) {
    return '<div class="card ' + cls + '"><div class="big">' + value + '</div><div class="label">' + label + '</div></div>';
  }

  function renderDetailTable() {
    var filter = $('detail-filter').value;
    var html = '<thead><tr>';
    for (var c = 0; c < detail.columns.length; c++) html += '<th>' + escapeHtml(detail.columns[c]) + '</th>';
    html += '<th>Matched</th><th>Match type</th><th>Vendor files</th></tr></thead><tbody>';
    for (var r = 0; r < detail.rows.length; r++) {
      var row = detail.rows[r];
      if (filter === 'matched' && !row.matched) continue;
      if (filter === 'unmatched' && row.matched) continue;
      html += '<tr>';
      for (var c2 = 0; c2 < row.cells.length; c2++) html += '<td>' + escapeHtml(row.cells[c2]) + '</td>';
      html += '<td class="' + (row.matched ? 'ok">Yes' : 'miss">No') + '</td>';
      html += '<td>' + row.matchType + '</td><td>' + escapeHtml(row.files) + '</td></tr>';
    }
    html += '</tbody>';
    $('detail-table').innerHTML = html;
  }

  $('detail-filter').addEventListener('change', renderDetailTable);
  $('download-full').addEventListener('click', function () {
    R.downloadCsv(R.toCsv(detail, 'all'), 'coverage-results.csv');
  });
  $('download-unmatched').addEventListener('click', function () {
    R.downloadCsv(R.toCsv(detail, 'unmatched'), 'coverage-unmatched.csv');
  });
  $('restart').addEventListener('click', function () {
    location.reload();
  });

})();
