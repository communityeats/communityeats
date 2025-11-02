// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp } from "firebase/app";
import { isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID!,
}

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const firestore = getFirestore(app);

if (typeof window !== 'undefined') {
  const emulatorHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST;
  if (emulatorHost) {
    const [host, port] = emulatorHost.split(':');
    if (host && port) {
      connectFirestoreEmulator(firestore, host, Number(port));
    }
  }
}

if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
     // uncomment later const analytics = getAnalytics(app);
    }
  });
}

export const auth = getAuth(app);
export { app, firestore };
