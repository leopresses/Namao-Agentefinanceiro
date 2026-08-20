import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDialog } from '../contexts/DialogContext';
import { logoutGoogle, saveCloudBackup, loadCloudBackup, deleteCloudBackup, getUserProStatus, onAuthChange } from '../services/firebase';
import { getExpenses, getBudgets, getGoals, restoreCloudData, clearAllFinancialData } from '../services/db';
import { clearAllChats, getAllChats, setAllChats } from '../services/chatDb';
import { CloudUpload, CloudDownload, LogOut, User, Moon, Sun, Lock, Star, Smartphone, CircleHelp, ShieldCheck } from 'lucide-react';
import AdminPanel from '../components/AdminPanel';

export default function Profile() {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useDialog();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastBackup, setLastBackup] = useState(localStorage.getItem('namao_last_sync_time'));
  const [theme, setTheme] = useState(localStorage.getItem('namao_theme') || 'light');
  const [biometricEnabled, setBiometricEnabled] = useState(localStorage.getItem('namao_biometric') === 'true');
  const [isPro, setIsPro] = useState(localStorage.getItem('namao_is_pro') === 'true');
  const [cloudBackupProtected, setCloudBackupProtected] = useState(localStorage.getItem('namao_cloud_backup_protected') === 'true');
  const { showProModal } = useDialog();

  React.useEffect(() => {
    const handleSyncCompleted = () => {
      setLastBackup(localStorage.getItem('namao_last_sync_time'));
    };
    window.addEventListener('namao_sync_completed', handleSyncCompleted);
    
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
      localStorage.removeItem('namao_is_pro');
      navigate('/login');
    }
  };

  const handleCloudBackup = async () => {
    if (!isGoogle) return;
    if (!isPro) {
      showProModal();
      return;
    }
    setIsSyncing(true);
    try {
      const expenses = await getExpenses();
      const chats = getAllChats();
      const budgets = await getBudgets();
      const goals = await getGoals();
      await saveCloudBackup(expenses, chats, budgets, goals);
      const now = new Date().toISOString();
      localStorage.removeItem('namao_cloud_backup_protected');
      localStorage.setItem('namao_last_sync_time', now);
      setCloudBackupProtected(false);
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
          await restoreCloudData({
            expenses: cloudData.expenses,
            budgets: cloudData.budgets,
            goals: cloudData.goals
          });
          if (cloudData.chats) {
            setAllChats(cloudData.chats);
          }
          localStorage.removeItem('namao_cloud_backup_protected');
          setCloudBackupProtected(false);
          showAlert('Sucesso', 'Dados, orçamentos, metas e conversas restaurados da nuvem com sucesso!');
        } else {
          showAlert('Aviso', 'Não há dados salvos na sua nuvem ainda.');
        }
      } catch (err) {
        console.error(err);
        showAlert('Erro', 'Ocorreu um erro ao restaurar os dados.');
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleDeleteCloudBackup = async () => {
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
      localStorage.setItem('namao_cloud_backup_protected', 'true');
      localStorage.removeItem('namao_last_sync_time');
      localStorage.setItem('namao_pending_sync', 'false');
      setCloudBackupProtected(true);
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
      localStorage.setItem('namao_cloud_backup_protected', 'true');
      localStorage.setItem('namao_pending_sync', 'false');
      setCloudBackupProtected(true);
    }

    await clearAllFinancialData();
    clearAllChats();
    showAlert('Sucesso', 'Todos os dados locais foram apagados.');
    setTimeout(() => window.location.reload(), 1500);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('namao_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleInstallApp = () => {
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    if (isInstalled) {
      showAlert('App já instalado', 'O NaMão já está disponível na sua tela inicial.');
      return;
    }

    window.dispatchEvent(new CustomEvent('trigger-pwa-prompt'));
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

// Funções antigas de JSON removidas

  return (
    <div style={{ paddingBottom: '80px' }} className="animate-fade-up">
      <header className="app-header glass" style={{ borderRadius: '0 0 24px 24px', margin: '-24px -24px 24px -24px' }}>
        <h1 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Configurações</h1>
      </header>

      {/* Perfil do Usuário */}
      {isGoogle ? (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '16px', marginBottom: '24px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '40px', overflow: 'hidden', border: '3px solid var(--color-emerald-primary)', marginBottom: '16px' }}>
            {userPhoto ? (
              <img src={userPhoto} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'rgba(16,185,129,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <User size={40} color="var(--color-emerald-primary)" />
              </div>
            )}
          </div>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '4px' }}>{userName}</h2>
          <p style={{ color: 'var(--color-emerald-dark)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '16px' }}>Conectado via Google</p>
          
          {isPro ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 215, 0, 0.15)', color: '#D4AF37', padding: '8px 20px', borderRadius: '24px', fontWeight: 'bold', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
              <Star size={18} fill="currentColor" /> NaMão PRO
            </div>
          ) : (
            <button 
              onClick={showProModal}
              className="animate-pulse-glow"
              style={{ 
                display: 'flex', alignItems: 'center', gap: '8px', 
                background: 'linear-gradient(135deg, var(--color-emerald-primary) 0%, var(--color-emerald-dark) 100%)', 
                color: 'white', padding: '12px 32px', borderRadius: '30px', 
                fontWeight: 'bold', fontSize: '1.1rem', border: 'none', cursor: 'pointer', 
                boxShadow: '0 8px 24px rgba(16,185,129,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px'
              }}
            >
              <Star size={20} fill="currentColor" /> Seja PRO Agora
            </button>
          )}
        </div>
      ) : (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '16px', marginBottom: '24px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '40px', background: 'rgba(15, 23, 42, 0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '16px' }}>
            <User size={40} color="var(--text-secondary)" />
          </div>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '4px' }}>Conta Local</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Autenticação por Senha</p>
        </div>
      )}

      {/* Sincronização em Nuvem (apenas Google) */}
      {isGoogle && (
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ☁️ Sincronização em Nuvem
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Mantenha seus dados seguros na nuvem do Google. Recurso exclusivo para assinantes PRO.
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-emerald-primary)', fontWeight: '600', marginBottom: '24px' }}>
            Último backup: {formatTime(lastBackup)}
          </p>
          {cloudBackupProtected && (
            <p style={{ fontSize: '0.78rem', color: 'var(--color-crimson-dark)', margin: '-12px 0 18px' }}>
              A sincronização automática está pausada para preservar sua cópia em nuvem. Faça um backup manual quando quiser substituí-la.
            </p>
          )}

          <button 
            onClick={handleCloudBackup} 
            disabled={isSyncing}
            className="btn-primary" 
            style={{ width: '100%', marginBottom: '16px', display: 'flex', justifyContent: 'center', gap: '12px' }}
          >
            <CloudUpload size={20} />
            {isSyncing ? 'Sincronizando...' : 'Fazer Backup na Nuvem'}
          </button>

          <button 
            onClick={handleCloudRestore} 
            disabled={isSyncing}
            style={{ 
              width: '100%', padding: '16px', borderRadius: '16px', 
              border: '1px solid rgba(16, 185, 129, 0.3)', background: 'transparent',
              color: 'var(--color-emerald-dark)', fontWeight: '600',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: 'pointer'
            }}
          >
            <CloudDownload size={20} />
            {isSyncing ? 'Sincronizando...' : 'Restaurar da Nuvem'}
          </button>

          <button
            type="button"
            onClick={handleDeleteCloudBackup}
            disabled={isSyncing}
            style={{
              width: '100%', padding: '14px', borderRadius: '16px', marginTop: '12px',
              border: '1px solid rgba(244, 63, 94, 0.35)', background: 'transparent',
              color: 'var(--color-crimson-dark)', fontWeight: '600', cursor: 'pointer'
            }}
          >
            Excluir Backup da Nuvem
          </button>
        </div>
      )}

      {/* Planejamento */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          📈 Planejamento
        </h3>
        
        <div 
          onClick={() => navigate('/budgets')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--glass-border)', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '1.2rem' }}>🎯</span>
            </div>
            <div>
              <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>Limites de Orçamento</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Defina teto de gastos mensais</div>
            </div>
          </div>
          <span style={{ color: 'var(--text-tertiary)' }}>{'>'}</span>
        </div>

        <div 
          onClick={() => navigate('/goals')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '1.2rem' }}>🐷</span>
            </div>
            <div>
              <div style={{ color: 'var(--text-primary)', fontWeight: '500' }}>Metas Financeiras</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Acompanhe seus cofrinhos e sonhos</div>
            </div>
          </div>
          <span style={{ color: 'var(--text-tertiary)' }}>{'>'}</span>
        </div>
      </div>

      {/* Aparência e Segurança */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⚙️ Ajustes do App
        </h3>
        
        <div 
          onClick={toggleTheme}
          style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            padding: '16px', background: 'var(--bg-secondary)', borderRadius: '16px', 
            marginBottom: '12px', cursor: 'pointer', border: '1px solid var(--glass-border)' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {theme === 'dark' ? <Moon size={24} color="var(--color-emerald-primary)" /> : <Sun size={24} color="var(--color-emerald-primary)" />}
            <div>
              <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem' }}>Modo Escuro</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Economiza bateria e protege os olhos</p>
            </div>
          </div>
          <div style={{
            width: '50px', height: '28px', borderRadius: '14px',
            background: theme === 'dark' ? 'var(--color-emerald-primary)' : '#ccc',
            position: 'relative', transition: '0.3s'
          }}>
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%', background: '#fff',
              position: 'absolute', top: '2px', left: theme === 'dark' ? '24px' : '2px',
              transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }} />
          </div>
        </div>

        <div 
          onClick={toggleBiometric}
          style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            padding: '16px', background: 'var(--bg-secondary)', borderRadius: '16px', 
            cursor: 'pointer', border: '1px solid var(--glass-border)' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Lock size={24} color={biometricEnabled ? 'var(--color-emerald-primary)' : 'var(--text-secondary)'} />
            <div>
              <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem' }}>App Lock</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Exigir Biometria ao abrir o app</p>
            </div>
          </div>
          <div style={{
            width: '50px', height: '28px', borderRadius: '14px',
            background: biometricEnabled ? 'var(--color-emerald-primary)' : '#ccc',
            position: 'relative', transition: '0.3s'
          }}>
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%', background: '#fff',
              position: 'absolute', top: '2px', left: biometricEnabled ? '24px' : '2px',
              transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }} />
          </div>
        </div>

        <button
          type="button"
          onClick={handleInstallApp}
          style={{
            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px', background: 'var(--bg-secondary)', borderRadius: '16px',
            cursor: 'pointer', border: '1px solid var(--glass-border)', marginTop: '12px', textAlign: 'left'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Smartphone size={24} color="var(--color-emerald-primary)" />
            <span>
              <span style={{ display: 'block', color: 'var(--text-primary)', fontWeight: '500', fontSize: '1rem' }}>Adicionar à Tela Inicial</span>
              <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Instale o app no seu iPhone ou Android</span>
            </span>
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>{'>'}</span>
        </button>
      </div>

      <AdminPanel showAlert={showAlert} showConfirm={showConfirm} />

      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} color="var(--color-emerald-primary)" /> Ajuda e privacidade
        </h3>
        <button type="button" onClick={() => navigate('/help')} style={{ width: '100%', justifyContent: 'space-between', padding: '13px 0', background: 'transparent', color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><CircleHelp size={19} color="var(--color-emerald-primary)" /> Central de Ajuda</span>
          <span style={{ color: 'var(--text-tertiary)' }}>{'>'}</span>
        </button>
        <button type="button" onClick={() => navigate('/privacy')} style={{ width: '100%', justifyContent: 'space-between', padding: '13px 0 0', background: 'transparent', color: 'var(--text-primary)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><ShieldCheck size={19} color="var(--color-emerald-primary)" /> Política de Privacidade</span>
          <span style={{ color: 'var(--text-tertiary)' }}>{'>'}</span>
        </button>
      </div>

      {/* Danger Zone */}
      <div className="glass-card" style={{ marginBottom: '24px', background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
        <h3 style={{ marginBottom: '8px', color: 'var(--color-crimson-dark)' }}>⚠️ Zona de Perigo</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Isso apagará rendas, despesas, orçamentos, metas e conversas salvos neste dispositivo. Use apenas se precisar "zerar" o aplicativo.
        </p>
        <button 
          onClick={handleResetLocalData}
          className="btn-danger" 
          style={{ width: '100%', background: 'var(--color-crimson-dark)' }}
        >
          Apagar Tudo e Começar do Zero
        </button>
      </div>

      {/* Sair */}
      <button 
        onClick={handleLogout} 
        className="btn-danger" 
        style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}
      >
        <LogOut size={20} /> Sair do Aplicativo
      </button>
    </div>
  );
}
