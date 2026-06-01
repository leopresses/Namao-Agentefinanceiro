// Firebase - Configuração protegida via variáveis de ambiente do Vite
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "firebase/auth";
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

export const loginWithGooglePopup = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  await grantAdminProStatus(result.user);
  return result.user;
};

export const loginWithGoogleRedirect = async () => {
  await signInWithRedirect(auth, googleProvider);
};

export const checkGoogleLoginResult = async () => {
  const result = await getRedirectResult(auth);
  if (result?.user) {
    await grantAdminProStatus(result.user);
    return result.user;
  }
  return null;
};

// =============================================
// Privilégios de Administrador
// =============================================
const grantAdminProStatus = async (user) => {
  if (user && user.email === 'lpresses17@gmail.com') {
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { isPro: true, aiMessageCount: 0 }, { merge: true });
      console.log('✅ Status PRO concedido automaticamente para o Admin.');
    } catch (e) {
      console.error('Falha ao conceder PRO:', e);
    }
  }
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

// =============================================
// Funções NaMão Pro (Freemium)
// =============================================

export const getUserProStatus = async () => {
  const uid = getSecureUserId();
  if (!uid) return { isPro: false, aiMessageCount: 0 };

  const userRef = doc(db, 'users', uid);
  const docSnap = await getDoc(userRef);
  
  if (docSnap.exists()) {
    const data = docSnap.data();
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    // Se mudou o mês, o limite reseta logicamente aqui
    // (O backend fará a mesma checagem de forma segura)
    let count = data.aiMessageCount || 0;
    if (data.aiLastMessageMonth !== currentMonth) {
      count = 0;
    }

    return {
      isPro: !!data.isPro,
      aiMessageCount: count
    };
  }
  return { isPro: false, aiMessageCount: 0 };
};
