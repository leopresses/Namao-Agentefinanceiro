import { del, get, set } from 'idb-keyval';
import { auth } from './firebase';
import { IS_LOCAL_TEST_MODE } from '../config/environment';

const LEGACY_IDB_KEYS = ['namao_expenses', 'namao_budgets', 'namao_goals'];
const LEGACY_LOCAL_KEYS = [
  'namao_chats', 'namao_active_chat', 'namao_last_sync_time',
  'namao_pending_sync', 'namao_cloud_backup_protected',
];

// Capturado antes de o login escrever o UID da conta nova. Dados antigos sem
// dono conhecido nunca são vinculados automaticamente a outra conta.
const legacyOwnerAtStartup = localStorage.getItem('namao_user_uid')
  || (localStorage.getItem('namao_local_test_user') === 'true' ? 'local-test' : null);
const preparations = new Map();

export function getCurrentAccountId() {
  if (IS_LOCAL_TEST_MODE && localStorage.getItem('namao_local_test_user') === 'true') {
    return 'local-test';
  }
  return auth.currentUser?.uid || null;
}

export function accountKey(base, accountId = getCurrentAccountId()) {
  if (!accountId) throw new Error('Conta não autenticada para acessar dados locais.');
  return `${base}:${accountId}`;
}

export function getAccountSetting(base, accountId) {
  return localStorage.getItem(accountKey(base, accountId));
}

export function setAccountSetting(base, value, accountId) {
  localStorage.setItem(accountKey(base, accountId), String(value));
}

export function removeAccountSetting(base, accountId) {
  localStorage.removeItem(accountKey(base, accountId));
}

async function copyLegacyData(accountId) {
  for (const base of LEGACY_IDB_KEYS) {
    const oldValue = await get(base);
    if (oldValue !== undefined && await get(accountKey(base, accountId)) === undefined) {
      await set(accountKey(base, accountId), oldValue);
    }
  }
  for (const base of LEGACY_LOCAL_KEYS) {
    const oldValue = localStorage.getItem(base);
    if (oldValue !== null && localStorage.getItem(accountKey(base, accountId)) === null) {
      localStorage.setItem(accountKey(base, accountId), oldValue);
    }
  }
  for (const base of LEGACY_IDB_KEYS) await del(base);
  for (const base of LEGACY_LOCAL_KEYS) localStorage.removeItem(base);
}

export function ensureLocalAccount(accountId = getCurrentAccountId()) {
  if (!accountId) return Promise.reject(new Error('Conta não autenticada.'));
  if (!preparations.has(accountId)) {
    const preparation = legacyOwnerAtStartup === accountId
      ? copyLegacyData(accountId)
      : Promise.resolve();
    preparations.set(accountId, preparation.catch((error) => {
      preparations.delete(accountId);
      throw error;
    }));
  }
  return preparations.get(accountId);
}

export async function hasUnclaimedLegacyData() {
  if (legacyOwnerAtStartup === getCurrentAccountId()) return false;
  for (const base of LEGACY_IDB_KEYS) {
    const data = await get(base);
    if (Array.isArray(data) ? data.length > 0 : data && Object.keys(data).length > 0) return true;
  }
  const chats = localStorage.getItem('namao_chats');
  return !!chats && chats !== '[]';
}

export async function recoverLegacyData() {
  const accountId = getCurrentAccountId();
  if (!accountId) throw new Error('Conta não autenticada.');
  for (const base of LEGACY_IDB_KEYS) {
    const current = await get(accountKey(base, accountId));
    if (Array.isArray(current) ? current.length > 0 : current && Object.keys(current).length > 0) {
      throw new Error('Esta conta já possui dados locais. Restaure os dados antigos antes de criar novos lançamentos.');
    }
  }
  const chats = localStorage.getItem(accountKey('namao_chats', accountId));
  if (chats && chats !== '[]') throw new Error('Esta conta já possui conversas locais.');
  await copyLegacyData(accountId);
  // O backup antigo pode pertencer a outra conta. A importação nunca autoriza
  // um envio automático para a nuvem.
  setAccountSetting('namao_cloud_backup_protected', 'true');
  removeAccountSetting('namao_backup_revision');
  setAccountSetting('namao_pending_sync', 'false');
  window.dispatchEvent(new CustomEvent('namao_data_changed'));
}
