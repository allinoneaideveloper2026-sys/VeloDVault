// VV-VERSION 1.10
// Loads the real index.html in a simulated browser, in Android-app mode and in web mode. Run: node tests/app.test.js
const { JSDOM, VirtualConsole } = require('jsdom'); const fs = require('fs'); const path = require('path'); const { webcrypto } = require('crypto');
const W = f => fs.readFileSync(path.join(__dirname, '../www', f), 'utf8');
let passed = 0;
async function t(n, f) { try { await f(); passed++; console.log('  ok  ' + n); } catch (e) { console.log('FAIL  ' + n + '\n      ' + (e && e.message)); process.exitCode = 1; } }
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const wait = (f, ms) => new Promise((res, rej) => { const s = Date.now(); (function p() { try { if (f()) return res(); } catch (e) {} if (Date.now() - s > (ms || 4000)) return rej(new Error('timeout waiting')); setTimeout(p, 30); })(); });


function makeFirebase() {
  const db = {}; let cur = null; const cbs = []; const sent = { verify: [], reset: [] }; let deleted = [];
  const err = c => Object.assign(new Error(c), { code: c });
  const user = r => ({ email: r.email, uid: r.uid, get emailVerified() { return r.verified; }, reload: async () => {} });
  const notify = () => cbs.forEach(f => f(cur ? user(cur) : null));
  const F = {
    initializeApp: c => ({ c }), initializeAuth: () => ({ get currentUser() { return cur ? user(cur) : null; } }), indexedDBLocalPersistence: 1, browserLocalPersistence: 2,
    createUserWithEmailAndPassword: async (a, e, p) => { if (db[e]) throw err('auth/email-already-in-use'); db[e] = { email: e, pw: p, verified: false, uid: 'u' + (Object.keys(db).length + 1) }; cur = db[e]; notify(); return { user: user(cur) }; },
    signInWithEmailAndPassword: async (a, e, p) => { if (!db[e] || db[e].pw !== p) throw err('auth/invalid-credential'); cur = db[e]; notify(); return { user: user(cur) }; },
    sendEmailVerification: async u => { sent.verify.push(u.email); },
    sendPasswordResetEmail: async (a, e) => { sent.reset.push(e); },
    signOut: async () => { cur = null; notify(); },
    onAuthStateChanged: (a, cb) => { cbs.push(cb); setTimeout(() => cb(cur ? user(cur) : null), 0); return () => {}; },
    deleteUser: async u => { deleted.push(u.email); delete db[u.email]; cur = null; notify(); },
    reauthenticateWithCredential: async (u, c) => { if (db[u.email].pw !== c.pw) throw err('auth/invalid-credential'); },
    EmailAuthProvider: { credential: (email, pw) => ({ email, pw }) }
  };
  return { F, db, sent, deleted, verify: e => { db[e].verified = true; }, remoteSignOut: () => { cur = null; notify(); } };
}
function load(native, fbmock) {
  const html = W('index.html').replace('<script src="vv-plugins.js"></script>', '').replace('<script src="firebase-config.js"></script>', fbmock ? '<script>window.VV_FIREBASE={apiKey:"k",authDomain:"x.firebaseapp.com",projectId:"p",appId:"a"}</script>' : '<script>window.VV_FIREBASE={apiKey:"YOUR_FIREBASE_API_KEY",authDomain:"YOUR_PROJECT_ID.firebaseapp.com",projectId:"YOUR_PROJECT_ID",appId:"YOUR_FIREBASE_APP_ID"}</script>').replace('<script src="fbauth.js"></script>', '<script>' + W('fbauth.js') + '</script>').replace('<script src="config.js"></script>', '').replace('<script src="native.js"></script>', native ? '<script>' + W('native.js') + '</script>' : '');
  const secure = {};
  const vc = new VirtualConsole(); vc.on('jsdomError', e => { if (!/scrollTo/.test(e.message)) console.log('   page error:', e.message.slice(0, 220)); });
  return new JSDOM(html, {
    virtualConsole: vc, runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
    beforeParse(w) {
      Object.defineProperty(w, 'crypto', { value: webcrypto });
      w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.Uint8Array = Uint8Array;
      w.matchMedia = () => ({ matches: false }); w.Element.prototype.scrollIntoView = function () {}; w.Blob.prototype.arrayBuffer = function () { const b = this; return new Promise(r => { const fr = new w.FileReader(); fr.onload = () => r(fr.result); fr.readAsArrayBuffer(b); }); }; w.addEventListener('unhandledrejection', e => console.log('   rejected:', String(e.reason && e.reason.stack || e.reason).slice(0, 300)));
      w.VV_CONFIG = { googleWebClientId: 'x.apps.googleusercontent.com' };
      if (fbmock && !native) w.VVP = { native: false, Firebase: fbmock.F };
      if (native) w.VVP = { native: true, Firebase: fbmock ? fbmock.F : undefined, Camera: { Camera: { getPhoto: async o => { w.__cam = o; if (w.__camFail) throw new Error(w.__camFail); return { base64String: '/9j/4AAQSkZJRgABAQEASABIAAD/2wBD', format: 'jpeg' }; } }, CameraResultType: { Base64: 'base64' }, CameraSource: { Camera: 'CAMERA', Photos: 'PHOTOS' } },
        SecureStorage: { get: async k => secure[k] || null, set: async (k, v) => { secure[k] = v; } },
        LocalNotifications: { getPending: async () => ({ notifications: [] }), cancel: async () => {}, schedule: async () => {}, checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }) },
        BiometricAuth: { checkBiometry: async () => ({ isAvailable: true, deviceIsSecure: true }), authenticate: async () => {} },
        SocialLogin: { initialize: async () => {}, login: async () => ({ result: { profile: { email: w.__gmail || '' }, accessToken: { token: 't' } } }) } };
    }
  });
}

(async () => {
  console.log('Android app mode');
  const dom = load(true), w = dom.window, app = () => w.document.getElementById('app').innerHTML;
  await t('starts with encrypted storage on and shows Google sign-in with Drive', async () => { await wait(() => w.SEC && w.SEC.on && app().length > 100); ok(/saves to your Drive/.test(app())); ok(/VeloDVault/.test(app())); });
  await t('sign-up needs the consent box, then signs in', async () => {
    w.eval("st.mode='signup';draw()"); w.document.getElementById('em').value = 'a@b.com'; w.document.getElementById('pw').value = 'longpassword1';
    await w.eval('emailAuth2()');
    ok(!w.eval('st.user'), 'must not sign in without consent'); ok(/confirm the privacy notice/.test(app()), 'consent error shown');
    ok(w.document.getElementById('em').value === 'a@b.com', 'typed email is kept after an error');
    w.document.getElementById('pw').value = 'longpassword1'; w.document.getElementById('cn').checked = true;
    await w.eval('emailAuth2()'); await wait(() => w.eval('st.user') === 'a@b.com');
    ok(/Personalized tracker/.test(app()));
  });
  await t('password is stored hashed, never as typed', async () => { const u = w.eval("S.get('vw_users')")['a@b.com']; ok(u.h && u.salt, 'hash and salt'); ok(!JSON.stringify(u).includes('longpassword1')); });
  await t('More shows reminders, lock and security', async () => { w.eval("st.tab='more';draw()"); const h = app(); ok(/Reminders/.test(h)); ok(/Fingerprint, face or screen lock/.test(h)); ok(/Security/.test(h)); });
  await t('Security screen reports encryption and no third-party code as active', async () => { w.eval("st.tab='security';draw()"); const h = app(); ok(/Encryption at rest[\s\S]*?Active/.test(h), 'encryption'); ok(/No third-party code[\s\S]*?Active/.test(h), 'third party'); });
  await t('turning reminders on works', async () => { await w.NATIVE.toggleRem(); ok(w.eval("S.get('vw_rem')") === true); });
  await t('spreadsheet export blocks formula injection and escapes quotes', async () => {
    w.eval("S.set('vw_r_a@b.com',[{id:'1',c:'vehicle',d:{name:'=HYPERLINK(\"http://x\")',reg:'KA01HQ5468',vtype:'Car'},created:'2026-11-05 10:00',edited:null,docs:[]}])");
    const csv = w.eval('driveData()').sheets.Vehicle; ok(csv.includes('"\'=HYPERLINK(""http://x"")"'), csv.slice(0, 160));
  });
  await t('reminder items are built from records', async () => {
    w.eval("S.set('vw_r_a@b.com',[{id:'9',c:'insurance',d:{name:'Car · KA01HQ5468',expiry:'2030-01-01'}}])");
    const items = w.eval('remItems(recs())'); ok(items.length === 1 && /Insurance: Car/.test(items[0].title));
  });

  await t('when Google sign-in fails, the screen shows the real reason', async () => {
    const SL = w.VVP.SocialLogin, orig = SL.login; SL.login = async () => { throw Object.assign(new Error('Developer console is not set up correctly'), { code: '10' }); };
    w.eval("st.user=null;st.mode='signin';draw()"); await w.eval('googleGo()'); const toastText = [...w.document.querySelectorAll('.toast')].map(n => n.textContent).join(' ');
    ok(/Developer console is not set up correctly/.test(toastText) && /10/.test(toastText), 'reason shown: ' + toastText);
    SL.login = async () => ({ result: { profile: { email: 'a@b.com' } } }); w.document.querySelectorAll('.toast').forEach(n => n.remove()); await w.eval('googleGo()');
    ok(/did not give Drive access/.test([...w.document.querySelectorAll('.toast')].map(n => n.textContent).join(' ')), 'missing token explained'); SL.login = orig;
  });
  await t('password field has a show/hide button that works', async () => {
    w.eval("st.user=null;st.mode='signin';draw()"); const pw = w.document.getElementById('pw');
    ok(pw.type === 'password' && w.document.getElementById('pwt'), 'button present'); w.eval("togglePw('pw','pwt')"); ok(w.document.getElementById('pw').type === 'text'); ok(w.document.getElementById('pwt').textContent === 'Hide');
    w.eval("togglePw('pw','pwt')"); ok(w.document.getElementById('pw').type === 'password');
  });
  await t('forgot password: phone lock check, then a new password works and the old one does not', async () => {
    w.__gmail = 'someone.else@gmail.com'; w.document.getElementById('em').value = 'a@b.com'; await w.eval('forgot()');
    ok(/Email not verified/.test(w.document.getElementById('mod').innerHTML) && /someone\.else@gmail\.com/.test(w.document.getElementById('mod').innerHTML), 'wrong Google account is refused');
    ok(!/Set a new password/.test(w.document.getElementById('mod').innerHTML), 'no password box without verification');
    w.eval('closeM()'); w.document.getElementById('em').value = 'a@b.com'; w.eval("st.em='a@b.com'");
    w.__gmail = 'a@b.com'; await w.eval('forgot()');
    ok(/Set a new password/.test(w.document.getElementById('mod').innerHTML), 'reset dialog shown');
    w.document.getElementById('np').value = 'short'; await w.eval('setNewPw()'); ok(/at least 8/.test(w.document.getElementById('mod').innerHTML), 'short password refused');
    w.document.getElementById('np').value = 'brandnewpass9'; await w.eval('setNewPw()');
    w.document.getElementById('em').value = 'a@b.com'; w.document.getElementById('pw').value = 'longpassword1'; await w.eval('emailAuth2()'); ok(!w.eval('st.user'), 'old password refused');
    w.document.getElementById('pw').value = 'brandnewpass9'; await w.eval('emailAuth2()'); await wait(() => w.eval('st.user') === 'a@b.com');
    ok(w.eval("S.get('vw_r_a@b.com')").length === 1, 'records kept');
  });
  await t('forgot password for an unknown email asks for a registered email', async () => {
    w.eval("st.user=null;draw()"); w.document.getElementById('em').value = 'nobody@x.com'; await w.eval('forgot()'); ok(/registered email/.test(w.document.getElementById('app').innerHTML));
  });
  await t('document screen offers Take photo (camera) and Choose file', async () => {
    w.eval("st.user='a@b.com';st.tab='add';st.cat='vehicle';draw()"); const h = app();
    ok(/Take photo/.test(h) && /capture="environment"/.test(h), 'camera input'); ok(/Choose file/.test(h) && /application\/pdf/.test(h), 'file input');
  });
  await t('graphics: each Discover section draws its own illustration', async () => {
    for (const k of ['launch', 'cars', 'bikes', 'ev', 'ins']) { w.eval("st.tab='discover';st.dk='" + k + "';st.ds=0;draw()"); ok(/<svg[^>]*aria-label=["'][a-zA-Z]+ illustration["']/.test(app()), 'illustration in ' + k); }
  });

  await t('custom form needs a category name', async () => {
    w.eval("st.user='a@b.com';st.tab='add';st.cat='custom';st.editId=null;draw()"); ok(/Category name/.test(app()) && /House rent/.test(app()), 'category field with example');
    w.document.getElementById('f_name').value = 'Flat 2B rent'; w.eval('saveRec()'); ok(/Required/.test(w.document.getElementById('e_cat').textContent), 'category required');
  });
  await t('each custom category gets its own sheet with its own columns', async () => {
    w.eval(`S.set('vw_r_a@b.com',[{id:'c1',c:'custom',d:{cat:'House rent',name:'Flat 2B',note:'',expiry:'2026-12-01',extra:{'Rent amount':'18000','Landlord':'Mr Rao'}},created:'2026-11-01 09:00',edited:null,docs:[]},{id:'c2',c:'custom',d:{cat:'House rent',name:'Flat 3C',note:'',expiry:'',extra:{'Rent amount':'12000'}},created:'2026-11-02 09:00',edited:null,docs:[]},{id:'c3',c:'custom',d:{cat:'Gym',name:'Membership',note:'annual',expiry:'2027-03-01',extra:{'Fee':'9000'}},created:'2026-11-03 09:00',edited:null,docs:[]}])`);
    const sh = w.eval('driveData()').sheets, keys = Object.keys(sh);
    ok(keys.includes('Custom|House rent') && keys.includes('Custom|Gym'), 'sheet per category: ' + keys.join());
    ok(!keys.includes('Custom'), 'no single mixed Custom sheet');
    const head = sh['Custom|House rent'].split('\r\n')[0]; ok(/Rent amount/.test(head) && /Landlord/.test(head) && !/Fee/.test(head), head);
    ok(/Fee/.test(sh['Custom|Gym'].split('\r\n')[0]) && !/Rent amount/.test(sh['Custom|Gym']));
    w.eval("st.tab='records';st.sheet=1;draw()"); const h = app(); ok(/Custom · House rent/.test(h) && /Custom · Gym/.test(h), 'sheet view headings'); ok(/Landlord/.test(h) && /Mr Rao/.test(h));
    w.eval("st.sheet=0;draw()"); ok(/Custom · House rent/.test(app()), 'card shows category');
    const items = w.eval('remItems(recs())'); ok(items.some(x => /Custom · House rent: Flat 2B/.test(x.title)), 'reminder names the category');
  });
  await t('feedback is saved and prepared as an email to the support inbox', async () => {
    w.eval("st.tab='fb';draw()"); w.document.getElementById('tm').value = 'The camera button did not open on my phone.'; w.eval('sendTk()');
    const tk = w.eval("S.get('vw_tk_a@b.com')")[0]; ok(/^VV-\d{4}$/.test(tk.id) && tk.status === 'Sent' && tk.uid === 'a@b.com');
    ok(w.eval('SUPPORT') === 'allinoneaideveloper2026@gmail.com'); ok(/opens in your email app/.test(app()));
  });
  await t('About shows the owner, no prototype wording, and builds as an Android app', async () => {
    w.eval("st.tab='about';draw()"); const h = app(); ok(/allinoneaideveloper2026/.test(h) && /allinoneaideveloper2026@gmail\.com/.test(h), 'owner and email'); ok(!/prototype/i.test(h), 'no prototype text'); ok(/VeloDVault is an Android app/.test(h)); ok(!/\[/.test(h.replace(/<[^>]*>/g, '')), 'no placeholders left in About');
  });

  console.log('Email sign-in with Firebase (verified email, any device)');
  const fbm = makeFirebase(), fdom = load(true, fbm), fw = fdom.window, fapp = () => fw.document.getElementById('app').innerHTML, $f = id => fw.document.getElementById(id);
  const fill = (em, pw) => { $f('em').value = em; $f('pw').value = pw; };
  await t('Firebase mode is on and says the email is verified', async () => { await wait(() => fw.FBAUTH && fw.FBAUTH.enabled && /verified before/.test(fapp())); });
  await t('without Firebase the app clearly says it is in test mode', async () => {
    const nf = load(true).window; await wait(() => nf.document.getElementById('app').innerHTML.length > 100);
    ok(/Test mode: accounts exist only on this phone/.test(nf.document.getElementById('app').innerHTML)); ok(nf.eval('fbOn()') === false);
  });
  await t('sign-up needs consent, then shows a check-your-email screen and does NOT open the app', async () => {
    fw.eval("st.mode='signup';draw()"); fill('Sam@Example.com', 'longpassword1'); await fw.eval('fbAuth()'); ok(/confirm the privacy notice/.test(fapp()), 'consent required'); ok(!fbm.db['sam@example.com'], 'no account without consent');
    fill('Sam@Example.com', 'longpassword1'); $f('cn').checked = true; await fw.eval('fbAuth()');
    ok(/Check your email/.test(fapp()) && /sam@example\.com/.test(fapp()), 'verify screen'); ok(!fw.eval('st.user'), 'app stays closed'); ok(fbm.sent.verify.includes('sam@example.com'), 'verification email sent');
  });
  await t('tapping "I have verified" before opening the link is refused', async () => { await fw.eval('fbCheck()'); ok(/Not verified yet/.test(fapp()) && !fw.eval('st.user')); });
  await t('after the link is opened the account opens, with no password stored in the app', async () => {
    fbm.verify('sam@example.com'); await fw.eval('fbCheck()'); await wait(() => fw.eval('st.user') === 'sam@example.com');
    const u = fw.eval("S.get('vw_users')")['sam@example.com']; ok(u.fb === true && !u.h && !u.salt && !u.pw, 'no local password data');
  });
  await t('same email cannot be registered twice', async () => {
    await fw.eval('signOut()'); ok(!fw.eval('st.user')); fw.eval("st.mode='signup';draw()"); fill('sam@example.com', 'otherpassword9'); $f('cn').checked = true; await fw.eval('fbAuth()');
    ok(/already exists/.test(fapp()), 'duplicate refused');
  });
  await t('wrong password is refused; right password opens the app (like a second phone)', async () => {
    fw.eval("st.mode='signin';draw()"); fill('sam@example.com', 'wrongpassword'); await fw.eval('fbAuth()'); ok(/Incorrect email or password/.test(fapp()) && !fw.eval('st.user'));
    fill('sam@example.com', 'longpassword1'); await fw.eval('fbAuth()'); await wait(() => fw.eval('st.user') === 'sam@example.com');
  });
  await t('an unverified account cannot sign in until verified', async () => {
    await fw.eval('signOut()'); fbm.db['new@example.com'] = { email: 'new@example.com', pw: 'abcdefgh1', verified: false, uid: 'u9' };
    fw.eval("st.mode='signin';draw()"); fill('new@example.com', 'abcdefgh1'); await fw.eval('fbAuth()'); ok(/Check your email/.test(fapp()) && !fw.eval('st.user'), 'sent to verify screen');
    await fw.eval('fbBack()'); ok(/Create account|Sign up/.test(fapp()));
  });
  await t('forgot password sends a reset email and never reveals whether the account exists', async () => {
    fw.eval("st.mode='signin';draw()"); $f('em').value = 'sam@example.com'; await fw.eval('fbForgot()'); const a1 = fw.document.getElementById('mod').innerHTML;
    fw.eval('closeM()'); $f('em').value = 'nobody@example.com'; await fw.eval('fbForgot()'); const a2 = fw.document.getElementById('mod').innerHTML;
    ok(/If an account exists/.test(a1) && /If an account exists/.test(a2), 'same wording'); ok(fbm.sent.reset.includes('sam@example.com'), 'reset email requested'); ok(!/not found|no account/i.test(a2));
  });
  await t('signing out elsewhere signs this phone out too', async () => {
    fill('sam@example.com', 'longpassword1'); await fw.eval('fbAuth()'); await wait(() => fw.eval('st.user') === 'sam@example.com');
    fbm.remoteSignOut(); await wait(() => !fw.eval('st.user')); ok(/signed out|Sign in/i.test(fapp()));
  });
  await t('Security screen lists verified email sign-in as active', async () => { fill('sam@example.com', 'longpassword1'); await fw.eval('fbAuth()'); await wait(() => fw.eval('st.user')); fw.eval("st.tab='security';draw()"); ok(/Verified email sign-in[\s\S]*?Active/.test(fapp()) && /Firebase Authentication/.test(fapp())); });
  await t('More offers to connect Google Drive for email accounts (restore on a new phone)', async () => { fw.eval("st.tab='more';draw()"); ok(/Connect Google Drive/.test(fapp())); });
  await t('deleting the account needs the password, removes the sign-in account and wipes the phone', async () => {
    fw.eval('askDelAcc()'); $f('dpw').value = 'wrong'; $f('dc').value = 'DELETE'; await fw.eval('delAcc()'); ok(/Incorrect email or password/.test(fw.document.getElementById('mod').innerHTML) && fbm.db['sam@example.com'], 'wrong password refused');
    $f('dpw').value = 'longpassword1'; await fw.eval('delAcc()'); ok(!fbm.db['sam@example.com'] && fbm.deleted.includes('sam@example.com'), 'sign-in account deleted'); ok(!fw.eval('st.user') && !fw.eval("S.get('vw_users')")['sam@example.com'], 'phone wiped');
  });

  console.log('Setup check (finds why sign-up or Google fails)');
  const modalText = win => win.document.getElementById('mod').innerHTML;
  await t('the setup check is hidden until developer tools are switched on (7 taps), and then works before sign-in', async () => {
    fw.eval("st.user=null;st.mode='signin';draw()"); ok(!/run the setup check/i.test(fapp()), 'hidden from ordinary users'); for (let i = 0; i < 7; i++) fw.eval('aboutTap()'); ok(/run the setup check/i.test(fapp()), 'seven taps on the footer text turn developer tools on'); fw.eval('setupCheck()'); ok(/Setup check/.test(modalText(fw)) && /Firebase settings/.test(modalText(fw)) && /Google settings/.test(modalText(fw)) && new RegExp('Version ' + fw.eval('APPVER').replace('.', '\\.')).test(modalText(fw)));
  });
  const probe = async (win, resp) => { win.fetch = typeof resp === 'function' ? resp : async () => ({ status: resp.status || 400, json: async () => resp.body }); win.eval('setupCheck()'); await win.eval('runChecks()'); return win.document.getElementById('sc').textContent; };
  await t('Firebase live test: working setup', async () => { ok(/key is valid and Email\/Password sign-in is switched on/.test(await probe(fw, { body: { error: { message: 'INVALID_LOGIN_CREDENTIALS' } } })), 'ok case'); });
  await t('Firebase live test: names each common mistake', async () => {
    ok(/NOT switched on/.test(await probe(fw, { body: { error: { message: 'OPERATION_NOT_ALLOWED' } } })), 'email sign-in off');
    ok(/key in this build is not valid/.test(await probe(fw, { body: { error: { message: 'API key not valid. Please pass a valid API key.' } } })), 'bad key');
    ok(/Authentication is not started/.test(await probe(fw, { body: { error: { message: 'CONFIGURATION_NOT_FOUND' } } })), 'not started');
    ok(/blocked or restricted/.test(await probe(fw, { status: 403, body: { error: { message: 'API_KEY_HTTP_REFERRER_BLOCKED' } } })), 'restricted key');
    ok(/Could not reach Firebase/.test(await probe(fw, async () => { throw new Error('Failed to fetch'); })), 'no internet or blocked');
  });
  await t('without Firebase values the check says so instead of guessing', async () => { ok(/placeholders/.test(await probe(w, { body: {} }))); });
  await t('Google test: shows success with Drive, or the exact reason', async () => {
    w.eval("st.user=null;draw()"); w.fetch = async () => ({ ok: true, status: 200, json: async () => ({ files: [] }) }); w.eval('setupCheck()'); await w.eval('testGoogle()');
    ok(/Signed in as a@b\.com/.test(w.document.getElementById('sc').textContent) && /Drive answered/.test(w.document.getElementById('sc').textContent), 'success path');
    const SL = w.VVP.SocialLogin, orig = SL.login; SL.login = async () => { throw Object.assign(new Error('Developer console is not set up correctly'), { code: '10' }); };
    w.eval('setupCheck()'); await w.eval('testGoogle()'); ok(/Developer console is not set up correctly/.test(w.document.getElementById('sc').textContent), 'failure reason'); SL.login = orig;
  });
  await t('Setup check shows the app\'s own package name and SHA-1 to copy into Google Cloud', async () => {
    w.VVNative = { info: () => JSON.stringify({ pkg: 'com.allinoneaideveloper2026.velodvault', sha1: 'AA:BB:CC:DD', sha256: '11:22:33' }) };
    w.eval('setupCheck()'); const txt = w.document.getElementById('sc').textContent;
    ok(/Package name: com\.allinoneaideveloper2026\.velodvault/.test(txt) && /SHA-1: AA:BB:CC:DD/.test(txt) && /exactly this package name/.test(txt), txt.slice(0, 300));
    w.VVNative = { info: () => JSON.stringify({ error: 'SecurityException' }) }; w.eval('setupCheck()'); ok(/Could not read the app identity/.test(w.document.getElementById('sc').textContent), 'error case');
    w.VVNative = { info: () => JSON.stringify({ pkg: 'com.allinoneaideveloper2026.velodvault', sha1: 'AA:BB:CC:DD', sha256: '11:22:33' }) };
  });
  await t('copy report works without clipboard and includes version and recent errors', async () => {
    w.eval('setupCheck()'); w.eval('copyReport()'); const m = modalText(w); ok(/VeloDVault setup report/.test(m) && new RegExp('Version ' + w.eval('APPVER').replace('.', '\\.')).test(m) && /google sign-in/i.test(m) && /Developer console/.test(m) && /SHA-1: AA:BB:CC:DD/.test(m), 'report content');
    ok(!/AIza|client_secret/.test(m), 'no secrets in the report');
  });
  await t('sign-up errors show the real code instead of a vague message', async () => {
    ok(/Email\/Password/.test(fw.FBAUTH.friendly({ code: 'auth/operation-not-allowed' })), 'known code explained'); ok(/auth\/some-new-thing/.test(fw.FBAUTH.friendly({ code: 'auth/some-new-thing' })), 'unknown code shown');
  });

  console.log('Camera, documents, display name');
  const imgDoc = (name, at, data) => ({ name, type: 'image', data: data || 'data:image/jpeg;base64,QUJD', at });
  await t('Take photo opens the camera directly and never falls back to the gallery picker', async () => {
    w.eval("st.user='a@b.com';st.tab='add';st.cat='vehicle';st.editId=null;draw()"); let galleryOpened = false; w.document.getElementById('fl').click = () => { galleryOpened = true; };
    await w.eval('takePhoto()'); ok(w.__cam && w.__cam.source === 'CAMERA' && w.__cam.saveToGallery === false && w.__cam.resultType === 'base64', 'camera options'); ok(!galleryOpened, 'file picker not used');
    w.document.querySelectorAll('.toast').forEach(n => n.remove()); w.__camFail = 'User cancelled photos app'; await w.eval('takePhoto()'); ok(![...w.document.querySelectorAll('.toast')].length, 'cancelling is silent');
    w.__camFail = 'Camera permission denied'; await w.eval('takePhoto()'); ok(/Camera permission denied/.test([...w.document.querySelectorAll('.toast')].map(n => n.textContent).join(' ')), 'real reason shown'); w.__camFail = '';
  });
  await t('attaching a document does NOT invent sample values in the form', async () => {
    w.eval("st.cat='vehicle';st.docs=[];draw()"); w.eval("scanFile(new File(['%PDF-1.4 hello world test'],'rc.pdf',{type:'application/pdf'}))");
    await wait(() => /Attached/.test(w.document.getElementById('pv').textContent) && w.eval('st.docs.length') === 1);
    ok(w.document.getElementById('f_reg').value === '' && w.document.getElementById('f_owner').value === '', 'no demo values'); ok(!/Demo scan|sample values/i.test(w.document.getElementById('pv').textContent)); ok(/^\d{4}-\d{2}-\d{2}/.test(w.eval('st.docs[0].at')), 'attach time recorded');
    ok(!/auto-fill with AI/i.test(app()) && /Attach documents/.test(app()), 'wording is honest');
  });
  await t('greeting uses a name the user chooses, not the email', async () => {
    w.eval("st.tab='home';draw()"); ok(/Hello A 👋/.test(app()) && !/Hello a@b\.com/.test(app()), 'default is the part before @');
    w.eval("st.tab='more';draw()"); ok(/Your name/.test(app())); w.eval('askName()'); w.document.getElementById('nm').value = 'Don'; w.eval('saveName()');
    w.eval("st.tab='home';draw()"); ok(/Hello Don 👋/.test(app()), 'custom name shown'); w.eval("st.tab='more';draw()"); ok(/<b>Don<\/b>/.test(app()) && /a@b\.com/.test(app()), 'profile shows name and email');
    w.eval('askName()'); w.document.getElementById('nm').value = '<img src=x onerror=1>'; w.eval('saveName()'); w.eval("st.tab='home';draw()"); ok(!/<img src=x/.test(app()) && /Hello img srcx onerror1/.test(app()), 'unsafe characters removed');
    w.eval('askName()'); w.document.getElementById('nm').value = '   '; w.eval('saveName()'); ok(/Enter a name/.test(w.document.getElementById('mod').innerHTML), 'empty refused'); w.eval('clearName()'); w.eval("st.tab='home';draw()"); ok(/Hello A 👋/.test(app()), 'back to default');
    ok(w.eval("S.get('vw_name_other@x.com')") == null, 'name belongs to one account');
  });
  const vrec = (id, nick, reg, docs) => ({ id, c: 'vehicle', d: { name: nick, reg, make: 'Yamaha', model: 'Fascino', fuel: 'Petrol', regdate: '2016-06-12', expiry: '2031-06-12', extra: {} }, created: '2026-01-01 09:00', edited: null, docs: docs || [] });
  const lrec = (id, c, key, d, created, docs) => ({ id, c, d: Object.assign({ name: key, extra: {} }, d), created, edited: null, docs: docs || [] });
  const seed = () => w.eval('S.set("vw_r_a@b.com",' + JSON.stringify([
    vrec('v1', 'Fascino', 'KA01HQ5468', [imgDoc('rc.jpg', '2026-01-02 10:00')]), vrec('v2', 'Tiago', 'KA01MP5284'),
    lrec('i1', 'insurance', 'Fascino · KA01HQ5468', { provider: '=cmd|calc', ptype: 'Comprehensive', policy: 'P1', start: '2025-01-01', expiry: '2026-01-01' }, '2025-01-01 10:00', [imgDoc('old.jpg', '2025-01-01 10:00')]),
    lrec('i2', 'insurance', 'Fascino · KA01HQ5468', { provider: 'Acko', ptype: 'Comprehensive', policy: 'P2', start: '2026-01-01', expiry: '2027-01-01' }, '2026-11-01 10:00', [imgDoc('new.jpg', '2026-11-01 10:00'), imgDoc('page2.jpg', '2026-11-01 10:01')]),
    lrec('p1', 'puc', 'Fascino · KA01HQ5468', { center: 'C', issue: '2026-07-01', expiry: '2027-07-01' }, '2026-07-01 10:00', [{ name: 'puc.pdf', type: 'pdf', data: 'data:application/pdf;base64,JVBERi0=', at: '2026-07-02 08:00' }]),
    lrec('p2', 'puc', 'Tiago · KA01MP5284', { center: 'C', issue: '2026-08-01', expiry: '2027-08-01' }, '2026-08-01 10:00', [imgDoc('t.jpg', '2026-08-03 09:00')]),
    lrec('e1', 'expense', 'Fascino · KA01HQ5468', { kind: 'Service', amount: '1850', date: '2026-10-10', note: 'Oil change' }, '2026-10-10 10:00', [imgDoc('bill.jpg', '2026-10-10 10:05')]),
    { id: 'd1', c: 'dl', d: { name: 'Don', dlno: 'KA25', classes: 'MCWG', expiry: '2036-02-15', extra: {} }, created: '2026-02-01 10:00', edited: null, docs: [imgDoc('dl.jpg', '2026-02-02 10:00')] },
    { id: 'c1', c: 'custom', d: { cat: 'House rent', name: 'Flat 2B', note: '', expiry: '', extra: {} }, created: '2026-03-01 10:00', edited: null, docs: [imgDoc('agreement.jpg', '2026-03-02 10:00')] }]) + ')');
  const plan = () => JSON.parse(w.eval('JSON.stringify(docPlan(recs()))'));
  await t('Drive plan: one folder per vehicle, files named Nickname_Type_Date', async () => {
    seed(); const p = plan(), g1 = p.groups.find(g => g.key === 'veh:v1'), g2 = p.groups.find(g => g.key === 'veh:v2');
    ok(g1.folder === 'Fascino KA01HQ5468' && g2.folder === 'Tiago KA01MP5284', 'folder per vehicle: ' + g1.folder);
    const names = g1.docs.map(d => d.fileName).sort(); ok(names.includes('Fascino_RC_2026-01-02.jpg') && names.includes('Fascino_PUC_2026-07-02.pdf') && names.includes('Fascino_Receipt-Service_2026-10-10.jpg'), names.join());
    ok(g2.docs.length === 1 && g2.docs[0].fileName === 'Tiago_PUC_2026-08-03.jpg', 'second vehicle has its own files');
  });
  await t('Drive plan: a new upload of the same type for the same vehicle replaces the old one', async () => {
    const g1 = plan().groups.find(g => g.key === 'veh:v1'), ins = g1.docs.filter(d => /Insurance/.test(d.fileName));
    ok(ins.length === 2 && ins.every(d => d.rec === 'i2') && ins[0].fileName === 'Fascino_Insurance_2026-11-01.jpg' && ins[1].fileName === 'Fascino_Insurance_2026-11-01_2.jpg', 'only the latest insurance, pages numbered: ' + ins.map(d => d.fileName));
    ok(g1.docs.every(d => d.rec !== 'i1'), 'older insurance not kept'); ok(plan().clear.some(c => c.rec === 'i1' && c.idx === 0), 'older document told to drop its Drive link'); ok(ins[0].slot === 'veh:v1|Insurance|0', 'stable slot id');
  });
  await t('Drive plan: licence goes to Personal, other custom records to Other, nothing is lost', async () => {
    const p = plan(), per = p.groups.find(g => g.key === 'personal'), oth = p.groups.find(g => g.key === 'other');
    ok(per.folder === 'Personal' && per.docs[0].fileName === 'Don_DL_2026-02-02.jpg', 'licence'); ok(oth.folder === 'Other' && /Flat 2B_Custom-House rent-c1_2026-03-02\.jpg/.test(oth.docs[0].fileName), 'custom: ' + oth.docs[0].fileName);
  });
  await t('vehicle summary sheet lists the papers, with the document file name and formula protection', async () => {
    const csv = plan().groups.find(g => g.key === 'veh:v1').csv; ok(/^\ufeff"Item","Details"/.test(csv)); ok(/"Vehicle \(RC\)","Yamaha Fascino · Petrol","KA01HQ5468"/.test(csv), 'vehicle row'); ok(/"Insurance","Acko · Comprehensive","P2".*"Fascino_Insurance_2026-11-01\.jpg"/.test(csv), 'latest insurance with file name');
    ok(/"Insurance","'=cmd\|calc/.test(csv), 'formula neutralised'); ok(/"Expense: Service","Oil change".*"1850"/.test(csv), 'expense row');
  });
  await t('driveData carries the plan, so sync needs nothing else', async () => { const d = w.eval('driveData()'); ok(d.plan && d.plan.groups.length >= 4 && Array.isArray(d.plan.clear)); });
  await t('My vehicles links to a common documents view, with the Drive folder when connected', async () => {
    w.eval("st.tab='home';draw()"); ok(/📎 Documents/.test(app()) && /View \(\d+\)/.test(app()), 'link on the vehicle card'); w.eval("S.set('vw_drvids_a@b.com',{pf:{'veh:v1':'FOLDER123'}})");
    w.eval("vehDocs('v1')"); const m = w.document.getElementById('mod').innerHTML; ok(/Documents: Fascino/.test(m) && /RC · rc\.jpg/.test(m) && /Insurance · new\.jpg/.test(m) && /PUC · puc\.pdf/.test(m) && /Receipt-Service · bill\.jpg/.test(m), 'all of this vehicle\'s documents'); ok(!/Tiago|t\.jpg/.test(m), 'only this vehicle');
    ok(/drive\.google\.com\/drive\/folders\/FOLDER123/.test(m), 'open folder in Drive'); ok(/only the latest document of each type is kept/i.test(m), 'tells the user about replacement');
    w.eval("S.del('vw_drvids_a@b.com')"); w.eval("vehDocs('v1')"); ok(!/drive\.google\.com/.test(w.document.getElementById('mod').innerHTML), 'no Drive link before Drive is connected');
  });

  console.log('Web mode (browser)');
  const d2 = load(false), w2 = d2.window;
  await t('web build has no fake Google login and no testing tools', async () => {
    await wait(() => w2.document.getElementById('app').innerHTML.length > 100);
    const h = w2.document.getElementById('app').innerHTML;
    ok(/available in the Android app/.test(h)); ok(!/demo\.user@gmail/.test(h)); ok(w2.eval('TESTING') === false);
  });
  await t('web forgot password explains there is no email reset and offers to erase', async () => {
    w2.eval("S.set('vw_users',{'x@y.com':{salt:'s',h:'h'}});st.user=null;draw()"); w2.document.getElementById('em').value = 'x@y.com'; await w2.eval('forgot()');
    const m = w2.document.getElementById('mod').innerHTML; ok(/no email we can send/.test(m) && /Erase this account/.test(m));
    w2.eval("askErase()"); w2.document.getElementById('dc').value = 'DELETE'; w2.eval('eraseAcc()'); ok(!w2.eval("S.get('vw_users')")['x@y.com'], 'account erased');
  });
  console.log('\n' + passed + ' checks passed' + (process.exitCode ? ', with failures' : ''));
  process.exit(process.exitCode || 0);
})();
