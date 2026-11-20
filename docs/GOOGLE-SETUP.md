# Google sign-in and Drive saving: setup

The app only asks for the Drive "file" permission: it can see only files and folders it creates.
Check on the consent screen page that Google shows this scope with its sensitivity label; if Google asks for verification, follow its prompts.

1. Go to console.cloud.google.com, create a project named VeloDVault.
2. APIs and services > Library > enable **Google Drive API**.
3. APIs and services > OAuth consent screen: User type External; app name VeloDVault; support email; logo (icons/icon-512.png); privacy policy link (your privacy.html address); authorised domain; add scope `.../auth/drive.file`; add your own and testers' Gmail addresses under Test users.
4. Credentials > Create credentials > OAuth client ID:
   a. **Web application** (any name). Copy its client ID into `www/config.js` (`googleWebClientId`). This is the ID the app passes to Google.
   b. **Android**: the easiest way to get both values exactly right is the app itself. Install the build, open the sign-in screen, tap **Having trouble? Run the setup check**, and read **This app (for Google setup)**: it shows the **Package name** and **SHA-1** this installed app really has. Use those two values for the Android client. (The build run's Summary also lists the fingerprint if the workflow step is present.) Create one Android client per key you use:
      - your upload key (for the APK you install directly): the SHA1 from the run summary
      - Play's app signing key (for builds installed from Google Play): Play Console > Setup > App signing
5. Put the Web client ID into `www/config.js`, commit, and run **Build Android app** again. Install the new APK. Then in More you will see Google Drive status after signing in with Google.
6. While the consent screen is in Testing, only listed test users can sign in. Publish it to production before the public release.

What gets saved, all inside the user's own Drive (no other database or server):
- `VeloDVault/` with one subfolder per category (Vehicle, Insurance, PUC, ...), each holding a Google Sheet; custom categories get their own sheet named `Custom - <category>`.
- `VeloDVault/Documents/<Nickname> <Registration>/` : one folder per vehicle. It holds that vehicle's photos and PDFs named `Nickname_Type_Date.jpg` (for example `Fascino_PUC_2026-11-10.pdf`; Type is RC, Insurance, PUC, PA or Receipt-Service) and a Google Sheet `Summary - <Nickname>` listing its RC, insurance, PUC, PA and expenses with the matching file names.
- A new upload of the same type for the same vehicle replaces the old file (only the latest of each type is kept in Drive). Several pages of one document get `_2`, `_3`.
- `Documents/Personal/` holds the driving licence (`Name_DL_Date`); `Documents/Other/` holds documents of custom records.
- `VeloDVault/_app/state.json` is a small file used to restore everything on a new phone.
The sign-in and Drive code is tested against simulated services only. Test it on a real phone with a test user before any release.
