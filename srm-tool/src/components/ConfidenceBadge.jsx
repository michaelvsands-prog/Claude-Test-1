import React from 'react';

export default function ConfidenceBadge({ match }) {
  if (!match) {
    return (
      <span className="badge red">
        <span className="badge-dot" /> unmatched
      </span>
    );
  }
  const { tier, matchedBy, score } = match;
  const label =
    matchedBy === 'manual'
      ? 'manual'
      : matchedBy === 'synonym'
        ? 'synonym'
        : `fuzzy ${score.toFixed(2)}`;
  return (
    <span className={`badge ${tier}`}>
      <span className="badge-dot" /> {label}
    </span>
  );
}
