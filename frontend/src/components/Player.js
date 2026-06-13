import React from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import './Player.css';

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = String(Math.floor(secs % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

export default function Player({ player }) {
  const { current, playing, progress, duration, toggle, seek, skip } = player;
  if (!current) return null;

  const elapsed = duration * progress;

  const handleSeek = (e) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
    seek(Math.max(0, Math.min(1, x / rect.width)));
  };

  return (
    <div className="player">
      <div className="player-title">{current.title}</div>

      <div
        className="player-progress-bar"
        onClick={handleSeek}
        onTouchStart={handleSeek}
        onTouchMove={handleSeek}
      >
        <div className="player-progress-fill" style={{ width: `${progress * 100}%` }} />
        <div className="player-progress-thumb" style={{ left: `${progress * 100}%` }} />
      </div>

      <div className="player-times">
        <span>{formatTime(elapsed)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <div className="player-controls">
        <button className="player-btn" onClick={() => skip(-1)}><SkipBack size={22} /></button>
        <button className="player-btn player-btn--primary" onClick={toggle}>
          {playing ? <Pause size={26} /> : <Play size={26} />}
        </button>
        <button className="player-btn" onClick={() => skip(1)}><SkipForward size={22} /></button>
      </div>
    </div>
  );
}
