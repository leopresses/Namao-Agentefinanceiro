import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';

export default function PwaPrompt() {
  const [isOpen, setIsOpen] = useState(false);
  const [deviceType, setDeviceType] = useState('unknown'); // 'ios' | 'android' | 'desktop'
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // Detecta o dispositivo
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) {
      setDeviceType('ios');
    } else if (/android/i.test(ua)) {
      setDeviceType('android');
    } else {
      setDeviceType('desktop');
    }

    // Verifica se já viu o prompt recentemente (não incomodar)
    const hasDismissed = sessionStorage.getItem('namao_pwa_dismissed');
    
    // Para Android/Desktop (Captura o evento nativo de PWA)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!hasDismissed) {
        setIsOpen(true);
      }
    });

    // Para iOS (Se estiver rodando no navegador e não como PWA instalado)
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    if (deviceType === 'ios' && !isStandalone && !hasDismissed) {
      // Pequeno delay para não assustar no primeiro load
      setTimeout(() => setIsOpen(true), 3000);
    }

    // Listener para o botão de Configurações ativar manualmente
    const handleManualTrigger = () => setIsOpen(true);
    window.addEventListener('trigger-pwa-prompt', handleManualTrigger);

    return () => window.removeEventListener('trigger-pwa-prompt', handleManualTrigger);
  }, [deviceType]);

  const handleClose = () => {
    setIsOpen(false);
    sessionStorage.setItem('namao_pwa_dismissed', 'true');
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsOpen(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '100px', // Fica acima da BottomNav
      left: '24px',
      right: '24px',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(16px)',
      border: '1px solid var(--color-emerald-primary)',
      borderRadius: '24px',
      padding: '20px',
      boxShadow: '0 8px 32px rgba(16, 185, 129, 0.2)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      animation: 'fadeUp 0.5s ease forwards'
    }}>
      <button 
        onClick={handleClose}
        style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}
      >
        <X size={20} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img src="/logo.png" alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '10px' }} />
        <div>
          <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem' }}>Instalar NaMão</h4>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Acesso rápido offline</p>
        </div>
      </div>

      {deviceType === 'ios' ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.5', background: 'rgba(15, 23, 42, 0.05)', padding: '12px', borderRadius: '12px' }}>
          Para instalar no iPhone:<br/>
          1. Toque no ícone Compartilhar <Share size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /><br/>
          2. Role e toque em <strong>"Adicionar à Tela de Início"</strong> <PlusSquare size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
        </div>
      ) : (
        <button onClick={handleInstallClick} className="btn-primary" style={{ width: '100%', padding: '12px' }}>
          <Download size={18} /> Adicionar à Tela Inicial
        </button>
      )}
    </div>
  );
}
