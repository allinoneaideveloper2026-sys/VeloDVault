// Builds the public website into ./site (landing page + policy pages + security files).
// The web version of the app is NOT included unless you ask for it: node scripts/build-site.js --with-app
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'site');
const withApp = process.argv.includes('--with-app');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, '.well-known'), { recursive: true });
const cp = (from, to) => fs.cpSync(path.join(root, from), path.join(out, to), { recursive: true });
cp('site-src/index.html', 'index.html'); cp('site-src/robots.txt', 'robots.txt'); cp('site-src/_headers', '_headers');
['privacy.html', 'terms.html', 'delete-account.html', 'grievance.html', 'security.html'].forEach(f => cp('www/' + f, f));
cp('www/.well-known/security.txt', '.well-known/security.txt');
cp('www/icons', 'icons');
// Optional: set SITE_URL (for example https://velodvault.pages.dev) in Cloudflare to add a Policy line to security.txt.
if (process.env.SITE_URL) fs.appendFileSync(path.join(out, '.well-known/security.txt'), 'Policy: ' + process.env.SITE_URL.replace(/\/$/, '') + '/security.html\n');
if (withApp) { fs.cpSync(path.join(root, 'www'), path.join(out, 'app'), { recursive: true }); console.log('Included the web version at /app/ (unlisted, not indexed).'); }
console.log('Site built in ./site' + (withApp ? ' with the web app' : ' (app not included)'));
