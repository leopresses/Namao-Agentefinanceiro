import React, { useState } from 'react';
import { Check, Star, Shield, Cloud, Zap, X } from 'lucide-react';
import { getIdToken } from '../services/firebase';

export default function ProModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleCheckout = async (planType) => {
    setLoading(true);
    try {
      const token = await getIdToken();
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ planType })
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar link de pagamento');
      }

      const data = await response.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      }
    } catch (err) {
      console.error(err);
      alert('Ocorreu um erro ao processar o pagamento. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '24px'
    }}>
      <div className="glass-card" style={{
        maxWidth: '400px', width: '100%',
        background: 'var(--bg-primary)',
        position: 'relative', overflow: 'hidden',
        border: '1px solid var(--color-emerald-primary)'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '16px', right: '16px',
          background: 'none', border: 'none', color: 'var(--text-secondary)',
          cursor: 'pointer', padding: '4px', zIndex: 10
        }}>
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(16,185,129,0.1)', color: 'var(--color-emerald-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Star size={32} fill="currentColor" />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--text-primary)' }}>
            NaMão <span style={{ color: 'var(--color-emerald-primary)' }}>PRO</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Desbloqueie o poder total do seu Agente Financeiro Inteligente.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
          {[
            { icon: Zap, text: 'Conversas ilimitadas com a IA' },
            { icon: Cloud, text: 'Backup em nuvem automático' },
            { icon: Shield, text: 'Selo PRO exclusivo no perfil' },
            { icon: Check, text: 'Acesso antecipado a novas funções' }
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-primary)' }}>
              <div style={{ color: 'var(--color-emerald-primary)' }}><item.icon size={20} /></div>
              <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>{item.text}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            onClick={() => handleCheckout('anual')}
            disabled={loading}
            style={{
              width: '100%', padding: '16px', borderRadius: '12px',
              background: loading ? '#6b7280' : 'var(--color-emerald-primary)', color: 'white',
              border: 'none', fontWeight: 'bold', fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer', position: 'relative', overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute', top: 0, right: 0, background: '#FFD700', color: '#000',
              fontSize: '0.65rem', padding: '2px 8px', borderBottomLeftRadius: '8px', fontWeight: '800'
            }}>MAIS POPULAR</div>
            {loading ? 'Aguarde...' : 'Plano Anual - R$ 89,00'}
            <div style={{ fontSize: '0.75rem', fontWeight: 'normal', opacity: 0.9, marginTop: '2px' }}>Apenas R$ 7,41 por mês</div>
          </button>
          
          <button 
            onClick={() => handleCheckout('mensal')}
            disabled={loading}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              background: 'transparent', color: 'var(--text-primary)',
              border: '1px solid var(--glass-border)', fontWeight: '600', fontSize: '0.9rem',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Aguarde...' : 'Plano Mensal - R$ 9,90'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            Pagamento seguro processado pelo Mercado Pago. Cancele quando quiser.
          </span>
        </div>
      </div>
    </div>
  );
}
