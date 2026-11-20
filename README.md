# VeloDVault

Personalized vehicle tracker. One codebase: the web app (`www/`) and the Android app (Capacitor shell in `android/`).

| Folder | What it is |
|---|---|
| `www/` | The app, public pages (privacy, terms, delete account, grievance, security), security headers |
| `src/plugins.js` | Bundles the phone plugins (`npm run build:web` creates `www/vv-plugins.js`) |
| `www/native.js` | Encrypted storage, fingerprint lock, reminders, Google sign-in and Drive saving |
| `android/` | Android project (target API 36, backups off, screen hidden in recents in release builds) |
| `site-src/` | Landing page and site headers; `scripts/build-site.js` builds the public website into `site/` |
| `tests/` | Automated checks (`npm test`, `node tests/app.test.js`) |
| `.github/workflows/` | Free cloud build of the Android app, and a one-time signing key maker |
| `www/fbauth.js`, `www/firebase-config.js` | Sign-in with Firebase Authentication (email verification, password reset, any device) |
| `docs/` | Setup guides, publish checklist, incident plan, Play data-safety answers |

Every build prints a Setup check table (Firebase, Google, package name, release flags) in the GitHub run summary.

Start with `docs/ANDROID-BUILD.md`, then `docs/GOOGLE-SETUP.md`, then `docs/PUBLISH-CHECKLIST.md`.

Website (free): Cloudflare Pages, connect this private repo, build command `node scripts/build-site.js`, output folder `site`. This publishes the landing page and policy pages only. The web version of the app (the same `www` code) stays unpublished until you add `--with-app` to the build command.
Never put secrets in this repo. The Google client ID in `www/config.js` is public by design.
