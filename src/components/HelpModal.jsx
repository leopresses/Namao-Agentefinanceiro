import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BookOpen, HelpCircle, Route, X } from 'lucide-react';
import HelpQuestions from './HelpQuestions';

export default function HelpModal() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(() => !localStorage.getItem('namao_has_seen_help'));
  const [expanded, setExpanded] = useState('balance');
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && !dialog.open) { dialog.showModal(); localStorage.setItem('namao_has_seen_help', 'true'); }
    else if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);
  const startTour = () => {
    setIsOpen(false);
    window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('namao_start_tour')));
  };
  return <>
    <button type="button" className="quick-help-trigger" aria-label="Ajuda" onClick={() => setIsOpen(true)}><HelpCircle size={21} aria-hidden="true" /></button>
    <dialog ref={dialogRef} className="quick-help-dialog modern-dialog" aria-labelledby="quick-help-title" onCancel={() => setIsOpen(false)} onClose={() => setIsOpen(false)}>
      <header className="quick-help-header"><div className="app-title"><img src="/logo.png?v=20260901" className="logo-icon" alt="" />NaMão</div><button type="button" className="modern-icon-button" aria-label="Fechar ajuda rápida" onClick={() => setIsOpen(false)}><X size={23} aria-hidden="true" /></button></header>
      <h2 id="quick-help-title" className="help-title">Ajuda rápida</h2><p className="help-intro">Uma dúvida de cada vez. Veja como aproveitar o NaMão.</p>
      <button type="button" className="help-tour-entry" onClick={startTour}><Route size={23} aria-hidden="true" /><span><strong>Conheça o app em 6 passos</strong><small>Tour guiado · você pode pular quando quiser</small></span><ArrowRight size={18} aria-hidden="true" /></button>
      <h3 className="help-section-label">Dúvidas frequentes</h3><HelpQuestions compact expanded={expanded} onChange={setExpanded} group="quick-help" />
      <button type="button" className="help-more" onClick={() => { setIsOpen(false); navigate('/help'); }}><BookOpen size={18} aria-hidden="true" /><span>Ver central de ajuda</span><ArrowUpRight size={17} aria-hidden="true" /></button>
      <button type="button" className="btn-primary help-understood" onClick={() => setIsOpen(false)}>Entendi, vamos lá!</button><p className="help-footnote">A ajuda continua disponível no botão ?</p>
    </dialog>
  </>;
}
