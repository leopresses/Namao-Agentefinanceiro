import { useState, useEffect, useCallback, useRef } from 'react';
import { getExpenses, getBudgets, getGoals } from '../services/db';
import { getAllChats } from '../services/chatDb';
import { getSecureUserId, getUserProStatus, onAuthChange, saveCloudBackup } from '../services/firebase';

export function useAutoSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('idle');
  const syncingRef = useRef(false);
  const syncQueuedRef = useRef(false);

  const doSync = useCallback(async () => {
    if (syncingRef.current) {
      syncQueuedRef.current = true;
      return;
    }

    const uid = getSecureUserId();
    if (!uid) {
      localStorage.setItem('namao_pending_sync', 'true');
      return;
    }

    // Depois de "Apagar dados locais", preservamos o último backup até que
    // a pessoa escolha explicitamente restaurá-lo ou fazer um novo backup.
    // Isso impede que uma base vazia substitua a cópia em nuvem sem aviso.
    if (localStorage.getItem('namao_cloud_backup_protected') === 'true') {
      localStorage.setItem('namao_pending_sync', 'false');
      setSyncStatus('idle');
      return;
    }

    syncingRef.current = true;
    setSyncStatus('syncing');
    try {
      const proData = await getUserProStatus();
      if (!proData.isPro) {
        localStorage.setItem('namao_pending_sync', 'false');
        setSyncStatus('idle');
        return;
      }

      const [expenses, budgets, goals] = await Promise.all([
        getExpenses(),
        getBudgets(),
        getGoals(),
      ]);
      const chats = getAllChats();
      await saveCloudBackup(expenses, chats, budgets, goals);

      localStorage.setItem('namao_pending_sync', 'false');
      const now = new Date().toISOString();
      localStorage.setItem('namao_last_sync_time', now);
      window.dispatchEvent(new CustomEvent('namao_sync_completed'));
      setSyncStatus('success');
      window.setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (error) {
      console.error('Erro na sincronização automática:', error);
      localStorage.setItem('namao_pending_sync', 'true');
      setSyncStatus('error');
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

      const lastSync = localStorage.getItem('namao_last_sync_time');
      const hasPendingSync = localStorage.getItem('namao_pending_sync') === 'true';
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
      if (localStorage.getItem('namao_pending_sync') === 'true') doSync();
    };
    const handleOffline = () => setIsOnline(false);
    const handleDataChanged = () => {
      if (navigator.onLine) doSync();
      else localStorage.setItem('namao_pending_sync', 'true');
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
