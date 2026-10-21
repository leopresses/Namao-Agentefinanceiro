import { useState, useEffect, useCallback, useRef } from 'react';
import { getExpenses, getBudgets, getGoals } from '../services/db';
import { getAllChats } from '../services/chatDb';
import { BackupConflictError, getSecureUserId, getUserProStatus, onAuthChange, saveCloudBackup } from '../services/firebase';
import { ensureLocalAccount, getAccountSetting, setAccountSetting } from '../services/accountScope';
import { IS_LOCAL_TEST_MODE } from '../config/environment';

export function useAutoSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('idle');
  const syncingRef = useRef(false);
  const syncQueuedRef = useRef(false);

  const doSync = useCallback(async () => {
    if (IS_LOCAL_TEST_MODE) {
      setSyncStatus('idle');
      return;
    }

    if (syncingRef.current) {
      syncQueuedRef.current = true;
      return;
    }

    const uid = getSecureUserId();
    if (!uid) return;

    if (getAccountSetting('namao_backup_conflict', uid) === 'true') {
      setSyncStatus('conflict');
      return;
    }

    // Depois de "Apagar dados locais", preservamos o último backup até que
    // a pessoa escolha explicitamente restaurá-lo ou fazer um novo backup.
    // Isso impede que uma base vazia substitua a cópia em nuvem sem aviso.
    if (getAccountSetting('namao_cloud_backup_protected', uid) === 'true') {
      setAccountSetting('namao_pending_sync', 'false', uid);
      setSyncStatus('idle');
      return;
    }

    syncingRef.current = true;
    setSyncStatus('syncing');
    try {
      await ensureLocalAccount(uid);
      const proData = await getUserProStatus();
      if (!proData.isPro) {
        setAccountSetting('namao_pending_sync', 'false', uid);
        setSyncStatus('idle');
        return;
      }

      const [expenses, budgets, goals] = await Promise.all([
        getExpenses(),
        getBudgets(),
        getGoals(),
      ]);
      const chats = getAllChats();
      if (getSecureUserId() !== uid) return;
      const revision = await saveCloudBackup(
        expenses, chats, budgets, goals, getAccountSetting('namao_backup_revision', uid)
      );

      setAccountSetting('namao_backup_revision', revision, uid);
      setAccountSetting('namao_pending_sync', 'false', uid);
      const now = new Date().toISOString();
      setAccountSetting('namao_last_sync_time', now, uid);
      window.dispatchEvent(new CustomEvent('namao_sync_completed'));
      setSyncStatus('success');
      window.setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (error) {
      console.error('Erro na sincronização automática:', error);
      setAccountSetting('namao_pending_sync', 'true', uid);
      if (error instanceof BackupConflictError) {
        setAccountSetting('namao_backup_conflict', 'true', uid);
        setSyncStatus('conflict');
      } else {
        setSyncStatus('error');
      }
    } finally {
      syncingRef.current = false;
      if (syncQueuedRef.current && navigator.onLine) {
        syncQueuedRef.current = false;
        doSync();
      }
    }
  }, []);

  useEffect(() => {
    const checkInitialSync = () => {
      if (!navigator.onLine || !getSecureUserId()) return;

      if (getAccountSetting('namao_backup_conflict') === 'true') {
        setSyncStatus('conflict');
        return;
      }
      const lastSync = getAccountSetting('namao_last_sync_time');
      const hasPendingSync = getAccountSetting('namao_pending_sync') === 'true';
      if (hasPendingSync) {
        doSync();
        return;
      }

      // Em um dispositivo novo, nunca enviamos um banco vazio antes do usuário
      // restaurar ou criar o primeiro lançamento.
      if (!lastSync) return;

      const diffMs = Date.now() - new Date(lastSync).getTime();
      if (!Number.isFinite(diffMs) || diffMs >= 86400000) doSync();
    };

    const handleOnline = () => {
      setIsOnline(true);
      if (getSecureUserId() && getAccountSetting('namao_pending_sync') === 'true') doSync();
    };
    const handleOffline = () => setIsOnline(false);
    const handleDataChanged = () => {
      if (!getSecureUserId()) return;
      if (navigator.onLine) doSync();
      else setAccountSetting('namao_pending_sync', 'true');
    };

    const unsubscribe = onAuthChange((user) => {
      if (user) checkInitialSync();
    });
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('namao_data_changed', handleDataChanged);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('namao_data_changed', handleDataChanged);
    };
  }, [doSync]);

  return { isOnline, syncStatus };
}
