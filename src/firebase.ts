import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

// Em produção usa o próprio domínio como authDomain para evitar o ITP do Safari.
// O servidor proxy /__/ → firebaseapp.com mantém o fluxo OAuth no mesmo origin.
const authDomain = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? window.location.hostname
  : firebaseConfig.authDomain;

const app = initializeApp({ ...firebaseConfig, authDomain });
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
