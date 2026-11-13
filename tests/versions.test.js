// VV-VERSION 1.9
// Confirms the repository holds files from one release. A web upload can leave some files from an older update.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const appId = JSON.parse(read('capacitor.config.json')).appId;
const expected = (read('www/index.html').match(/APPVER='([0-9.]+)'/) || [])[1];
const files = ['www/native.js', 'www/fbauth.js', 'src/plugins.js', 'tests/app.test.js', 'tests/native.test.js', 'android/app/src/main/java/' + appId.split('.').join('/') + '/MainActivity.java'];
if (!expected) { console.log('FAIL  www/index.html has no version (APPVER). It is damaged or from a very old update.'); process.exit(1); }
const rows = files.map(f => ({ f, v: (read(f).match(/VV-VERSION ([0-9.]+)/) || [])[1] || 'none' }));
const old = rows.filter(r => r.v !== expected);
if (old.length) {
  console.log('FAIL  these files are from a different update than www/index.html (version ' + expected + '):');
  old.forEach(r => console.log('      - ' + r.f + '  (has ' + r.v + ', needs ' + expected + ')'));
  console.log('\nUpload them from the latest project zip, keeping the same folder, then run the build again.');
  process.exit(1);
}
console.log('  ok  all key files are from the same update (version ' + expected + ')');
