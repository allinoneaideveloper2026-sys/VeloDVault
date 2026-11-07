# Build the Android app (free, no Android Studio)

You need: a GitHub account (free), this folder, and about 30 minutes.

## 1. Choose your permanent app id (once)
The id identifies your app on Google Play forever. Pick something like `com.janedoe.velodvault`.
On a computer with Python: `python3 scripts/set-app-id.py com.janedoe.velodvault`, then `npm install` and `npm run sync`.
(No computer tools? Ask Claude to change it for you and send the new zip.)

## 2. Put the code in a private repo
Create a private repository, upload everything (including the hidden `.github` folder; GitHub Desktop or `git` is safest).
Turn on two-step sign-in for GitHub.

## 3. Create the signing key (once)
Actions tab > "Create upload key (run once)" > Run workflow. Open the finished run, download the artifact `upload-key-DELETE-AFTER-USE`.
Repository Settings > Secrets and variables > Actions > New secret, four times:
- `ANDROID_KEYSTORE_BASE64` = contents of keystore.b64
- `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD` = the password in keystore-info.txt
- `ANDROID_KEY_ALIAS` = upload
Then delete the artifact and keep a private backup of upload.keystore somewhere safe (not in the repo). If you lose it, Play can reset the upload key, but it takes support time.

## 4. Build
Actions tab > "Build Android app" > Run workflow (it also runs on every push to main).
It runs the automated checks, builds, and gives you: a signed APK (install on phones for testing) and an AAB (upload to Google Play).
Download both from the run's Artifacts section (kept 14 days).

## 5. Install on a phone for testing
Send the APK file; on the phone allow "install unknown apps" for the app you open it from. Google may add warnings for apps from outside Play; internal testing in Play Console avoids this.
Release builds block screenshots on purpose.

## 6. Google Play
Play Console > Testing > Internal testing > upload the AAB, turn on Play App Signing, add testers by email.
Then follow `PUBLISH-CHECKLIST.md`. After Play App Signing is on, copy Play's signing SHA-1 into your Google Android OAuth client (see GOOGLE-SETUP.md) or Google sign-in will fail in Play-installed builds.

## Updating
Change code, push to main, build again. The version code is the build number, so each upload is higher automatically. Change versionName in android/app/build.gradle for monthly releases.
