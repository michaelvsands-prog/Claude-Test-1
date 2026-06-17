# AudioClip

A Spotify-like PWA that strips audio from any video you upload and lets you build your own playlist.

## Structure

```
backend/   — Node/Express API + ffmpeg audio extraction
frontend/  — React PWA (Spotify-style UI, installable on iPhone)
```

## Quick start (local)

### 1. Set up Cloudflare R2

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2**
2. Create a bucket named `audioclip-files`
3. Enable **Public access** on the bucket and copy the public URL
4. Go to **Manage R2 API Tokens** → Create token with **Object Read & Write** on that bucket
5. Copy the Account ID, Access Key ID, and Secret Access Key

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
# Fill in your R2 credentials in .env
npm install
npm run dev
```

### 3. Start the frontend

```bash
cd frontend
# Create a .env.local file:
echo "REACT_APP_API_URL=http://localhost:3001" > .env.local
npm install
npm start
```

### 4. Install on iPhone

1. Deploy the frontend (e.g. Vercel: `npx vercel` in `frontend/`)
2. Open the deployed URL in Safari on your iPhone
3. Tap the Share button → **Add to Home Screen**
4. It works like an app — background audio, lock screen controls

## Deploy the backend

The backend has a Dockerfile. Deploy it anywhere Docker runs:

- **Railway**: Connect this repo, select the `backend/` folder, add your `.env` vars
- **Render**: Same — use the Dockerfile, set env vars in the dashboard
- **Fly.io**: `fly launch` inside `backend/`

After deploying, set `REACT_APP_API_URL` to your backend URL in the frontend deployment.

## Features

- Upload any video (screen recordings, saved YouTube clips, camera recordings)
- Paste a YouTube or SoundCloud link to import its audio directly (via yt-dlp)
- Audio is extracted server-side via ffmpeg → stored as MP3 in Cloudflare R2
- Spotify-style playlist with play/pause/skip/seek
- Rename any track
- Clip a portion of a track by specifying start/end timestamps
- Auto-advances to the next track
- Background audio playback on iPhone
- Installable as a home screen app (PWA)

## Importing from YouTube / SoundCloud

The backend uses [yt-dlp](https://github.com/yt-dlp/yt-dlp) (via the `yt-dlp-exec` npm package) to download
just the audio from a link. This needs **Python 3** installed on whatever machine/server runs the backend
(the Docker image already includes it). For local development:

```bash
# macOS
brew install python3

# Debian/Ubuntu
sudo apt-get install python3
```

Then tap the **Link** button in the app and paste a YouTube or SoundCloud URL.

Only import content you have the right to use — downloading from YouTube/SoundCloud may violate their
Terms of Service depending on how the content is used, so keep this to personal use.
