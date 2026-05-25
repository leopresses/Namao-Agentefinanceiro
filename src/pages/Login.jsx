import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithGoogle } from '../services/firebase';

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      const user = await loginWithGoogle();
      localStorage.setItem('namao_auth_token', 'google');
      localStorage.setItem('namao_user_uid', user.uid);
      localStorage.setItem('namao_user_name', user.displayName || '');
      localStorage.setItem('namao_user_photo', user.photoURL || '');
      navigate('/');
    } catch (err) {
      console.error('Firebase Auth Error:', err);
      const code = err?.code || '';
      let msg = 'Erro ao autenticar com o Google.';
      if (code === 'auth/popup-closed-by-user') {
        msg = 'Você fechou a janela de login antes de finalizar.';
      } else if (code === 'auth/popup-blocked') {
        msg = 'O navegador bloqueou o popup. Permita popups para este site.';
      } else if (code === 'auth/unauthorized-domain') {
        msg = 'Este domínio não está autorizado no Firebase. Adicione "localhost" nos domínios autorizados.';
      } else if (code === 'auth/configuration-not-found') {
        msg = 'O provedor Google não está ativado no Firebase Console.';
      } else if (code) {
        msg = `Erro Firebase: ${code}`;
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: '-24px', padding: '24px' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', background: 'rgba(255,255,255,0.9)' }}>
        <img src="/app_icon.png" alt="NaMão Logo" style={{ width: '80px', height: '80px', marginBottom: '8px', filter: 'drop-shadow(0 4px 6px rgba(16, 185, 129, 0.2))' }} />
        <h1 className="app-title" style={{ fontSize: '2.5rem', marginBottom: '8px', color: 'var(--color-emerald-primary)', justifyContent: 'center' }}>NaMão</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Seu Agente Financeiro Pessoal</p>
        
        <div style={{ display: 'inline-block', padding: '6px 12px', borderRadius: '16px', background: 'rgba(16,185,129,0.1)', color: 'var(--color-emerald-dark)', fontSize: '0.75rem', fontWeight: '600', marginBottom: '24px' }}>
          ☁️ Backup em Nuvem Integrado
        </div>

        {error && <p style={{ color: 'var(--color-crimson-dark)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>}

        <button 
          onClick={handleGoogleLogin} 
          disabled={isLoading}
          style={{ 
            width: '100%', 
            padding: '16px 24px', 
            borderRadius: '16px', 
            background: '#FFF', 
            color: '#333', 
            border: '1px solid #ddd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: isLoading ? 'wait' : 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            transition: 'all 0.3s ease',
            opacity: isLoading ? 0.7 : 1
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          {isLoading ? 'Conectando...' : 'Entrar com Google'}
        </button>
        
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '24px', lineHeight: '1.5' }}>
          Use o Google para sincronizar seus dados em tempo real e nunca perder nenhum lançamento.
        </p>
      </div>
    </div>
  );
}
