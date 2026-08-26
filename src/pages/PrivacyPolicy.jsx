import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PRIVACY_EMAIL } from '../config/legal';

const updatedAt = '20 de agosto de 2026';

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: '24px' }}>
      <h2 style={{ color: 'var(--text-primary)', fontSize: '1.05rem', marginBottom: '9px' }}>{title}</h2>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.65 }}>{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <main className="animate-fade-up" style={{ maxWidth: '760px', margin: '0 auto', padding: '24px 0 48px' }}>
      <button type="button" onClick={() => navigate(-1)} style={{ background: 'transparent', color: 'var(--text-secondary)', padding: '8px 0', marginBottom: '12px' }}>
        <ArrowLeft size={20} /> Voltar
      </button>

      <article className="glass-card">
        <header style={{ marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid var(--glass-border)' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)', fontSize: '1.5rem', marginBottom: '8px' }}>
            <ShieldCheck size={27} color="var(--color-emerald-primary)" /> Política de Privacidade
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Última atualização: {updatedAt}</p>
        </header>

        <Section title="1. Sobre esta política">
          <p>Esta política explica como o NaMão trata dados pessoais para oferecer organização financeira, autenticação, backup, pagamentos e recursos de inteligência artificial. Ela foi escrita para usuários no Brasil e observa os princípios aplicáveis da Lei Geral de Proteção de Dados (LGPD).</p>
        </Section>

        <Section title="2. Dados que tratamos">
          <ul style={{ paddingLeft: '20px' }}>
            <li><strong>Conta:</strong> nome, e-mail, foto de perfil e identificador da conta Google, quando você faz login.</li>
            <li><strong>Dados financeiros inseridos por você:</strong> lançamentos, categorias, orçamentos, metas e conversas salvas no chat.</li>
            <li><strong>Uso do serviço:</strong> dados técnicos necessários para autenticação, segurança, limites de uso e funcionamento do app.</li>
            <li><strong>Pagamento:</strong> status e identificação do pagamento necessários para liberar o plano PRO. O NaMão não armazena dados completos de cartão.</li>
          </ul>
        </Section>

        <Section title="3. Para que usamos esses dados">
          <ul style={{ paddingLeft: '20px' }}>
            <li>criar e manter sua conta e seus lançamentos;</li>
            <li>calcular saldos, faturas, metas e relatórios;</li>
            <li>realizar backup e restauração quando o recurso estiver disponível no seu plano;</li>
            <li>prevenir fraude, abuso e uso acima dos limites do serviço;</li>
            <li>processar pagamentos e liberar os recursos contratados;</li>
            <li>responder às perguntas enviadas à NaMão IA.</li>
          </ul>
        </Section>

        <Section title="4. Onde os dados ficam e com quem podem ser compartilhados">
          <p>Os dados permanecem neste dispositivo enquanto você usa o app. Quando você usa o backup em nuvem, os dados selecionados são armazenados no Firebase/Google Cloud para permitir restauração na sua conta.</p>
          <p style={{ marginTop: '10px' }}>A autenticação é realizada com Google/Firebase. Pagamentos são processados pelo Mercado Pago. Ao usar a NaMão IA, a sua pergunta e um resumo financeiro do mês atual podem ser enviados à API Gemini, do Google, para gerar a resposta. Não vendemos seus dados financeiros nem os usamos para publicidade comportamental.</p>
          <p style={{ marginTop: '10px' }}><strong>Importante:</strong> não envie pelo chat senhas, CPF, dados bancários completos, números de cartão ou dados sensíveis. O tratamento pelo provedor de IA também segue os termos aplicáveis do Google.</p>
        </Section>

        <Section title="5. Base legal e decisões suas">
          <p>Tratamos dados quando isso é necessário para prestar o serviço solicitado, cumprir obrigações legais, proteger a segurança do serviço e, quando aplicável, mediante seu consentimento. Você pode optar por não usar recursos opcionais, como o chat com IA e o backup em nuvem.</p>
        </Section>

        <Section title="6. Retenção e exclusão">
          <p>Os dados locais permanecem no dispositivo até serem apagados por você. Backups em nuvem permanecem até serem substituídos ou excluídos pela área de Configurações, salvo períodos necessários para cumprir obrigações legais, prevenir fraudes ou resolver disputas. A exclusão de dados locais não exclui automaticamente um backup em nuvem preservado.</p>
        </Section>

        <Section title="7. Segurança">
          <p>Adotamos medidas técnicas e administrativas razoáveis para reduzir riscos de acesso não autorizado, incluindo autenticação de conta, regras de acesso no banco de dados e comunicação protegida pelos provedores. Nenhum sistema conectado à internet é totalmente isento de riscos; por isso, proteja seu aparelho e sua conta Google.</p>
        </Section>

        <Section title="8. Seus direitos">
          <p>Nos termos da LGPD, você pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários, portabilidade quando aplicável, informações sobre compartilhamento e revisão das informações prestadas. Você também pode revogar consentimentos quando essa for a base aplicável.</p>
        </Section>

        <Section title="9. Uso responsável e idade mínima">
          <p>O NaMão é uma ferramenta de organização pessoal e a NaMão IA não fornece recomendação profissional de investimento, contábil, jurídica ou financeira. O serviço é destinado a pessoas com 18 anos ou mais. Confira informações relevantes antes de tomar decisões financeiras.</p>
        </Section>

        <Section title="10. Contato e alterações desta política">
          <p>Para dúvidas, solicitações relacionadas a dados pessoais ou exercício de direitos, escreva para <a href={`mailto:${PRIVACY_EMAIL}`} style={{ color: 'var(--color-emerald-dark)', fontWeight: '700' }}>{PRIVACY_EMAIL}</a>.</p>
          <p style={{ marginTop: '10px' }}>Podemos atualizar esta política quando houver mudança relevante no serviço ou no tratamento de dados. A versão vigente ficará disponível nesta página com a data de atualização.</p>
        </Section>

        <p style={{ paddingTop: '18px', borderTop: '1px solid var(--glass-border)', fontSize: '0.8rem' }}>
          Leia também a <Link to="/help" style={{ color: 'var(--color-emerald-dark)', fontWeight: '700' }}>Central de Ajuda</Link> para entender backup, IA e os recursos do aplicativo.
        </p>
      </article>
    </main>
  );
}
