import { useCallback, useEffect, useRef, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { logoutGoogle } from '../services/firebase';

export default function BiometricLock({ children, requireLock }) {
  const [unlocked, setUnlocked] = useState(!requireLock);
  const [error, setError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const unlockInProgress = useRef(false);
  const lockVersion = useRef(0);

  const handleBiometricUnlock = useCallback(async () => {
    if (unlockInProgress.current) return;

    unlockInProgress.current = true;
    const requestLockVersion = lockVersion.current;
    setIsUnlocking(true);
    setError('');
    try {
      if (!window.PublicKeyCredential || !navigator.credentials?.get) {
        setError('Este navegador não suporta biometria. Entre novamente para desativar o App Lock.');
        return;
      }
      const savedIdStr = localStorage.getItem('namao_biometric_id');
      if (!savedIdStr) {
        setError('A credencial biométrica não foi encontrada neste dispositivo.');
        return;
      }

      const savedIdArray = JSON.parse(savedIdStr);
      if (!Array.isArray(savedIdArray) || savedIdArray.length === 0) {
        throw new Error('Credencial biométrica inválida');
      }
      const credIdBuffer = new Uint8Array(savedIdArray);
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{
            id: credIdBuffer,
            type: 'public-key',
            transports: ['internal'],
          }],
          timeout: 60000,
          userVerification: 'required',
        },
      });

      if (!credential) throw new Error('Biometria não confirmada');
      if (requestLockVersion !== lockVersion.current || document.visibilityState === 'hidden') return;

      setUnlocked(true);
    } catch (err) {
      console.error('Biometria falhou', err);
      setError('Falha ao reconhecer biometria. Tente novamente.');
    } finally {
      unlockInProgress.current = false;
      setIsUnlocking(false);
    }
  }, []);

  useEffect(() => {
    if (!requireLock) {
      setUnlocked(true);
      return undefined;
    }

    const lockApp = () => {
      lockVersion.current += 1;
      setUnlocked(false);
    };
    const lockWhenBackgrounded = () => {
      if (document.visibilityState === 'hidden') lockApp();
    };

    setUnlocked(false);
    handleBiometricUnlock();
    document.addEventListener('visibilitychange', lockWhenBackgrounded);
    window.addEventListener('pagehide', lockApp);

    return () => {
      document.removeEventListener('visibilitychange', lockWhenBackgrounded);
      window.removeEventListener('pagehide', lockApp);
    };
  }, [requireLock, handleBiometricUnlock]);

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: '24px', textAlign: 'center'
    }}>
      <div style={{
        width: '80px', height: '80px', borderRadius: '40px', background: 'rgba(16, 185, 129, 0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px'
      }}>
        <Fingerprint size={40} color="var(--color-emerald-primary)" />
      </div>
      <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>App Bloqueado</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        Use sua biometria para acessar o NaMão.
      </p>
      {error && <p style={{ color: 'var(--color-crimson-dark)', marginBottom: '24px', fontSize: '0.9rem' }}>{error}</p>}
      
      <button disabled={isUnlocking} onClick={handleBiometricUnlock} className="btn-primary" style={{ width: '100%', maxWidth: '300px' }}>
        {isUnlocking ? 'Aguardando biometria...' : 'Desbloquear'}
      </button>

      {error && (
        <button 
          onClick={async () => {
            try {
              await logoutGoogle();
            } catch (e) {
              console.error('Erro ao deslogar:', e);
            }
            localStorage.removeItem('namao_biometric');
            localStorage.removeItem('namao_biometric_id');
            localStorage.removeItem('namao_auth_token');
            localStorage.removeItem('namao_local_test_user');
            window.location.href = '/login';
          }}
          style={{ marginTop: '32px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', textDecoration: 'underline', cursor: 'pointer' }}
        >
          Sair da Conta (Recuperação)
        </button>
      )}
    </div>
  );
}
