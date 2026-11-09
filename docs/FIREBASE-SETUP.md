# Firebase sign-in setup (email verification, password reset, sign-in on any device)

Firebase Authentication handles the email, the password (stored as a hash by Google, never in the app) and a stable account id.
Your records stay on the phone and in the user's own Google Drive. Firebase never receives them.

## Steps
1. console.firebase.google.com > Add project. Name it VeloDVault. Turn Google Analytics OFF (not needed).
2. Build > Authentication > Get started > Sign-in method > Email/Password > Enable. Leave "Email link (passwordless)" off. Save.
3. Authentication > Settings:
   - User actions: keep sign-up enabled; turn **Email enumeration protection** ON; keep "One account per email address".
   - Password policy (if shown): minimum length 8.
   - Authorized domains: the defaults are fine (localhost is already listed).
4. Authentication > Templates > Email address verification and Password reset: set the sender name to VeloDVault and the reply-to to allinoneaideveloper2026@gmail.com. Keep the default action link (a Firebase-hosted page opens from the email and works on any device).
5. Project settings (gear) > Your apps > Add app > Web (`</>`). Name it VeloDVault app. Skip Firebase Hosting. Copy the four values from the config box.
6. In GitHub edit `www/firebase-config.js`: replace `YOUR_FIREBASE_API_KEY`, `YOUR_PROJECT_ID` (twice) and `YOUR_FIREBASE_APP_ID`. These values are public identifiers, not secrets. Commit.
7. Optional hardening: console.cloud.google.com > APIs & Services > Credentials > the "Browser key" > API restrictions > restrict to Identity Toolkit API and Token Service API.
8. Run **Build Android app**, install the new APK, and test (below).

## Test
- Sign up with a real email you can open. The app shows "Check your email" and stays closed.
- Open the link in the email (on any device), return to the app, tap "I have verified my email".
- Forgot password: tap it, open the emailed link, set a new password, sign in.
- Second phone: sign in with the same email and password. To get the records onto it, open More > Connect Google Drive and use the same Google account you used on the first phone.
- More > Delete my account and data: enter the password and DELETE. Afterwards the same email can sign up again.

## What to know
- **Free limits (Spark plan):** email and password sign-in is free at your scale. Check the current Firebase pages before launch: verification emails and password-reset emails have daily limits on the free plan, and sign-in attempts are rate limited.
- **Offline:** after the first sign-in the app opens without internet. Signing in again on a new phone needs internet.
- **Sign-out elsewhere:** if the account is signed out or deleted elsewhere, the phone signs out the next time it checks.
- **Test mode:** while `firebase-config.js` still has the YOUR_ values, the app runs with phone-only accounts and says so on the sign-in screen. Do not publish in that state.
- **Privacy:** Firebase (Google) processes the email and password hash. The privacy notice and the Play Data safety form already say so. Keep them in step with the final setup.
