// VV-VERSION 1.10
// Prints a Markdown "Setup check" table for the GitHub run summary. Never fails the build.
// Usage: node scripts/check-config.js [--offline] [--root <folder>]
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const root = argv.includes('--root') ? path.resolve(argv[argv.indexOf('--root') + 1]) : path.join(__dirname, '..');
const offline = argv.includes('--offline');
const read = f => { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch (e) { return ''; } };
const cfg = (f, name) => { const w = {}; try { new Function('window', read(f))(w); } catch (e) { /* damaged file */ } return w[name] || {}; };

function classifyFirebase(status, message) {
  const m = String(message || '');
  if (/EMAIL_NOT_FOUND|INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|INVALID_EMAIL/.test(m)) return ['ok', 'Firebase answers, the key is valid and Email/Password sign-in is switched on', ''];
  if (/OPERATION_NOT_ALLOWED|PASSWORD_LOGIN_DISABLED/.test(m)) return ['bad', 'Email/Password sign-in is NOT switched on', 'Firebase > Authentication > Sign-in method > Email/Password > Enable'];
  if (/API key not valid|API_KEY_INVALID|INVALID_KEY/i.test(m)) return ['bad', 'The Firebase apiKey is not valid', 'Firebase > Project settings > Your apps > Web app: copy the config again into www/firebase-config.js'];
  if (/CONFIGURATION_NOT_FOUND/.test(m)) return ['bad', 'Authentication is not started', 'Firebase > Authentication > Get started'];
  if (status === 403) return ['bad', 'The key is blocked or restricted (403)', 'Google Cloud > Credentials > Browser key: remove the HTTP-referrer restriction'];
  return ['warn', 'Unexpected answer (' + status + '): ' + m.slice(0, 100), 'Run the build again; if it persists, send this line to support'];
}

function checkFirebaseValues(c) {
  const placeholder = x => !x || String(x).indexOf('YOUR_') > -1;
  if (placeholder(c.apiKey) || placeholder(c.projectId) || placeholder(c.appId) || placeholder(c.authDomain)) return ['bad', 'Firebase values are still placeholders (the app runs in test mode)', 'Paste the four Web app values into www/firebase-config.js'];
  const problems = [];
  if (!/^AIza[0-9A-Za-z_-]{30,}$/.test(c.apiKey)) problems.push('apiKey does not look like a Firebase web key');
  if (!/(\.firebaseapp\.com|\.web\.app)$/.test(c.authDomain)) problems.push('authDomain should end with .firebaseapp.com');
  if (!/^1:\d+:web:[0-9a-f]+$/.test(c.appId)) problems.push('appId should look like 1:123...:web:abc... (use the WEB app)');
  if (problems.length) return ['bad', problems.join('; '), 'Copy the values again from Firebase > Project settings > Your apps > Web app'];
  return ['ok', 'Firebase values present for project ' + c.projectId, ''];
}

function checkGoogleId(c) {
  const id = c.googleWebClientId || '';
  if (!id || id.indexOf('YOUR_') === 0) return ['bad', 'Google Web client ID is still a placeholder', 'Paste the Web application client ID into www/config.js'];
  if (!/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(id)) return ['bad', 'The ID in config.js does not look like a Google client ID', 'It looks like 123456789012-abcdef.apps.googleusercontent.com'];
  return ['ok', 'Google Web client ID present (' + id.slice(0, 8) + '…' + id.slice(-24) + ')', 'It must be the Web application client, not the Android one'];
}

async function main() {
  const rows = [];
  const add = (name, r) => rows.push([name].concat(r));
  const html = read('www/index.html'), ver = (html.match(/APPVER='([0-9.]+)'/) || [])[1] || 'unknown';
  add('App version', ['ok', 'Version ' + ver, 'The version shown in About must match this after you install the new APK']);
  let appId = '';
  try { appId = JSON.parse(read('capacitor.config.json')).appId; } catch (e) { /* ignore */ }
  add('Package name', /yourname/.test(appId) || !appId ? ['bad', 'Package name is the placeholder: ' + (appId || 'missing'), 'Run scripts/set-app-id.py with your own id'] : ['ok', appId, 'The Google Android client must use exactly this package name and the SHA1 printed under Signing fingerprints']);
  const fb = cfg('www/firebase-config.js', 'VV_FIREBASE'), fbv = checkFirebaseValues(fb);
  add('Firebase values', fbv);
  if (fbv[0] === 'ok' && !offline) {
    try {
      const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(fb.apiKey), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'setup-check@example.invalid', password: 'not-a-real-password', returnSecureToken: true }) });
      const j = await r.json().catch(() => ({}));
      add('Firebase live test', classifyFirebase(r.status, (j.error && j.error.message) || ''));
    } catch (e) { add('Firebase live test', ['warn', 'Could not reach Firebase from the build machine: ' + String(e.message).slice(0, 80), 'Try again']); }
  } else add('Firebase live test', ['warn', 'Skipped', fbv[0] === 'ok' ? '(offline mode)' : 'Fix the Firebase values first']);
  add('Google Web client ID', checkGoogleId(cfg('www/config.js', 'VV_CONFIG')));
  const flags = [];
  if (/const TESTING=true/.test(html)) flags.push('TESTING is on (sample-data tools visible)');
  if (/const DIAG=true/.test(html)) flags.push('DIAG is on (developer tools visible to everyone)');
  add('Release flags', flags.length ? ['bad', flags.join('; '), 'Turn them off before the public release'] : ['ok', 'Test tools are off for ordinary users', 'Developer tools can be switched on by tapping the version text in About 7 times']);
  const icon = { ok: '✅', bad: '❌', warn: '⚠️' };
  const out = ['### Setup check', '', '| Check | Result | What to do |', '|---|---|---|'].concat(rows.map(r => '| ' + r[0] + ' | ' + icon[r[1]] + ' ' + r[2] + ' | ' + (r[3] || '') + ' |'));
  const bad = rows.filter(r => r[1] === 'bad').length;
  out.push('', bad ? '**' + bad + ' item(s) need attention before sign-in will fully work.**' : '**All configuration checks passed.** Install the APK and test Google sign-in on a phone.', '', 'Signing fingerprints (package name + SHA1 for the Google Android client) are listed in the next section of this summary.');
  console.log(out.join('\n'));
}
module.exports = { classifyFirebase, checkFirebaseValues, checkGoogleId };
if (require.main === module) main().catch(e => console.log('### Setup check\n\nThe check script itself failed: ' + e.message));
