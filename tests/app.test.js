// Loads the real index.html in a simulated browser, in Android-app mode and in web mode. Run: node tests/app.test.js
const { JSDOM, VirtualConsole } = require('jsdom'); const fs = require('fs'); const path = require('path'); const { webcrypto } = require('crypto');
const W = f => fs.readFileSync(path.join(__dirname, '../www', f), 'utf8');
let passed = 0;
async function t(n, f) { try { await f(); passed++; console.log('  ok  ' + n); } catch (e) { console.log('FAIL  ' + n + '\n      ' + (e && e.message)); process.exitCode = 1; } }
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const wait = (f, ms) => new Promise((res, rej) => { const s = Date.now(); (function p() { try { if (f()) return res(); } catch (e) {} if (Date.now() - s > (ms || 4000)) return rej(new Error('timeout waiting')); setTimeout(p, 30); })(); });

function load(native) {
  const html = W('index.html').replace('<script src="vv-plugins.js"></script>', '').replace('<script src="config.js"></script>', '').replace('<script src="native.js"></script>', native ? '<script>' + W('native.js') + '</script>' : '');
  const secure = {};
  const vc = new VirtualConsole(); vc.on('jsdomError', e => { if (!/scrollTo/.test(e.message)) console.log('   page error:', e.message.slice(0, 220)); });
  return new JSDOM(html, {
    virtualConsole: vc, runScripts: 'dangerously', url: 'https://localhost/', pretendToBeVisual: true,
    beforeParse(w) {
      Object.defineProperty(w, 'crypto', { value: webcrypto });
      w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.Uint8Array = Uint8Array;
      w.matchMedia = () => ({ matches: false }); w.Element.prototype.scrollIntoView = function () {}; w.addEventListener('unhandledrejection', e => console.log('   rejected:', String(e.reason && e.reason.stack || e.reason).slice(0, 300)));
      w.VV_CONFIG = { googleWebClientId: 'x.apps.googleusercontent.com' };
      if (native) w.VVP = { native: true,
        SecureStorage: { get: async k => secure[k] || null, set: async (k, v) => { secure[k] = v; } },
        LocalNotifications: { getPending: async () => ({ notifications: [] }), cancel: async () => {}, schedule: async () => {}, checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' }) },
        BiometricAuth: { checkBiometry: async () => ({ isAvailable: true, deviceIsSecure: true }), authenticate: async () => {} },
        SocialLogin: { initialize: async () => {}, login: async () => ({}) } };
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

  await t('password field has a show/hide button that works', async () => {
    w.eval("st.user=null;st.mode='signin';draw()"); const pw = w.document.getElementById('pw');
    ok(pw.type === 'password' && w.document.getElementById('pwt'), 'button present'); w.eval("togglePw('pw','pwt')"); ok(w.document.getElementById('pw').type === 'text'); ok(w.document.getElementById('pwt').textContent === 'Hide');
    w.eval("togglePw('pw','pwt')"); ok(w.document.getElementById('pw').type === 'password');
  });
  await t('forgot password: phone lock check, then a new password works and the old one does not', async () => {
    w.document.getElementById('em').value = 'a@b.com'; await w.eval('forgot()');
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
