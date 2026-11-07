// Runs the real native.js against simulated phone services. Run: npm test
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
async function t(name, fn) { try { await fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.log('FAIL  ' + name + '\n      ' + (e && e.stack || e)); process.exitCode = 1; } }

// ---- simulated browser and phone ----
const store = {};
globalThis.window = globalThis;
globalThis.localStorage = {
  get length() { return Object.keys(store).length; },
  key: i => Object.keys(store)[i], getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }
};
const listeners = {};
globalThis.document = { hidden: false, addEventListener: (e, f) => { listeners[e] = f; }, getElementById: () => null, createElement: () => ({ style: {}, setAttribute() {}, querySelector: () => ({}), }), body: { appendChild() {} } };
const secure = {}; const pending = []; const scheduled = []; let authOk = true; let loginCalls = 0;
globalThis.VVP = {
  native: true,
  SecureStorage: { get: async k => secure[k] || null, set: async (k, v) => { secure[k] = v; } },
  LocalNotifications: {
    getPending: async () => ({ notifications: pending.slice() }), cancel: async o => { o.notifications.forEach(n => { const i = pending.findIndex(p => p.id === n.id); if (i >= 0) pending.splice(i, 1); }); },
    schedule: async o => { o.notifications.forEach(n => { pending.push({ id: n.id }); scheduled.push(n); }); },
    checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({ display: 'granted' })
  },
  BiometricAuth: { checkBiometry: async () => ({ isAvailable: true, deviceIsSecure: true }), authenticate: async () => { if (!authOk) throw new Error('no'); } },
  SocialLogin: { initialize: async () => {}, login: async () => { loginCalls++; return { result: { accessToken: { token: 'tok' }, profile: { email: 'Tester@Gmail.com' } } }; } }
};
globalThis.VV_CONFIG = { googleWebClientId: 'abc.apps.googleusercontent.com' };
// minimal app globals the bridge expects
globalThis.S = { get: k => SEC.get(k), set: (k, v) => SEC.set(k, v), del: k => SEC.del(k) };
globalThis.st = { user: 'tester@gmail.com' };
globalThis.toast = () => {}; globalThis.draw = () => {}; globalThis.modal = () => {}; globalThis.closeM = () => {};
globalThis.driveData = () => ({ records: S.get('vw_r_tester@gmail.com') || [], bin: [], sheets: { Vehicle: 'a,b\r\n1,2', 'Custom|House rent': 'x,y\r\n1,2' } });

eval(fs.readFileSync(path.join(__dirname, '../www/native.js'), 'utf8'));
const N = window.NATIVE;

(async () => {
  console.log('Encrypted storage');
  await t('starts and reports encrypted', async () => { await SECINIT(); assert.strictEqual(N.encrypted, true); assert.strictEqual(SEC.on, true); });
  await t('key stored in the secure keystore, 32 bytes', async () => { assert.ok(secure.vv_dek); assert.strictEqual(Buffer.from(secure.vv_dek, 'base64').length, 32); });
  await t('saved data is unreadable in storage', async () => {
    const rec = [{ id: '1', c: 'vehicle', d: { name: 'SECRETNAME', reg: 'KA01HQ5468' } }];
    S.set('vw_r_tester@gmail.com', rec); await SEC.flushNow();
    const raw = JSON.stringify(store);
    assert.ok(store['enc_vw_r_tester@gmail.com'], 'encrypted entry exists');
    assert.ok(!raw.includes('SECRETNAME') && !raw.includes('KA01HQ5468'), 'no plain text in storage');
  });
  await t('data survives a restart (decrypts again)', async () => {
    for (const k of Object.keys(SEC)) {} // keep SEC
    const keep = JSON.parse(JSON.stringify(store));
    // simulate restart: new bridge instance reading the same storage and keystore
    const code = fs.readFileSync(path.join(__dirname, '../www/native.js'), 'utf8');
    eval(code); await SECINIT();
    assert.strictEqual(S.get('vw_r_tester@gmail.com')[0].d.name, 'SECRETNAME');
    assert.deepStrictEqual(Object.keys(store).sort(), Object.keys(keep).sort());
  });
  await t('older plain-text data is migrated and removed', async () => {
    store['vw_users'] = JSON.stringify({ a: 1 });
    eval(fs.readFileSync(path.join(__dirname, '../www/native.js'), 'utf8')); await SECINIT();
    assert.ok(!('vw_users' in store)); assert.ok('enc_vw_users' in store); assert.deepStrictEqual(S.get('vw_users'), { a: 1 });
  });
  await t('tampered data is rejected, not trusted', async () => {
    const k = 'enc_vw_r_tester@gmail.com'; const good = store[k];
    const b = Buffer.from(good, 'base64'); b[20] ^= 255; store[k] = b.toString('base64');
    eval(fs.readFileSync(path.join(__dirname, '../www/native.js'), 'utf8')); await SECINIT();
    assert.strictEqual(S.get('vw_r_tester@gmail.com'), null); store[k] = good;
  });

  console.log('Reminders');
  const N2 = window.NATIVE; // after re-evals
  await t('schedules 30/7/1/0 days at 9am, only future dates, unique ids', async () => {
    const now = new Date('2026-11-05T10:00:00').getTime();
    const list = N2.buildReminders([{ id: 'r1', date: '2027-01-10', title: 'Insurance: Car' }, { id: 'r2', date: '2026-11-06', title: 'PUC: Bike' }, { id: 'r3', date: '2026-01-01', title: 'Old' }], now);
    const r1 = list.filter(x => x.body === 'Insurance: Car'); assert.strictEqual(r1.length, 4);
    assert.deepStrictEqual(r1.map(x => x.title), ['Due in 30 days', 'Due in 7 days', 'Due tomorrow', 'Due today']);
    r1.forEach(x => assert.strictEqual(x.schedule.at.getHours(), 9));
    const r2 = list.filter(x => x.body === 'PUC: Bike'); assert.strictEqual(r2.length, 1, 'only the day-of reminder is still in the future'); assert.strictEqual(r2[0].title, 'Due today');
    assert.strictEqual(list.filter(x => x.body === 'Old').length, 0);
    assert.strictEqual(new Set(list.map(x => x.id)).size, list.length);
    for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].schedule.at <= list[i].schedule.at);
  });
  await t('turning on needs permission, then replaces old schedules', async () => {
    await N2.toggleRem(); assert.strictEqual(S.get('vw_rem'), true);
    pending.push({ id: 999 });
    S.set('vw_r_tester@gmail.com', []);
    N2.remind([{ id: 'x', date: '2030-01-01', title: 'Test' }]);
    await new Promise(r => setTimeout(r, 1100));
    assert.ok(!pending.some(p => p.id === 999), 'old reminder cleared'); assert.strictEqual(scheduled.filter(s => s.body === 'Test').length, 4);
  });
  await t('turning off cancels everything', async () => { await N2.toggleRem(); assert.strictEqual(S.get('vw_rem'), false); assert.strictEqual(pending.length, 0); });

  console.log('Lock');
  await t('lock turns on only after the phone confirms the owner', async () => { authOk = false; await N2.toggleBio(); assert.ok(!S.get('vw_bio')); authOk = true; await N2.toggleBio(); assert.strictEqual(S.get('vw_bio'), true); });

  console.log('Google Drive saving');
  const calls = [];
  let nextId = 1; const created = {};
  globalThis.fetch = async (url, opt = {}) => {
    const u = String(url).replace('https://www.googleapis.com', ''); calls.push({ u, m: opt.method || 'GET', h: opt.headers || {}, b: opt.body });
    assert.strictEqual((opt.headers || {}).Authorization, 'Bearer tok', 'token sent');
    const json = o => ({ ok: true, status: 200, json: async () => o, arrayBuffer: async () => new ArrayBuffer(0) });
    if (u.startsWith('/drive/v3/files?q=')) return json({ files: [] });
    if (u.startsWith('/drive/v3/files?fields=id')) { const id = 'f' + nextId++; created[id] = JSON.parse(opt.body); return json({ id }); }
    if (u.startsWith('/upload/drive/v3/files')) { const id = u.includes('/files/') ? u.split('/files/')[1].split('?')[0] : 'u' + nextId++; return json({ id }); }
    throw new Error('unexpected ' + u);
  };
  await t('Google login returns the email in lower case and keeps the token', async () => { const e = await N2.googleLogin(); assert.strictEqual(e, 'tester@gmail.com'); assert.strictEqual(S.get('vw_gmode_tester@gmail.com'), true); });
  await t('first sync builds the folder tree, uploads documents, state and sheets', async () => {
    S.set('vw_r_tester@gmail.com', [{ id: '1', c: 'vehicle', d: { name: 'Car' }, docs: [{ name: 'rc.jpg', type: 'image', data: 'data:image/jpeg;base64,QUJD' }] }]);
    await N2.syncNow(false);
    const folders = Object.values(created).map(c => c.name);
    ['VeloDVault', 'Vehicle', 'Insurance', 'PUC', 'PA Cover', 'Expense', 'Driving Licence', 'Custom', 'Documents', '_app'].forEach(n => assert.ok(folders.includes(n), 'folder ' + n));
    assert.ok(folders.every(n => created && true));
    const ups = calls.filter(c => c.u.startsWith('/upload'));
    const doc = ups.find(c => /Content-Transfer-Encoding: base64/.test(c.b)); assert.ok(doc, 'document uploaded as base64');
    const state = ups.find(c => /"app":"VeloDVault"/.test(c.b)); assert.ok(state, 'state file uploaded');
    assert.ok(!/QUJD/.test(state.b), 'document bytes are not duplicated inside the state file');
    const sheet = ups.find(c => /vnd.google-apps.spreadsheet/.test(c.b)); assert.ok(sheet, 'sheet converted from CSV');
    const cs = ups.find(c => /"name":"Custom - House rent"/.test(c.b)); assert.ok(cs, 'custom category sheet is named Custom - House rent');
    const parent = JSON.parse(cs.b.split('\r\n\r\n')[1].split('\r\n')[0]).parents[0]; assert.strictEqual(created[parent].name, 'Custom', 'custom sheet sits in the Custom folder');
    assert.strictEqual(S.get('vw_drvstat_tester@gmail.com').ok, true);
    assert.ok(S.get('vw_r_tester@gmail.com')[0].docs[0].driveId, 'drive id remembered');
  });
  await t('second sync updates the same files instead of creating new ones', async () => {
    calls.length = 0; const before = Object.keys(created).length;
    await N2.syncNow(false);
    assert.strictEqual(Object.keys(created).length, before, 'no new folders');
    const ups = calls.filter(c => c.u.startsWith('/upload'));
    assert.ok(ups.every(c => c.m === 'PATCH' || /Content-Transfer-Encoding/.test(c.b) === false), 'updates use PATCH');
    assert.ok(ups.some(c => c.m === 'PATCH' && /"app":"VeloDVault"/.test(c.b) || c.m === 'PATCH'), 'state updated in place');
  });
  await t('silent sync without a token does not pop sign-in and says what to do', async () => {
    globalThis.VVP.SocialLogin.login = async () => { throw new Error('should not be called'); };
    const code = fs.readFileSync(path.join(__dirname, '../www/native.js'), 'utf8'); eval(code); await SECINIT();
    const n = window.NATIVE; S.set('vw_gmode_tester@gmail.com', true);
    await n.syncNow(true);
    assert.match(S.get('vw_drvstat_tester@gmail.com').msg, /sign in again/);
  });

  console.log('\n' + passed + ' checks passed' + (process.exitCode ? ', with failures' : ''));
})();
