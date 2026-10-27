import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { validateBackupInput } from '../shared/backupValidation.js';
import { isAdministrator } from '../api/_lib/adminIdentity.js';
import { releaseAiRequest, reserveAiRequest, withAiRateLimit } from '../api/_lib/aiRateLimit.js';

const records = new Map();
let identity, generationCount, transactionTail = Promise.resolve();
const snapshot = (path) => ({ exists: records.has(path), data: () => structuredClone(records.get(path)) });
function firestoreMerge(previous, incoming) {
  const merged = { ...previous };
  for (const [key, value] of Object.entries(incoming)) {
    merged[key] = value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length
      ? firestoreMerge(merged[key], value) : value;
  }
  return merged;
}
function reference(path) {
  return { path, collection: (name) => collection(`${path}/${name}`),
    get: async () => snapshot(path),
    set: async (data, options) => records.set(path, options?.merge ? firestoreMerge(records.get(path), data) : data) };
}
const collection = (path) => ({ doc: (id) => reference(`${path}/${id}`), add: async () => {} });
const db = {
  collection,
  runTransaction(callback) {
    const promise = transactionTail.then(async () => {
      const writes = [];
      const result = await callback({ get: async (ref) => snapshot(ref.path),
        set: (ref, data, options) => writes.push([ref, structuredClone(data), options]) });
      for (const [ref, data, options] of writes) await ref.set(data, options);
      return result;
    });
    transactionTail = promise.catch(() => {});
    return promise;
  },
};
mock.module('../api/_lib/firebaseAdmin.js', { exports: {
  getAdminDb: () => db,
  getAdminAuth: () => ({ verifyIdToken: async (token) => {
    if (token !== 'valid') throw new Error('Invalid token');
    return identity;
  } }),
} });
mock.module('../api/_lib/chatGeneration.js', { exports: {
  validateChatPayload: (value) => ({ payload: value }),
  generateChatReply: async () => { generationCount++; return 'Resposta simulada.'; },
  getChatFailure: () => ({ status: 503, error: 'Falha simulada.', code: 'AI_BUSY' }),
} });
const backup = (await import('../api/backup.js')).default;
const account = (await import('../api/account.js')).default;
const admin = (await import('../api/admin.js')).default;
const chat = (await import('../api/chat.js')).default;

function response() {
  return { code: 200, headers: {}, status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }, setHeader(key, value) { this.headers[key] = value; } };
}
async function invoke(handler, body = {}, token = 'valid') {
  const res = response();
  await handler({ method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body }, res);
  return res;
}
const validBackup = () => ({ expenses: [{ id: 'e1', description: 'Mercado', amount: 32.5, date: '2026-10-27', type: 'expense', status: 'paid' }],
  chats: [{ id: 'c1', title: 'Conversa', messages: [{ id: 1, sender: 'user', text: 'Olá' }] }],
  budgets: { mercado: 500 }, goals: [{ id: 'g1', title: 'Reserva', targetAmount: 1000, currentAmount: 20, deadline: null }], expectedRevision: null });

beforeEach(() => {
  records.clear(); generationCount = 0;
  identity = { uid: 'owner', email: 'admin@example.test', email_verified: true, firebase: { sign_in_provider: 'google.com' } };
  process.env.ADMIN_EMAIL = 'admin@example.test';
  delete process.env.ADMIN_UID;
  process.env.GEMINI_API_KEY = 'isolated-test';
});

test('admin rejeita e-mail não verificado e provedor diferente; UID configurado prevalece', () => {
  assert.equal(isAdministrator(identity), true);
  assert.equal(isAdministrator({ ...identity, email_verified: false }), false);
  assert.equal(isAdministrator({ ...identity, firebase: { sign_in_provider: 'password' } }), false);
  process.env.ADMIN_UID = 'fixed-admin';
  assert.equal(isAdministrator(identity), false);
  assert.equal(isAdministrator({ ...identity, uid: 'fixed-admin', email: 'changed@example.test' }), true);
  assert.equal(isAdministrator({ uid: 'fixed-admin', email_verified: false }), false);
  assert.equal(isAdministrator({ uid: 'fixed-admin', emailVerified: true }), true);
});

test('APIs de conta e administração não promovem token com e-mail não verificado', async () => {
  identity.email_verified = false;
  assert.equal((await invoke(account)).body.isPro, false);
  assert.equal(records.has('users/owner'), false);
  assert.equal((await invoke(admin, { action: 'summary' })).code, 403);
  assert.equal((await invoke(account, {}, null)).code, 401);
});

test('provisionamento preserva administrador Google verificado', async () => {
  assert.equal((await invoke(account)).body.isPro, true);
  assert.equal(records.get('users/owner').planType, 'admin');
});

test('backup exige autenticação e PRO ativo, inclusive quando o plano venceu', async () => {
  assert.equal((await invoke(backup, validBackup(), null)).code, 401);
  assert.equal((await invoke(backup, validBackup(), 'invalid')).code, 401);
  assert.equal((await invoke(backup, validBackup())).code, 403);
  records.set('users/owner', { isPro: true, planType: 'mensal', proExpiresAt: '2020-01-01T00:00:00Z' });
  assert.equal((await invoke(backup, validBackup())).code, 403);
  assert.equal(records.has('users/owner/private/backup'), false);
});

test('backup usa UID do token e preserva privilégios e dados de outra conta', async () => {
  records.set('users/owner', { isPro: true, planType: 'manual_unlimited' });
  records.set('users/other/private/backup', { untouched: true });
  assert.equal((await invoke(backup, { ...validBackup(), uid: 'other' })).code, 400);
  assert.equal((await invoke(backup, { ...validBackup(), isPro: true })).code, 400);
  const result = await invoke(backup, validBackup());
  assert.equal(result.code, 200);
  assert.deepEqual(records.get('users/owner/private/backup').expenses, validBackup().expenses);
  assert.equal(records.get('users/owner').planType, 'manual_unlimited');
  assert.deepEqual(records.get('users/other/private/backup'), { untouched: true });
});

test('dispositivos concorrentes não substituem backup mais recente silenciosamente', async () => {
  records.set('users/owner', { isPro: true, planType: 'manual_unlimited' });
  const results = await Promise.all([invoke(backup, validBackup()), invoke(backup, validBackup())]);
  assert.deepEqual(results.map((r) => r.code).sort(), [200, 409]);
  const revision = records.get('users/owner/private/backup').backupRevision;
  assert.equal(results.find((r) => r.code === 409).body.currentRevision, revision);
  assert.equal((await invoke(backup, { ...validBackup(), expectedRevision: revision })).code, 200);
});

test('backup legado mantém a revisão para migração sem alterar dados locais', async () => {
  records.set('users/owner', { isPro: true, expenses: [], lastBackup: 'legacy-revision' });
  assert.equal((await invoke(backup, validBackup())).code, 409);
  assert.equal((await invoke(backup, { ...validBackup(), expectedRevision: 'legacy-revision' })).code, 200);
});

test('validação recusa estruturas incorretas, valores inválidos, datas falsas e excesso de tamanho', async () => {
  for (const value of [null, [], { ...validBackup(), expenses: {} },
    { ...validBackup(), expenses: [{ ...validBackup().expenses[0], amount: -1 }] },
    { ...validBackup(), expenses: [{ ...validBackup().expenses[0], date: '2026-99-99' }] },
    { ...validBackup(), expenses: [{ ...validBackup().expenses[0], date: '2026-02-30' }] },
    { ...validBackup(), chats: [{ id: 'c', title: 'C', messages: {} }] },
    { ...validBackup(), budgets: { mercado: '500' } },
    { ...validBackup(), goals: [{ id: 'g', title: 'G', targetAmount: -1 }] },
    JSON.parse('{"expenses":[],"__proto__":{"isPro":true}}')]) {
    assert.equal(validateBackupInput(value).status, 400);
    assert.equal((await invoke(backup, value)).code, 400);
  }
  const huge = { ...validBackup(), chats: [{ id: 'c', title: 'C', messages: [{ sender: 'user', text: 'ç'.repeat(430_000) }] }] };
  assert.equal((await invoke(backup, huge)).code, 413);
});

test('IA aplica limite de frequência também ao PRO, antes de gerar resposta', async () => {
  records.set('users/owner', { isPro: true, planType: 'manual_unlimited' });
  for (let i = 0; i < 6; i++) assert.equal((await invoke(chat, { userText: 'Olá' })).code, 200);
  const limited = await invoke(chat, { userText: 'Olá' });
  assert.equal(limited.code, 429);
  assert.equal(limited.body.code, 'AI_RATE_LIMIT');
  assert.ok(Number(limited.headers['Retry-After']) > 0);
  assert.equal(generationCount, 6);
});

test('limite distribuído contém concorrência e libera vagas sem devolver a contagem de abuso', async () => {
  const now = 100_000;
  const leases = await Promise.all(Array.from({ length: 3 }, () => reserveAiRequest(db, 'owner', now)));
  assert.equal(leases.filter((lease) => lease.allowed).length, 2);
  await releaseAiRequest(db, leases[0]);
  const next = await reserveAiRequest(db, 'owner', now);
  assert.equal(next.allowed, true);
  await releaseAiRequest(db, next);
  await releaseAiRequest(db, leases[1]);
  for (let i = 0; i < 3; i++) {
    const lease = await reserveAiRequest(db, 'owner', now);
    assert.equal(lease.allowed, true);
    await releaseAiRequest(db, lease);
  }
  assert.equal((await reserveAiRequest(db, 'owner', now)).allowed, false);
  assert.equal((await reserveAiRequest(db, 'other', now)).allowed, true);
  assert.equal((await reserveAiRequest(db, 'owner', now + 120_001)).allowed, true);
});

test('falha de geração libera concorrência e falha do limitador impede chamada externa', async () => {
  const res = response();
  await assert.rejects(withAiRateLimit(db, 'owner', res, async () => { throw new Error('failed'); }));
  assert.deepEqual([...records.values()][0].leases, {});
  let called = false;
  const broken = { ...db, runTransaction: async () => { throw new Error('offline'); } };
  const unavailable = response();
  await withAiRateLimit(broken, 'owner', unavailable, async () => { called = true; });
  assert.equal(unavailable.code, 503);
  assert.equal(called, false);
});

test('limite por hora permanece entre minutos e leases abandonados expiram', async () => {
  const start = 3_600_000;
  for (let minute = 0; minute < 10; minute++) {
    for (let count = 0; count < 6; count++) {
      const lease = await reserveAiRequest(db, 'owner', start + minute * 60_000);
      assert.equal(lease.allowed, true);
      await releaseAiRequest(db, lease);
    }
  }
  assert.equal((await reserveAiRequest(db, 'owner', start + 11 * 60_000)).allowed, false);
  assert.equal((await reserveAiRequest(db, 'owner', start + 3_600_000)).allowed, true);
  assert.equal((await reserveAiRequest(db, 'crashed-process', start)).allowed, true);
  assert.equal((await reserveAiRequest(db, 'crashed-process', start)).allowed, true);
  assert.equal((await reserveAiRequest(db, 'crashed-process', start + 30_000)).allowed, false);
  assert.equal((await reserveAiRequest(db, 'crashed-process', start + 120_001)).allowed, true);
});

test('gravação direta de backup e privilégios permanece negada nas regras', async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /allow create, update: if false/);
  assert.match(rules, /allow write: if false/);
});
