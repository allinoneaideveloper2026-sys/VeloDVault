/* VV-VERSION 1.9 */
/* VeloDVault sign-in with Firebase Authentication (email verification, password reset, sign-in on any device).
   Firebase holds only the email, the password hash and an account id. Records stay on the phone and in the user's own Drive. */
(function () {
  var cfg = window.VV_FIREBASE, F = window.VVP && window.VVP.Firebase;
  var ready = !!(cfg && F && cfg.apiKey && cfg.apiKey.indexOf('YOUR_') !== 0 && cfg.projectId && cfg.projectId.indexOf('YOUR_') !== 0);
  var A = { enabled: ready };
  window.FBAUTH = A;
  A.friendly = function (e) {
    var c = (e && e.code) || '';
    var m = {
      'auth/email-already-in-use': 'An account with this email already exists. Sign in or reset your password.',
      'auth/invalid-email': 'Enter a valid email.',
      'auth/weak-password': 'Choose a stronger password (at least 8 characters).',
      'auth/invalid-credential': 'Incorrect email or password.',
      'auth/wrong-password': 'Incorrect email or password.',
      'auth/user-not-found': 'Incorrect email or password.',
      'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
      'auth/network-request-failed': 'No internet. Check your connection and try again.',
      'auth/requires-recent-login': 'For safety, sign in again and retry.',
      'auth/user-disabled': 'This account has been disabled. Contact support.',
      'auth/operation-not-allowed': 'Email sign-up is not switched on in Firebase yet (Authentication > Sign-in method > Email/Password).',
      'auth/configuration-not-found': 'Firebase Authentication is not started for this project (open Authentication in Firebase and click Get started).',
      'auth/invalid-api-key': 'The Firebase key in this build is wrong. Copy it again from Firebase project settings.',
      'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'The Firebase key in this build is wrong. Copy it again from Firebase project settings.',
      'auth/unauthorized-domain': 'This address is not allowed in Firebase (Authentication > Settings > Authorized domains).',
      'auth/app-not-authorized': 'This app is not allowed to use that Firebase key. Check the key restrictions.',
      'auth/internal-error': 'Firebase had an internal problem. Try again, and run the Setup check.'
    };
    return m[c] || ('Something went wrong' + (c ? ' (' + c + ')' : '') + '. Try again, and run the Setup check.');
  };
  if (!ready) return;
  var app = F.initializeApp(cfg);
  var auth = F.initializeAuth(app, { persistence: [F.indexedDBLocalPersistence, F.browserLocalPersistence] });
  function info(u) { return { email: (u.email || '').toLowerCase(), verified: !!u.emailVerified, uid: u.uid }; }
  A.signUp = async function (email, pw) {
    var c = await F.createUserWithEmailAndPassword(auth, email, pw);
    try { await F.sendEmailVerification(c.user); } catch (e) { /* the user can resend from the next screen */ }
    return info(c.user);
  };
  A.signIn = async function (email, pw) { var c = await F.signInWithEmailAndPassword(auth, email, pw); return info(c.user); };
  A.resend = async function () { if (!auth.currentUser) throw { code: 'auth/requires-recent-login' }; await F.sendEmailVerification(auth.currentUser); };
  A.check = async function () { var u = auth.currentUser; if (!u) return null; await u.reload(); return info(auth.currentUser || u); };
  A.reset = function (email) { return F.sendPasswordResetEmail(auth, email); };
  A.signOut = function () { return F.signOut(auth); };
  A.onChange = function (cb) { return F.onAuthStateChanged(auth, cb); };
  A.reauthPassword = async function (pw) { var u = auth.currentUser; if (!u) throw { code: 'auth/requires-recent-login' }; await F.reauthenticateWithCredential(u, F.EmailAuthProvider.credential(u.email, pw)); };
  A.deleteAccount = async function () { var u = auth.currentUser; if (!u) throw { code: 'auth/requires-recent-login' }; await F.deleteUser(u); };
})();
