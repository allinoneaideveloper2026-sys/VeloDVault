/* VeloDVault native features. Active only inside the Android app; on the web it does nothing. */
(function () {
  var P = window.VVP;
  var isNative = !!(P && P.native);
  window.NATIVE = isNative ? {} : null;
  if (!isNative) return;

  var N = window.NATIVE, SS = P.SecureStorage, LN = P.LocalNotifications, BA = P.BiometricAuth, SL = P.SocialLogin;
  var te = new TextEncoder(), td = new TextDecoder();
  function b64(u) { var s = '', i; for (i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
  function unb(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  function say(m) { if (typeof toast === 'function') toast(m); }
  function redraw() { if (typeof draw === 'function') draw(); }

  /* ---------- 1. Encrypted storage (AES-256-GCM, key kept in the Android Keystore) ---------- */
  var KEY = null, mem = {}, dirty = {}, flushT = null;
  async function enc(txt) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, KEY, te.encode(txt)));
    var o = new Uint8Array(12 + ct.length); o.set(iv); o.set(ct, 12); return b64(o);
  }
  async function dec(s) {
    var o = unb(s);
    return td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: o.slice(0, 12) }, KEY, o.slice(12)));
  }
  async function flush() {
    var ks = Object.keys(dirty); dirty = {};
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i];
      if (k in mem) { try { localStorage.setItem('enc_' + k, await enc(JSON.stringify(mem[k]))); } catch (e) { N.storageFull = true; say('Storage is full. Delete old documents or sync to Drive.'); } }
    }
  }
  window.SEC = {
    on: false,
    get: function (k) { return k in mem ? mem[k] : null; },
    set: function (k, v) { mem[k] = v; dirty[k] = 1; clearTimeout(flushT); flushT = setTimeout(flush, 250); },
    del: function (k) { delete mem[k]; delete dirty[k]; localStorage.removeItem('enc_' + k); },
    flushNow: flush
  };
  window.SECINIT = async function () {
    try {
      var kb = await SS.get('vv_dek');
      if (!kb) { kb = b64(crypto.getRandomValues(new Uint8Array(32))); await SS.set('vv_dek', kb); }
      KEY = await crypto.subtle.importKey('raw', unb(kb), 'AES-GCM', false, ['encrypt', 'decrypt']);
      var keys = [], i;
      for (i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      for (i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k.indexOf('enc_') === 0) { try { mem[k.slice(4)] = JSON.parse(await dec(localStorage.getItem(k))); } catch (e) { /* skip unreadable */ } }
      }
      keys.forEach(function (k) { // move any older plain-text data into the encrypted store
        if (k.indexOf('vw_') === 0) {
          try { if (!(k in mem)) { mem[k] = JSON.parse(localStorage.getItem(k)); dirty[k] = 1; } } catch (e) {}
          localStorage.removeItem(k);
        }
      });
      await flush();
      window.SEC.on = true; N.encrypted = true;
    } catch (e) { N.encrypted = false; console.warn('Secure storage unavailable', e); }
  };

  /* ---------- 2. Fingerprint / face / screen-lock ---------- */
  var locked = false, hiddenAt = 0;
  function overlay() {
    var o = document.getElementById('lockov'); if (o) return o;
    o = document.createElement('div'); o.id = 'lockov'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
    o.style.cssText = 'position:fixed;inset:0;z-index:99;background:#0B0F2A;color:#fff;display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:system-ui,sans-serif;text-align:center;padding:24px';
    o.innerHTML = (typeof logo === 'function' ? logo(64) : '') + '<h2 style="margin:0">VeloDVault is locked</h2><p style="color:#C3C8E6;margin:0">Use your fingerprint, face or screen lock to open.</p><button id="unl" style="padding:14px 28px;border:0;border-radius:14px;background:#5B4BF0;color:#fff;font-size:16px;font-weight:700">Unlock</button><p id="lockerr" style="color:#F87171;margin:0" role="status"></p>';
    document.body.appendChild(o); o.querySelector('#unl').onclick = unlock; return o;
  }
  async function unlock() {
    var o = overlay();
    try {
      await BA.authenticate({ reason: 'Unlock VeloDVault', cancelTitle: 'Cancel', allowDeviceCredential: true, androidTitle: 'Unlock VeloDVault', androidSubtitle: 'Confirm it is you' });
      o.style.display = 'none'; locked = false; o.querySelector('#lockerr').textContent = '';
    } catch (e) { o.querySelector('#lockerr').textContent = 'Not unlocked. Tap Unlock to try again.'; }
  }
  function lock() { if (typeof S === 'undefined' || !S.get('vw_bio')) return; overlay().style.display = 'flex'; locked = true; unlock(); }
  N.bootLock = lock;
  N.verifyOwner = function () { return BA.authenticate({ reason: 'Confirm it is you to reset your password', allowDeviceCredential: true, androidTitle: 'Reset password', androidSubtitle: 'Confirm it is you' }); };
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hiddenAt = Date.now(); if (window.SEC && SEC.on) SEC.flushNow(); }
    else if (typeof S !== 'undefined' && S.get('vw_bio') && !locked && Date.now() - hiddenAt > 30000) lock();
  });
  N.toggleBio = async function () {
    if (S.get('vw_bio')) { S.set('vw_bio', false); say('Lock turned off'); redraw(); return; }
    try {
      var c = await BA.checkBiometry();
      if (!c.isAvailable && !c.deviceIsSecure) { say('Set up a fingerprint or screen lock in Android settings first'); return; }
      await BA.authenticate({ reason: 'Turn on the lock', allowDeviceCredential: true, androidTitle: 'Turn on the lock' });
      S.set('vw_bio', true); say('Lock turned on'); redraw();
    } catch (e) { say('Lock was not turned on'); }
  };

  /* ---------- 3. Reminders (local notifications, no server) ---------- */
  var OFFSETS = [30, 7, 1, 0], remT = null;
  function hash(s) { var h = 2166136261, i; for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 1) || 1; }
  N.buildReminders = function (items, now) {
    var list = [], used = {};
    (items || []).forEach(function (it) {
      OFFSETS.forEach(function (off) {
        var d = new Date(it.date + 'T09:00:00'); d.setDate(d.getDate() - off);
        if (isNaN(d.getTime()) || d.getTime() <= now + 60000) return;
        var id = hash(it.id + '|' + it.date + '|' + off); while (used[id]) id++; used[id] = 1;
        list.push({ id: id, title: off === 0 ? 'Due today' : off === 1 ? 'Due tomorrow' : 'Due in ' + off + ' days', body: it.title, schedule: { at: d, allowWhileIdle: true }, smallIcon: 'ic_stat_name' });
      });
    });
    list.sort(function (a, b) { return a.schedule.at - b.schedule.at; });
    return list.slice(0, 200);
  };
  async function cancelAll() { var p = await LN.getPending(); if (p.notifications && p.notifications.length) await LN.cancel({ notifications: p.notifications }); }
  async function doRemind(items) {
    if (S.get('vw_rem') !== true) return;
    try { await cancelAll(); var l = N.buildReminders(items, Date.now()); if (l.length) await LN.schedule({ notifications: l }); } catch (e) { console.warn('reminders', e); }
  }
  N.remind = function (items) { clearTimeout(remT); remT = setTimeout(function () { doRemind(items); }, 800); };
  N.toggleRem = async function () {
    if (S.get('vw_rem') === true) { S.set('vw_rem', false); try { await cancelAll(); } catch (e) {} say('Reminders turned off'); redraw(); return; }
    try {
      var s = await LN.checkPermissions(); if (s.display !== 'granted') s = await LN.requestPermissions();
      if (s.display !== 'granted') { say('Allow notifications for VeloDVault in Android settings'); return; }
      S.set('vw_rem', true); say('Reminders turned on'); if (typeof remindNow === 'function') remindNow(); redraw();
    } catch (e) { say('Could not turn on reminders'); }
  };
  N.testRem = async function () {
    try {
      var s = await LN.checkPermissions(); if (s.display !== 'granted') s = await LN.requestPermissions();
      if (s.display !== 'granted') { say('Allow notifications first'); return; }
      await LN.schedule({ notifications: [{ id: 1, title: 'VeloDVault test', body: 'Reminders work on this phone.', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }, smallIcon: 'ic_stat_name' }] });
      say('Test reminder arrives in 5 seconds');
    } catch (e) { say('Test failed'); }
  };

  /* ---------- 4. Google sign-in and Drive saving (drive.file: only files this app creates) ---------- */
  var GA = 'https://www.googleapis.com', TOKEN = null, TEXP = 0, ginit = false, syncT = null, busy = false;
  var FOLDERS = ['Vehicle', 'Insurance', 'PUC', 'PA Cover', 'Expense', 'Driving Licence', 'Custom', 'Documents', '_app'];
  function cfgOk() { var c = window.VV_CONFIG; return !!(c && c.googleWebClientId && c.googleWebClientId.indexOf('YOUR_') !== 0); }
  async function initG() {
    if (!cfgOk()) throw new Error('SETUP');
    if (!ginit) { await SL.initialize({ google: { webClientId: window.VV_CONFIG.googleWebClientId } }); ginit = true; }
  }
  async function loginG() {
    await initG();
    var r = await SL.login({ provider: 'google', options: { scopes: ['https://www.googleapis.com/auth/drive.file'] } });
    var res = r.result || {};
    TOKEN = res.accessToken && res.accessToken.token; TEXP = Date.now() + 50 * 60000;
    var email = ((res.profile && res.profile.email) || '').toLowerCase();
    if (!email || !TOKEN) throw new Error('NOTOKEN');
    return email;
  }
  // Proves the person controls the Google account with this email (used before a password reset). No Drive access is requested.
  N.verifyEmail = async function (email) {
    await initG();
    var r = await SL.login({ provider: 'google', options: {} });
    var got = ((r && r.result && r.result.profile && r.result.profile.email) || '').toLowerCase();
    if (!got) throw new Error('NOTOKEN');
    if (got !== String(email).toLowerCase()) { var e = new Error('MISMATCH'); e.got = got; throw e; }
    return true;
  };
  N.googleLogin = async function () { var e = await loginG(); S.set('vw_gmode_' + e, true); return e; };
  async function gfetch(path, opt) {
    opt = opt || {};
    if (!TOKEN || Date.now() > TEXP) throw new Error('AUTH');
    var h = Object.assign({ Authorization: 'Bearer ' + TOKEN }, opt.headers || {});
    var r = await fetch(GA + path, Object.assign({}, opt, { headers: h }));
    if (r.status === 401) { TOKEN = null; throw new Error('AUTH'); }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r;
  }
  function qe(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
  async function find(name, parent, mime) {
    var q = "name='" + qe(name) + "' and trashed=false" + (mime ? " and mimeType='" + mime + "'" : '') + (parent ? " and '" + parent + "' in parents" : '');
    var r = await (await gfetch('/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id)&pageSize=1')).json();
    return r.files && r.files[0] ? r.files[0].id : null;
  }
  async function mk(name, parent) {
    var FM = 'application/vnd.google-apps.folder';
    var id = await find(name, parent, FM); if (id) return id;
    var body = { name: name, mimeType: FM }; if (parent) body.parents = [parent];
    return (await (await gfetch('/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json()).id;
  }
  async function upl(name, parent, mime, content, existing, convertTo, isB64) {
    var meta = { name: name }; if (!existing) meta.parents = [parent]; if (convertTo) meta.mimeType = convertTo;
    var b = 'vvb' + Date.now() + Math.floor(Math.random() * 1e6);
    var body = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b + '\r\nContent-Type: ' + mime + '\r\n' + (isB64 ? 'Content-Transfer-Encoding: base64\r\n' : '') + '\r\n' + content + '\r\n--' + b + '--';
    var r = await gfetch('/upload/drive/v3/files' + (existing ? '/' + existing : '') + '?uploadType=multipart&fields=id', { method: existing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: body });
    return (await r.json()).id;
  }
  function setStat(u, ok, msg) { S.set('vw_drvstat_' + u, { at: new Date().toISOString().slice(0, 16).replace('T', ' '), ok: ok, msg: msg }); redraw(); }
  async function ensureTree(ids) {
    ids.root = ids.root || await mk('VeloDVault', null); ids.f = ids.f || {};
    for (var i = 0; i < FOLDERS.length; i++) ids.f[FOLDERS[i]] = ids.f[FOLDERS[i]] || await mk(FOLDERS[i], ids.root);
  }
  async function pushAll(user, data) {
    var key = 'vw_drvids_' + user, ids = S.get(key) || {};
    try { await ensureTree(ids); } catch (e) { if (String(e.message) === 'HTTP 404') { ids = {}; await ensureTree(ids); } else throw e; }
    var recs = data.records || [], i, j;
    for (i = 0; i < recs.length; i++) {
      var ds = recs[i].docs || [];
      for (j = 0; j < ds.length; j++) {
        var m = ds[j].data && !ds[j].driveId ? /^data:([^;]+);base64,(.*)$/.exec(ds[j].data) : null;
        if (m) ds[j].driveId = await upl(ds[j].name, ids.f.Documents, m[1], m[2], null, null, true);
      }
    }
    S.set('vw_r_' + user, recs);
    var savedAt = new Date().toISOString();
    var clean = recs.map(function (r) { return Object.assign({}, r, { docs: (r.docs || []).map(function (d) { return { name: d.name, type: d.type, driveId: d.driveId }; }) }); });
    ids.state = await upl('state.json', ids.f._app, 'application/json', JSON.stringify({ app: 'VeloDVault', v: 1, savedAt: savedAt, records: clean, bin: data.bin || [] }), ids.state);
    ids.sheets = ids.sheets || {};
    var names = Object.keys(data.sheets || {});
    for (i = 0; i < names.length; i++) {
      var parts = names[i].split('|'), title = parts[1] ? parts[0] + ' - ' + parts[1] : parts[0];
      ids.sheets[names[i]] = await upl(title, ids.f[parts[0]], 'text/csv', data.sheets[names[i]], ids.sheets[names[i]], 'application/vnd.google-apps.spreadsheet');
    }
    S.set(key, ids); S.set('vw_lastsync_' + user, savedAt);
    return savedAt;
  }
  N._push = pushAll;
  // For people who sign in with email: link a Google account just for Drive backup and restore.
  N.connectDrive = async function () {
    var u = typeof st !== 'undefined' && st.user; if (!u) return;
    try { await loginG(); S.set('vw_gmode_' + u, true); say('Google Drive connected'); await N.afterLogin(u); redraw(); }
    catch (e) { say(typeof gErr === 'function' ? gErr(e) : 'Could not connect Google Drive'); }
  };
  N.syncNow = async function (silent) {
    var u = typeof st !== 'undefined' && st.user; if (!u || !S.get('vw_gmode_' + u) || busy) return;
    busy = true;
    try {
      if (!TOKEN || Date.now() > TEXP) { if (silent) { setStat(u, false, 'Tap Sync now to sign in again'); return; } await loginG(); }
      var at = await pushAll(u, driveData());
      setStat(u, true, 'Saved to Drive'); if (!silent) say('Saved to your Drive'); return at;
    } catch (e) {
      var m = String(e.message);
      setStat(u, false, m === 'AUTH' ? 'Tap Sync now to sign in again' : m === 'SETUP' ? 'Google sign-in is not set up yet' : 'Could not reach Drive');
    } finally { busy = false; }
  };
  N.syncSoon = function () { var u = typeof st !== 'undefined' && st.user; if (!u || !S.get('vw_gmode_' + u)) return; clearTimeout(syncT); syncT = setTimeout(function () { N.syncNow(true); }, 4000); };
  N.checkRemote = async function (user) {
    var ids = S.get('vw_drvids_' + user) || {};
    if (!ids.state) {
      var root = await find('VeloDVault', null, 'application/vnd.google-apps.folder'); if (!root) return null;
      var app = await find('_app', root, 'application/vnd.google-apps.folder'); if (!app) return null;
      var st0 = await find('state.json', app); if (!st0) return null;
      ids.root = root; ids.state = st0; S.set('vw_drvids_' + user, ids);
    }
    return await (await gfetch('/drive/v3/files/' + ids.state + '?alt=media')).json();
  };
  async function fetchDoc(driveId, mime) {
    var r = await gfetch('/drive/v3/files/' + driveId + '?alt=media'), buf = new Uint8Array(await r.arrayBuffer());
    return 'data:' + mime + ';base64,' + b64(buf);
  }
  N.restoreFrom = async function (user, remote) {
    var recs = remote.records || [], i, j;
    for (i = 0; i < recs.length; i++) for (j = 0; j < (recs[i].docs || []).length; j++) {
      var d = recs[i].docs[j];
      if (d.driveId && !d.data) { try { d.data = await fetchDoc(d.driveId, d.type === 'pdf' ? 'application/pdf' : 'image/jpeg'); } catch (e) {} }
    }
    S.set('vw_r_' + user, recs); S.set('vw_bin_' + user, remote.bin || []); S.set('vw_lastsync_' + user, remote.savedAt || '');
  };
  N.afterLogin = async function (email) {
    try {
      var remote = await N.checkRemote(email), local = S.get('vw_r_' + email) || [];
      var rn = remote && remote.records ? remote.records.length : 0;
      if (rn && !local.length) { await N.restoreFrom(email, remote); say('Restored ' + rn + ' record(s) from your Drive'); redraw(); }
      else if (rn && local.length && (remote.savedAt || '') > (S.get('vw_lastsync_' + email) || '')) {
        N._pending = remote;
        modal('Backup found in your Drive', 'A newer backup from ' + String(remote.savedAt).slice(0, 16).replace('T', ' ') + ' has ' + rn + ' record(s). Restore it, or keep the records on this phone and overwrite Drive?',
          [{ l: 'Restore from Drive', a: 'NATIVE.pickRestore(true)' }, { l: 'Keep this phone', c: 'ghost', a: 'NATIVE.pickRestore(false)' }]);
      } else N.syncSoon();
    } catch (e) { setStat(email, false, 'Could not reach Drive'); }
  };
  N.pickRestore = async function (yes) {
    closeM(); var u = st.user;
    if (yes && N._pending) { await N.restoreFrom(u, N._pending); say('Restored from Drive'); redraw(); } else N.syncSoon();
    N._pending = null;
  };
})();
