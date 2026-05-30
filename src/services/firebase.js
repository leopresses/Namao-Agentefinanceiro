// Firebase - Configuração protegida via variáveis de ambiente do Vite
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// =============================================
// Funções de Autenticação
// =============================================

export const loginWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
};

export const logoutGoogle = async () => {
  return signOut(auth);
};

// Retorna o UID seguro do Firebase Auth (nunca do localStorage)
export function getSecureUserId() {
  const user = auth.currentUser;
  if (!user) return null;
  return user.uid;
}

// Retorna o ID Token JWT para envio ao backend
export async function getIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuário não autenticado");
  return user.getIdToken();
}

// Observador de estado de autenticação
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// =============================================
// Funções de Nuvem (Cloud Firestore)
// =============================================

// SEGURANÇA: userId vem de auth.currentUser.uid, NUNCA do localStorage
export const saveCloudBackup = async (expensesData, chatsData) => {
  const uid = getSecureUserId();
  if (!uid) throw new Error("Usuário não autenticado");

  const userRef = doc(db, 'users', uid);
  const payload = {
    expenses: expensesData,
    lastBackup: new Date().toISOString()
  };
  if (chatsData !== undefined) {
    payload.chats = chatsData;
  }
  await setDoc(userRef, payload, { merge: true });
};

export const loadCloudBackup = async () => {
  const uid = getSecureUserId();
  if (!uid) throw new Error("Usuário não autenticado");

  const userRef = doc(db, 'users', uid);
  const docSnap = await getDoc(userRef);
  
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      expenses: data.expenses || [],
      chats: data.chats || null
    };
  }
  return { expenses: [], chats: null };
};
