const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { extractAudio, getDuration } = require('../lib/ffmpeg');
const { uploadFile, deleteFile } = require('../lib/r2');
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
// Body: { url, title? }
router.post('/import-url', async (req, res) => {
  try {
    const { url, title: titleOverride } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });

    const { buffer, title, duration } = await downloadAudioFromUrl(url);

    const id = uuidv4();
    const key = `tracks/${id}.mp3`;
    const fileUrl = await uploadFile(key, buffer, 'audio/mpeg');

    const track = db.insert({
      id,
      title: titleOverride || title,
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

// PATCH /api/tracks/:id — rename a track
router.patch('/:id', (req, res) => {
  const track = db.update(req.params.id, { title: req.body.title });
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
