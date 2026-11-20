// VV-VERSION 1.10
// Tests the build-summary Setup check. Run: node tests/config-check.test.js
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const { classifyFirebase, checkFirebaseValues, checkGoogleId } = require('../scripts/check-config.js');
let passed = 0, failed = 0;
const t = (n, f) => { try { f(); passed++; console.log('  ok  ' + n); } catch (e) { failed++; console.log('FAIL  ' + n + '\n      ' + e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const run = root => execFileSync('node', [path.join(__dirname, '../scripts/check-config.js'), '--offline', '--root', root]).toString();
const mk = (fb, g) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-')); fs.mkdirSync(path.join(d, 'www')); fs.writeFileSync(path.join(d, 'www/firebase-config.js'), 'window.VV_FIREBASE=' + JSON.stringify(fb) + ';'); fs.writeFileSync(path.join(d, 'www/config.js'), 'window.VV_CONFIG=' + JSON.stringify(g) + ';'); fs.writeFileSync(path.join(d, 'www/index.html'), "const TESTING=false,x;const DIAG=false,APPVER='9.9'"); fs.writeFileSync(path.join(d, 'capacitor.config.json'), JSON.stringify({ appId: 'com.example.app' })); return d; };
const good = { apiKey: 'AIzaSyA1234567890abcdefghijklmnopqrstuvw', authDomain: 'demo.firebaseapp.com', projectId: 'demo', appId: '1:123456789:web:abcdef0123' };
const placeholder = { apiKey: 'YOUR_FIREBASE_API_KEY', authDomain: 'YOUR_PROJECT_ID.firebaseapp.com', projectId: 'YOUR_PROJECT_ID', appId: 'YOUR_FIREBASE_APP_ID' };

t('placeholders are reported, with what to do', () => { const o = run(mk(placeholder, { googleWebClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com' })); ok(/Firebase values.*placeholders/.test(o) && /Google Web client ID.*placeholder/.test(o) && /need attention/.test(o), o); });
t('good values pass', () => { const o = run(mk(good, { googleWebClientId: '123456789012-abcdef123.apps.googleusercontent.com' })); ok(/Firebase values present for project demo/.test(o) && /Google Web client ID present/.test(o), o); });
t('values copied from the wrong place are named', () => { ok(/WEB app/.test(checkFirebaseValues(Object.assign({}, good, { appId: '1:123456789:android:abc' }))[1])); ok(/apiKey does not look/.test(checkFirebaseValues(Object.assign({}, good, { apiKey: 'AAAA' }))[1])); ok(/authDomain/.test(checkFirebaseValues(Object.assign({}, good, { authDomain: 'demo.com' }))[1])); });
t('an Android-style or malformed Google ID is flagged', () => { ok(checkGoogleId({ googleWebClientId: 'not-an-id' })[0] === 'bad'); ok(checkGoogleId({ googleWebClientId: '123-abc.apps.googleusercontent.com' })[0] === 'ok'); });
t('Firebase answers are explained', () => {
  ok(classifyFirebase(400, 'INVALID_LOGIN_CREDENTIALS')[0] === 'ok'); ok(/NOT switched on/.test(classifyFirebase(400, 'OPERATION_NOT_ALLOWED')[1])); ok(/apiKey is not valid/.test(classifyFirebase(400, 'API key not valid. Please pass a valid API key.')[1]));
  ok(/not started/.test(classifyFirebase(400, 'CONFIGURATION_NOT_FOUND')[1])); ok(/blocked or restricted/.test(classifyFirebase(403, 'x')[1])); ok(classifyFirebase(500, 'boom')[0] === 'warn');
});
t('placeholder package name and left-on test tools are flagged', () => {
  const d = mk(good, { googleWebClientId: '123456789012-abc.apps.googleusercontent.com' }); fs.writeFileSync(path.join(d, 'capacitor.config.json'), JSON.stringify({ appId: 'com.yourname.velodvault' })); fs.writeFileSync(path.join(d, 'www/index.html'), "const TESTING=true,x;const DIAG=true,APPVER='9.9'");
  const o = run(d); ok(/Package name is the placeholder/.test(o) && /TESTING is on/.test(o) && /DIAG is on/.test(o), o);
});
t('the script never crashes on a damaged file', () => { const d = mk(good, {}); fs.writeFileSync(path.join(d, 'www/config.js'), 'this is not javascript {{{'); ok(/### Setup check/.test(run(d))); });
console.log('\n' + passed + ' checks passed' + (failed ? ', ' + failed + ' failed' : '')); process.exit(failed ? 1 : 0);
