import React, { useMemo } from 'react';
import { useApp } from '../store/AppContext.jsx';
import { matchFile } from '../engine/match.js';
import { downloadXlsx, downloadCsv } from '../io/exportSpec.js';

export default function ExportTab() {
  const { state, dispatch } = useApp();
  const { type, uploadIds } = state.selection;

  const selected = uploadIds
    .map((id) => state.uploads.find((u) => u.id === id && u.type === type))
    .filter(Boolean);

  const results = useMemo(
    () =>
      selected.map((u) => ({
        upload: u,
        effective: matchFile(type, u, state.overrides[u.id] || {}),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, selected.map((u) => u.id).join('|'), state.overrides, state.uploads]
  );

  const generatedBy = selected[0]?.user || '';

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Export Mapping Specification</h2>
          <p className="muted">
            The deliverable: a formatted workbook with the crosswalk, coverage summary, and
            unmapped-field exceptions for the current Mapping selection.
          </p>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="empty-state">
          <p>Nothing selected to export.</p>
          <p className="muted">
            Choose a type and files on the{' '}
            <button className="link" onClick={() => dispatch({ type: 'SET_TAB', tab: 'mapping' })}>
              Mapping tab
            </button>{' '}
            first.
          </p>
        </div>
      ) : (
        <>
          <div className="cards">
            <div className="card">
              <div className="card-num">{type}</div>
              <div className="card-label">Data type</div>
            </div>
            {results.map(({ upload, effective }) => (
              <div className="card" key={upload.id}>
                <div className="card-num">{effective.stats.coveragePct}%</div>
                <div className="card-label">
                  {upload.vendor} coverage — {effective.stats.mapped}/{effective.stats.totalAttrs}{' '}
                  mapped, {effective.unmappedHeaders.length} unmapped fields
                </div>
              </div>
            ))}
          </div>

          <div className="export-actions">
            <button className="btn primary" onClick={() => downloadXlsx(type, results, generatedBy)}>
              Download Excel Workbook
            </button>
            <button className="btn" onClick={() => downloadCsv(type, results)}>
              Download CSV
            </button>
          </div>

          <p className="muted small">
            Workbook sheets: <strong>Summary</strong> (engagement + coverage),{' '}
            <strong>Mapping Spec</strong> (canonical attribute → vendor field, confidence, matched
            by), <strong>Unmapped Fields</strong> (exceptions per vendor).
          </p>
        </>
      )}
    </div>
  );
}
