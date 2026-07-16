#!/usr/bin/env node
// Generates deterministic synthetic vendor data files for the SRM Crosswalk demo.
// All identifiers, names, and values are fake; check digits are valid so the
// value profilers light up. Run: node sample-data/generate.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = dirname(fileURLToPath(import.meta.url));

// --- Seeded PRNG (mulberry32) for reproducible output ---
let seed = 0xbeac0001 & 0xffffffff;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

// --- Check-digit helpers (mirror src/engine/profilers.js) ---
function isinCheckDigit(body) {
  let digits = '';
  for (const ch of body) digits += /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
  let sum = 0;
  let dbl = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return String((10 - (sum % 10)) % 10);
}
function cusipCheckDigit(body) {
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const ch = body[i];
    let d = /[A-Z]/.test(ch) ? ch.charCodeAt(0) - 55 : Number(ch);
    if (i % 2 === 1) d *= 2;
    sum += Math.floor(d / 10) + (d % 10);
  }
  return String((10 - (sum % 10)) % 10);
}
function sedolCheckDigit(body) {
  const weights = [1, 3, 1, 7, 3, 9];
  let sum = 0;
  for (let i = 0; i < 6; i++) {
    const ch = body[i];
    const d = /[A-Z]/.test(ch) ? ch.charCodeAt(0) - 55 : Number(ch);
    sum += d * weights[i];
  }
  return String((10 - (sum % 10)) % 10);
}
function leiCheck(body18) {
  let digits = '';
  for (const ch of body18 + '00') digits += /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
  let rem = 0;
  for (const d of digits) rem = (rem * 10 + Number(d)) % 97;
  const check = 98 - rem;
  return body18 + String(check).padStart(2, '0');
}

// --- Fake universe ---
const NAME_PARTS_A = ['Acme', 'Nordwind', 'Bluepeak', 'Silverline', 'Harborstone', 'Vantage', 'Crescent', 'Ironbridge', 'Solaris', 'Kestrel', 'Alpenrose', 'Meridian', 'Oakfield', 'Redcliff', 'Stellar'];
const NAME_PARTS_B = ['Industrials', 'Capital', 'Energy', 'Logistics', 'Pharma', 'Foods', 'Materials', 'Systems', 'Networks', 'Utilities', 'Retail Group', 'Financial', 'Aerospace', 'Marine', 'Mining'];
const SUFFIXES = [
  { s: 'PLC', c: 'GB' }, { s: 'Inc', c: 'US' }, { s: 'Corp', c: 'US' },
  { s: 'AG', c: 'DE' }, { s: 'SA', c: 'FR' }, { s: 'AG', c: 'CH' },
  { s: 'NV', c: 'NL' }, { s: 'SpA', c: 'IT' }, { s: 'AB', c: 'SE' }, { s: 'KK', c: 'JP' },
];
const CCY_BY_COUNTRY = { GB: 'GBP', US: 'USD', DE: 'EUR', FR: 'EUR', CH: 'CHF', NL: 'EUR', IT: 'EUR', SE: 'SEK', JP: 'JPY' };
const MIC_BY_COUNTRY = { GB: 'XLON', US: 'XNYS', DE: 'XETR', FR: 'XPAR', CH: 'XSWX', NL: 'XAMS', IT: 'XMIL', SE: 'XSTO', JP: 'XTKS' };
const EXCH_NAME_BY_MIC = { XLON: 'London Stock Exchange', XNYS: 'New York Stock Exchange', XETR: 'Deutsche Boerse Xetra', XPAR: 'Euronext Paris', XSWX: 'SIX Swiss Exchange', XAMS: 'Euronext Amsterdam', XMIL: 'Borsa Italiana', XSTO: 'Nasdaq Stockholm', XTKS: 'Tokyo Stock Exchange' };
const ASSET = ['Corporate Bond', 'Equity', 'Corporate Bond', 'Corporate Bond', 'Equity'];
const SENIORITY = ['Senior Unsecured', 'Senior Secured', 'Subordinated'];
const DAY_COUNT = ['30/360', 'ACT/ACT', 'ACT/360'];
const FREQ = ['Annual', 'Semi-Annual', 'Quarterly'];

function alnum(n) {
  const chars = 'ABCDEFGHJKLMNPQRSTVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < n; i++) s += chars[Math.floor(rand() * chars.length)];
  return s;
}
function digits(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += String(Math.floor(rand() * 10));
  return s;
}

const securities = [];
const usedNames = new Set();
while (securities.length < 50) {
  const name = `${pick(NAME_PARTS_A)} ${pick(NAME_PARTS_B)}`;
  if (usedNames.has(name)) continue;
  usedNames.add(name);
  const suf = pick(SUFFIXES);
  const country = suf.c;
  const ccy = CCY_BY_COUNTRY[country];
  const mic = MIC_BY_COUNTRY[country];
  const assetClass = pick(ASSET);
  const isBond = assetClass === 'Corporate Bond';

  const isinBody = country + alnum(9);
  const isin = isinBody + isinCheckDigit(isinBody);
  const cusipBody = digits(3) + alnum(5);
  const cusip = cusipBody + cusipCheckDigit(cusipBody);
  const sedolBody = pick(['B', 'C', 'D', '0', '2', '3']) + alnum(5).replace(/[AEIOU]/g, 'X');
  const sedol = sedolBody + sedolCheckDigit(sedolBody);
  const figi = 'BBG' + alnum(9);
  const tickerRoot = name.split(' ')[0].slice(0, 4).toUpperCase();
  const ticker = tickerRoot + (isBond ? '' : String(randInt(0, 9)));
  const ric = `${tickerRoot}.${{ XLON: 'L', XNYS: 'N', XETR: 'DE', XPAR: 'PA', XSWX: 'S', XAMS: 'AS', XMIL: 'MI', XSTO: 'ST', XTKS: 'T' }[mic]}`;
  const legalName = `${name} ${suf.s}`;

  const issueY = randInt(2015, 2024);
  const matY = issueY + randInt(3, 15);
  const m = String(randInt(1, 12)).padStart(2, '0');
  const d = String(randInt(1, 28)).padStart(2, '0');
  const coupon = isBond ? (randInt(50, 750) / 100).toFixed(3) : '';
  const par = isBond ? pick(['1000', '1000', '100000']) : '';
  const issueAmt = isBond ? String(randInt(100, 2000) * 1000000) : '';
  const outAmt = isBond ? String(Math.floor(Number(issueAmt) * (randInt(60, 100) / 100))) : '';

  securities.push({
    isin, cusip, sedol, figi, ticker, ric, valor: digits(randInt(6, 8)),
    name, legalName, country, ccy, mic, exchName: EXCH_NAME_BY_MIC[mic], assetClass, isBond,
    desc: isBond ? `${name} ${coupon}% ${matY}` : `${name} Common Stock`,
    issueDate: `${issueY}-${m}-${d}`, maturityDate: isBond ? `${matY}-${m}-${d}` : '',
    coupon, freq: isBond ? pick(FREQ) : '', dayCount: isBond ? pick(DAY_COUNT) : '',
    par, issueAmt, outAmt,
    seniority: isBond ? pick(SENIORITY) : '', callable: isBond ? pick(['Y', 'N', 'N']) : 'N',
    settleDays: isBond ? '2' : '2', minDenom: isBond ? par : '',
    status: pick(['Active', 'Active', 'Active', 'Active', 'Matured']),
    lei: leiCheck(alnum(18)),
    parentName: rand() < 0.3 ? `${name} Holdings ${suf.s}` : legalName,
    parentLei: leiCheck(alnum(18)),
    regNum: digits(8),
    entityType: pick(['Public Limited Company', 'Corporation', 'Aktiengesellschaft', 'Societe Anonyme']),
    bic: alnum(4).replace(/[0-9]/g, 'B') + country + alnum(2),
  });
}

const usDate = (iso) => (iso ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : '');
const dotDate = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');

function csv(headers, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n') + '\n';
}

const files = {
  // Bloomberg: ID_-prefixed, terse, US date format. Junk cols: FEED_SOURCE_ID, ROW_HASH.
  'bloomberg_reference.csv': csv(
    ['ID_ISIN', 'ID_CUSIP', 'ID_SEDOL1', 'ID_BB_GLOBAL', 'TICKER', 'NAME', 'SECURITY_DES', 'MARKET_SECTOR_DES', 'CRNCY', 'CNTRY_OF_INCORPORATION', 'ID_MIC_PRIM_EXCH', 'ISSUE_DT', 'MATURITY', 'CPN', 'CPN_FREQ', 'DAY_CNT_DES', 'PAR_AMT', 'AMT_OUTSTANDING', 'PAYMENT_RANK', 'CALLABLE', 'PX_SETTLE_DAYS', 'FEED_SOURCE_ID', 'ROW_HASH'],
    securities.map((s) => [s.isin, s.cusip, s.sedol, s.figi, s.ticker, s.name.toUpperCase(), s.desc.toUpperCase(), s.assetClass === 'Equity' ? 'Equity' : 'Corp', s.ccy, s.country, s.mic, usDate(s.issueDate), usDate(s.maturityDate), s.coupon, s.freq, s.dayCount, s.par, s.outAmt, s.seniority, s.callable, s.settleDays, 'BBG-SFTP-01', alnum(12)])
  ),
  // LSEG: spelled-out headers, ISO dates. Junk cols: PermID (real concept, no canonical attr), Quality Flag.
  'lseg_reference.csv': csv(
    ['ISIN', 'CUSIP', 'SEDOL', 'RIC', 'Ticker Symbol', 'Issuer Name', 'Security Description', 'Asset Category', 'Currency Code', 'Country of Incorporation', 'Exchange MIC', 'Primary Exchange', 'Issue Date', 'Maturity Date', 'Coupon Rate', 'Coupon Frequency', 'Day Count Basis', 'Face Value', 'Outstanding Amount', 'Seniority', 'Callable Flag', 'Security Status', 'PermID', 'Quality Flag'],
    securities.map((s) => [s.isin, s.cusip, s.sedol, s.ric, s.ticker, s.name, s.desc, s.assetClass, s.ccy, s.country, s.mic, s.exchName, s.issueDate, s.maturityDate, s.coupon, s.freq, s.dayCount, s.par, s.outAmt, s.seniority, s.callable === 'Y' ? 'Yes' : 'No', s.status, digits(10), pick(['A', 'A', 'B'])])
  ),
  // ICE: heavily abbreviated, ISO dates. Junk cols: SRC_SYS_CD, LOAD_TS.
  'ice_reference.csv': csv(
    ['ISIN_CD', 'CUSIP_CD', 'SEDOL_CD', 'TKR', 'ISSUER_NM', 'SEC_DESC', 'ASSET_CLS', 'CRNCY_CD', 'CNTRY_INC', 'EXCH_MIC_CD', 'ISS_DT', 'MAT_DT', 'CPN_RT', 'CPN_FREQ_CD', 'DAY_CNT', 'PAR_VAL', 'OUTSTD_AMT', 'SEN_LVL', 'CALL_IND', 'MIN_DENOM', 'SEC_STAT', 'SRC_SYS_CD', 'LOAD_TS'],
    securities.map((s) => [s.isin, s.cusip, s.sedol, s.ticker, s.name, s.desc, s.assetClass, s.ccy, s.country, s.mic, s.issueDate, s.maturityDate, s.coupon, s.freq ? s.freq[0] : '', s.dayCount, s.par, s.outAmt, s.seniority, s.callable, s.minDenom, s.status, 'ICE-REF-2', `${s.issueDate}T04:00:00Z`])
  ),
  // SIX: Valor-flavored, dotted dates. Junk col: Listing ID.
  'six_reference.csv': csv(
    ['ISIN', 'Valor Number', 'Security Name', 'Instrument Type', 'Trading Currency', 'Country', 'Exchange', 'Issue Date', 'Redemption Date', 'Interest Rate', 'Interest Frequency', 'Nominal Value', 'Minimum Piece', 'Instrument Status', 'Listing ID'],
    securities.map((s) => [s.isin, s.valor, s.desc, s.assetClass === 'Equity' ? 'Share' : 'Bond', s.ccy, s.country, s.mic, dotDate(s.issueDate), dotDate(s.maturityDate), s.coupon, s.freq, s.par, s.minDenom, s.status, 'CH-' + digits(7)])
  ),
  // Entity files
  'lseg_entity.csv': csv(
    ['LEI', 'Legal Name', 'Short Name', 'Ultimate Parent LEI', 'Ultimate Parent Name', 'Country of Domicile', 'Jurisdiction', 'Legal Form', 'Company Registration Number', 'Entity Status', 'SWIFT BIC', 'PermID'],
    securities.map((s) => [s.lei, s.legalName, s.name, s.parentLei, s.parentName, s.country, s.country, s.entityType, s.regNum, 'Active', s.bic, digits(10)])
  ),
  'bloomberg_entity.csv': csv(
    ['LEGAL_ENTITY_IDENTIFIER', 'LEGAL_NM', 'SHORT_NM', 'ULT_PARENT_LEI', 'ULT_PARENT_NM', 'CNTRY_DOM', 'CNTRY_REG', 'ENTITY_TYP', 'REG_NUM', 'ENTITY_STAT', 'BIC_CD', 'BBG_INTERNAL_KEY'],
    securities.map((s) => [s.lei, s.legalName.toUpperCase(), s.name.toUpperCase(), s.parentLei, s.parentName.toUpperCase(), s.country, s.country, s.entityType, s.regNum, 'ACTIVE', s.bic, alnum(10)])
  ),
};

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(OUT_DIR, name), content);
  console.log(`wrote ${name} (${content.split('\n').length - 2} rows)`);
}
