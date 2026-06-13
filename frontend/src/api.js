const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export async function fetchTracks() {
  const res = await fetch(`${BASE}/api/tracks`);
  return res.json();
}

export async function uploadVideo(file, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', file.name.replace(/\.[^.]+$/, ''));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/api/tracks/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(JSON.parse(xhr.responseText)?.error || 'Upload failed'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
}

export async function createClip(trackId, { title, startSec, endSec }) {
  const res = await fetch(`${BASE}/api/tracks/${trackId}/clip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, startSec, endSec }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export async function renameTrack(id, title) {
  const res = await fetch(`${BASE}/api/tracks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  return res.json();
}

export async function deleteTrack(id) {
  await fetch(`${BASE}/api/tracks/${id}`, { method: 'DELETE' });
}
