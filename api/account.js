import { getAdminAuth, getAdminDb } from './_lib/firebaseAdmin.js';
import { getBearerToken, handleCors } from './_lib/http.js';

function isActivePro(data) {
  if (!data?.isPro) return false;
  if (data.planType === 'admin') return true;
  const expiresAt = new Date(data.proExpiresAt || '');
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now();
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const idToken = getBearerToken(req);
  if (!idToken) return res.status(401).json({ error: 'Token de autenticação ausente.' });

  try {
    const decodedUser = await getAdminAuth().verifyIdToken(idToken);
    const ref = getAdminDb().collection('users').doc(decodedUser.uid);
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

    if (adminEmail && decodedUser.email?.toLowerCase() === adminEmail) {
      await ref.set({ isPro: true, planType: 'admin' }, { merge: true });
    }

    const snap = await ref.get();
    const data = snap.exists ? snap.data() : {};
    return res.status(200).json({
      isPro: isActivePro(data),
      aiMessageCount: Number(data.aiMessageCount || 0),
    });
  } catch (error) {
    console.error('Falha ao consultar a conta:', error.message);
    return res.status(503).json({ error: 'Não foi possível consultar sua conta agora.' });
  }
}
