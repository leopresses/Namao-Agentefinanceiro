import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDialog } from '../contexts/DialogContext';
import { logoutGoogle, saveCloudBackup, loadCloudBackup } from '../services/firebase';
import { getExpenses, setExpensesData, clearAllExpenses } from '../services/db';
import { CloudUpload, CloudDownload, LogOut, User } from 'lucide-react';

export default function Profile() {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useDialog();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastBackup, setLastBackup] = useState(localStorage.getItem('namao_last_sync_time'));

  React.useEffect(() => {
    const handleSyncCompleted = () => {
      setLastBackup(localStorage.getItem('namao_last_sync_time'));
    };
    window.addEventListener('namao_sync_completed', handleSyncCompleted);
    return () => window.removeEventListener('namao_sync_completed', handleSyncCompleted);
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
  const userUid = localStorage.getItem('namao_user_uid');

  const handleLogout = async () => {
    const confirmed = await showConfirm('Sair', 'Deseja mesmo sair do aplicativo?');
    if (confirmed) {
      if (isGoogle) {
        try { await logoutGoogle(); } catch (e) { /* ignore */ }
      }
      localStorage.removeItem('namao_auth_token');
      localStorage.removeItem('namao_user_uid');
      localStorage.removeItem('namao_user_name');
      localStorage.removeItem('namao_user_photo');
      navigate('/login');
    }
  };

  const handleCloudBackup = async () => {
    if (!isGoogle || !userUid) return;
    setIsSyncing(true);
    try {
      const data = await getExpenses();
      await saveCloudBackup(userUid, data);
      showAlert('Sucesso', 'Seus dados foram salvos com segurança na nuvem do Google!');
    } catch (err) {
      console.error(err);
      showAlert('Erro', 'Ocorreu um erro ao salvar na nuvem. Verifique sua conexão.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCloudRestore = async () => {
    if (!isGoogle || !userUid) return;
    const confirmed = await showConfirm(
      'Restaurar da Nuvem', 
      'Atenção: Isso vai substituir seus dados atuais pelos que estão salvos na Nuvem. Deseja continuar?'
    );
    if (confirmed) {
      setIsSyncing(true);
      try {
        const cloudData = await loadCloudBackup(userUid);
        if (cloudData.length > 0) {
          await setExpensesData(cloudData);
          showAlert('Sucesso', 'Dados restaurados da nuvem com sucesso!');
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
          <p style={{ color: 'var(--color-emerald-dark)', fontSize: '0.85rem', fontWeight: '600' }}>Conectado via Google</p>
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
            Mantenha seus dados seguros na nuvem do Google. Ideal para trocar de celular sem perder nada.
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-emerald-primary)', fontWeight: '600', marginBottom: '24px' }}>
            Último backup: {formatTime(lastBackup)}
          </p>

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
        </div>
      )}





      {/* Danger Zone */}
      <div className="glass-card" style={{ marginBottom: '24px', background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
        <h3 style={{ marginBottom: '8px', color: 'var(--color-crimson-dark)' }}>⚠️ Zona de Perigo</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Isso apagará todos os seus lançamentos locais permanentemente. Use apenas se precisar "zerar" o aplicativo.
        </p>
        <button 
          onClick={async () => {
            const confirmed = await showConfirm('ZERAR TUDO', 'Atenção: Isso vai APAGAR TODAS AS RENDAS E DESPESAS! Não tem como desfazer. Deseja mesmo continuar?');
            if (confirmed) {
              await clearAllExpenses();
              showAlert('Sucesso', 'Todos os dados foram apagados.');
              setTimeout(() => window.location.reload(), 1500);
            }
          }} 
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
