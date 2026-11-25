// إنجاز — طبقة الربط مع Firebase للنسخة المستقلة.
// تحاكي واجهة claude.use(...) التي يستخدمها index.html، فيعمل البرنامج نفسه دون تعديل.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, sendPasswordResetEmail, setPersistence, browserLocalPersistence,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  collection, doc, setDoc, getDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy, limit, getDocs
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { FIREBASE_CONFIG, STORAGE_ENABLED, INLINE_MAX_BYTES } from './config.js';

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
let fs;
try { fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
catch (e) { fs = initializeFirestore(app, { localCache: memoryLocalCache() }); }
window.ENJAZ_INLINE_MAX = INLINE_MAX_BYTES;

/* ---------- الدخول برقم الجوال ----------
   حسابات المنسوبين تُنشأ ببريد داخلي مشتق من رقم الجوال (لا يستقبل رسائل).
   logins/{05xxxxxxxx} = { email } يحدد البريد الحالي للرقم (يتغير عند إصدار كلمة مرور جديدة). */
const LOGIN_DOMAIN = FIREBASE_CONFIG.authDomain;
const phoneEmail = (ph, k) => 'p' + ph + (k ? '.' + k : '') + '@' + LOGIN_DOMAIN;
const isPhoneEmail = e => /^p\d{10}(\.\d+)?@/.test(e || '') && String(e).endsWith('@' + LOGIN_DOMAIN);
function asPhone(t) {
  let d = String(t || '').replace(/[^\d٠-٩]/g, '').replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c));
  if (!d || /@/.test(t)) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('966')) d = '0' + d.slice(3);
  if (d.length === 9 && d.startsWith('5')) d = '0' + d;
  return /^05\d{8}$/.test(d) ? d : '';
}
async function resolveLogin(t) {
  const ph = asPhone(t);
  if (!ph) return { email: String(t || '').trim().toLowerCase(), phone: '' };
  try { const s = await getDoc(doc(fs, 'logins', ph)); if (s.exists() && s.data().email) return { email: s.data().email, phone: ph }; } catch (e) {}
  return { email: phoneEmail(ph), phone: ph };
}

/* ---------- محوّل قاعدة البيانات (نفس واجهة db في Claude) ---------- */
const errCode = e => ({ code: e && e.code === 'permission-denied' ? 'invalid_argument' : 'unavailable', message: (e && e.message) || '' });
const wrap = d => ({ id: d.id, exists: d.exists(), data: () => d.data(), metadata: d.metadata });
const wrapQ = s => ({ docs: s.docs.map(wrap), size: s.size, empty: s.empty, metadata: s.metadata });
function docApi(c, id) {
  const r = doc(fs, c, id);
  return {
    id, path: c + '/' + id,
    set: o => setDoc(r, o).catch(e => { throw errCode(e); }),
    update: o => updateDoc(r, o).catch(e => { throw errCode(e); }),
    delete: () => deleteDoc(r).catch(e => { throw errCode(e); }),
    get: async () => wrap(await getDoc(r)),
    onSnapshot: (next, err) => onSnapshot(r, d => next(wrap(d)), e => err && err(errCode(e)))
  };
}
function queryApi(c, cons) {
  return {
    orderBy: (f, d) => queryApi(c, cons.concat(orderBy(f, d || 'asc'))),
    limit: n => queryApi(c, cons.concat(limit(n))),
    get: async () => wrapQ(await getDocs(query(collection(fs, c), ...cons))),
    onSnapshot: (next, err) => onSnapshot(query(collection(fs, c), ...cons), s => next(wrapQ(s)), e => err && err(errCode(e)))
  };
}
const DB = {
  collection: c => Object.assign(queryApi(c, []), { path: c, doc: id => docApi(c, id) }),
  doc: p => { const i = p.lastIndexOf('/'); return docApi(p.slice(0, i), p.slice(i + 1)); }
};

/* ---------- المستخدمون ---------- */
let USERS = {}, PROFILE = null, unsubUsers = null;
const USER = {
  id: async () => auth.currentUser && auth.currentUser.uid,
  me: async () => ({ id: auth.currentUser && auth.currentUser.uid }),
  profiles: async ids => Object.fromEntries(ids.map(i => [i, { name: (USERS[i] && (USERS[i].name || USERS[i].email)) || '' }])),
  isOwner: () => !!PROFILE && PROFILE.role === 'principal',
  canEdit: () => !!PROFILE && PROFILE.role === 'principal',
  can: () => true
};

/* ---------- التنزيل ---------- */
const DL = {
  save: async ({ filename, data }) => {
    const b = data instanceof Blob ? data : new Blob([data]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = filename || 'file';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
};

/* ---------- رفع الملفات (يُفعَّل بعد تفعيل Storage والفوترة) ---------- */
let ASSETS = null;
if (STORAGE_ENABLED) {
  const st = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js');
  const storage = st.getStorage(app);
  ASSETS = {
    upload: async file => {
      const path = 'evidence/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '-' + String(file.name || 'file').replace(/[^\w.\-]+/g, '_');
      await st.uploadBytes(st.ref(storage, path), file, { contentType: file.type || 'application/octet-stream' });
      return { id: path, url: '', sizeBytes: file.size, contentType: file.type };
    }
  };
  window.ENJAZ_BLOB_URL = path => st.getDownloadURL(st.ref(storage, path));
}

window.claude = { use: async n => ({ db: DB, user: USER, downloads: DL, assets: ASSETS })[n] || null };

/* ---------- واجهة الحسابات للمدير ---------- */
const AR_ERR = {
  'auth/invalid-credential': 'بيانات الدخول أو كلمة المرور غير صحيحة',
  'auth/requires-recent-login': 'سجّل الخروج ثم ادخل من جديد وأعد المحاولة',
  'enjaz/bad-phone': 'رقم الجوال غير صحيح (05xxxxxxxx)',
  'enjaz/phone-used': 'رقم الجوال مستخدم لحساب آخر',
  'enjaz/not-phone': 'هذا الحساب ليس برقم جوال',
  'auth/wrong-password': 'كلمة المرور غير صحيحة',
  'auth/user-not-found': 'لا يوجد حساب بهذا البريد',
  'auth/invalid-email': 'البريد الإلكتروني غير صحيح',
  'auth/email-already-in-use': 'هذا البريد مستخدم لحساب آخر',
  'auth/weak-password': 'كلمة المرور ضعيفة (6 أحرف فأكثر)',
  'auth/too-many-requests': 'محاولات كثيرة، انتظر قليلاً ثم أعد المحاولة',
  'auth/network-request-failed': 'تعذّر الاتصال بالإنترنت',
  'permission-denied': 'ليست لديك صلاحية لهذا الإجراء',
  'invalid_argument': 'ليست لديك صلاحية لهذا الإجراء'
};
const errMsg = e => AR_ERR[e && e.code] || ('حدث خطأ: ' + ((e && (e.code || e.message)) || ''));
let secondary = null;
const AUTH = {
  user: null, profile: null, errMsg,
  signOut: () => signOut(auth).then(() => location.reload()),
  listUsers: () => Object.entries(USERS).map(([id, u]) => Object.assign({ id }, u)),
  createUser: async ({ email, phone, password, name, role, staffId }) => {
    secondary = secondary || initializeApp(FIREBASE_CONFIG, 'secondary');
    const sa = getAuth(secondary);
    const ph = phone ? asPhone(phone) : '';
    if (phone && !ph) throw { code: 'enjaz/bad-phone' };
    const em = ph ? phoneEmail(ph) : String(email).trim().toLowerCase();
    if (ph) { try { const s = await getDoc(doc(fs, 'logins', ph)); if (s.exists()) throw { code: 'enjaz/phone-used' }; } catch (e) { if (e && e.code === 'enjaz/phone-used') throw e; } }
    const cred = await createUserWithEmailAndPassword(sa, em, password);
    try {
      await setDoc(doc(fs, 'users', cred.user.uid), { email: em, name, role, staffId: staffId || '', phone: ph, active: true, canAdd: true, createdAt: new Date().toISOString() });
      if (ph) await setDoc(doc(fs, 'logins', ph), { email: em });
    } finally { await signOut(sa); }
  },
  // إصدار كلمة مرور جديدة لحساب رقم جوال: حساب دخول جديد لنفس المستخدم، ويُلغى القديم.
  reissue: async (uid, password) => {
    const u = USERS[uid]; const m = /^p(\d{10})(?:\.(\d+))?@/.exec((u && u.email) || '');
    if (!m) throw { code: 'enjaz/not-phone' };
    secondary = secondary || initializeApp(FIREBASE_CONFIG, 'secondary');
    const sa = getAuth(secondary), k = (+(m[2] || 0)) + 1, em = phoneEmail(m[1], k);
    const cred = await createUserWithEmailAndPassword(sa, em, password);
    try {
      const nu = Object.assign({}, u, { email: em, phone: m[1], reissuedAt: new Date().toISOString() }); delete nu.id;
      await setDoc(doc(fs, 'users', cred.user.uid), nu);
      await setDoc(doc(fs, 'logins', m[1]), { email: em });
      await deleteDoc(doc(fs, 'users', uid));
    } finally { await signOut(sa); }
  },
  changePassword: async (cur, nw) => {
    const u = auth.currentUser;
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, cur));
    await updatePassword(u, nw);
  },
  updateUser: (uid, patch) => updateDoc(doc(fs, 'users', uid), patch),
  resetPassword: email => sendPasswordResetEmail(auth, email)
};

/* ---------- شاشة الدخول ---------- */
const gate = document.createElement('div');
gate.id = 'authGate';
gate.innerHTML = `<style>
#authGate{position:fixed;inset:0;z-index:100;background:linear-gradient(160deg,#0e5a4b,#14806a);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Tajawal,system-ui,sans-serif;direction:rtl}
#authGate .box{background:#fff;border-radius:18px;max-width:420px;width:100%;padding:24px;box-shadow:0 10px 40px rgba(0,0,0,.25)}
#authGate h1{margin:0 0 4px;color:#0e5a4b;font-size:26px;display:flex;align-items:center;gap:10px}
#authGate h1 i{font-style:normal;width:40px;height:40px;border-radius:12px;background:#b8913a;color:#fff;display:grid;place-items:center}
#authGate p{color:#66756f;margin:0 0 16px;font-size:14px}
#authGate label{display:block;font-size:13px;color:#66756f;margin:10px 0 4px;font-weight:600}
#authGate input{width:100%;box-sizing:border-box;border:1px solid #cfd9d6;border-radius:10px;padding:10px;font:inherit}
#authGate button{width:100%;margin-top:16px;border:none;background:#0e5a4b;color:#fff;border-radius:10px;padding:11px;font:inherit;font-weight:700;cursor:pointer}
#authGate .lnk{background:none;color:#14806a;margin-top:8px;padding:4px;font-weight:600}
#authGate .msg{margin-top:12px;font-size:13.5px;color:#c0392b;min-height:18px}
#authGate .ok{color:#1d8a55}
#authGate .sep{border-top:1px solid #e1e7e5;margin:18px 0 6px}
</style><div class="box" id="gateBox"><div style="text-align:center;color:#66756f">جارٍ التحميل…</div></div>`;
document.body.appendChild(gate);
const box = () => document.getElementById('gateBox');
const v = id => (document.getElementById(id) || {}).value || '';
const msg = (t, ok) => { const m = document.getElementById('gMsg'); if (m) { m.textContent = t; m.className = 'msg' + (ok ? ' ok' : ''); } };

const MAX_FAILS = 5, LOCK_MIN = 15;
const failKey = e => 'enjaz_fail_' + e;
const readFail = e => { try { return JSON.parse(localStorage.getItem(failKey(e)) || '{}'); } catch (x) { return {}; } };
const writeFail = (e, o) => { try { localStorage.setItem(failKey(e), JSON.stringify(o)); } catch (x) {} };
const addFail = e => { const o = readFail(e); o.n = (o.n || 0) + 1; writeFail(e, o); return o.n; };
const lockEmail = e => writeFail(e, { n: 0, until: Date.now() + LOCK_MIN * 60000 });
const clearFails = e => { try { localStorage.removeItem(failKey(e)); } catch (x) {} };
const lockLeft = e => { const o = readFail(e); return o.until && o.until > Date.now() ? Math.ceil((o.until - Date.now()) / 60000) : 0; };

async function showLogin() {
  let boot = null;
  try { const b = await getDoc(doc(fs, 'meta', 'bootstrap')); boot = b.exists() ? b.data() : null; } catch (e) { boot = { unknown: true }; }
  if (!boot) {
    box().innerHTML = `<h1><i>إ</i>إنجاز</h1><p>إعداد أول مرة: أنشئ حساب مدير المدرسة. بعدها يضيف المدير بقية المستخدمين من «الإعدادات».</p>
      <label>اسم المدرسة</label><input id="gSchool"><label>اسم المدير</label><input id="gName">
      <label>البريد الإلكتروني</label><input id="gEmail" type="email" dir="ltr" autocomplete="username"><label>كلمة المرور (6 أحرف فأكثر)</label><input id="gPass" type="password" dir="ltr" autocomplete="new-password">
      <button id="gCreate">إنشاء حساب المدير والدخول</button><div class="msg" id="gMsg"></div>`;
    document.getElementById('gCreate').onclick = async () => {
      const school = v('gSchool').trim(), name = v('gName').trim(), email = v('gEmail').trim(), pass = v('gPass');
      if (!school || !name) { msg('أدخل اسم المدرسة واسم المدير'); return; }
      msg('جارٍ الإنشاء…', true); creating = true;
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        const uid = cred.user.uid;
        await setDoc(doc(fs, 'meta', 'bootstrap'), { principalUid: uid, at: new Date().toISOString() });
        await setDoc(doc(fs, 'users', uid), { email, name, role: 'principal', staffId: '', active: true, createdAt: new Date().toISOString() });
        await setDoc(doc(fs, 'settings', 'main'), { id: 'main', school, people: { principal: name }, pins: {}, perms: { counselor: ['dis'], activity: ['op'], admin: ['circ'] } });
        location.reload();
      } catch (e) { creating = false; msg(errMsg(e)); }
    };
    return;
  }
  box().innerHTML = `<h1><i>إ</i>إنجاز</h1><p>سجّل الدخول برقم جوالك (أو بريدك) وكلمة المرور.</p>
    <label>رقم الجوال أو البريد الإلكتروني</label><input id="gEmail" type="text" dir="ltr" autocomplete="username" placeholder="05xxxxxxxx">
    <label>كلمة المرور</label><input id="gPass" type="password" dir="ltr" autocomplete="current-password">
    <button id="gLogin">دخول</button><button class="lnk" id="gForgot">نسيت كلمة المرور؟</button><div class="msg" id="gMsg"></div>`;
  const go = async () => {
    if (!v('gEmail').trim() || !v('gPass')) { msg('اكتب رقم الجوال أو البريد، وكلمة المرور'); return; }
    const { email, phone } = await resolveLogin(v('gEmail'));
    const lockId = phone || email;
    const lk = lockLeft(lockId);
    if (lk) { msg('تم إيقاف الدخول بهذا الحساب مؤقتاً بعد ' + MAX_FAILS + ' محاولات خاطئة. ' + (phone ? 'تواصل مع مدير المدرسة لإصدار كلمة مرور جديدة، أو' : 'افتح الرابط المرسل إلى بريدك لتعيين كلمة مرور جديدة، ثم') + ' أعد المحاولة بعد ' + lk + ' دقيقة.'); return; }
    msg('جارٍ الدخول…', true);
    try { await signInWithEmailAndPassword(auth, email, v('gPass')); clearFails(lockId); }
    catch (e) {
      const c = e && e.code;
      if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/too-many-requests') {
        const n = c === 'auth/too-many-requests' ? MAX_FAILS : addFail(lockId);
        if (n >= MAX_FAILS) {
          lockEmail(lockId);
          if (phone) { msg('أُدخلت كلمة مرور خاطئة ' + MAX_FAILS + ' مرات، فأُوقف الدخول مؤقتاً لمدة ' + LOCK_MIN + ' دقيقة. تواصل مع مدير المدرسة لإصدار كلمة مرور جديدة.'); return; }
          try { await sendPasswordResetEmail(auth, email); } catch (e2) {}
          msg('أُدخلت كلمة مرور خاطئة ' + MAX_FAILS + ' مرات، فأُوقف الدخول مؤقتاً لمدة ' + LOCK_MIN + ' دقيقة. أرسلنا رابط تعيين كلمة مرور جديدة إلى بريدك (افحص الرسائل غير المرغوبة أيضاً).');
          return;
        }
        msg('بيانات الدخول أو كلمة المرور غير صحيحة. المتبقي ' + (MAX_FAILS - n) + ' من ' + MAX_FAILS + ' محاولات قبل إيقاف الدخول مؤقتاً' + (phone ? '.' : ' وإرسال رابط الاستعادة.'));
        return;
      }
      msg(errMsg(e));
    }
  };
  document.getElementById('gLogin').onclick = go;
  document.getElementById('gPass').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  document.getElementById('gForgot').onclick = async () => { if (!v('gEmail')) { msg('اكتب بريدك أولاً'); return; } if (asPhone(v('gEmail'))) { msg('الحسابات برقم الجوال: تواصل مع مدير المدرسة ليصدر لك كلمة مرور جديدة.'); return; } try { await sendPasswordResetEmail(auth, v('gEmail').trim()); msg('أُرسل رابط تغيير كلمة المرور إلى بريدك', true); } catch (e) { msg(errMsg(e)); } };
}

function blocked(text) {
  box().innerHTML = `<h1><i>إ</i>إنجاز</h1><p>${text}</p><button id="gOut">تسجيل الخروج</button>`;
  document.getElementById('gOut').onclick = () => signOut(auth);
}

let started = false, creating = false;
try { await setPersistence(auth, browserLocalPersistence); } catch (e) {}
onAuthStateChanged(auth, async user => {
  if (!user) { if (started) { location.reload(); return; } showLogin(); return; }
  if (started || creating) return;
  let prof = null;
  try { const s = await getDoc(doc(fs, 'users', user.uid)); prof = s.exists() ? s.data() : null; } catch (e) { prof = null; }
  if (!prof) { blocked('حسابك غير مفعّل في البرنامج بعد. تواصل مع مدير المدرسة.'); return; }
  if (prof.active === false) { blocked('تم إيقاف حسابك. تواصل مع مدير المدرسة.'); return; }
  PROFILE = prof; AUTH.user = user; AUTH.profile = prof;
  unsubUsers = onSnapshot(collection(fs, 'users'), s => { USERS = {}; s.docs.forEach(d => { USERS[d.id] = d.data(); }); if (window.render && started) try { window.scheduleRender && window.scheduleRender(); } catch (e) {} }, () => {});
  window.ENJAZ_AUTH = AUTH;
  started = true;
  gate.remove();
  window.__enjazReady();
});
