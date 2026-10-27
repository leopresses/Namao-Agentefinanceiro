import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CalendarDays, Check, Pencil, Repeat2, Tag, Trash2 } from 'lucide-react';
import { getExpenseById, deleteExpenseSeries, updateExpense } from '../services/db';
import { useDialog } from '../contexts/DialogContext';
import { useGoBack } from '../contexts/NavigationContext';
import { getCategory } from '../utils/categories';
import BackButton from '../components/BackButton';
import RecurrenceScopeDialog from '../components/RecurrenceScopeDialog';

export default function ExpenseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const goBack = useGoBack();
  const { showConfirm, showAlert } = useDialog();
  const [expense, setExpense] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [showDeleteScope, setShowDeleteScope] = useState(false);
  const actionLock = useRef(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await getExpenseById(id);
        if (!active) return;
        if (data) setExpense(data);
        else goBack();
      } catch (error) {
        console.error('Falha ao carregar lançamento:', error);
        if (active) {
          showAlert('Erro', 'Não foi possível abrir este lançamento. Tente novamente.');
          goBack();
        }
      }
    }
    load();
    return () => { active = false; };
  }, [id, goBack, showAlert]);

  const deleteSelected = async (scope) => {
    if (!scope) { setShowDeleteScope(false); return; }
    if (actionLock.current) return;
    actionLock.current = true;
    setIsBusy(true);
    try {
      await deleteExpenseSeries(id, scope);
      setShowDeleteScope(false);
      goBack();
    } catch (error) {
      console.error('Falha ao excluir lançamento:', error);
      setShowDeleteScope(false);
      showAlert('Erro', 'Não foi possível excluir. Tente novamente.');
    } finally {
      actionLock.current = false;
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    if (actionLock.current) return;
    if (expense.groupId) { setShowDeleteScope(true); return; }
    const confirmed = await showConfirm('Excluir lançamento', 'Deseja excluir este lançamento? Esta ação não pode ser desfeita.');
    if (confirmed) await deleteSelected('one');
  };

  const updateStatus = async (status) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setIsBusy(true);
    try {
      await updateExpense({ ...expense, status });
      goBack();
    } catch (error) {
      console.error('Falha ao atualizar situação:', error);
      showAlert('Erro', 'Não foi possível atualizar a situação. Tente novamente.');
    } finally {
      actionLock.current = false;
      setIsBusy(false);
    }
  };

  if (!expense) return <div data-navigation-loading="true" style={{ padding: '24px', textAlign: 'center' }}>Carregando...</div>;

  const isIncome = expense.type === 'income';
  const isPaid = expense.status === 'paid';
  const isPlanned = expense.status === 'planned';
  const category = getCategory(expense.category);
  const statusLabel = isIncome ? 'Recebido' : isPaid ? 'Pago' : isPlanned ? 'Planejado' : 'Pendente';

  return (
    <div className="expense-details modern-page">
      <header className="app-header expense-detail-header">
        <BackButton onClick={goBack} />
        <h1>Detalhamento</h1>
        <span className="back-button-spacer" aria-hidden="true" />
      </header>
      <section className="glass-card expense-detail-card" aria-labelledby="expense-title" aria-busy={isBusy}>
        <div className="expense-detail-topline">
          <span>{isIncome ? 'Renda' : 'Despesa'}</span>
          <span className={`expense-status expense-status-${isIncome || isPaid ? 'paid' : isPlanned ? 'planned' : 'unpaid'}`}>{statusLabel}</span>
        </div>
        <h2 id="expense-title">{expense.description}</h2>
        <p className={`expense-detail-amount${isIncome ? ' income' : ''}`}>R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        <dl className="expense-detail-info">
          <div><dt><CalendarDays size={18} aria-hidden="true" /> Data</dt><dd>{expense.date.split('-').reverse().join('/')}</dd></div>
          <div><dt><Tag size={18} aria-hidden="true" /> Categoria</dt><dd>{isIncome ? '💰 Renda' : `${category.icon} ${category.label}`}</dd></div>
          {expense.groupId && <div><dt><Repeat2 size={18} aria-hidden="true" /> Repetição</dt><dd>Lançamento recorrente</dd></div>}
        </dl>
        <div className="expense-detail-actions">
          {!isIncome && <button type="button" disabled={isBusy} onClick={() => updateStatus(isPaid ? 'unpaid' : 'paid')} className={isPaid ? 'expense-secondary-button' : 'btn-primary'}>
            {!isPaid && <Check size={20} aria-hidden="true" />}{isPaid ? 'Marcar como Pendente' : 'Marcar como Pago'}
          </button>}
          <button type="button" disabled={isBusy} onClick={() => navigate(`/expense/new?id=${expense.id}&type=${expense.type}`)} className={isIncome ? 'btn-primary' : 'expense-secondary-button'}>
            <Pencil size={18} aria-hidden="true" /> Editar Lançamento
          </button>
          {!isIncome && !isPlanned && <button type="button" disabled={isBusy} onClick={() => updateStatus('planned')} className="expense-planned-button">Marcar como Planejada</button>}
        </div>
      </section>
      <button type="button" disabled={isBusy} onClick={handleDelete} className="expense-delete-button"><Trash2 size={18} aria-hidden="true" /> Excluir {isIncome ? 'Renda' : 'Despesa'}</button>
      {showDeleteScope && <RecurrenceScopeDialog action="delete" onChoose={deleteSelected} busy={isBusy} />}
    </div>
  );
}
