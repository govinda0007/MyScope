# Lumacam — your own camera app

A clean, attractive camera web app with photo + video capture, flash/torch,
grid lines, self-timer (3s/10s), front/back flip, resolution display, and an
in-app gallery (stored on-device via IndexedDB — nothing uploaded anywhere).

It uses the same `getUserMedia` camera stream as the object scanner, requested
at the highest resolution your phone supports — so photo/video quality matches
(or exceeds) what you saw before.

---

## Option A — Run it instantly (fastest, no build)

1. Copy this whole `camera-pwa` folder to your phone.
2. Install a free local server app from Play Store, e.g. **"HTTP Server"**
   or **"Simple HTTP Server"** (many free, no-subscription options exist).
3. Point the server at this folder, it'll give you a `http://localhost:PORT`
   address.
4. Open that address in Chrome on your phone.
5. Tap the browser menu → **"Add to Home Screen"** / **"Install app"**.
   It now opens full-screen like a real app, works offline, and keeps your
   photos/videos in the gallery between launches.

This is the easiest way to get something installable without any subscription
or build tools.

---

## Option B — Turn it into a real installable .apk (offline, free, no account needed for the basic flow)

This uses **Bubblewrap**, Google's official open-source tool that wraps a PWA
into a real Android APK. Free, runs on your laptop, no Netlify.

### Requirements (one-time setup on your laptop)
- Node.js (free, nodejs.org)
- Java JDK 17 (free, adoptium.net)
- Android SDK (Bubblewrap can auto-download a minimal copy)

### Steps

```bash
npm install -g @bubblewrap/cli

# Serve this folder locally first (any static server works), e.g.:
npx http-server ./camera-pwa -p 8080

# In another terminal, initialize Bubblewrap pointing at your local PWA:
bubblewrap init --manifest http://localhost:8080/manifest.json

# Answer the prompts (it reads name/icons/colors from manifest.json automatically)

# Build the APK:
bubblewrap build
```

This produces an `app-release-signed.apk` you can copy to your phone and
install directly (enable "Install unknown apps" for your file manager once).

No Netlify, no paid hosting, no subscription — everything runs locally on
your laptop during the build, and the resulting APK runs fully offline.

---

## Features included

- **Photo & Video modes** — switch with the top tab
- **Flip camera** — front/back
- **Flash / torch toggle** — on supported devices (back camera, Android Chrome)
- **Grid lines** — rule-of-thirds overlay
- **Self-timer** — off / 3s / 10s with on-screen countdown
- **Tap-to-focus ring** — visual feedback on tap
- **Recording indicator** — live timer while recording video
- **In-app gallery** — view, play, and delete captured photos/videos
- **Max resolution capture** — requests the highest resolution the camera
  supports (`width: 4096, height: 2160` ideal — browser picks the closest
  supported mode)
- **Installable PWA** — works offline once installed via "Add to Home Screen"

## Notes

- Camera access requires either `https://`, `localhost`, or running as an
  installed PWA/APK — plain `file://` won't work on most phones.
- Flash/torch control depends on browser + device support (works best on
  Android Chrome with the rear camera).
- Gallery storage is local to the browser/app (IndexedDB) — clearing browser
  data will remove saved media.
