/**
 * Lightweight in-memory store that persists to a JSON file on disk.
 * In production you'd swap this for a real DB (e.g. PlanetScale, Turso).
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/tracks.json');

function load() {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (_) {
    return [];
  }
}

function save(tracks) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(tracks, null, 2));
}

function all() { return load(); }

function find(id) { return load().find(t => t.id === id) || null; }

function insert(track) {
  const tracks = load();
  tracks.push(track);
  save(tracks);
  return track;
}

function update(id, patch) {
  const tracks = load();
  const idx = tracks.findIndex(t => t.id === id);
  if (idx === -1) return null;
  tracks[idx] = { ...tracks[idx], ...patch };
  save(tracks);
  return tracks[idx];
}

function remove(id) {
  const tracks = load();
  const idx = tracks.findIndex(t => t.id === id);
  if (idx === -1) return false;
  tracks.splice(idx, 1);
  save(tracks);
  return true;
}

module.exports = { all, find, insert, update, remove };
