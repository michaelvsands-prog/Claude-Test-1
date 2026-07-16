import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const SAMPLE_LIMIT = 50;

/**
 * Parse a CSV or XLSX File in the browser.
 * Returns { headers, samplesByHeader, rowCount } — raw rows are NOT retained.
 */
export async function parseFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return parseXlsx(file);
  return parseCsv(file);
}

function collectSamples(headers, rows) {
  const samplesByHeader = {};
  for (const h of headers) samplesByHeader[h] = [];
  for (const row of rows) {
    let allFull = true;
    for (const h of headers) {
      const bucket = samplesByHeader[h];
      if (bucket.length >= SAMPLE_LIMIT) continue;
      allFull = false;
      const v = row[h];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        bucket.push(String(v).trim());
      }
    }
    if (allFull) break;
  }
  return samplesByHeader;
}

function parseCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const headers = (results.meta.fields || []).filter((h) => h && h.trim());
        resolve({
          headers,
          samplesByHeader: collectSamples(headers, results.data),
          rowCount: results.data.length,
        });
      },
      error: reject,
    });
  });
}

async function parseXlsx(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const headers = (aoa[0] || []).map((h) => String(h)).filter((h) => h && h.trim());
  return {
    headers,
    samplesByHeader: collectSamples(headers, rows),
    rowCount: rows.length,
  };
}
