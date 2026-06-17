const fs = require('fs');
const os = require('os');
const path = require('path');
const ytdlp = require('yt-dlp-exec');

/**
 * Downloads the audio track from a YouTube or SoundCloud URL using yt-dlp,
 * and returns { buffer, title, duration } for an MP3.
 */
async function downloadAudioFromUrl(url) {
  const outBase = path.join(os.tmpdir(), `ytdlp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const outTemplate = `${outBase}.%(ext)s`;

  const info = await ytdlp(url, {
    output: outTemplate,
    extractAudio: true,
    audioFormat: 'mp3',
    audioQuality: 0,
    noPlaylist: true,
    printJson: true,
  });

  const mp3Path = `${outBase}.mp3`;
  if (!fs.existsSync(mp3Path)) {
    throw new Error('Audio download failed: no output file produced');
  }

  const buffer = fs.readFileSync(mp3Path);
  fs.unlinkSync(mp3Path);

  const title = info?.title || 'Untitled';
  const duration = info?.duration || 0;

  return { buffer, title, duration: Math.round(duration) };
}

module.exports = { downloadAudioFromUrl };
