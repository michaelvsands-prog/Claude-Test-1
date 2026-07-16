import React, { useState } from 'react';
import { CANONICAL_SCHEMA } from '../data/canonicalSchema.js';
import MappingCell from './MappingCell.jsx';

export default function MappingGrid({ type, results }) {
  const attrs = CANONICAL_SCHEMA[type];
  const [showUnmapped, setShowUnmapped] = useState(false);

  return (
    <>
      <div className="grid-scroll">
        <table className="mapping-table">
          <thead>
            <tr>
              <th className="attr-col">Canonical Attribute</th>
              {results.map(({ upload, effective }) => (
                <th key={upload.id}>
                  <div className="file-head">
                    <span className="vendor-tag">{upload.vendor}</span>
                    <span className="file-name small">{upload.fileName}</span>
                    <span className="stats">
                      {effective.stats.mapped}/{effective.stats.totalAttrs} attributes ·{' '}
                      {effective.stats.coveragePct}% · {effective.stats.totalFields} fields in file
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attrs.map((attr) => (
              <tr key={attr.id}>
                <td className="attr-col" title={`Also matches: ${attr.synonyms.join(', ')}`}>
                  {attr.label}
                </td>
                {results.map(({ upload, auto, effective }) => (
                  <td key={upload.id}>
                    <MappingCell
                      upload={upload}
                      attrId={attr.id}
                      match={effective.byAttr[attr.id]}
                      autoMatch={auto.byAttr[attr.id]}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="unmapped-section">
        <button className="btn ghost" onClick={() => setShowUnmapped((s) => !s)}>
          {showUnmapped ? '▾' : '▸'} Unmapped vendor fields (
          {results.reduce((n, r) => n + r.effective.unmappedHeaders.length, 0)})
        </button>
        {showUnmapped && (
          <div className="unmapped-panels">
            {results.map(({ upload, effective }) => (
              <div key={upload.id} className="unmapped-panel">
                <h4>
                  {upload.vendor} — {upload.fileName}
                </h4>
                {effective.unmappedHeaders.length === 0 ? (
                  <p className="muted small">All fields mapped.</p>
                ) : (
                  <ul>
                    {effective.unmappedHeaders.map((h) => (
                      <li key={h}>
                        <code>{h}</code>{' '}
                        <span className="muted small">
                          {(upload.samplesByHeader[h] || []).slice(0, 2).join(', ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
