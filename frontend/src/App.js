import React, { useState, useEffect, useCallback } from 'react';
import { fetchTracks, uploadVideo, deleteTrack, renameTrack, createClip, importFromUrl } from './api';
import { usePlayer } from './usePlayer';
import TrackList from './components/TrackList';
import Player from './components/Player';
import UploadButton from './components/UploadButton';
import ImportUrlButton from './components/ImportUrlButton';
import ClipModal from './components/ClipModal';
import './App.css';

export default function App() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clipTarget, setClipTarget] = useState(null);
  const player = usePlayer(tracks);

  const load = useCallback(async () => {
    try {
      setTracks(await fetchTracks());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (file) => {
    const track = await uploadVideo(file);
    setTracks(prev => [...prev, track]);
  };

  const handleImport = async (url) => {
    const track = await importFromUrl(url);
    setTracks(prev => [...prev, track]);
  };

  const handleDelete = async (id) => {
    await deleteTrack(id);
    setTracks(prev => prev.filter(t => t.id !== id));
  };

  const handleRename = async (id, title) => {
    const updated = await renameTrack(id, title);
    setTracks(prev => prev.map(t => t.id === id ? updated : t));
  };

  const handleClip = async ({ title, startSec, endSec }) => {
    const track = await createClip(clipTarget.id, { title, startSec, endSec });
    setTracks(prev => [...prev, track]);
    setClipTarget(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">AudioClip</h1>
        <div className="app-header-actions">
          <ImportUrlButton onImport={handleImport} />
          <UploadButton onUpload={handleUpload} />
        </div>
      </header>

      <main className="app-main">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : tracks.length === 0 ? (
          <div className="empty-state">
            <p>No tracks yet.</p>
            <p className="empty-hint">Tap the + button to upload a video.</p>
          </div>
        ) : (
          <TrackList
            tracks={tracks}
            currentId={player.current?.id}
            playing={player.playing}
            onPlay={player.play}
            onDelete={handleDelete}
            onRename={handleRename}
            onClip={setClipTarget}
          />
        )}
      </main>

      {player.current && (
        <Player player={player} />
      )}

      {clipTarget && (
        <ClipModal
          track={clipTarget}
          onConfirm={handleClip}
          onClose={() => setClipTarget(null)}
        />
      )}
    </div>
  );
}
