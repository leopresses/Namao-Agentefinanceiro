import { useState, useEffect, useCallback } from 'react';
import { getExpenses } from '../services/db';
import { saveCloudBackup } from '../services/firebase';

export function useAutoSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'success', 'error'

  const doSync = useCallback(async () => {
    const userUid = localStorage.getItem('namao_user_uid');
    const isGoogle = localStorage.getItem('namao_auth_token') === 'google';

    if (!isGoogle || !userUid) return;

    setSyncStatus('syncing');
    try {
      const data = await getExpenses();
      await saveCloudBackup(userUid, data);
      localStorage.setItem('namao_pending_sync', 'false');
      
      const now = new Date().toISOString();
      localStorage.setItem('namao_last_sync_time', now);
      window.dispatchEvent(new CustomEvent('namao_sync_completed'));
      
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000); // Volta ao normal após 3 segundos
    } catch (error) {
      console.error('Erro na sincronização oculta:', error);
      setSyncStatus('error');
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Quando volta a internet, verifica se tem pendência
      if (localStorage.getItem('namao_pending_sync') === 'true') {
        doSync();
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleDataChanged = () => {
      if (navigator.onLine) {
        doSync();
      } else {
        localStorage.setItem('namao_pending_sync', 'true');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('namao_data_changed', handleDataChanged);

    // Na inicialização, tenta sincronizar se tiver algo pendente ou se for o backup diário preventivo
    const checkInitialSync = () => {
      if (!navigator.onLine) return;
      
      let needsDailySync = true;
      const lastSyncStr = localStorage.getItem('namao_last_sync_time');
      if (lastSyncStr) {
        const lastSync = new Date(lastSyncStr);
        const diffMs = Date.now() - lastSync.getTime();
        // Se sincronizou há menos de 24h (86400000ms), não precisa de backup diário
        if (diffMs < 86400000) {
          needsDailySync = false;
        }
      }

      if (needsDailySync || localStorage.getItem('namao_pending_sync') === 'true') {
        doSync();
      }
    };

    checkInitialSync();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('namao_data_changed', handleDataChanged);
    };
  }, [doSync]);

  return { isOnline, syncStatus };
}
