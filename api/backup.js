import { randomUUID } from 'node:crypto';
import { getAdminAuth, getAdminDb } from './_lib/firebaseAdmin.js';
import { getBearerToken, handleCors } from './_lib/http.js';
import { validateBackupInput } from '../shared/backupValidation.js';

function isActivePro(data) {
  if (data?.isPro !== true) return false;
  if (['admin', 'manual_unlimited'].includes(data.planType)) return true;
  if (!data.planType && !data.proExpiresAt) return true;
  return new Date(data.proExpiresAt || '').getTime() > Date.now();
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Token de autenticação ausente.' });
  let user;
  try { user = await getAdminAuth().verifyIdToken(token); } catch {
    return res.status(401).json({ error: 'Token de autenticação inválido ou expirado.' });
  }
  const validated = validateBackupInput(req.body);
  if (validated.error) return res.status(validated.status).json({ error: validated.error });

  try {
    const db = getAdminDb();
    const userRef = db.collection('users').doc(user.uid);
    const backupRef = userRef.collection('private').doc('backup');
    const backupRevision = randomUUID();
    await db.runTransaction(async (transaction) => {
      const [account, backup] = await Promise.all([transaction.get(userRef), transaction.get(backupRef)]);
      const accountData = account.exists ? account.data() : {};
      if (!isActivePro(accountData)) throw Object.assign(new Error('Backup em nuvem disponível no plano PRO.'), { status: 403 });
      const legacy = ['expenses', 'chats', 'budgets', 'goals'].some((key) => accountData[key]);
      const current = backup.exists ? backup.data() : legacy ? accountData : null;
      const revision = current
        ? current.backupRevision || current.lastBackup || (backup.exists ? 'legacy-private' : 'legacy-root')
        : null;
      if (revision !== validated.expectedRevision) {
        throw Object.assign(new Error('A cópia na nuvem mudou desde o último backup deste dispositivo.'), {
          status: 409, code: 'BACKUP_CONFLICT', currentRevision: revision,
        });
      }
      const combined = { ...validated.payload };
      for (const key of ['chats', 'budgets', 'goals']) {
        if (!(key in combined) && current?.[key] != null) combined[key] = current[key];
      }
      const checked = validateBackupInput(combined);
      if (checked.error) throw Object.assign(new Error(checked.error), { status: checked.status });
      transaction.set(backupRef, {
        ...checked.payload, backupRevision, lastBackup: new Date().toISOString(),
      });
    });
    return res.status(200).json({ backupRevision });
  } catch (error) {
    if (error.status) return res.status(error.status).json({
      error: error.message, ...(error.code ? { code: error.code, currentRevision: error.currentRevision } : {}),
    });
    console.error('Falha ao salvar backup:', error.code || 'BACKUP_FAILED');
    return res.status(503).json({ error: 'Não foi possível salvar o backup agora.' });
  }
}
