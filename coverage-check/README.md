# Vendor Coverage Check

A browser-only tool that checks whether a market data vendor's Security
Reference Master files cover your holdings. You load your holdings workbook
(.xlsx) and point the tool at the vendor's delimited TXT files (multi-GB files
are fine); it matches on ISIN, SEDOL, CUSIP, and ticker and reports coverage.

**Everything runs locally in your browser. No file is ever uploaded anywhere.**
The vendor files are streamed and scanned in place — a 1.8 GB file is never
loaded into memory.

## How to use

1. Open the tool (hosted page, or serve this folder locally — see below).
2. **Step 1**: pick your holdings `.xlsx`. The tool guesses which columns hold
   ISIN / SEDOL / CUSIP / ticker; confirm or correct them.
3. **Step 2**: select all the vendor TXT files at once. For each file the tool
   samples the first 256 KB, detects the delimiter and header, and guesses the
   identifier columns — review each file's card and correct anything wrong.
4. **Step 3**: the scan streams each file once, with per-file progress. A ~5 GB
   corpus typically takes well under two minutes on a modern machine.
5. **Step 4**: coverage summary (overall %, per identifier type, per vendor
   file) and a per-holding detail table. Download the full results or just the
   unmatched holdings as CSV.

## Running locally

Browsers restrict Web Workers on `file://` pages, so serve the folder over
HTTP for best performance:

```bash
# from the repository root
python3 -m http.server 8000
# then open http://localhost:8000/coverage-check/
```

Opening `index.html` directly still works — the tool falls back to scanning on
the main thread (a banner will say so) — but the page will feel sluggish while
scanning the large files.

## How matching works

- Holdings identifiers are normalized (trimmed, uppercased) and held in memory
  (they're small). Each vendor file is then streamed **once**, line by line,
  and every row's identifier columns are checked against the holdings.
- A holding is **covered** if any of its identifiers appears in any vendor
  file. Match precedence when reporting: ISIN > SEDOL > CUSIP > Ticker.
- Ticker matching is best-effort: common exchange qualifiers are stripped
  (`AAPL US` ≡ `AAPL`, `VOD.L` ≡ `VOD`) but share classes are preserved
  (`BRK.B` stays `BRK.B`). Holdings that matched on ticker *only* are flagged
  as lower confidence.

## Test data

`js/generate-test-data.js` (Node, dev-only) synthesizes a realistic vendor
file of any size plus a matching holdings workbook with known expected
results:

```bash
node coverage-check/js/generate-test-data.js 2000 /tmp/covtest   # ~2 GB
```

It writes `vendor-test.txt`, `vendor-test-2.txt` (small, with a BOM and no
trailing newline), `holdings-test.xlsx` (half the rows should match), and
`expected.json` listing the planted identifiers.

## Known limitations

- Fixed-width (non-delimited) vendor files are not supported.
- Quoted fields are handled, but a quoted field containing a line break is not.
- Files are decoded as UTF-8; other encodings decode lossily. Identifiers are
  ASCII so matching still works, but name columns may show replacement chars.
- Ticker matching can produce false positives/negatives across exchanges —
  prefer ISIN/SEDOL/CUSIP when your holdings file has them.
