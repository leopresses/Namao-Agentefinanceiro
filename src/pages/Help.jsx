import { ArrowRight, Cloud, Route, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGoBack, usePageState } from '../contexts/NavigationContext';
import PageHeader from '../components/PageHeader';
import HelpQuestions from '../components/HelpQuestions';

export default function Help() {
  const goBack = useGoBack('/login');
  const [expanded, setExpanded] = usePageState('helpQuestion', 'balance');
  return <main className="modern-page help-page">
    <PageHeader title="Central de Ajuda" onBack={goBack} />
    <p className="help-intro">Encontre o caminho para organizar sua vida financeira no NaMão.</p>
    <button type="button" className="help-tour-entry" onClick={() => window.dispatchEvent(new CustomEvent('namao_start_tour'))}><Route size={23} aria-hidden="true" /><span><strong>Conheça o app em 6 passos</strong><small>Um tour pelos principais recursos</small></span><ArrowRight size={18} aria-hidden="true" /></button>
    <h2 className="help-section-label">Perguntas rápidas</h2><HelpQuestions expanded={expanded} onChange={setExpanded} group="help-center" />
    <section className="surface-card help-data-note"><h2><Cloud size={20} aria-hidden="true" />Cuidados com seus dados</h2><p>Antes de trocar de dispositivo, confira a data do último backup. Ao apagar os dados locais de uma conta Google, o app preserva o backup em nuvem e pausa a sincronização automática até você decidir restaurar ou substituí-lo.</p></section>
    <Link className="help-privacy-link" to="/privacy"><ShieldCheck size={20} aria-hidden="true" /><span>Política de Privacidade</span><ArrowRight size={18} aria-hidden="true" /></Link>
  </main>;
}
