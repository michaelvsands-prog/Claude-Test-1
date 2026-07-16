// Value profilers: each returns true if a single value fits the pattern.
// The matcher computes a hit-rate over a column's sample values and uses a
// high hit-rate (>= 0.8) as a confidence boost — never the sole match basis.

const CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK',
  'DKK', 'SGD', 'HKD', 'CNY', 'CNH', 'KRW', 'INR', 'BRL', 'MXN', 'ZAR',
  'PLN', 'CZK', 'HUF', 'TRY', 'ILS', 'AED', 'SAR', 'THB', 'MYR', 'IDR',
  'PHP', 'TWD', 'RUB', 'CLP', 'COP', 'PEN', 'ARS', 'EGP', 'NGN', 'VND',
]);

const COUNTRIES_A2 = new Set([
  'US', 'GB', 'DE', 'FR', 'CH', 'JP', 'CA', 'AU', 'NZ', 'SE', 'NO', 'DK',
  'SG', 'HK', 'CN', 'KR', 'IN', 'BR', 'MX', 'ZA', 'PL', 'CZ', 'HU', 'TR',
  'IL', 'AE', 'SA', 'TH', 'MY', 'ID', 'PH', 'TW', 'NL', 'BE', 'LU', 'IE',
  'IT', 'ES', 'PT', 'AT', 'FI', 'GR', 'IS', 'LI', 'MC', 'KY', 'BM', 'VG',
  'JE', 'GG', 'IM', 'CL', 'CO', 'PE', 'AR', 'EG', 'NG', 'VN', 'RU',
]);

const COUNTRIES_A3 = new Set([
  'USA', 'GBR', 'DEU', 'FRA', 'CHE', 'JPN', 'CAN', 'AUS', 'NZL', 'SWE',
  'NOR', 'DNK', 'SGP', 'HKG', 'CHN', 'KOR', 'IND', 'BRA', 'MEX', 'ZAF',
  'POL', 'CZE', 'HUN', 'TUR', 'ISR', 'ARE', 'SAU', 'THA', 'MYS', 'IDN',
  'PHL', 'TWN', 'NLD', 'BEL', 'LUX', 'IRL', 'ITA', 'ESP', 'PRT', 'AUT',
  'FIN', 'GRC', 'ISL', 'CYM', 'BMU', 'JEY', 'GGY', 'IMN',
]);

const MICS = new Set([
  'XNYS', 'XNAS', 'XLON', 'XPAR', 'XETR', 'XFRA', 'XSWX', 'XVTX', 'XTKS',
  'XTSE', 'XASX', 'XHKG', 'XSES', 'XAMS', 'XBRU', 'XMIL', 'XMAD', 'XSTO',
  'XCSE', 'XOSL', 'XHEL', 'XDUB', 'XWBO', 'XLIS', 'BATS', 'ARCX', 'XCBO',
]);

/** Expand letters to digits (A=10..Z=35) then run Luhn from the right. */
function luhnOverExpanded(s) {
  let digits = '';
  for (const ch of s) {
    digits += /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
  }
  let sum = 0;
  let dbl = true; // rightmost digit is the check digit; double starts left of it
  for (let i = digits.length - 2; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[digits.length - 1]);
}

export const PROFILERS = {
  isin(v) {
    if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(v)) return false;
    return luhnOverExpanded(v);
  },

  cusip(v) {
    if (!/^[0-9A-Z]{8}[0-9]$/.test(v)) return false;
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      const ch = v[i];
      let d = /[A-Z]/.test(ch) ? ch.charCodeAt(0) - 55 : Number(ch);
      if (i % 2 === 1) d *= 2;
      sum += Math.floor(d / 10) + (d % 10);
    }
    return (10 - (sum % 10)) % 10 === Number(v[8]);
  },

  sedol(v) {
    if (!/^[0-9BCDFGHJKLMNPQRSTVWXYZ]{6}[0-9]$/.test(v)) return false;
    const weights = [1, 3, 1, 7, 3, 9];
    let sum = 0;
    for (let i = 0; i < 6; i++) {
      const ch = v[i];
      const d = /[A-Z]/.test(ch) ? ch.charCodeAt(0) - 55 : Number(ch);
      sum += d * weights[i];
    }
    return (10 - (sum % 10)) % 10 === Number(v[6]);
  },

  lei(v) {
    if (!/^[A-Z0-9]{18}[0-9]{2}$/.test(v)) return false;
    // ISO 7064 mod 97-10 over letter-expanded digits.
    let digits = '';
    for (const ch of v) {
      digits += /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    }
    let rem = 0;
    for (const d of digits) rem = (rem * 10 + Number(d)) % 97;
    return rem === 1;
  },

  iso4217(v) {
    return CURRENCIES.has(v.toUpperCase());
  },

  iso3166(v) {
    const u = v.toUpperCase();
    return COUNTRIES_A2.has(u) || COUNTRIES_A3.has(u);
  },

  mic(v) {
    return /^[A-Z0-9]{4}$/.test(v) && MICS.has(v.toUpperCase());
  },

  date(v) {
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(v) ||
      /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v) ||
      /^\d{2}\.\d{2}\.\d{4}$/.test(v) ||
      /^\d{8}$/.test(v)
    );
  },

  decimal(v) {
    return /^-?[\d,]+(\.\d+)?$/.test(String(v).trim());
  },
};

/** Fraction of non-empty sample values that satisfy the named profiler. */
export function profileHitRate(profilerId, samples) {
  const fn = PROFILERS[profilerId];
  if (!fn || !samples || !samples.length) return 0;
  const vals = samples.map((s) => String(s).trim()).filter(Boolean);
  if (!vals.length) return 0;
  let hits = 0;
  for (const v of vals) if (fn(v)) hits++;
  return hits / vals.length;
}
