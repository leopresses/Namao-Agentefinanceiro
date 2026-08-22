import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExpenseById, deleteExpense, deleteExpenseGroup, updateExpense } from '../services/db';
import { useDialog } from '../contexts/DialogContext';

export default function ExpenseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useDialog();
  const [expense, setExpense] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const actionLockRef = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getExpenseById(id);
        if (data) setExpense(data);
        else navigate('/');
      } catch (error) {
        console.error('Falha ao carregar lançamento:', error);
        showAlert('Erro', 'Não foi possível carregar este lançamento.');
        navigate('/');
      }
    }
    load();
  }, [id, navigate, showAlert]);

  const handleDelete = async () => {
    if (actionLockRef.current || !expense) return;
    actionLockRef.current = true;

    try {
      if (expense.groupId) {
        const confirmedAll = await showConfirm('Excluir Recorrência', 'Deseja excluir TODAS as parcelas ligadas a este lançamento (incluindo as antigas já pagas)?');
        if (confirmedAll) {
          setIsDeleting(true);
          const deletedCount = await deleteExpenseGroup(expense.groupId);
          if (deletedCount === 0) {
            showAlert('Lançamento não encontrado', 'Esta recorrência já não existe neste dispositivo.');
          }
          navigate('/');
          return;
        }
      }

      const confirmed = await showConfirm('Excluir Lançamento', 'Tem certeza que deseja excluir APENAS esta movimentação?');
      if (confirmed) {
        setIsDeleting(true);
        const wasDeleted = await deleteExpense(id);
        if (!wasDeleted) {
          showAlert('Lançamento não encontrado', 'Este lançamento já não existe neste dispositivo.');
        }
        navigate('/');
      }
    } catch (error) {
      console.error('Falha ao excluir lançamento:', error);
      showAlert('Erro', 'Não foi possível excluir o lançamento. Tente novamente.');
    } finally {
      actionLockRef.current = false;
      setIsDeleting(false);
    }
  };

  const updateStatus = async (newStatus) => {
    if (actionLockRef.current || !expense) return;
    actionLockRef.current = true;
    setIsUpdatingStatus(true);
    try {
      const updated = { ...expense, status: newStatus };
      await updateExpense(updated);
      setExpense(updated);
      navigate(-1); // Volta para a tela anterior
    } catch (error) {
      console.error('Falha ao atualizar situação:', error);
      showAlert('Erro', error.message === 'Lançamento não encontrado para atualização.'
        ? 'Este lançamento não existe mais. Atualize a lista e tente novamente.'
        : 'Não foi possível atualizar a situação do lançamento.');
    } finally {
      actionLockRef.current = false;
      setIsUpdatingStatus(false);
    }
  };

  if (!expense) return <div style={{ padding: '24px', textAlign: 'center' }}>Carregando...</div>;

  const isIncome = expense.type === 'income';
  const isPaid = expense.status === 'paid';
  const isPlanned = expense.status === 'planned';
  return (
    <div style={{ paddingBottom: '80px' }}>
      <header className="app-header glass" style={{ borderRadius: '0 0 24px 24px', margin: '-24px -24px 24px -24px' }}>
        <div className="btn-icon" onClick={() => navigate(-1)}>{'<'}</div>
        <h1 style={{ fontSize: '1.2rem' }}>Detalhamento</h1>
        <div className="btn-icon" style={{ opacity: 0 }}></div>
      </header>

      <div className="glass-card" style={{ textAlign: 'center', marginTop: '16px' }}>
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>
            {isIncome ? 'Renda' : 'Despesa'}
          </p>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '16px' }}>{expense.description}</h2>
          
          <h1 style={{ 
            fontSize: '2.5rem', 
            color: isIncome ? 'var(--color-emerald-dark)' : 'var(--color-crimson-dark)',
            marginBottom: '16px' 
          }}>
            R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h1>
          
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
            Data: {expense.date.split('-').reverse().join('/')}
          </p>

          <button 
            onClick={() => navigate(`/expense/new?id=${expense.id}&type=${expense.type}`)} 
            className="btn-primary"
            style={{ width: '100%', marginBottom: '24px', background: 'rgba(15, 23, 42, 0.05)', color: 'var(--text-primary)', border: '1px solid rgba(15, 23, 42, 0.1)', boxShadow: 'none' }}
          >
            Editar Lançamento
          </button>

          <p style={{ color: 'var(--text-primary)', fontWeight: '600', marginBottom: '8px' }}>
            Status: {isIncome ? 'Renda registrada' : isPaid ? 'Pago' : isPlanned ? 'Planejado' : 'Pendente'}
          </p>
          {!isIncome && (
            <>
              <button
                onClick={() => updateStatus(isPaid ? 'unpaid' : 'paid')}
                disabled={isDeleting || isUpdatingStatus}
                className={isPaid ? "btn-danger" : "btn-primary"}
                style={{
                  width: '100%',
                  margin: '16px 0 8px',
                  boxShadow: 'none'
                }}
              >
                {isUpdatingStatus ? 'Atualizando...' : isPaid ? 'Marcar como Pendente' : 'Marcar como Pago'}
              </button>
              {!isPlanned && (
                <button
                  onClick={() => updateStatus('planned')}
                  disabled={isDeleting || isUpdatingStatus}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '16px',
                    background: 'transparent', color: '#b45309',
                    border: '1px solid rgba(245, 158, 11, 0.45)', fontWeight: '600'
                  }}
                >
                  Marcar como Planejada
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <button onClick={handleDelete} disabled={isDeleting || isUpdatingStatus} className="btn-danger" style={{ width: '100%', marginTop: '24px' }}>
        {isDeleting ? 'Excluindo...' : `Excluir ${isIncome ? 'Renda' : 'Despesa'}`}
      </button>
    </div>
  );
}
