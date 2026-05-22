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

    // Na inicialização, tenta sincronizar se tiver algo pendente
    if (navigator.onLine && localStorage.getItem('namao_pending_sync') === 'true') {
      doSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('namao_data_changed', handleDataChanged);
    };
  }, [doSync]);

  return { isOnline, syncStatus };
}
