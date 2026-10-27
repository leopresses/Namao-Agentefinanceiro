import { createHash, randomUUID } from 'node:crypto';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const LEASE_MS = 120_000;

// Stored server-side: limits apply across Vercel instances and to PRO accounts.
export async function reserveAiRequest(db, uid, now = Date.now()) {
  const ref = db.collection('aiRateLimits').doc(createHash('sha256').update(uid).digest('hex'));
  const leaseId = randomUUID();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists ? snapshot.data() : {};
    const leases = Object.fromEntries(Object.entries(data.leases || {}).filter(([, expiry]) => expiry > now));
    const minute = Math.floor(now / MINUTE);
    const hour = Math.floor(now / HOUR);
    const minuteCount = data.minute === minute ? Number(data.minuteCount || 0) : 0;
    const hourCount = data.hour === hour ? Number(data.hourCount || 0) : 0;
    if (hourCount >= 60) return { allowed: false, retryAfter: Math.ceil(((hour + 1) * HOUR - now) / 1000) };
    if (minuteCount >= 6) return { allowed: false, retryAfter: Math.ceil(((minute + 1) * MINUTE - now) / 1000) };
    if (Object.keys(leases).length >= 2) {
      return { allowed: false, retryAfter: Math.ceil((Math.min(...Object.values(leases)) - now) / 1000) };
    }
    leases[leaseId] = now + LEASE_MS;
    transaction.set(ref, { minute, hour, minuteCount: minuteCount + 1, hourCount: hourCount + 1, leases });
    return { allowed: true, ref, leaseId };
  });
}

export async function releaseAiRequest(db, lease) {
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(lease.ref);
    if (!snapshot.exists) return;
    const data = snapshot.data();
    const leases = { ...data.leases };
    delete leases[lease.leaseId];
    // Firestore merge:true recursively merges map entries and would keep the
    // removed lease. Replace the snapshot atomically to actually remove it.
    transaction.set(lease.ref, { ...data, leases });
  });
}

export async function withAiRateLimit(db, uid, res, action) {
  let lease;
  try {
    lease = await reserveAiRequest(db, uid);
  } catch {
    return res.status(503).json({ error: 'Não foi possível verificar o limite de uso. Tente novamente.' });
  }
  if (!lease.allowed) {
    res.setHeader('Retry-After', String(lease.retryAfter));
    return res.status(429).json({ error: 'Muitas solicitações à IA. Aguarde um pouco e tente novamente.', code: 'AI_RATE_LIMIT' });
  }
  try {
    return await action();
  } finally {
    // Failed generations still count toward the short-term abuse limit.
    try { await releaseAiRequest(db, lease); } catch { console.error('Falha ao liberar uma solicitação de IA.'); }
  }
}
