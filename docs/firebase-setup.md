# إعداد النسخة المستقلة من إنجاز

## ١. قواعد الأمان في Firestore (مرة واحدة، وعند كل تحديث لها)
1. افتح Firebase ← Firestore ← تبويب **Rules**.
2. احذف كل النص الموجود، والصق محتوى الملف `firebase/firestore.rules` كاملاً.
3. اضغط **Publish**.

## ٢. النشر على Cloudflare

المشروع منشور على Cloudflare **Workers** (مشروع باسم `enjaz` مربوط بالمستودع، أمر النشر `npx wrangler deploy`)،
وملف `wrangler.jsonc` في جذر المستودع يوجّه النشر إلى مجلد `web`. كل رفع إلى `main` يُنشر تلقائياً.

بديل (Pages):
1. أنشئ حساباً مجانياً في https://dash.cloudflare.com
2. من القائمة: **Workers & Pages** ← **Create** ← تبويب **Pages** ← **Connect to Git**.
3. اربط حساب GitHub واختر مستودع `enjaz`.
4. الإعدادات:
   - Project name: `enjaz`
   - Production branch: `main`
   - Framework preset: `None`
   - Build command: (فارغ)
   - Build output directory: `web`
5. **Save and Deploy**. سيظهر الرابط مثل `https://enjaz.pages.dev`.

## ٣. السماح للرابط بتسجيل الدخول
1. Firebase ← Security ← Authentication ← تبويب **Settings** ← **Authorized domains**.
2. **Add domain** ← اكتب `enjaz.pages.dev` (أو الدومين الخاص لاحقاً).

## ٤. أول دخول
- يفتح المدير الرابط، ويظهر نموذج «إعداد أول مرة» لإنشاء حساب المدير.
- ثم من «الإعدادات ← حسابات المستخدمين» يضيف بقية المستخدمين ببريد وكلمة مرور ودور.
- لنقل البيانات من نسخة Claude: نزّل «نسخة احتياطية» من إعدادات نسخة Claude، ثم «استعادة من نسخة» في النسخة الجديدة.

## ٥. لاحقاً: رفع الشواهد المباشر (يحتاج خطة Blaze)
1. فعّل الفوترة (Blaze) ثم Firebase ← Storage ← Get started.
2. الصق `firebase/storage.rules` في Storage ← Rules ← Publish.
3. اضبط CORS للحاوية حتى يعرض البرنامج ملفات PDF داخله.
4. في `web-src/config.js` اجعل `STORAGE_ENABLED = true` ثم ابنِ `web/`.

## للمطوّر
- المصدر الوحيد: `claude-version/index.html`. بعد أي تعديل: `python3 tools/build_web.py`.
- `web-src/firebase-shim.js` يحاكي `claude.use('db'|'user'|'downloads'|'assets')` فوق Firebase،
  ويعرض شاشة الدخول ويضبط `ENJAZ_AUTH` (الدور من `users/{uid}`).
