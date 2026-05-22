import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExpenseById, deleteExpense, updateExpense, getExpenses } from '../services/db';
import { useDialog } from '../contexts/DialogContext';

export default function ExpenseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showConfirm } = useDialog();
  const [expense, setExpense] = useState(null);

  useEffect(() => {
    async function load() {
      const data = await getExpenseById(id);
      if (data) setExpense(data);
      else navigate('/'); 
    }
    load();
  }, [id, navigate]);

  const handleDelete = async () => {
    if (expense.groupId) {
      const confirmedAll = await showConfirm('Excluir Recorrência', 'Deseja excluir TODAS as parcelas ligadas a este lançamento (incluindo as antigas já pagas)?');
      if (confirmedAll) {
        const all = await getExpenses();
        const toDelete = all.filter(e => e.groupId === expense.groupId);
        for (let e of toDelete) {
          await deleteExpense(e.id);
        }
        navigate('/');
        return;
      }
    }

    const confirmed = await showConfirm('Excluir Lançamento', 'Tem certeza que deseja excluir APENAS esta movimentação?');
    if (confirmed) {
      await deleteExpense(id);
      navigate('/');
    }
  };

  const toggleStatus = async () => {
    const newStatus = expense.status === 'paid' ? 'unpaid' : 'paid';
    const updated = { ...expense, status: newStatus };
    await updateExpense(updated);
    setExpense(updated);
    navigate(-1); // Volta para a tela anterior
  };

  if (!expense) return <div style={{ padding: '24px', textAlign: 'center' }}>Carregando...</div>;

  const isIncome = expense.type === 'income';
  const isPaid = expense.status === 'paid';
  const color = isIncome ? 'var(--color-emerald-light)' : (isPaid ? 'var(--color-emerald-dark)' : 'var(--color-crimson-light)');

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
            color: isIncome ? 'var(--color-emerald-dark)' : 'var(--color-emerald-dark)', 
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
            Status: {isPaid ? 'Recebido/Pago' : 'Pendente'}
          </p>
          {!isIncome && (
             <button 
              onClick={toggleStatus} 
              className={isPaid ? "btn-danger" : "btn-primary"} 
              style={{ 
                width: '100%', 
                margin: '16px 0', 
                boxShadow: 'none' 
              }}
             >
               {isPaid ? 'Desfazer Pagamento (Pendente)' : 'Marcar como Pago'}
             </button>
          )}
        </div>
      </div>

      <button onClick={handleDelete} className="btn-danger" style={{ width: '100%', marginTop: '24px' }}>
        Excluir {isIncome ? 'Renda' : 'Despesa'}
      </button>
    </div>
  );
}
