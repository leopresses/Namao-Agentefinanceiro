import React, { useState, useEffect } from 'react';
import { Fingerprint } from 'lucide-react';

export default function BiometricLock({ children, requireLock }) {
  const [unlocked, setUnlocked] = useState(!requireLock);
  const [error, setError] = useState('');

  useEffect(() => {
    if (requireLock) {
      handleBiometricUnlock();
    }
  }, [requireLock]);

  const handleBiometricUnlock = async () => {
    try {
      if (!window.PublicKeyCredential) {
        setUnlocked(true); // Fallback
        return;
      }
      
      // Simulando uma chamada WebAuthn local genérica
      // Na vida real o app precisa de um backend para validar o challenge, 
      // mas podemos chamar navigator.credentials.get para forçar o SO a pedir a biometria
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      
      await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          timeout: 60000,
          userVerification: "required"
        }
      });
      
      setUnlocked(true);
    } catch (err) {
      console.error('Biometria falhou', err);
      setError('Falha ao reconhecer biometria. Tente novamente.');
    }
  };

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
      
      <button onClick={handleBiometricUnlock} className="btn-primary" style={{ width: '100%', maxWidth: '300px' }}>
        Desbloquear
      </button>
    </div>
  );
}
