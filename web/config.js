// إعدادات مشروع Firebase الخاص بإنجاز (ليست سرية؛ الحماية في قواعد الأمان firestore.rules).
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDeyticICoFVpZLXyxofDUYy8eHRu5cBFY",
  authDomain: "enjaz-d0d3b.firebaseapp.com",
  projectId: "enjaz-d0d3b",
  storageBucket: "enjaz-d0d3b.firebasestorage.app",
  messagingSenderId: "1067278280873",
  appId: "1:1067278280873:web:abd80224dceed17773e1b8"
};

// رفع الشواهد إلى Firebase Storage يحتاج خطة Blaze. اجعلها true بعد تفعيل الفوترة وStorage
// وضبط CORS للحاوية (انظر docs/firebase-setup.md).
export const STORAGE_ENABLED = false;

// أقصى حجم لملف يُحفظ داخل قاعدة البيانات مباشرة عند تعطّل Storage (حد المستند في Firestore 1 ميجابايت).
export const INLINE_MAX_BYTES = 650 * 1024;
