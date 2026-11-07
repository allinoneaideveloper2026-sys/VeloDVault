# VeloDVault

Personalized vehicle tracker. One codebase: the web app (`www/`) and the Android app (Capacitor shell in `android/`).

| Folder | What it is |
|---|---|
| `www/` | The app, public pages (privacy, terms, delete account, grievance, security), security headers |
| `src/plugins.js` | Bundles the phone plugins (`npm run build:web` creates `www/vv-plugins.js`) |
| `www/native.js` | Encrypted storage, fingerprint lock, reminders, Google sign-in and Drive saving |
| `android/` | Android project (target API 36, backups off, screen hidden in recents in release builds) |
| `tests/` | Automated checks (`npm test`, `node tests/app.test.js`) |
| `.github/workflows/` | Free cloud build of the Android app, and a one-time signing key maker |
| `docs/` | Setup guides, publish checklist, incident plan, Play data-safety answers |

Start with `docs/ANDROID-BUILD.md`, then `docs/GOOGLE-SETUP.md`, then `docs/PUBLISH-CHECKLIST.md`.

Web hosting (free): Cloudflare Pages, connect this private repo, build command empty, output folder `www`.
Never put secrets in this repo. The Google client ID in `www/config.js` is public by design.
