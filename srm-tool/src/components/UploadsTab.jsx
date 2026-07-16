import React, { useRef, useState } from 'react';
import { useApp } from '../store/AppContext.jsx';
import { parseFile } from '../io/parseFile.js';
import { VENDORS, TYPES, guessVendor, guessType } from '../data/vendors.js';
import { newId, formatDate } from '../utils/id.js';

export default function UploadsTab() {
  const { state, dispatch } = useApp();
  const fileInput = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const lastUser = state.uploads.length
    ? state.uploads[state.uploads.length - 1].user
    : '';

  async function handleFiles(fileList) {
    setError(null);
    setBusy(true);
    try {
      for (const file of Array.from(fileList)) {
        const parsed = await parseFile(file);
        if (!parsed.headers.length) {
          setError(`"${file.name}" has no detectable header row.`);
          continue;
        }
        dispatch({
          type: 'ADD_UPLOAD',
          upload: {
            id: newId(),
            vendor: guessVendor(file.name),
            type: guessType(file.name),
            user: lastUser,
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
            headers: parsed.headers,
            samplesByHeader: parsed.samplesByHeader,
            rowCount: parsed.rowCount,
          },
        });
      }
    } catch (e) {
      setError(`Failed to parse file: ${e.message || e}`);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Vendor File Uploads</h2>
          <p className="muted">
            Upload vendor extract files (CSV or Excel). Only headers and a small value
            sample are retained — parsed locally, never transmitted.
          </p>
        </div>
        <div>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.xlsx,.xls"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {busy ? 'Parsing…' : 'Upload'}
          </button>
        </div>
      </div>

      {error && <div className="error-bar">{error}</div>}

      {state.uploads.length === 0 ? (
        <div className="empty-state">
          <p>No files uploaded yet.</p>
          <p className="muted">
            Try the synthetic vendor files in <code>sample-data/</code> — e.g.{' '}
            <code>bloomberg_reference.csv</code>, <code>lseg_reference.csv</code>,{' '}
            <code>ice_reference.csv</code>.
          </p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Date</th>
              <th>User</th>
              <th>Type</th>
              <th>File</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {state.uploads.map((u) => (
              <tr key={u.id}>
                <td>
                  <select
                    value={u.vendor}
                    onChange={(e) =>
                      dispatch({ type: 'UPDATE_UPLOAD_META', id: u.id, patch: { vendor: e.target.value } })
                    }
                  >
                    {VENDORS.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </td>
                <td className="muted">{formatDate(u.uploadedAt)}</td>
                <td>
                  <input
                    type="text"
                    placeholder="name"
                    value={u.user}
                    onChange={(e) =>
                      dispatch({ type: 'UPDATE_UPLOAD_META', id: u.id, patch: { user: e.target.value } })
                    }
                  />
                </td>
                <td>
                  <select
                    value={u.type}
                    onChange={(e) =>
                      dispatch({ type: 'UPDATE_UPLOAD_META', id: u.id, patch: { type: e.target.value } })
                    }
                  >
                    {TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="file-cell">
                    <span className="file-name">{u.fileName}</span>
                    <span className="muted small">
                      {u.headers.length} fields · {u.rowCount.toLocaleString()} rows
                    </span>
                  </div>
                </td>
                <td>
                  <button
                    className="btn ghost danger"
                    onClick={() => {
                      if (window.confirm(`Delete "${u.fileName}"? Its manual mappings are removed too.`)) {
                        dispatch({ type: 'DELETE_UPLOAD', id: u.id });
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
