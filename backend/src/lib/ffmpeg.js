const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Extract audio from a video buffer. Optionally trim to [startSec, endSec].
 * Returns a Buffer of the resulting MP3.
 */
function extractAudio(inputBuffer, { startSec, endSec } = {}) {
  return new Promise((resolve, reject) => {
    const tmpIn = path.join(os.tmpdir(), `in_${Date.now()}`);
    const tmpOut = path.join(os.tmpdir(), `out_${Date.now()}.mp3`);

    fs.writeFileSync(tmpIn, inputBuffer);

    let cmd = ffmpeg(tmpIn).noVideo().audioCodec('libmp3lame').audioBitrate(192);

    if (startSec != null) cmd = cmd.seekInput(startSec);
    if (endSec != null && startSec != null) cmd = cmd.duration(endSec - startSec);
    else if (endSec != null) cmd = cmd.duration(endSec);

    cmd
      .output(tmpOut)
      .on('end', () => {
        const buf = fs.readFileSync(tmpOut);
        fs.unlinkSync(tmpIn);
        fs.unlinkSync(tmpOut);
        resolve(buf);
      })
      .on('error', (err) => {
        try { fs.unlinkSync(tmpIn); } catch (_) {}
        try { fs.unlinkSync(tmpOut); } catch (_) {}
        reject(err);
      })
      .run();
  });
}

/**
 * Get video duration in seconds.
 */
function getDuration(inputBuffer) {
  return new Promise((resolve, reject) => {
    const tmpIn = path.join(os.tmpdir(), `probe_${Date.now()}`);
    fs.writeFileSync(tmpIn, inputBuffer);
    ffmpeg.ffprobe(tmpIn, (err, metadata) => {
      fs.unlinkSync(tmpIn);
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

module.exports = { extractAudio, getDuration };
