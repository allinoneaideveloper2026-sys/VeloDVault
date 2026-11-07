# Google sign-in and Drive saving: setup

The app only asks for the Drive "file" permission: it can see only files and folders it creates.
Check on the consent screen page that Google shows this scope with its sensitivity label; if Google asks for verification, follow its prompts.

1. Go to console.cloud.google.com, create a project named VeloDVault.
2. APIs and services > Library > enable **Google Drive API**.
3. APIs and services > OAuth consent screen: User type External; app name VeloDVault; support email; logo (icons/icon-512.png); privacy policy link (your privacy.html address); authorised domain; add scope `.../auth/drive.file`; add your own and testers' Gmail addresses under Test users.
4. Credentials > Create credentials > OAuth client ID:
   a. **Web application** (any name). Copy its client ID into `www/config.js` (`googleWebClientId`). This is the ID the app passes to Google.
   b. **Android**: package name = your app id; SHA-1 = the signing key's fingerprint. Create one Android client per key you use:
      - your upload key (for the APK you install directly): `keytool -list -v -keystore upload.keystore -alias upload`
      - Play's app signing key (for builds installed from Google Play): Play Console > Setup > App signing.
5. Rebuild the app. In More you will see Google Drive status after signing in with Google.
6. While the consent screen is in Testing, only listed test users can sign in. Publish it to production before the public release.

What gets saved: a folder VeloDVault in the user's Drive with one subfolder per category (each holding a Google Sheet), a Documents folder for uploaded files, and a small hidden-style _app folder with state.json used to restore on a new phone.
The sign-in and Drive code is tested against simulated services only. Test it on a real phone with a test user before any release.
