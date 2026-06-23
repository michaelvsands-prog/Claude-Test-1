const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { extractAudio, getDuration } = require('../lib/ffmpeg');
const { uploadFile, deleteFile, listFiles } = require('../lib/r2');
const { downloadAudioFromUrl } = require('../lib/ytdlp');
const db = require('../lib/db');
const requireToken = require('../lib/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB

// All track routes require the bearer token (when ALLOWED_TOKEN is set).
router.use(requireToken);

// GET /api/tracks — list all tracks
router.get('/', (req, res) => {
  res.json(db.all());
});

// POST /api/tracks/upload — upload a video, extract full audio
router.post('/upload', upload.single('video'), async (req, res) => {
  try {
    const { originalname, buffer } = req.file;
    const title = req.body.title || originalname.replace(/\.[^.]+$/, '');

    const duration = await getDuration(buffer);
    const mp3 = await extractAudio(buffer);

    const id = uuidv4();
    const key = `tracks/${id}.mp3`;
    const url = await uploadFile(key, mp3, 'audio/mpeg');

    const track = db.insert({
      id,
      title,
      folder: req.body.folder || 'Uncategorized',
      duration: Math.round(duration),
      url,
      r2Key: key,
      createdAt: new Date().toISOString(),
      clips: [],
    });

    res.json(track);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tracks/import-url — download audio from a YouTube/SoundCloud link
// Body: { url, title?, folder? }
router.post('/import-url', async (req, res) => {
  try {
    const { url, title: titleOverride, folder } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });

    const { buffer, title, duration } = await downloadAudioFromUrl(url);

    const id = uuidv4();
    const key = `tracks/${id}.mp3`;
    const fileUrl = await uploadFile(key, buffer, 'audio/mpeg');

    const track = db.insert({
      id,
      title: titleOverride || title,
      folder: folder || 'Uncategorized',
      duration,
      url: fileUrl,
      r2Key: key,
      sourceUrl: url,
      createdAt: new Date().toISOString(),
      clips: [],
    });

    res.json(track);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Import failed' });
  }
});

// POST /api/tracks/recover-from-storage — re-list any mp3 files sitting in R2 that
// aren't currently tracked (e.g. after the local track list was wiped) and add them back.
router.post('/recover-from-storage', async (req, res) => {
  try {
    const keys = await listFiles('tracks/');
    const existingKeys = new Set(db.all().map(t => t.r2Key));
    const recovered = [];

    for (const key of keys) {
      if (existingKeys.has(key) || !key.endsWith('.mp3')) continue;

      const id = key.replace(/^tracks\//, '').replace(/\.mp3$/, '');
      const url = `${process.env.R2_PUBLIC_URL}/${key}`;

      let duration = 0;
      try {
        const fetch = (await import('node-fetch')).default;
        const audioRes = await fetch(url);
        const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
        duration = await getDuration(audioBuffer);
      } catch (_) {}

      const track = db.insert({
        id,
        title: `Recovered track ${id.slice(0, 8)}`,
        folder: 'Recovered',
        duration: Math.round(duration),
        url,
        r2Key: key,
        createdAt: new Date().toISOString(),
        clips: [],
      });
      recovered.push(track);
    }

    res.json({ recovered: recovered.length, tracks: recovered });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Recovery failed' });
  }
});

// POST /api/tracks/:id/clip — extract a trimmed clip from an existing track's source
// Body: { title, startSec, endSec }
// NOTE: For clipping we re-upload the original video is not stored, so instead
// we fetch the full MP3 and let ffmpeg trim it.
router.post('/:id/clip', async (req, res) => {
  try {
    const parent = db.find(req.params.id);
    if (!parent) return res.status(404).json({ error: 'Track not found' });

    const { title, startSec, endSec } = req.body;
    if (startSec == null || endSec == null) {
      return res.status(400).json({ error: 'startSec and endSec required' });
    }

    // Fetch the stored MP3 to re-slice it
    const fetch = (await import('node-fetch')).default;
    const audioRes = await fetch(parent.url);
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

    const clipped = await extractAudio(audioBuffer, { startSec, endSec });

    const id = uuidv4();
    const key = `tracks/${id}.mp3`;
    const url = await uploadFile(key, clipped, 'audio/mpeg');

    const track = db.insert({
      id,
      title: title || `${parent.title} [${startSec}s–${endSec}s]`,
      folder: parent.folder || 'Uncategorized',
      duration: Math.round(endSec - startSec),
      url,
      r2Key: key,
      createdAt: new Date().toISOString(),
      parentId: parent.id,
      clips: [],
    });

    res.json(track);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tracks/:id — rename a track and/or move it to a folder
router.patch('/:id', (req, res) => {
  const patch = {};
  if (req.body.title != null) patch.title = req.body.title;
  if (req.body.folder != null) patch.folder = req.body.folder;
  const track = db.update(req.params.id, patch);
  if (!track) return res.status(404).json({ error: 'Not found' });
  res.json(track);
});

// DELETE /api/tracks/:id
router.delete('/:id', async (req, res) => {
  const track = db.find(req.params.id);
  if (!track) return res.status(404).json({ error: 'Not found' });
  try { await deleteFile(track.r2Key); } catch (_) {}
  db.remove(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
