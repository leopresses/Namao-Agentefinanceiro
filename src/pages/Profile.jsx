import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDialog } from '../contexts/DialogContext';
import { BackupConflictError, getCachedProStatus, logoutGoogle, saveCloudBackup, loadCloudBackup, deleteCloudBackup, getUserProStatus, onAuthChange } from '../services/firebase';
import { getExpenses, getBudgets, getGoals, restoreCloudData, clearAllFinancialData } from '../services/db';
import { clearAllChats, getAllChats, setAllChats } from '../services/chatDb';
import { ensureLocalAccount, getAccountSetting, hasUnclaimedLegacyData, recoverLegacyData, removeAccountSetting, setAccountSetting } from '../services/accountScope';
import ProfileView from '../components/ProfileView';
import AdminPanel from '../components/AdminPanel';
import { applyTheme, getStoredTheme } from '../utils/theme';
import { IS_LOCAL_TEST_MODE } from '../config/environment';
import {
  areBrowserNotificationsAvailable,
  getBrowserNotificationPermission,
  getProNotificationsEnabled,
  setProNotificationsEnabled,
} from '../utils/proNotifications';

export default function Profile() {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useDialog();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastBackup, setLastBackup] = useState(() => getAccountSetting('namao_last_sync_time'));
  const [theme, setTheme] = useState(getStoredTheme);
  const [biometricEnabled, setBiometricEnabled] = useState(localStorage.getItem('namao_biometric') === 'true');
  const [isPro, setIsPro] = useState(getCachedProStatus);
  const [cloudBackupProtected, setCloudBackupProtected] = useState(() => getAccountSetting('namao_cloud_backup_protected') === 'true');
  const [backupConflict, setBackupConflict] = useState(() => getAccountSetting('namao_backup_conflict') === 'true');
  const [legacyAvailable, setLegacyAvailable] = useState(false);
  const [proNotificationsEnabled, setProNotificationsEnabledState] = useState(getProNotificationsEnabled);
  const { showProModal } = useDialog();

  React.useEffect(() => {
    const handleSyncCompleted = () => {
      setLastBackup(getAccountSetting('namao_last_sync_time'));
    };
    window.addEventListener('namao_sync_completed', handleSyncCompleted);
    hasUnclaimedLegacyData().then(setLegacyAvailable).catch(console.error);
    
    // Load Pro Status exactly when auth is ready
    const unsubscribe = onAuthChange(async (user) => {
      if (user) {
        const status = await getUserProStatus();
        setIsPro(status.isPro);
      }
    });

    return () => {
      window.removeEventListener('namao_sync_completed', handleSyncCompleted);
      unsubscribe();
    };
  }, []);

  const formatTime = (isoString) => {
    if (!isoString) return 'Nunca';
    const d = new Date(isoString);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  const authMethod = localStorage.getItem('namao_auth_token');
  const isGoogle = authMethod === 'google';
  const userName = localStorage.getItem('namao_user_name') || 'Usuário';
  const userPhoto = localStorage.getItem('namao_user_photo');

  const handleLogout = async () => {
    const confirmed = await showConfirm('Sair', 'Deseja mesmo sair do aplicativo?');
    if (confirmed) {
      if (isGoogle) {
        try { await logoutGoogle(); } catch { /* ignore */ }
      }
      localStorage.removeItem('namao_auth_token');
      localStorage.removeItem('namao_user_uid');
      localStorage.removeItem('namao_user_name');
      localStorage.removeItem('namao_user_photo');
      localStorage.removeItem('namao_local_test_user');
      navigate('/login');
    }
  };

  const handleCloudBackup = async () => {
    if (IS_LOCAL_TEST_MODE) {
      showAlert('Teste local', 'O backup em nuvem está desativado nesta versão de teste para proteger os seus dados reais.');
      return;
    }
    if (!isGoogle) return;
    if (!isPro) {
      showProModal();
      return;
    }
    setIsSyncing(true);
    try {
      await ensureLocalAccount();
      const expenses = await getExpenses();
      const chats = getAllChats();
      const budgets = await getBudgets();
      const goals = await getGoals();
      let revision;
      try {
        revision = await saveCloudBackup(
          expenses, chats, budgets, goals, getAccountSetting('namao_backup_revision')
        );
      } catch (error) {
        if (!(error instanceof BackupConflictError)) throw error;
        const replace = await showConfirm(
          'Backup mais recente na nuvem',
          'A cópia na nuvem mudou desde a última sincronização deste dispositivo. Substituí-la pode apagar lançamentos feitos em outro aparelho. Deseja substituir mesmo assim?'
        );
        if (!replace) return;
        revision = await saveCloudBackup(expenses, chats, budgets, goals, error.currentRevision);
      }
      const now = new Date().toISOString();
      setAccountSetting('namao_backup_revision', revision);
      removeAccountSetting('namao_cloud_backup_protected');
      removeAccountSetting('namao_backup_conflict');
      setAccountSetting('namao_pending_sync', 'false');
      setAccountSetting('namao_last_sync_time', now);
      setCloudBackupProtected(false);
      setBackupConflict(false);
      setLastBackup(now);
      showAlert('Sucesso', 'Seus dados, orçamentos, metas e conversas com a IA foram salvos na nuvem do Google!');
    } catch (err) {
      console.error(err);
      showAlert('Erro', 'Ocorreu um erro ao salvar na nuvem. Verifique sua conexão.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCloudRestore = async () => {
    if (IS_LOCAL_TEST_MODE) {
      showAlert('Teste local', 'A restauração da nuvem está desativada nesta versão de teste para proteger os seus dados reais.');
      return;
    }
    if (!isGoogle) return;
    if (!isPro) {
      showProModal();
      return;
    }
    const confirmed = await showConfirm(
      'Restaurar da Nuvem', 
      'Atenção: Isso vai substituir seus dados atuais, orçamentos, metas e conversas com a IA pelos que estão salvos na Nuvem. Deseja continuar?'
    );
    if (confirmed) {
      setIsSyncing(true);
      try {
        const cloudData = await loadCloudBackup();
        const hasBudgets = Object.keys(cloudData.budgets || {}).length > 0;
        const hasGoals = (cloudData.goals || []).length > 0;
        if (cloudData.expenses.length > 0 || cloudData.chats || hasBudgets || hasGoals) {
          setAccountSetting('namao_cloud_backup_protected', 'true');
          await restoreCloudData({
            expenses: cloudData.expenses,
            budgets: cloudData.budgets,
            goals: cloudData.goals
          });
          setAllChats(cloudData.chats || []);
          if (cloudData.revision) setAccountSetting('namao_backup_revision', cloudData.revision);
          else removeAccountSetting('namao_backup_revision');
          removeAccountSetting('namao_backup_conflict');
          setAccountSetting('namao_pending_sync', 'false');
          removeAccountSetting('namao_cloud_backup_protected');
          setCloudBackupProtected(false);
          setBackupConflict(false);
          showAlert('Sucesso', 'Dados, orçamentos, metas e conversas restaurados da nuvem com sucesso!');
        } else {
          showAlert('Aviso', 'Não há dados salvos na sua nuvem ainda.');
        }
      } catch (err) {
        console.error(err);
        setCloudBackupProtected(getAccountSetting('namao_cloud_backup_protected') === 'true');
        showAlert('Erro', 'Ocorreu um erro ao restaurar os dados.');
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleDeleteCloudBackup = async () => {
    if (IS_LOCAL_TEST_MODE) {
      showAlert('Teste local', 'A exclusão do backup em nuvem está desativada nesta versão de teste.');
      return;
    }
    if (!isGoogle) return;
    if (!isPro) {
      showProModal();
      return;
    }

    const confirmed = await showConfirm(
      'Excluir backup da nuvem',
      'Isso apagará somente a cópia salva na nuvem. Os dados deste dispositivo serão mantidos e a sincronização automática ficará pausada até você fazer um novo backup manual. Deseja continuar?'
    );
    if (!confirmed) return;

    setIsSyncing(true);
    try {
      await deleteCloudBackup();
      setAccountSetting('namao_cloud_backup_protected', 'true');
      removeAccountSetting('namao_last_sync_time');
      removeAccountSetting('namao_backup_revision');
      removeAccountSetting('namao_backup_conflict');
      setAccountSetting('namao_pending_sync', 'false');
      setCloudBackupProtected(true);
      setBackupConflict(false);
      setLastBackup(null);
      showAlert('Backup excluído', 'A cópia em nuvem foi excluída. Seus dados locais continuam neste dispositivo.');
    } catch (err) {
      console.error(err);
      showAlert('Erro', 'Não foi possível excluir o backup da nuvem agora.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetLocalData = async () => {
    // Mesmo uma conta que hoje não é PRO pode ter um backup de uma assinatura
    // anterior. Por segurança, nunca deixamos o reset local sobrescrevê-lo.
    const preservesCloud = isGoogle;
    const cloudMessage = preservesCloud
      ? ' Seu backup na nuvem será preservado e a sincronização automática ficará pausada até você restaurar ou fizer um novo backup manual.'
      : '';
    const confirmed = await showConfirm(
      'ZERAR DADOS LOCAIS',
      `Atenção: isso apagará rendas, despesas, orçamentos, metas e conversas deste dispositivo. Não tem como desfazer.${cloudMessage}`
    );
    if (!confirmed) return;

    if (preservesCloud) {
      setAccountSetting('namao_cloud_backup_protected', 'true');
      setAccountSetting('namao_pending_sync', 'false');
      setCloudBackupProtected(true);
    }

    await clearAllFinancialData();
    clearAllChats();
    showAlert('Sucesso', 'Todos os dados locais foram apagados.');
    setTimeout(() => window.location.reload(), 1500);
  };

  const handleRecoverLegacyData = async () => {
    const confirmed = await showConfirm(
      'Recuperar dados antigos',
      'Este navegador guarda dados de uma versão anterior sem identificação de conta. Importe-os somente se forem seus. A sincronização ficará pausada até você decidir restaurar ou substituir o backup na nuvem. Deseja importar?'
    );
    if (!confirmed) return;
    try {
      await recoverLegacyData();
      setLegacyAvailable(false);
      setCloudBackupProtected(true);
      showAlert('Dados recuperados', 'Os dados foram associados a esta conta neste dispositivo.');
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      showAlert('Não foi possível recuperar', error.message);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('namao_theme', newTheme);
    applyTheme(newTheme);
  };

  const handleInstallApp = () => {
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    if (isInstalled) {
      showAlert('App já instalado', 'O NaMão já está disponível na sua tela inicial.');
      return;
    }

    window.dispatchEvent(new CustomEvent('trigger-pwa-prompt'));
  };

  const handleProNotifications = async () => {
    if (!isPro) {
      showProModal();
      return;
    }

    if (!areBrowserNotificationsAvailable()) {
      showAlert('Não compatível', 'Este navegador não oferece notificações. Você ainda verá os alertas dentro do NaMão.');
      return;
    }

    if (proNotificationsEnabled) {
      setProNotificationsEnabled(false);
      setProNotificationsEnabledState(false);
      showAlert('Alertas pausados', 'Os avisos do navegador foram pausados. Você pode reativá-los quando quiser.');
      return;
    }

    let permission = getBrowserNotificationPermission();
    if (permission === 'default') {
      permission = await window.Notification.requestPermission();
    }

    if (permission !== 'granted') {
      showAlert('Permissão necessária', 'Para receber os avisos, permita notificações do NaMão nas configurações do navegador.');
      return;
    }

    setProNotificationsEnabled(true);
    setProNotificationsEnabledState(true);
    try {
      new window.Notification('Alertas do NaMão ativados', {
        body: 'Você receberá avisos de vencimentos e do limite do orçamento ao abrir o app.',
        icon: '/logo.png?v=20260901',
        tag: 'namao-alerts-enabled',
      });
    } catch (error) {
      console.warn('Permissão concedida, mas o aviso de confirmação não pôde ser exibido:', error);
    }
    showAlert('Alertas ativados', 'Vamos avisar sobre vencimentos próximos e limites de orçamento quando você abrir o NaMão.');
  };

  const toggleBiometric = async () => {
    if (!biometricEnabled) {
      if (window.PublicKeyCredential) {
        try {
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);
          const userId = new Uint8Array(16);
          window.crypto.getRandomValues(userId);

          const credential = await navigator.credentials.create({
            publicKey: {
              challenge: challenge,
              rp: { name: "NaMão App" },
              user: {
                id: userId,
                name: "usuario@namao",
                displayName: "Usuário NaMão"
              },
              pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
              authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "required"
              },
              timeout: 60000
            }
          });

          const credIdArray = Array.from(new Uint8Array(credential.rawId));
          localStorage.setItem('namao_biometric_id', JSON.stringify(credIdArray));

          setBiometricEnabled(true);
          localStorage.setItem('namao_biometric', 'true');
          showAlert('Sucesso', 'O App Lock Biométrico foi ativado! Da próxima vez que abrir, pediremos sua digital ou FaceID.');
        } catch (err) {
          console.error('Falha ao registrar biometria', err);
          showAlert('Erro', 'Ocorreu um erro ou você cancelou o registro da biometria.');
        }
      } else {
        showAlert('Erro', 'Seu dispositivo ou navegador não suporta biometria (WebAuthn).');
      }
    } else {
      setBiometricEnabled(false);
      localStorage.removeItem('namao_biometric');
      localStorage.removeItem('namao_biometric_id');
      showAlert('Aviso', 'O App Lock Biométrico foi desativado.');
    }
  };

  return <ProfileView
    account={{ isGoogle, name: userName, photo: userPhoto, isPro }}
    backup={{
      busy: isSyncing, lastTime: lastBackup ? formatTime(lastBackup) : null,
      protected: cloudBackupProtected, conflict: backupConflict,
      legacyAvailable, localTest: IS_LOCAL_TEST_MODE,
    }}
    settings={{ theme, biometric: biometricEnabled, notifications: proNotificationsEnabled }}
    actions={{
      cloudBackup: handleCloudBackup, cloudRestore: handleCloudRestore,
      cloudDelete: handleDeleteCloudBackup, resetLocal: handleResetLocalData,
      recoverLegacy: handleRecoverLegacyData, toggleTheme, toggleBiometric,
      toggleNotifications: handleProNotifications, installApp: handleInstallApp,
      logout: handleLogout, showPro: showProModal,
    }}
  >
    <AdminPanel showAlert={showAlert} showConfirm={showConfirm} />
  </ProfileView>;
}
