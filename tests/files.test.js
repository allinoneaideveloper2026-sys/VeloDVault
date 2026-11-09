// Confirms every file the build needs is in the repository, and names any that are missing.
// Web uploads to GitHub can drop files (limits and hidden folders), so this runs first.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const appId = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8')).appId;
const need = [
  'package.json', 'package-lock.json', 'capacitor.config.json', 'README.md',
  'src/plugins.js',
  'www/index.html', 'www/native.js', 'www/vv-plugins.js', 'www/config.js', 'www/firebase-config.js', 'www/fbauth.js', 'www/sw.js', 'www/manifest.webmanifest', 'www/_headers',
  'www/privacy.html', 'www/terms.html', 'www/delete-account.html', 'www/grievance.html', 'www/security.html',
  'www/icons/icon-192.png', 'www/icons/icon-512.png', 'www/icons/maskable-512.png',
  'site-src/index.html', 'site-src/robots.txt', 'site-src/_headers', 'site-src/security.txt',
  'scripts/build-site.js', 'scripts/set-app-id.py',
  'tests/native.test.js', 'tests/site.test.js', 'tests/app.test.js',
  'android/gradlew', 'android/build.gradle', 'android/settings.gradle', 'android/variables.gradle', 'android/gradle/wrapper/gradle-wrapper.jar', 'android/gradle/wrapper/gradle-wrapper.properties',
  'android/app/build.gradle', 'android/app/src/main/AndroidManifest.xml',
  'android/app/src/main/java/' + appId.split('.').join('/') + '/MainActivity.java',
  '.github/workflows/android.yml'
];
const missing = need.filter(f => !fs.existsSync(path.join(root, f)));
if (missing.length) {
  console.log('FAIL  ' + missing.length + ' required file(s) are missing from the repository:\n' + missing.map(f => '      - ' + f).join('\n'));
  console.log('\nUpload them from the project zip (keep the same folder). GitHub web uploads accept about 100 files at a time, so upload big folders in parts.');
  process.exit(1);
}
console.log('  ok  all ' + need.length + ' required files are present');
