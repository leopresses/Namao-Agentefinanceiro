import { ArrowLeft, BookOpen, Cloud, FileText, MessageCircle, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const topics = [
  {
    icon: '➕',
    title: 'Lançamentos e saldo',
    text: 'Use o botão “Lançar” para registrar renda ou despesa. O saldo mensal considera rendas e despesas marcadas como pagas; despesas pendentes aparecem em “Faturas a Pagar”.',
  },
  {
    icon: '🔁',
    title: 'Parcelas, recorrências e planejamento',
    text: 'Ao criar uma despesa, escolha “Repetir” para gerar parcelas ou lançamentos fixos. Use “Planejado” para lembrar um gasto futuro sem descontá-lo do saldo atual.',
  },
  {
    icon: '☁️',
    title: 'Backup e troca de dispositivo',
    text: 'O backup em nuvem é um recurso PRO. Em Configurações, faça backup antes de trocar de aparelho e use “Restaurar da Nuvem” no novo dispositivo.',
  },
  {
    icon: '📊',
    title: 'Relatórios',
    text: 'A aba Relatórios permite consultar os gastos por mês ou no período completo e exportar um PDF para compartilhar ou salvar.',
  },
];

export default function Help() {
  const navigate = useNavigate();

  return (
    <main className="animate-fade-up" style={{ maxWidth: '760px', margin: '0 auto', padding: '24px 0 48px' }}>
      <button type="button" onClick={() => navigate(-1)} style={{ background: 'transparent', color: 'var(--text-secondary)', padding: '8px 0', marginBottom: '12px' }}>
        <ArrowLeft size={20} /> Voltar
      </button>

      <section className="glass-card" style={{ marginBottom: '16px' }}>
        <h1 style={{ display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--text-primary)', fontSize: '1.5rem', marginBottom: '8px' }}>
          <BookOpen size={26} color="var(--color-emerald-primary)" /> Central de Ajuda
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Tudo que você precisa para organizar sua vida financeira no NaMão.
        </p>
      </section>

      <section className="glass-card" style={{ marginBottom: '16px', padding: '0' }}>
        {topics.map((topic, index) => (
          <article key={topic.title} style={{ padding: '18px 20px', borderBottom: index < topics.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '7px' }}>
              <span aria-hidden="true">{topic.icon}</span> {topic.title}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55 }}>{topic.text}</p>
          </article>
        ))}
      </section>

      <section className="glass-card" style={{ marginBottom: '16px', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '10px' }}>
          <MessageCircle size={20} color="var(--color-emerald-primary)" /> NaMão IA: uso responsável
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          A IA pode ajudar a organizar informações e explicar o seu resumo financeiro, mas não substitui orientação financeira, contábil, jurídica ou de investimento. Confira valores e decisões importantes antes de agir.
        </p>
        <p style={{ color: 'var(--color-crimson-dark)', fontSize: '0.85rem', lineHeight: 1.55, marginTop: '10px' }}>
          Não envie senhas, CPF, números de cartão, dados bancários completos ou outros dados sensíveis pelo chat.
        </p>
      </section>

      <section className="glass-card" style={{ marginBottom: '16px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '10px' }}>
          <Cloud size={20} color="var(--color-emerald-primary)" /> Cuidados com os seus dados
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Antes de trocar de dispositivo, confirme a data do último backup. Se escolher “Apagar Tudo”, o NaMão preserva a cópia em nuvem e pausa a sincronização automática até você decidir restaurar ou substituir o backup.
        </p>
      </section>

      <Link to="/privacy" className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-primary)', textDecoration: 'none' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '600' }}><ShieldCheck size={20} color="var(--color-emerald-primary)" /> Política de Privacidade</span>
        <FileText size={18} color="var(--text-secondary)" />
      </Link>
    </main>
  );
}
