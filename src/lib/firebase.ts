// PulseCISC-32 Production Firebase Client
// Supports Web, Desktop (Tauri), and Android WebView environments
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyD1P9npgGxjLKhWlhGuuu2OkzXx9p_8Zpo',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'pulsecisc-32.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'pulsecisc-32',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'pulsecisc-32.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '626009302369',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:626009302369:web:8b926ffec69f12bcced120',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-825KJ78SN3',
};

// Singleton Firebase App instance
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Authentication service (Email/Password, Google, Anonymous)
export const auth: Auth = getAuth(app);

// Cloud Firestore with multi-tab persistent offline cache
export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// Cloud Storage for binary ROMs/RAM dumps, machine code files
export const storage: FirebaseStorage = getStorage(app);

// Analytics: Initialized with environment support guard (prevents crash in desktop/mobile webviews)
export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {
      analytics = null;
    });
}
