import { useEffect, useRef } from 'react';
import { ArrowRight, CalendarDays, Layers, Pencil, Trash2 } from 'lucide-react';

export default function RecurrenceScopeDialog({ action = 'edit', onChoose, busy = false }) {
  const ref = useRef(null);
  const isDelete = action === 'delete';

  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog ref={ref} className="recurrence-dialog" aria-labelledby="recurrence-title" aria-describedby="recurrence-description" onCancel={(event) => { event.preventDefault(); if (!busy) onChoose(null); }}>
      <h2 id="recurrence-title">{isDelete ? 'Quais parcelas excluir?' : 'Quais parcelas atualizar?'}</h2>
      <p id="recurrence-description">{isDelete
        ? 'Escolha os lançamentos que serão excluídos. Esta ação não pode ser desfeita.'
        : 'Valor, descrição e categoria serão aplicados à opção escolhida. Data e situação mudam apenas na parcela aberta.'}</p>
      <div className="recurrence-options">
        {[
          ['one', 'Somente esta', 'Apenas a parcela aberta.', Pencil],
          ['future', 'Esta e próximas', 'Inclui as parcelas a partir da data original desta.', CalendarDays],
          ['all', 'Todas', 'Inclui também as parcelas anteriores e já pagas.', Layers],
        ].map(([value, title, description, Icon]) => (
          <button key={value} type="button" className={`recurrence-option${isDelete ? ' recurrence-option-danger' : ''}`} disabled={busy} onClick={() => onChoose(value)}>
            {isDelete ? <Trash2 size={21} aria-hidden="true" /> : <Icon size={21} aria-hidden="true" />}
            <span><strong>{title}</strong><small>{description}</small></span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        ))}
      </div>
      <button type="button" className="recurrence-cancel" disabled={busy} onClick={() => onChoose(null)}>{busy ? 'Excluindo...' : 'Cancelar'}</button>
    </dialog>
  );
}
