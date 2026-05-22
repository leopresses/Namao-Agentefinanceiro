import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addExpense, getExpenseById, updateExpense, updateExpenseGroupAmount } from '../services/db';
import { useDialog } from '../contexts/DialogContext';

// Função para adicionar meses a uma data (YYYY-MM-DD)
function addMonths(dateString, monthsToAdd) {
  const date = new Date(dateString + 'T12:00:00'); // Evitar problemas de timezone
  const targetMonth = (date.getMonth() + monthsToAdd) % 12;
  date.setMonth(date.getMonth() + monthsToAdd);
  
  // Se pulou para o próximo mês devido ao dia 31, voltar para o último dia do mês esperado
  if (date.getMonth() !== targetMonth) {
    date.setDate(0); 
  }
  return date.toISOString().split('T')[0];
}

export default function ExpenseForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type') || 'expense';
  const editId = searchParams.get('id');
  const isIncome = typeParam === 'income';
  const isEditing = !!editId;

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState(isIncome ? 'paid' : 'unpaid');
  
  // Opções de Recorrência (Apenas para novas despesas)
  const [recurrence, setRecurrence] = useState('unica'); // 'unica', 'parcelada', 'fixa'
  const [installments, setInstallments] = useState(2);
  const [fixedMonths, setFixedMonths] = useState(12);
  const [groupId, setGroupId] = useState(null);
  const { showConfirm } = useDialog();

  useEffect(() => {
    if (isEditing) {
      async function loadExpense() {
        const expense = await getExpenseById(editId);
        if (expense) {
          setDescription(expense.description);
          setAmount(expense.amount.toString());
          setDate(expense.date);
          setStatus(expense.status);
          setGroupId(expense.groupId || null);
        }
      }
      loadExpense();
    }
  }, [editId, isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description || !amount || !date) return;

    if (isEditing) {
      // Atualizar a despesa
      const newAmount = parseFloat(amount);
      
      if (groupId) {
        const updateAll = await showConfirm(
          'Atualizar Parcelas',
          'Esta é uma conta parcelada/recorrente. Deseja atualizar o valor de TODAS as parcelas deste grupo? (Clique em OK para Todas, ou Cancelar para alterar apenas este mês).'
        );
        
        if (updateAll) {
          await updateExpenseGroupAmount(groupId, newAmount, date);
        }
      }

      await updateExpense({
        id: editId,
        description,
        amount: newAmount,
        date,
        type: typeParam,
        status,
        groupId
      });
    } else {
      // Criar nova (com suporte a recorrência)
      let loops = 1;
      if (recurrence === 'parcelada') loops = parseInt(installments, 10);
      if (recurrence === 'fixa') loops = parseInt(fixedMonths, 10);

      const baseAmount = parseFloat(amount);
      const valuePerInstallment = recurrence === 'parcelada' ? Number((baseAmount / loops).toFixed(2)) : baseAmount;
      const groupId = loops > 1 ? Date.now().toString() + Math.random().toString(36).substring(2, 9) : null;

      for (let i = 0; i < loops; i++) {
        let desc = description;
        if (recurrence === 'parcelada' || recurrence === 'fixa') {
          desc = `${description} (${i + 1}/${loops})`;
        }

        await addExpense({
          groupId,
          description: desc,
          amount: valuePerInstallment,
          date: addMonths(date, i),
          type: typeParam,
          status: (i === 0) ? status : 'unpaid'
        });
      }
    }

    navigate('/'); 
  };

  return (
    <div style={{ paddingBottom: '80px' }} className="animate-fade-up">
      <header className="app-header glass" style={{ borderRadius: '0 0 24px 24px', margin: '-24px -24px 24px -24px' }}>
        <div className="btn-icon" onClick={() => navigate(-1)} style={{ cursor: 'pointer' }}>{'<'}</div>
        <h1 style={{ fontSize: '1.2rem', color: isIncome ? 'var(--color-emerald-dark)' : 'var(--color-crimson-dark)' }}>
          {isEditing ? 'Editar Lançamento' : (isIncome ? 'Nova Renda' : 'Nova Despesa')}
        </h1>
        <div style={{ width: '48px' }}></div>
      </header>

      <div className="glass-card">
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Descrição</label>
            <input 
              type="text" 
              placeholder="ex: Salário, Aluguel" 
              className="input-field" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required 
            />
          </div>
          <div className="input-group">
            <label className="input-label">Valor</label>
            <input 
              type="number" 
              step="0.01"
              min="0.01"
              placeholder={recurrence === 'parcelada' && !isEditing ? "Valor Total (R$)" : "R$"}
              className="input-field" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required 
            />
          </div>
          <div className="input-group">
            <label className="input-label">Data</label>
            <input 
              type="date" 
              className="input-field" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required 
            />
          </div>
          
          {!isEditing && (
            <div className="input-group">
              <label className="input-label">Tipo de Movimentação</label>
              <select className="input-field" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                <option value="unica">Única (Acontece uma vez)</option>
                <option value="parcelada">Parcelada (Divide o valor em X vezes)</option>
                <option value="fixa">Fixa (Repete o mesmo valor por X meses)</option>
              </select>
            </div>
          )}

          {!isEditing && recurrence === 'parcelada' && (
            <div className="input-group">
              <label className="input-label">Número de Parcelas</label>
              <input 
                type="number" 
                min="2" max="120"
                className="input-field" 
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                required 
              />
            </div>
          )}

          {!isEditing && recurrence === 'fixa' && (
            <div className="input-group" style={{ background: 'rgba(244, 63, 94, 0.05)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
              <label className="input-label" style={{ color: 'var(--color-crimson-dark)' }}>Projetar por quantos meses?</label>
              <input 
                type="number" 
                min="2" max="240"
                className="input-field" 
                value={fixedMonths}
                onChange={(e) => setFixedMonths(e.target.value)}
                required 
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                * Por padrão, criamos o lançamento nos próximos 12 meses para evitar acúmulo infinito de dados no celular. Você pode aumentar ou diminuir esse prazo.
              </p>
            </div>
          )}

          {!isIncome && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', marginBottom: '8px' }}>
              <input 
                type="checkbox" 
                id="paid" 
                checked={status === 'paid'}
                onChange={(e) => setStatus(e.target.checked ? 'paid' : 'unpaid')}
                style={{ width: '20px', height: '20px', accentColor: 'var(--color-emerald-primary)' }}
              />
              <label htmlFor="paid" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '500' }}>
                {isEditing ? 'Esta despesa está paga?' : 'A 1ª fatura já foi paga?'}
              </label>
            </div>
          )}

          <button type="submit" className={isIncome ? 'btn-primary' : 'btn-danger'} style={{ width: '100%', marginTop: '16px' }}>
            {isEditing ? 'Atualizar Lançamento' : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  );
}
