import { useState } from 'react';
import { BellRing, Cloud, Shield, Sparkles, Star, TrendingUp, X } from 'lucide-react';
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
        maxWidth: '430px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--bg-primary)',
        position: 'relative', overflowX: 'hidden', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch',
        border: '1px solid var(--color-emerald-primary)'
      }}>
        <button type="button" onClick={onClose} aria-label="Fechar planos" style={{
          position: 'absolute', top: '16px', right: '16px',
          background: 'none', border: 'none', color: 'var(--text-secondary)',
          cursor: 'pointer', padding: '4px', zIndex: 10
        }}>
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
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
            Menos preocupação com planilhas. Mais clareza para decidir o que fazer com o seu dinheiro.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
          <section style={{ padding: '14px', borderRadius: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}>
            <h3 style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontSize: '0.95rem' }}>Gratuito</h3>
            <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)', fontSize: '0.72rem', lineHeight: 1.4 }}>Para organizar seu dia a dia.</p>
            <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-secondary)', fontSize: '0.72rem', lineHeight: 1.6 }}>
              <li>Lançamentos, metas e limites</li>
              <li>Relatórios e PDF</li>
              <li>5 mensagens com a IA por mês</li>
              <li>Dados neste dispositivo</li>
            </ul>
          </section>

          <section style={{ padding: '14px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.45)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--color-emerald-dark)', marginBottom: '4px' }}>
              <Star size={15} fill="currentColor" /> <h3 style={{ margin: 0, fontSize: '0.95rem' }}>PRO</h3>
            </div>
            <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)', fontSize: '0.72rem', lineHeight: 1.4 }}>Para planejar com segurança.</p>
            <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-primary)', fontSize: '0.72rem', lineHeight: 1.6 }}>
              <li>Tudo do Gratuito</li>
              <li>IA sem limite mensal*</li>
              <li>Comparativo e previsão mensal</li>
              <li>Alertas de vencimento e orçamento</li>
              <li>Backup automático na nuvem</li>
              <li>Restaure em outro aparelho</li>
            </ul>
          </section>
        </div>

        <section style={{ padding: '14px', borderRadius: '16px', background: 'var(--bg-secondary)', marginBottom: '20px' }}>
          <p style={{ margin: '0 0 10px', color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.9rem' }}>Com PRO, você ganha:</p>
          {[
            { icon: Sparkles, text: 'Mais conversas com a NaMão IA para analisar e planejar suas finanças.' },
            { icon: TrendingUp, text: 'Comparativo mês a mês e previsão de fechamento para antecipar decisões.' },
            { icon: BellRing, text: 'Avisos de vencimentos e limites de orçamento ao abrir o app, se ativados no navegador.' },
            { icon: Cloud, text: 'Uma cópia automática de lançamentos, metas, limites e conversas.' },
            { icon: Shield, text: 'Tranquilidade para trocar de aparelho sem perder sua organização.' },
          ].map((item) => (
            <div key={item.text} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', color: 'var(--text-primary)', marginTop: '9px' }}>
              <item.icon size={18} color="var(--color-emerald-primary)" style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>{item.text}</span>
            </div>
          ))}
        </section>

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
            {loading ? 'Aguarde...' : 'Escolher plano anual — R$ 89,00'}
            <div style={{ fontSize: '0.75rem', fontWeight: 'normal', opacity: 0.9, marginTop: '2px' }}>365 dias · R$ 7,42 por mês · economize R$ 29,80</div>
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
            {loading ? 'Aguarde...' : 'Plano mensal — R$ 9,90 por 30 dias'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            Pagamento avulso processado pelo Mercado Pago. O acesso mensal dura 30 dias e o anual, 365 dias. *O chat PRO não tem cota mensal. Chat e voz compartilham até 6 solicitações por minuto e 60 por hora, com até 2 simultâneas. A voz permite até 20 lançamentos por hora.
          </span>
        </div>
        <button type="button" onClick={onClose} style={{ width: '100%', marginTop: '12px', padding: '10px', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
          Continuar no plano gratuito
        </button>
      </div>
    </div>
  );
}
