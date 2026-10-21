import { generateChatReply, getChatFailure, validateChatPayload } from './_lib/chatGeneration.js';
import { getAdminAuth, getAdminDb } from './_lib/firebaseAdmin.js';
import { getBearerToken, handleCors } from './_lib/http.js';

const FREE_MONTHLY_MESSAGES = 5;
function getBrazilMonthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}

function isActivePro(data, now) {
  if (!data?.isPro) return false;
  if (data.planType === 'admin' || data.planType === 'manual_unlimited') return true;
  // Compatibilidade com acessos concedidos antes de existir plano/vencimento.
  if (!data.planType && !data.proExpiresAt) return true;
  const expiresAt = new Date(data.proExpiresAt || '');
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now;
}

async function reserveChatMessage(db, uid) {
  const userRef = db.collection('users').doc(uid);
  const now = new Date();
  const currentMonth = getBrazilMonthKey(now);

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(userRef);
    const data = snap.exists ? snap.data() : {};

    if (isActivePro(data, now)) return { allowed: true, isPro: true };

    const previousCount = data.aiLastMessageMonth === currentMonth
      ? Number(data.aiMessageCount || 0)
      : 0;

    if (previousCount >= FREE_MONTHLY_MESSAGES) {
      return { allowed: false, isPro: false };
    }

    transaction.set(userRef, {
      aiMessageCount: previousCount + 1,
      aiLastMessageMonth: currentMonth,
    }, { merge: true });

    return { allowed: true, isPro: false };
  });
}

// A cota é reservada antes da chamada externa para evitar requisições
// concorrentes acima do limite. Se a IA falhar, a reserva é devolvida.
async function releaseChatMessage(db, uid) {
  const userRef = db.collection('users').doc(uid);
  const currentMonth = getBrazilMonthKey();

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(userRef);
    const data = snap.exists ? snap.data() : {};
    if (data.aiLastMessageMonth !== currentMonth || isActivePro(data, new Date())) return;

    const currentCount = Math.max(0, Number(data.aiMessageCount || 0));
    if (currentCount > 0) {
      transaction.set(userRef, { aiMessageCount: currentCount - 1 }, { merge: true });
    }
  });
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const idToken = getBearerToken(req);
  if (!idToken) {
    return res.status(401).json({ error: 'Token de autenticação ausente.' });
  }

  let decodedUser;
  try {
    decodedUser = await getAdminAuth().verifyIdToken(idToken);
  } catch (error) {
    console.error('Falha ao validar o token Firebase:', error.message);
    if (error.message.includes('FIREBASE_SERVICE_ACCOUNT')) {
      return res.status(503).json({ error: 'Serviço de autenticação temporariamente indisponível.' });
    }
    return res.status(401).json({ error: 'Token de autenticação inválido ou expirado.' });
  }

  const validated = validateChatPayload(req.body);
  if (validated.error) return res.status(validated.status).json({ error: validated.error });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY não definida no ambiente.');
    return res.status(500).json({ error: 'Erro de configuração do servidor.' });
  }

  let access;
  try {
    access = await reserveChatMessage(getAdminDb(), decodedUser.uid);
  } catch (error) {
    console.error('Falha ao verificar a cota da IA:', error.message);
    return res.status(503).json({ error: 'Não foi possível verificar sua cota agora. Tente novamente.' });
  }

  if (!access.allowed) {
    return res.status(403).json({ error: 'Limite de mensagens gratuitas atingido. Assine o plano Pro para continuar.' });
  }

  try {
    const text = await generateChatReply(validated.payload, { apiKey });
    return res.status(200).json({ text });
  } catch (error) {
    if (!access.isPro) {
      try {
        await releaseChatMessage(getAdminDb(), decodedUser.uid);
      } catch (releaseError) {
        console.error('Falha ao devolver a cota da IA:', releaseError.message);
      }
    }
    const failure = getChatFailure(error);
    console.error('Falha na IA:', { code: failure.code, providerStatus: error.status || null });
    return res.status(failure.status).json({ error: failure.error, code: failure.code });
  }
}
