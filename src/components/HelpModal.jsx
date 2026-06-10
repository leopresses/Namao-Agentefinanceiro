import React, { useState, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';

export default function HelpModal() {
  const [isOpen, setIsOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  useEffect(() => {
    const hasSeenHelp = localStorage.getItem('namao_has_seen_help');
    if (!hasSeenHelp) {
      setIsOpen(true);
      localStorage.setItem('namao_has_seen_help', 'true');
    }
  }, []);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="glass-card"
        style={{
          position: 'fixed',
          top: isDesktop ? 'auto' : '20px',
          bottom: isDesktop ? '24px' : 'auto',
          left: 'auto',
          right: isDesktop ? '32px' : '20px',
          width: '36px',
          height: '36px',
          borderRadius: '18px',
          padding: 0,
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(8px)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--glass-border)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: 'var(--glass-shadow)',
          zIndex: 1000,
          cursor: 'pointer'
        }}
        aria-label="Ajuda"
      >
        <HelpCircle size={20} />
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
      padding: '24px'
    }}>
      <div className="glass-card animate-fade-up" style={{ width: '100%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', background: 'var(--bg-primary)' }}>
        <button 
          onClick={() => setIsOpen(false)}
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}
        >
          <X size={24} />
        </button>
        
        <h2 style={{ marginBottom: '16px', color: 'var(--color-emerald-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HelpCircle size={24} /> Ajuda Rápida
        </h2>
        
        <div style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
          <p style={{ marginBottom: '12px' }}>
            O <strong>NaMão</strong> é o seu Agente Financeiro Inteligente. Veja tudo o que você pode fazer:
          </p>
          <ul style={{ paddingLeft: '20px', marginBottom: '16px', fontSize: '0.85rem' }}>
            <li style={{ marginBottom: '8px' }}><strong>➕ Lançamentos:</strong> Use o botão central para adicionar Rendas ou Despesas. O Saldo do Mês é atualizado automaticamente (Rendas - Todas as Despesas).</li>
            <li style={{ marginBottom: '8px' }}><strong>🔄 Recorrência e Parcelas:</strong> Você pode repetir uma conta ativando o "Switch" e escolhendo entre Parcelado ou Fixo.</li>
            <li style={{ marginBottom: '8px' }}><strong>📅 Planejamento Futuro:</strong> Marque a situação como "Planejado" para anotar gastos futuros. Eles não descontam do seu saldo, mas geram alertas!</li>
            <li style={{ marginBottom: '8px' }}><strong>☁️ Sincronização e Offline:</strong> O app funciona sem internet. Quando o sinal volta, ele sincroniza tudo com a nuvem do Google de forma automática e invisível.</li>
            <li style={{ marginBottom: '8px' }}><strong>📊 Relatórios:</strong> Acesse a aba de gráficos para ter uma visão visual e baixar relatórios das suas finanças.</li>
          </ul>
          
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.85rem' }}>
            <strong>🤖 Inteligência Artificial Integrada</strong><br />
            Acesse a aba "Chat" para conversar com a <strong>NaMão IA</strong>. Ela lê seus dados financeiros e te dá conselhos personalizados, análises de gastos e tira dúvidas sobre economia!
          </div>
        </div>
        
        <button onClick={() => setIsOpen(false)} className="btn-primary" style={{ width: '100%', marginTop: '24px' }}>
          Entendi, vamos lá!
        </button>
      </div>
    </div>
  );
}
