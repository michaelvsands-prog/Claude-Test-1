export const VENDORS = ['LSEG', 'Bloomberg', 'ICE', 'SIX', 'FactSet', 'S&P', 'Other'];

export const TYPES = ['Reference', 'Entity', 'Pricing', 'Sector'];

/** Guess vendor from a file name, e.g. "bloomberg_reference.csv" -> "Bloomberg" */
export function guessVendor(fileName) {
  const lower = fileName.toLowerCase();
  const map = {
    lseg: 'LSEG',
    refinitiv: 'LSEG',
    bloomberg: 'Bloomberg',
    bbg: 'Bloomberg',
    ice: 'ICE',
    six: 'SIX',
    factset: 'FactSet',
    'sp_': 'S&P',
    snp: 'S&P',
  };
  for (const [key, vendor] of Object.entries(map)) {
    if (lower.includes(key)) return vendor;
  }
  return 'Other';
}

/** Guess type from a file name, e.g. "lseg_entity.csv" -> "Entity" */
export function guessType(fileName) {
  const lower = fileName.toLowerCase();
  for (const t of TYPES) {
    if (lower.includes(t.toLowerCase())) return t;
  }
  return 'Reference';
}
