import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, Route } from 'lucide-react';
import { getCurrentAccountId, setAccountSetting } from '../services/accountScope';

const STEPS = [
  { target: 'month', title: 'Escolha o mês', text: 'Use as setas para consultar outro mês. Ao voltar de uma despesa, o app mantém o mês e a posição da lista.' },
  { target: 'balance', title: 'Entenda seu saldo', text: 'O saldo já desconta despesas pagas e pendentes. “A pagar” mostra o que ainda precisa ser quitado.' },
  { target: 'add', title: 'Registre renda ou despesa', text: 'O botão + no celular, ou Lançar no computador, reúne as opções de renda, despesa e entrada por voz.' },
  { target: 'expense', fallback: 'transactions', title: 'Acompanhe cada lançamento', text: 'Toque em uma despesa para editar, marcar como paga ou excluir. A lista mostra todos os lançamentos do mês.' },
  { target: 'ai-link', title: 'Converse com a NaMão IA', text: 'A aba IA permite perguntar sobre suas finanças e usar sugestões. O assistente considera os dados registrados no app.' },
  { target: 'profile-link', title: 'Cuide da conta e dos dados', text: 'Em Perfil ficam preferências, metas e backup. A cópia na nuvem está disponível para contas Google PRO.' },
];
function visibleTarget(name) {
  return [...document.querySelectorAll(`[data-tour="${name}"]`)].find(element => element.getBoundingClientRect().width > 0);
}

export default function GuidedTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tour, setTour] = useState(null);
  const [geometry, setGeometry] = useState(null);
  const dialogRef = useRef(null);
  const panelRef = useRef(null);
  const originRef = useRef(null);
  const closeTour = useCallback(() => {
    setTour(null);
    setGeometry(null);
    if (location.state?.namaoTour && window.history.state?.idx === originRef.current?.index + 1) navigate(-1);
  }, [location.state, navigate]);

  useEffect(() => {
    const start = () => {
      if (tour) return;
      if (!getCurrentAccountId()) { navigate('/login'); return; }
      originRef.current = { key: location.key, index: window.history.state?.idx ?? 0, entered: false };
      setTour({ step: 0, complete: false });
      navigate('/', { state: { namaoTour: true } });
    };
    window.addEventListener('namao_start_tour', start);
    return () => window.removeEventListener('namao_start_tour', start);
  }, [location.key, navigate, tour]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (tour && !dialog.open) dialog.showModal();
    else if (!tour && dialog.open) dialog.close();
  }, [tour]);
  useEffect(() => {
    if (!tour) return;
    if (location.state?.namaoTour) { originRef.current.entered = true; return; }
    if (!originRef.current?.entered) return;
    setTour(null);
    setGeometry(null);
  }, [location.key, location.state, tour]);

  useLayoutEffect(() => {
    if (!tour || tour.complete) return;
    let frame;
    let aligned = false;
    let cancelled = false;
    const measure = () => {
      if (cancelled || document.querySelector('[data-navigation-loading="true"]')) return;
      const step = STEPS[tour.step];
      const target = visibleTarget(step.target) || (step.fallback && visibleTarget(step.fallback));
      if (!target || !panelRef.current) return;
      if (!aligned) { target.scrollIntoView({ behavior: 'instant', block: 'start', inline: 'nearest' }); aligned = true; }
      const rect = target.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      const panelWidth = Math.min(360, width - 24);
      const panelHeight = panelRef.current.offsetHeight;
      const top = Math.max(6, rect.top - 4);
      const bottom = Math.min(height - 6, rect.bottom + 4);
      const below = bottom + 16;
      const above = top - panelHeight - 16;
      const panelTop = below + panelHeight <= height - 12 ? below : above >= 12 ? above : Math.max(12, height - panelHeight - 12);
      const next = { left: Math.max(6, rect.left - 4), top, width: Math.min(width - 12, rect.width + 8), height: Math.max(10, bottom - top), panelLeft: Math.max(12, Math.min(rect.left, width - panelWidth - 12)), panelTop, panelWidth };
      setGeometry(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    const schedule = () => { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(measure); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.getElementById('root'), { subtree: true, childList: true, attributes: true, attributeFilter: ['data-navigation-loading'] });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    const settleId = window.setTimeout(schedule, 700);
    schedule();
    return () => { cancelled = true; observer.disconnect(); window.cancelAnimationFrame(frame); window.clearTimeout(settleId); window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true); };
  }, [tour, location.key]);

  const move = offset => { setGeometry(null); setTour(current => ({ ...current, step: current.step + offset })); };
  const complete = () => {
    setAccountSetting('namao_tour_completed', 'true');
    setTour(current => ({ ...current, complete: true }));
    setGeometry(null);
  };
  const step = tour ? STEPS[tour.step] : STEPS[0];
  return <dialog ref={dialogRef} className="guided-tour-dialog" aria-labelledby="tour-title" onCancel={event => { event.preventDefault(); closeTour(); }}>
    {tour && <>
      {!tour.complete && geometry && <div className="tour-spotlight" aria-hidden="true" style={{ left: geometry.left, top: geometry.top, width: geometry.width, height: geometry.height }} />}
      <section ref={panelRef} className={`tour-panel${!geometry || tour.complete ? ' tour-panel-centered' : ''}`} style={geometry && !tour.complete ? { left: geometry.panelLeft, top: geometry.panelTop, width: geometry.panelWidth } : undefined} aria-live="polite">
        {tour.complete ? <><div className="tour-complete-icon"><Check size={29} aria-hidden="true" /></div><h2 id="tour-title">Tudo pronto!</h2><p>O tour continua disponível na Ajuda rápida sempre que precisar.</p><button type="button" className="btn-primary" onClick={closeTour}>Voltar ao app</button></> : <>
          <div className="tour-panel-top"><span><Route size={15} aria-hidden="true" />{tour.step + 1} de {STEPS.length}</span><button type="button" onClick={closeTour}>Pular tour</button></div>
          <h2 id="tour-title">{step.title}</h2><p>{step.text}</p>
          {!geometry && <p className="tour-loading" role="status">Preparando a tela...</p>}
          <div className="tour-panel-actions"><button type="button" disabled={tour.step === 0} onClick={() => move(-1)}>Voltar</button><button type="button" className="btn-primary" disabled={!geometry} onClick={tour.step === STEPS.length - 1 ? complete : () => move(1)}>{tour.step === STEPS.length - 1 ? 'Concluir' : 'Próximo'}</button></div>
        </>}
      </section>
    </>}
  </dialog>;
}
