# SRM Crosswalk — Beacon Advisory Partners

A browser-only **Security Reference Master engagement accelerator**: crosswalks vendor
data-file schemas (LSEG, Bloomberg, ICE, SIX, FactSet, S&P) to a canonical attribute
model during vendor migrations and consolidations, then exports the mapping
specification as a formatted Excel deliverable.

**Everything runs client-side.** Files are parsed in the browser; only column headers
and a small value sample are kept, stored in the browser's local IndexedDB. No data is
ever transmitted to a server.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build:

```bash
npm run build
npm run preview
```

## Demo walkthrough

1. **Uploads tab** — click *Upload* and select the synthetic files in
   [`sample-data/`](sample-data/): `bloomberg_reference.csv`, `lseg_reference.csv`,
   `ice_reference.csv` (vendor and type are auto-guessed from the filename).
2. **Mapping tab** — Type = *Reference*, pick the three files. The grid crosswalks each
   vendor's fields to ~30 canonical reference attributes:
   - **Green** — exact synonym-dictionary hit (e.g. Bloomberg `ID_ISIN` → ISIN)
   - **Yellow** — fuzzy match after abbreviation expansion (e.g. ICE `SEN_LVL` → Seniority)
   - **Red** — unmatched; pick manually from the dropdown (shown as **manual**, remembered
     across sessions)
   - Junk columns (`ROW_HASH`, `LOAD_TS`, …) land in the *Unmapped vendor fields* panel.
3. **Export tab** — download the deliverable: an Excel workbook with **Summary**,
   **Mapping Spec**, and **Unmapped Fields** sheets (plus a flat CSV option).

## How matching works

1. Headers are normalized (lowercased, punctuation stripped, ~50 financial-data
   abbreviations expanded: `CNTRY_OF_INCORPORATION` → "country of incorporation").
2. Exact lookup against a curated per-attribute synonym dictionary
   (`src/data/canonicalSchema.js`) — score 1.0.
3. Fallback fuzzy match (Jaro-Winkler + token-set Dice, no dependencies).
4. Confidence boost when sampled column values fit the expected pattern (ISIN/CUSIP/
   SEDOL check digits, LEI mod-97, ISO 4217/3166 codes, MIC codes, dates).
5. Greedy one-to-one assignment; manual overrides always win and are the only thing
   persisted — auto-matches are recomputed live, so dictionary improvements apply
   retroactively to earlier uploads.

## Sample data

All files in `sample-data/` are **synthetic** — fake issuers with valid check-digit
identifiers, generated deterministically by `npm run gen-data`. No licensed vendor
data is included or required.
