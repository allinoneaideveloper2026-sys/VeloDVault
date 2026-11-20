# Troubleshooting sign-up and Google sign-in

Open the app. On the sign-in screen tap **Having trouble? Run the setup check** (also in More > Setup check).
1. Tap **Run checks** (tests Firebase). 2. Tap **Test Google sign-in** and choose your account. 3. Tap **Copy report** and paste it into a message.
The report holds no passwords or secrets (the Firebase key is shortened).

| What the check says | What it means | Fix |
|---|---|---|
| Version is not the latest number | An old build is installed | Run Build Android app, download, uninstall the old app, install the new APK |
| Firebase values are still placeholders | `www/firebase-config.js` was not filled, or a re-upload put the placeholders back | Paste the four Web app values, commit, rebuild |
| Email/Password sign-in is NOT switched on | Firebase Authentication is off for email | Firebase > Authentication > Sign-in method > Email/Password > Enable |
| The Firebase key is not valid | Wrong apiKey (for example copied from another project or app) | Firebase > Project settings > Your apps > Web app > copy the config again |
| Authentication is not started | You never clicked Get started | Firebase > Authentication > Get started |
| Key is blocked or restricted (403) | The key has restrictions that block the app | Google Cloud > Credentials > the Browser key > remove HTTP-referrer restriction (keep the API restriction) |
| Could not reach Firebase | No internet, or the build blocks the address | Check internet. If it persists, send the report |
| Google settings: placeholder | `www/config.js` still has YOUR_WEB_CLIENT_ID | Paste the Web application client ID, commit, rebuild |
| Google: Developer console is not set up correctly (code 10) | The Android client's package name or SHA-1 does not match this installed app | Open the setup check, read "This app (for Google setup)" and put exactly that package name and SHA-1 in the Android client. Save, wait about 5 minutes, try again |
| Google did not give Drive access | The drive.file scope is missing, or your Gmail is not a test user | Google Auth Platform > Data Access (add scope) and Audience (add test user) |
| Drive refused | Google Drive API is not enabled in the same project | APIs & Services > Library > Google Drive API > Enable |

| Take photo opens the gallery, not the camera | An old build that used the web file picker | Install the build from version 1.10 or later: it uses the phone's camera directly |

Rebuild and reinstall after any change to a config file.
The same table is printed in the GitHub **run summary** after every build (section "Setup check"), so you can check Firebase and Google settings before installing the app. The in-app Setup check is hidden: tap the version text in More > About (or the small footer text on the sign-in screen) 7 times to show it. Keep `DIAG=false` in `www/index.html` for the public release.
