import React, { useMemo } from 'react';
import { useApp } from '../store/AppContext.jsx';
import { TYPES } from '../data/vendors.js';
import { matchFile } from '../engine/match.js';
import MappingGrid from './MappingGrid.jsx';

export default function MappingTab() {
  const { state, dispatch } = useApp();
  const { type, uploadIds } = state.selection;

  const typeUploads = state.uploads.filter((u) => u.type === type);
  const selected = uploadIds
    .map((id) => typeUploads.find((u) => u.id === id))
    .filter(Boolean);

  const results = useMemo(
    () =>
      selected.map((u) => ({
        upload: u,
        auto: matchFile(type, u, {}),
        effective: matchFile(type, u, state.overrides[u.id] || {}),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, selected.map((u) => u.id).join('|'), state.overrides, state.uploads]
  );

  function setSlot(slot, id) {
    const ids = [0, 1, 2].map((i) => (i === slot ? id : uploadIds[i] || ''));
    dispatch({
      type: 'SET_SELECTION',
      selection: { type, uploadIds: ids.filter(Boolean) },
    });
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Attribute Mapping</h2>
          <p className="muted">
            Crosswalk vendor fields to the canonical {type.toLowerCase()} attribute model.
            Override any mapping via the dropdowns — manual choices are remembered.
          </p>
        </div>
      </div>

      <div className="selector-row">
        <label>
          Type
          <select
            value={type}
            onChange={(e) =>
              dispatch({ type: 'SET_SELECTION', selection: { type: e.target.value, uploadIds: [] } })
            }
          >
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        {[0, 1, 2].map((slot) => (
          <label key={slot}>
            File {slot + 1}
            <select value={uploadIds[slot] || ''} onChange={(e) => setSlot(slot, e.target.value)}>
              <option value="">{slot === 0 ? 'Select a file…' : '(none)'}</option>
              {typeUploads
                .filter((u) => u.id === uploadIds[slot] || !uploadIds.includes(u.id))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.vendor} — {u.fileName}
                  </option>
                ))}
            </select>
          </label>
        ))}
      </div>

      {typeUploads.length === 0 ? (
        <div className="empty-state">
          <p>No {type} files uploaded yet. Add some on the Uploads tab.</p>
        </div>
      ) : selected.length === 0 ? (
        <div className="empty-state">
          <p>Select at least one file above to build the crosswalk.</p>
        </div>
      ) : (
        <MappingGrid type={type} results={results} />
      )}
    </div>
  );
}
