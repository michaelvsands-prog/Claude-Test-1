import { ABBREVIATIONS } from '../data/abbreviations.js';

/**
 * Normalize a header for matching: lowercase, punctuation -> spaces,
 * expand common financial-data abbreviations token by token.
 * e.g. "CNTRY_OF_INCORPORATION" -> "country of incorporation"
 */
export function normalize(header) {
  if (!header) return '';
  let s = String(header).toLowerCase();
  // Treat brackets/parens and common separators as token boundaries.
  s = s.replace(/[()\[\]{}_\-./\\,:;|]+/g, ' ');
  // Split camelCase boundaries that survive lowercasing don't exist; but strip
  // any remaining non-alphanumeric characters.
  s = s.replace(/[^a-z0-9 ]+/g, ' ');
  const tokens = s
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ABBREVIATIONS[t] ?? t);
  return tokens.join(' ');
}
