// Firebase - Configuração protegida via variáveis de ambiente do Vite
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Funções utilitárias de Autenticação
export const loginWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
};

export const logoutGoogle = async () => {
  return signOut(auth);
};

// Funções utilitárias de Nuvem (Cloud Firestore)
export const saveCloudBackup = async (userId, expensesData) => {
  if (!userId) throw new Error("Usuário não autenticado");
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, {
    expenses: expensesData,
    lastBackup: new Date().toISOString()
  }, { merge: true });
};

export const loadCloudBackup = async (userId) => {
  if (!userId) throw new Error("Usuário não autenticado");
  const userRef = doc(db, 'users', userId);
  const docSnap = await getDoc(userRef);
  
  if (docSnap.exists()) {
    return docSnap.data().expenses || [];
  }
  return [];
};
