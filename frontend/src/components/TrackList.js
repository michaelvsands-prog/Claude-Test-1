import React, { useState } from 'react';
import { Play, Pause, Trash2, Scissors, Pencil, Check, X, FolderInput } from 'lucide-react';
import './TrackList.css';

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = String(Math.floor(secs % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

function TrackRow({ track, isCurrent, playing, onPlay, onDelete, onRename, onClip, onMove }) {
  const [editing, setEditing] = useState(false);
  const [movingTo, setMovingTo] = useState(null);
  const [title, setTitle] = useState(track.title);
  const [menuOpen, setMenuOpen] = useState(false);

  const saveRename = () => {
    if (title.trim() && title !== track.title) onRename(track.id, title.trim());
    setEditing(false);
    setMenuOpen(false);
  };

  const cancelRename = () => {
    setTitle(track.title);
    setEditing(false);
  };

  const saveMove = () => {
    if (movingTo !== null && movingTo.trim()) onMove(track.id, movingTo.trim());
    setMovingTo(null);
  };

  return (
    <div className={`track-row ${isCurrent ? 'track-row--active' : ''}`}>
      <button className="track-play-btn" onClick={() => onPlay(track)}>
        {isCurrent && playing ? <Pause size={18} /> : <Play size={18} />}
      </button>

      <div className="track-info" onClick={() => onPlay(track)}>
        {editing ? (
          <input
            className="track-rename-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') cancelRename(); }}
            autoFocus
            onClick={e => e.stopPropagation()}
          />
        ) : movingTo !== null ? (
          <input
            className="track-rename-input"
            value={movingTo}
            onChange={e => setMovingTo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveMove(); if (e.key === 'Escape') setMovingTo(null); }}
            placeholder="Folder name"
            autoFocus
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <>
            <span className="track-title">{track.title}</span>
            <span className="track-duration">{formatTime(track.duration)} · {track.folder || 'Uncategorized'}</span>
          </>
        )}
      </div>

      {editing ? (
        <div className="track-actions">
          <button onClick={saveRename}><Check size={16} /></button>
          <button onClick={cancelRename}><X size={16} /></button>
        </div>
      ) : movingTo !== null ? (
        <div className="track-actions">
          <button onClick={saveMove}><Check size={16} /></button>
          <button onClick={() => setMovingTo(null)}><X size={16} /></button>
        </div>
      ) : (
        <div className="track-actions">
          <button onClick={() => { setMovingTo(track.folder || ''); setMenuOpen(false); }} title="Move to folder">
            <FolderInput size={16} />
          </button>
          <button onClick={() => { setEditing(true); setMenuOpen(false); }} title="Rename">
            <Pencil size={16} />
          </button>
          <button onClick={() => { onClip(track); setMenuOpen(false); }} title="Clip">
            <Scissors size={16} />
          </button>
          <button onClick={() => onDelete(track.id)} title="Delete" className="track-delete-btn">
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function TrackList({ tracks, currentId, playing, onPlay, onDelete, onRename, onClip, onMove }) {
  return (
    <div className="track-list">
      {tracks.map(track => (
        <TrackRow
          key={track.id}
          track={track}
          isCurrent={track.id === currentId}
          playing={playing}
          onPlay={onPlay}
          onDelete={onDelete}
          onRename={onRename}
          onClip={onClip}
          onMove={onMove}
        />
      ))}
    </div>
  );
}
