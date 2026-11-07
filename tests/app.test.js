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
      w.matchMedia = () => ({ matches: false }); w.addEventListener('unhandledrejection', e => console.log('   rejected:', String(e.reason && e.reason.stack || e.reason).slice(0, 300)));
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

  console.log('Web mode (browser)');
  const d2 = load(false), w2 = d2.window;
  await t('web build has no fake Google login and no testing tools', async () => {
    await wait(() => w2.document.getElementById('app').innerHTML.length > 100);
    const h = w2.document.getElementById('app').innerHTML;
    ok(/available in the Android app/.test(h)); ok(!/demo\.user@gmail/.test(h)); ok(w2.eval('TESTING') === false);
  });
  console.log('\n' + passed + ' checks passed' + (process.exitCode ? ', with failures' : ''));
  process.exit(process.exitCode || 0);
})();
