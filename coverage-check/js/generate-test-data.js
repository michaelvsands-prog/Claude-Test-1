#!/usr/bin/env node
/*
 * generate-test-data.js — dev-only. Synthesizes a large pipe-delimited vendor
 * SRM file with planted identifiers, plus a holdings .xlsx (via the vendored
 * SheetJS build) where half the holdings match the planted identifiers and
 * half do not.
 *
 * Usage:  node generate-test-data.js [sizeMB] [outDir]
 *   e.g.  node generate-test-data.js 2000 /tmp/covtest   -> ~2 GB vendor file
 * Writes: vendor-test.txt, vendor-test-2.txt (small), holdings-test.xlsx,
 *         expected.json (the planted identifiers, for verification).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const sizeMB = parseInt(process.argv[2] || '100', 10);
const outDir = process.argv[3] || '.';
fs.mkdirSync(outDir, { recursive: true });

// ---- deterministic pseudo-random ----
let seed = 42;
// Math.imul keeps the multiply exact in 32-bit space — a plain `*` overflows
// float precision and collapses the state space (duplicate identifiers).
function rnd() { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CONS = 'BCDFGHJKLMNPQRSTVWXYZ0123456789'; // SEDOLs have no vowels

function randIsin() {
  const cc = pick(['US', 'GB', 'DE', 'FR', 'JP', 'CA', 'AU', 'CH']);
  let body = '';
  for (let i = 0; i < 9; i++) body += ALNUM[Math.floor(rnd() * ALNUM.length)];
  // Luhn check digit
  let digits = '';
  for (const ch of cc + body) {
    digits += ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch;
  }
  let sum = 0, dbl = true;
  for (let j = digits.length - 1; j >= 0; j--) {
    let d = digits.charCodeAt(j) - 48;
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  return cc + body + ((10 - (sum % 10)) % 10);
}

function randSedol() {
  const weights = [1, 3, 1, 7, 3, 9];
  let s = '', sum = 0;
  for (let i = 0; i < 6; i++) {
    const ch = CONS[Math.floor(rnd() * CONS.length)];
    s += ch;
    const v = ch >= '0' && ch <= '9' ? ch.charCodeAt(0) - 48 : ch.charCodeAt(0) - 55;
    sum += v * weights[i];
  }
  return s + ((10 - (sum % 10)) % 10);
}

function randTicker() {
  let s = '';
  const len = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < len; i++) s += LETTERS[Math.floor(rnd() * LETTERS.length)];
  return s;
}

function randName() {
  const a = ['GLOBAL', 'PACIFIC', 'NORTH', 'UNITED', 'FIRST', 'ALPHA', 'STERLING', 'SUMMIT'];
  const b = ['HOLDINGS', 'INDUSTRIES', 'CAPITAL', 'ENERGY', 'PHARMA', 'FOODS', 'TECH', 'MOTORS'];
  const c = ['INC', 'PLC', 'CORP', 'SA', 'AG', 'LTD'];
  return pick(a) + ' ' + pick(b) + ' ' + pick(c);
}

// ---- planted identifiers (these go into both vendor file and holdings) ----
const PLANT_COUNT = 40;
const planted = [];
for (let i = 0; i < PLANT_COUNT; i++) {
  planted.push({ isin: randIsin(), sedol: randSedol(), ticker: randTicker() + i, name: randName() });
}

function vendorRow(sec) {
  // 20-column pipe-delimited record; identifiers in columns 2 (ISIN), 3 (SEDOL), 5 (TICKER).
  const cols = [
    'SEC' + Math.floor(rnd() * 1e9),
    sec.isin,
    sec.sedol,
    pick(['EQUITY', 'BOND', 'FUND']),
    sec.ticker,
    sec.name,
    pick(['USD', 'GBP', 'EUR', 'JPY']),
    pick(['XNYS', 'XLON', 'XETR', 'XTKS']),
    (rnd() * 1000).toFixed(4),
    '20260819',
    pick(['A', 'I', '']),
    'N',
    (rnd() * 1e6).toFixed(0),
    '', '', 'SRC1',
    (rnd() * 100).toFixed(2),
    pick(['US', 'GB', 'DE', 'JP']),
    'CMN',
    'EOD'
  ];
  return cols.join('|');
}

function randomSecurity() {
  return { isin: randIsin(), sedol: randSedol(), ticker: randTicker(), name: randName() };
}

// ---- write the big vendor file ----
const bigPath = path.join(outDir, 'vendor-test.txt');
const targetBytes = sizeMB * 1048576;
const ws = fs.createWriteStream(bigPath);
const HEADER = ['SEC_ID', 'ISIN', 'SEDOL', 'SEC_TYPE', 'TICKER', 'SEC_NAME', 'CCY', 'MIC', 'PRICE', 'AS_OF', 'STATUS', 'RESTRICTED', 'SHARES_OUT', 'F14', 'F15', 'SOURCE', 'WEIGHT', 'CNTRY', 'CLASS', 'FREQ'].join('|');

let written = 0;
let rowNum = 0;
let plantIdx = 0;

function writeBig() {
  let ok = true;
  while (ok && written < targetBytes) {
    let buf = '';
    for (let i = 0; i < 2000 && written + buf.length < targetBytes; i++) {
      let line;
      if (rowNum === 0) {
        line = HEADER;
      } else if (rowNum % 10000 === 50 && plantIdx < planted.length) {
        line = vendorRow(planted[plantIdx++]); // plant half of them in the big file
        if (plantIdx >= PLANT_COUNT / 2) plantIdx = PLANT_COUNT; // stop planting here
      } else {
        line = vendorRow(randomSecurity());
      }
      // Mix CRLF in occasionally to exercise line-ending handling.
      buf += line + (rowNum % 7 === 3 ? '\r\n' : '\n');
      rowNum++;
    }
    written += Buffer.byteLength(buf);
    ok = ws.write(buf);
  }
  if (written < targetBytes) ws.once('drain', writeBig);
  else ws.end(finish);
}

function finish() {
  // Small second vendor file: contains the other half of the planted
  // identifiers (and one overlap with the big file), no trailing newline.
  const smallPath = path.join(outDir, 'vendor-test-2.txt');
  let lines = [HEADER];
  for (let i = Math.floor(PLANT_COUNT / 2); i < PLANT_COUNT; i++) lines.push(vendorRow(planted[i]));
  lines.push(vendorRow(planted[0])); // overlap: planted[0] appears in both files
  for (let i = 0; i < 5000; i++) lines.push(vendorRow(randomSecurity()));
  fs.writeFileSync(smallPath, '﻿' + lines.join('\n')); // BOM + no trailing newline

  // Holdings workbook: all planted (should match) + unmatched extras.
  const XLSX = require(path.join(__dirname, '..', 'vendor', 'xlsx.full.min.js'));
  const rows = [['Security Name', 'ISIN', 'SEDOL', 'Ticker', 'Quantity']];
  const expected = { matched: [], unmatched: [] };
  for (const p of planted) {
    rows.push([p.name, p.isin, p.sedol, p.ticker + ' US', Math.floor(rnd() * 10000)]);
    expected.matched.push(p.isin);
  }
  for (let i = 0; i < PLANT_COUNT; i++) {
    const s = randomSecurity();
    // Ticker must not collide with the vendor files' random 2-4 letter
    // tickers, or the expected match count becomes nondeterministic.
    s.ticker = 'ZZ' + i + 'X';
    rows.push([s.name, s.isin, s.sedol, s.ticker, Math.floor(rnd() * 10000)]);
    expected.unmatched.push(s.isin);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Holdings');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  fs.writeFileSync(path.join(outDir, 'holdings-test.xlsx'), wbout);

  fs.writeFileSync(path.join(outDir, 'expected.json'), JSON.stringify({
    plantedCount: PLANT_COUNT,
    holdingsTotal: PLANT_COUNT * 2,
    expectedMatched: PLANT_COUNT,
    expectedUnmatched: PLANT_COUNT,
    bigFilePlants: Math.floor(PLANT_COUNT / 2),
    smallFilePlants: PLANT_COUNT - Math.floor(PLANT_COUNT / 2) + 1,
    identifiers: planted
  }, null, 2));

  console.log('Wrote:');
  console.log('  ' + bigPath + ' (' + (written / 1048576).toFixed(1) + ' MB, ' + rowNum.toLocaleString() + ' rows)');
  console.log('  ' + smallPath);
  console.log('  ' + path.join(outDir, 'holdings-test.xlsx'));
  console.log('Expected coverage: ' + PLANT_COUNT + ' of ' + PLANT_COUNT * 2 + ' holdings (50.0%)');
}

writeBig();
