import React, { useState } from 'react';
import { X, Link as LinkIcon } from 'lucide-react';
import './ClipModal.css';

export default function ImportUrlModal({ onConfirm, onClose }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm(url.trim());
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <LinkIcon size={18} />
          <span>Import from YouTube / SoundCloud</span>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <label className="modal-label">
            Link
            <input
              className="modal-input"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              autoFocus
              required
            />
          </label>

          {error && <p className="modal-error">{error}</p>}

          <button className="modal-submit" type="submit" disabled={loading || !url.trim()}>
            {loading ? 'Importing…' : 'Add to Playlist'}
          </button>
        </form>
      </div>
    </div>
  );
}
