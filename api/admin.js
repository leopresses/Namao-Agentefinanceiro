import { getAdminAuth, getAdminDb } from './_lib/firebaseAdmin.js';
import { getBearerToken, handleCors } from './_lib/http.js';

const GRANT_DURATIONS = {
  '30': 30,
  '365': 365,
  unlimited: null,
};
const MAX_LISTED_USERS = 100;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isAdministrator(user) {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  return Boolean(adminEmail && normalizeEmail(user.email) === adminEmail);
}

function isActivePro(data, now = Date.now()) {
  if (!data?.isPro) return false;
  if (data.planType === 'admin' || data.planType === 'manual_unlimited') return true;
  // Compatibilidade com acessos concedidos antes de existir plano/vencimento.
  if (!data.planType && !data.proExpiresAt) return true;

  const expiresAt = new Date(data.proExpiresAt || '');
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now;
}

function toPublicUser(authUser, account) {
  const hasLegacyProAccess = account?.isPro === true && !account?.planType && !account?.proExpiresAt;
  return {
    uid: authUser.uid,
    email: authUser.email || '',
    name: authUser.displayName || '',
    isPro: isActivePro(account),
    planType: account?.planType || (hasLegacyProAccess ? 'legacy' : 'free'),
    proExpiresAt: account?.proExpiresAt || null,
  };
}

async function countRegisteredUsers(adminAuth) {
  let total = 0;
  let pageToken;

  do {
    const page = await adminAuth.listUsers(1000, pageToken);
    total += page.users.length;
    pageToken = page.pageToken;
  } while (pageToken);

  return total;
}

async function getRegisteredUsers(adminAuth, pageToken) {
  const page = await adminAuth.listUsers(MAX_LISTED_USERS, pageToken);
  const users = page.users
    .filter((user) => user.email)
    .map((user) => ({
      email: normalizeEmail(user.email),
      name: user.displayName || '',
    }))
    .sort((first, second) => first.email.localeCompare(second.email, 'pt-BR'));

  return {
    users,
    hasMoreUsers: Boolean(page.pageToken),
    nextPageToken: page.pageToken || null,
    ...(pageToken ? {} : { registeredUsers: await countRegisteredUsers(adminAuth) }),
  };
}

async function getUserByEmail(adminAuth, db, email) {
  const target = await adminAuth.getUserByEmail(email);
  const account = await db.collection('users').doc(target.uid).get();
  return { target, account: account.exists ? account.data() : {} };
}

async function writeAudit(db, actor, action, target, details = {}) {
  await db.collection('adminAudit').add({
    action,
    actorUid: actor.uid,
    actorEmail: normalizeEmail(actor.email),
    targetUid: target.uid,
    targetEmail: normalizeEmail(target.email),
    createdAt: new Date().toISOString(),
    ...details,
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

  try {
    const adminAuth = getAdminAuth();
    const db = getAdminDb();
    const actor = await adminAuth.verifyIdToken(idToken);

    if (!isAdministrator(actor)) {
      return res.status(403).json({ error: 'Acesso administrativo não autorizado.' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const action = body.action;

    if (action === 'summary') {
      const pageToken = typeof body.pageToken === 'string' && body.pageToken ? body.pageToken : undefined;
      return res.status(200).json(await getRegisteredUsers(adminAuth, pageToken));
    }

    const email = normalizeEmail(body.email);
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }

    const { target, account } = await getUserByEmail(adminAuth, db, email);

    if (action === 'find') {
      return res.status(200).json({ user: toPublicUser(target, account) });
    }

    if (action === 'grant') {
      const duration = String(body.duration || '');
      if (!Object.prototype.hasOwnProperty.call(GRANT_DURATIONS, duration)) {
        return res.status(400).json({ error: 'Período de acesso inválido.' });
      }

      const days = GRANT_DURATIONS[duration];
      const targetIsMainAdmin = isAdministrator(target);
      const now = new Date();
      const currentExpiry = new Date(account?.proExpiresAt || '');
      // Liberar dias extras nunca deve reduzir uma assinatura que ainda está
      // válida. Se já houver PRO ativo, o novo período começa ao fim dele.
      const baseDate = Number.isFinite(currentExpiry.getTime()) && currentExpiry > now
        ? currentExpiry
        : now;
      const expiresAt = targetIsMainAdmin || days === null
        ? null
        : new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
      const planType = targetIsMainAdmin ? 'admin' : days === null ? 'manual_unlimited' : 'manual';
      const accountRef = db.collection('users').doc(target.uid);

      await accountRef.set({
        isPro: true,
        planType,
        proExpiresAt: expiresAt,
        proGrantedAt: now.toISOString(),
      }, { merge: true });
      await writeAudit(db, actor, 'grant_pro', target, { planType, proExpiresAt: expiresAt });

      const updated = await accountRef.get();
      return res.status(200).json({ user: toPublicUser(target, updated.data() || {}) });
    }

    if (action === 'revoke') {
      if (isAdministrator(target)) {
        return res.status(400).json({ error: 'O acesso da conta administradora principal não pode ser removido.' });
      }

      const now = new Date().toISOString();
      const accountRef = db.collection('users').doc(target.uid);

      await accountRef.set({
        isPro: false,
        planType: 'free',
        proExpiresAt: null,
        proRevokedAt: now,
      }, { merge: true });
      await writeAudit(db, actor, 'revoke_pro', target);

      const updated = await accountRef.get();
      return res.status(200).json({ user: toPublicUser(target, updated.data() || {}) });
    }

    return res.status(400).json({ error: 'Ação administrativa inválida.' });
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'Nenhum usuário cadastrado com este e-mail.' });
    }

    console.error('Falha na administração de contas:', error.message);
    return res.status(503).json({ error: 'Não foi possível concluir a operação agora.' });
  }
}
