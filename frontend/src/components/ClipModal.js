import React, { useState } from 'react';
import { X, Scissors } from 'lucide-react';
import './ClipModal.css';

function parseTime(str) {
  const parts = str.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = String(Math.floor(secs % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

export default function ClipModal({ track, onConfirm, onClose }) {
  const [title, setTitle] = useState(`${track.title} (clip)`);
  const [start, setStart] = useState('0:00');
  const [end, setEnd] = useState(formatTime(track.duration));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const startSec = parseTime(start);
    const endSec = parseTime(end);
    if (isNaN(startSec) || isNaN(endSec) || endSec <= startSec) {
      setError('End time must be after start time.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onConfirm({ title, startSec, endSec });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <Scissors size={18} />
          <span>Clip from "{track.title}"</span>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <label className="modal-label">
            Clip title
            <input
              className="modal-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </label>

          <div className="modal-row">
            <label className="modal-label">
              Start (m:ss)
              <input className="modal-input" value={start} onChange={e => setStart(e.target.value)} placeholder="0:00" />
            </label>
            <label className="modal-label">
              End (m:ss)
              <input className="modal-input" value={end} onChange={e => setEnd(e.target.value)} placeholder="1:30" />
            </label>
          </div>

          {error && <p className="modal-error">{error}</p>}

          <button className="modal-submit" type="submit" disabled={loading}>
            {loading ? 'Clipping…' : 'Create Clip'}
          </button>
        </form>
      </div>
    </div>
  );
}
