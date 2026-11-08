// Checks the website build: pages exist, links work, no placeholders, web app only when asked. Run: node tests/site.test.js
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const root = path.join(__dirname, '..'), site = path.join(root, 'site');
let passed = 0, failed = 0;
const t = (n, f) => { try { f(); passed++; console.log('  ok  ' + n); } catch (e) { failed++; console.log('FAIL  ' + n + '\n      ' + e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const run = a => execSync('node scripts/build-site.js ' + a, { cwd: root, stdio: 'pipe' });
const html = f => fs.readFileSync(path.join(site, f), 'utf8');

run('');
t('site has the landing page and every policy page', () => ['index.html', 'privacy.html', 'terms.html', 'delete-account.html', 'grievance.html', 'security.html', '.well-known/security.txt', 'robots.txt', '_headers'].forEach(f => ok(fs.existsSync(path.join(site, f)), 'missing ' + f)));
t('web app is not published by default', () => { ok(!fs.existsSync(path.join(site, 'app')), 'app folder present'); ok(!/href="[^"]*app\//.test(html('index.html')), 'landing links to the app'); });
t('every local link on the landing page points to a real file', () => {
  const links = [...html('index.html').matchAll(/href="([^"#:]+)"/g)].map(m => m[1]);
  ok(links.length >= 5); links.forEach(l => ok(fs.existsSync(path.join(site, l)), 'broken link ' + l));
});
t('no placeholders left in public pages', () => { for (const f of ['index.html', 'privacy.html', 'terms.html', 'delete-account.html', 'grievance.html', 'security.html', '.well-known/security.txt']) { const txt = html(f).replace(/<!--[\s\S]*?-->/g, ''); const m = txt.match(/\[[A-Z][A-Z \/\-]+\]/); ok(!m, f + ' still has ' + (m && m[0])); } });
t('owner and support email are shown', () => { const h = html('index.html'); ok(h.includes('allinoneaideveloper2026@gmail.com') && h.includes('allinoneaideveloper2026')); });
t('search engines are told to skip /app/', () => { ok(/\/app\/\*\s+X-Robots-Tag: noindex/.test(html('_headers'))); ok(/Disallow: \/app\//.test(html('robots.txt'))); });
t('page has language, title and a skip link (accessibility)', () => { const h = html('index.html'); ok(/<html lang="en"/.test(h) && /<title>/.test(h) && /class="skip"/.test(h)); });
t('claims on the landing page stay within what is true today', () => { const h = html('index.html').toLowerCase(); ['100% private', 'unhackable', 'no cloud', 'government approved', 'real time'].forEach(w => ok(!h.includes(w), 'avoid: ' + w)); });
run('--with-app');
t('with the switch on, the web app is included under /app/', () => { ok(fs.existsSync(path.join(site, 'app/index.html')) && fs.existsSync(path.join(site, 'app/sw.js'))); });
run('');
console.log('\n' + passed + ' checks passed' + (failed ? ', ' + failed + ' failed' : ''));
process.exit(failed ? 1 : 0);
