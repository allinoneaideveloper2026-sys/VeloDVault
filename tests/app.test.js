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
  const html = W('index.html').replace('<script src="vv-plugins.js"></script>', '').replace('<script src="firebase-config.js"></script>', fbmock ? '<script>window.VV_FIREBASE={apiKey:"k",authDomain:"x.firebaseapp.com",projectId:"p",appId:"a"}</script>' : '<script>' + W('firebase-config.js') + '</script>').replace('<script src="fbauth.js"></script>', '<script>' + W('fbauth.js') + '</script>').replace('<script src="config.js"></script>', '').replace('<script src="native.js"></script>', native ? '<script>' + W('native.js') + '</script>' : '');
  const secure = {};
  const vc = new VirtualConsole(); vc.on('jsdomError', e => { if (!/scrollTo/.test(e.message)) console.log('   page error:', e.message.slice(0, 220)); });
  return new JSDOM(html, {
    virtualConsole: vc, runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
    beforeParse(w) {
      Object.defineProperty(w, 'crypto', { value: webcrypto });
      w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.Uint8Array = Uint8Array;
      w.matchMedia = () => ({ matches: false }); w.Element.prototype.scrollIntoView = function () {}; w.addEventListener('unhandledrejection', e => console.log('   rejected:', String(e.reason && e.reason.stack || e.reason).slice(0, 300)));
      w.VV_CONFIG = { googleWebClientId: 'x.apps.googleusercontent.com' };
      if (fbmock && !native) w.VVP = { native: false, Firebase: fbmock.F };
      if (native) w.VVP = { native: true, Firebase: fbmock ? fbmock.F : undefined,
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
