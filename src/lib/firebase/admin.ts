// firebase/admin.ts
import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

let appInitialized = false

export function initAdmin() {
  if (!appInitialized && getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        '[initAdmin] Missing Firebase Admin env vars: ' +
          JSON.stringify({ projectId, clientEmail, hasPrivateKey: !!privateKey })
      );
    }

    console.log('[initAdmin] Initializing Firebase Admin SDK with projectId:', projectId);
    console.log('[initAdmin] Using clientEmail:', clientEmail);
    console.log('[initAdmin] Private key length:', privateKey.length);

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    })
    console.log(process.env.FIREBASE_STORAGE_BUCKET, 'storage bucket')
    appInitialized = true
  }
}

export { getAuth, getFirestore, getStorage }