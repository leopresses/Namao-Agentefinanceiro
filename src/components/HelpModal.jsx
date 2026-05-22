import React, { useState, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

export default function HelpModal() {
  const [isOpen, setIsOpen] = useState(false);

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
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          width: '40px',
          height: '40px',
          borderRadius: '20px',
          background: 'var(--color-emerald-primary)',
          color: 'white',
          border: 'none',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
          zIndex: 1000,
          cursor: 'pointer'
        }}
      >
        <HelpCircle size={24} />
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
      <div className="glass-card animate-fade-up" style={{ width: '100%', maxWidth: '400px', position: 'relative', background: '#fff' }}>
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
            Bem-vindo ao <strong>NaMão</strong>! Aqui estão algumas dicas de como usar o app:
          </p>
          <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
            <li style={{ marginBottom: '8px' }}><strong>+ Renda/Despesa:</strong> Use o botão central inferior para adicionar movimentações.</li>
            <li style={{ marginBottom: '8px' }}><strong>Pendentes:</strong> Despesas criadas como pendentes ficam em vermelho e somam no "Faturas a Pagar". Clique nelas na lista para dar baixa (pagar).</li>
            <li style={{ marginBottom: '8px' }}><strong>Recorrência:</strong> Ao criar uma despesa, escolha se ela é Única, Parcelada ou Fixa Mensal.</li>
          </ul>
          
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <strong>Dúvidas? Fale com a IA!</strong><br />
            O Agente Inteligente na aba de Chat sabe como o aplicativo funciona. Pergunte a ele qualquer coisa sobre as suas finanças ou sobre como usar o app!
          </div>
        </div>
        
        <button onClick={() => setIsOpen(false)} className="btn-primary" style={{ width: '100%', marginTop: '24px' }}>
          Entendi, vamos lá!
        </button>
      </div>
    </div>
  );
}
