import React from 'react';
import { useApp } from '../store/AppContext.jsx';
import ConfidenceBadge from './ConfidenceBadge.jsx';

const NO_MATCH = '__none__';

export default function MappingCell({ upload, attrId, match, autoMatch }) {
  const { dispatch } = useApp();

  function onChange(e) {
    const value = e.target.value;
    if (value === NO_MATCH) {
      // If auto-match found nothing anyway, no override needed.
      if (autoMatch) {
        dispatch({ type: 'SET_OVERRIDE', uploadId: upload.id, attrId, value: null });
      } else {
        dispatch({ type: 'CLEAR_OVERRIDE', uploadId: upload.id, attrId });
      }
    } else if (autoMatch && value === autoMatch.field) {
      // Choosing the auto-suggested field back = drop the override.
      dispatch({ type: 'CLEAR_OVERRIDE', uploadId: upload.id, attrId });
    } else {
      dispatch({ type: 'SET_OVERRIDE', uploadId: upload.id, attrId, value });
    }
  }

  return (
    <div className={`map-cell tier-${match ? match.tier : 'red'}`}>
      <select value={match ? match.field : NO_MATCH} onChange={onChange}>
        <option value={NO_MATCH}>— no match —</option>
        {upload.headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <ConfidenceBadge match={match} />
    </div>
  );
}
