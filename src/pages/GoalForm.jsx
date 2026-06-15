import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addGoal, updateGoal, deleteGoal, getGoals } from '../services/db';
import { useDialog } from '../contexts/DialogContext';
import { Trash2 } from 'lucide-react';

const EMOJIS = ['🎯', '🐷', '🚗', '✈️', '🏠', '💻', '💍', '🎓', '🏥', '🎉', '🏍️', '📱'];

export default function GoalForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const { showConfirm, showAlert } = useDialog();

  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [deadline, setDeadline] = useState('');

  useEffect(() => {
    if (isEditing) {
      async function loadGoal() {
        const goals = await getGoals();
        const goal = goals.find(g => g.id === id);
        if (goal) {
          setTitle(goal.title);
          setIcon(goal.icon || '🎯');
          setTargetAmount(goal.targetAmount.toString());
          setCurrentAmount((goal.currentAmount || 0).toString());
          if (goal.deadline) setDeadline(goal.deadline);
        } else {
          navigate('/goals', { replace: true });
        }
      }
      loadGoal();
    }
  }, [id, isEditing, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !targetAmount) return;

    const tAmount = parseFloat(targetAmount.toString().replace(',', '.'));
    const cAmount = parseFloat(currentAmount.toString().replace(',', '.')) || 0;

    if (isNaN(tAmount) || tAmount <= 0) {
      showAlert('Atenção', 'O valor da meta deve ser maior que zero.');
      return;
    }

    if (cAmount > tAmount) {
      showAlert('Atenção', 'O valor guardado não pode ser maior que o objetivo final.');
      return;
    }

    const goalData = {
      title,
      icon,
      targetAmount: tAmount,
      currentAmount: cAmount,
      deadline: deadline || null
    };

    if (isEditing) {
      await updateGoal(id, goalData);
      showAlert('Sucesso', 'Sua meta foi atualizada!');
    } else {
      await addGoal(goalData);
      showAlert('Sucesso', 'Nova meta criada com sucesso!');
    }

    navigate('/goals', { replace: true });
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm(
      'Excluir Meta',
      'Tem certeza que deseja apagar essa meta? Essa ação não pode ser desfeita.'
    );
    if (confirmed) {
      await deleteGoal(id);
      navigate('/goals', { replace: true });
    }
  };

  const addFunds = (amountToAdd) => {
    const tAmount = parseFloat(targetAmount.toString().replace(',', '.')) || 0;
    const cAmount = parseFloat(currentAmount.toString().replace(',', '.')) || 0;
    
    let newTotal = cAmount + amountToAdd;
    if (newTotal > tAmount && tAmount > 0) newTotal = tAmount;
    if (newTotal < 0) newTotal = 0;
    
    setCurrentAmount(newTotal.toFixed(2));
  };

  return (
    <div className="animate-fade-up">
      <header className="app-header glass" style={{ borderRadius: '0 0 24px 24px', margin: '-24px -24px 24px -24px', display: 'flex', alignItems: 'center' }}>
        <div className="btn-icon" onClick={() => navigate(-1)} style={{ cursor: 'pointer' }}>{'<'}</div>
        <h1 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', textAlign: 'center', flex: 1, marginRight: isEditing ? '0' : '48px' }}>
          {isEditing ? 'Editar Meta' : 'Nova Meta'}
        </h1>
        {isEditing && (
          <div className="btn-icon" onClick={handleDelete} style={{ cursor: 'pointer', color: 'var(--color-crimson-primary)' }}>
            <Trash2 size={20} />
          </div>
        )}
      </header>

      <div className="glass-card">
        <form onSubmit={handleSubmit}>
          
          <div className="input-group">
            <label className="input-label">Ícone</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingBottom: '8px' }}>
              {EMOJIS.map(emj => (
                <div 
                  key={emj}
                  onClick={() => setIcon(emj)}
                  style={{ 
                    padding: '8px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '1.5rem',
                    background: icon === emj ? 'var(--color-emerald-primary)' : 'var(--bg-secondary)',
                    border: `1px solid ${icon === emj ? 'var(--color-emerald-primary)' : 'var(--glass-border)'}`,
                    transition: '0.2s'
                  }}
                >
                  {emj}
                </div>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Nome da Meta</label>
            <input 
              type="text" 
              placeholder="ex: Viagem para Paris" 
              className="input-field" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required 
            />
          </div>

          <div className="input-group">
            <label className="input-label">Objetivo Final (R$)</label>
            <input 
              type="number" 
              step="0.01"
              min="0.01"
              placeholder="10000,00"
              className="input-field" 
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              required 
            />
          </div>

          <div className="input-group" style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <label className="input-label" style={{ color: 'var(--color-emerald-dark)' }}>Valor Guardado (R$)</label>
            <input 
              type="number" 
              step="0.01"
              min="0"
              placeholder="0,00"
              className="input-field" 
              value={currentAmount}
              onChange={(e) => setCurrentAmount(e.target.value)}
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--glass-border)' }}
            />
            {isEditing && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => addFunds(100)} className="btn-secondary" style={{ flex: 1, padding: '6px', fontSize: '0.8rem', background: 'var(--bg-primary)' }}>+ R$ 100</button>
                <button type="button" onClick={() => addFunds(500)} className="btn-secondary" style={{ flex: 1, padding: '6px', fontSize: '0.8rem', background: 'var(--bg-primary)' }}>+ R$ 500</button>
                <button type="button" onClick={() => addFunds(-100)} className="btn-secondary" style={{ flex: 1, padding: '6px', fontSize: '0.8rem', background: 'var(--bg-primary)', color: 'var(--color-crimson-primary)' }}>- R$ 100</button>
              </div>
            )}
          </div>

          <div className="input-group">
            <label className="input-label">Prazo (Opcional)</label>
            <input 
              type="date" 
              className="input-field" 
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1rem', marginTop: '12px' }}>
            {isEditing ? 'Atualizar Meta' : 'Criar Meta'}
          </button>
        </form>
      </div>
    </div>
  );
}
