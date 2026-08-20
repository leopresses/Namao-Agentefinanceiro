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

  const expiresAt = new Date(data.proExpiresAt || '');
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now;
}

function toPublicUser(authUser, account) {
  return {
    uid: authUser.uid,
    email: authUser.email || '',
    name: authUser.displayName || '',
    isPro: isActivePro(account),
    planType: account?.planType || 'free',
    proExpiresAt: account?.proExpiresAt || null,
  };
}

async function getRegisteredUsers(adminAuth) {
  let total = 0;
  let pageToken;
  const users = [];

  do {
    const page = await adminAuth.listUsers(1000, pageToken);
    for (const user of page.users) {
      total += 1;
      if (users.length < MAX_LISTED_USERS && user.email) {
        users.push({
          email: normalizeEmail(user.email),
          name: user.displayName || '',
        });
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);

  users.sort((first, second) => first.email.localeCompare(second.email, 'pt-BR'));
  return {
    registeredUsers: total,
    users,
    hasMoreUsers: total > users.length,
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
    const adminAuth = getAdmAuth();
    const db = getAdminDb();
    const actor = await adminAuth.verifyIdToken(idToken);

    if (!isAdministrator(actor)) {
      return res.status(403).json({ error: 'Acesso administrativo não autorizado.' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const action = body.action;

    if (action === 'summary') {
      return res.status(200).json(await getRegisteredUsers(adminAuth));
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
      const expiresAt = targetIsMainAdmin || days === null
        ? null
        : new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
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

    return res.status(400).json({ error: 'Acção administrativa inválida.' });
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({ error: 'Nenhum usuário cadastrado com este e-mail.' });
    }

    console.error('Falha na administração de contas:', error.message);
    return res.status(503).json({ error: 'Não foi possível concluir a operação agora.' });
  }
}
