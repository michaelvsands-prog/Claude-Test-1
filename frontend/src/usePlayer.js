import { useRef, useState, useEffect, useCallback } from 'react';

export function usePlayer(tracks) {
  const audioRef = useRef(new Audio());
  const [currentId, setCurrentId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);   // 0-1
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const current = tracks.find(t => t.id === currentId) || null;

  useEffect(() => {
    const audio = audioRef.current;
    const onTimeUpdate = () => setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    const onDuration = () => setDuration(audio.duration);
    const onEnded = () => {
      setPlaying(false);
      // Auto-advance
      setCurrentId(id => {
        const idx = tracks.findIndex(t => t.id === id);
        if (idx < tracks.length - 1) {
          const next = tracks[idx + 1];
          audio.src = next.url;
          audio.play().catch(() => {});
          setPlaying(true);
          return next.id;
        }
        return id;
      });
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('ended', onEnded);
    };
  }, [tracks]);

  const play = useCallback((track) => {
    const audio = audioRef.current;
    if (track.id !== currentId) {
      audio.src = track.url;
      setCurrentId(track.id);
      setProgress(0);
    }
    audio.play().catch(() => {});
    setPlaying(true);
  }, [currentId]);

  const pause = useCallback(() => {
    audioRef.current.pause();
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (playing) pause();
    else if (current) play(current);
  }, [playing, current, play, pause]);

  const seek = useCallback((ratio) => {
    const audio = audioRef.current;
    if (audio.duration) {
      audio.currentTime = ratio * audio.duration;
      setProgress(ratio);
    }
  }, []);

  const skip = useCallback((dir) => {
    if (!tracks.length) return;
    const idx = tracks.findIndex(t => t.id === currentId);
    const next = tracks[idx + dir];
    if (next) play(next);
  }, [tracks, currentId, play]);

  const changeVolume = useCallback((v) => {
    audioRef.current.volume = v;
    setVolume(v);
  }, []);

  return { current, playing, progress, duration, volume, play, pause, toggle, seek, skip, changeVolume };
}
