import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGoals } from '../services/db';
import { Target, Plus } from 'lucide-react';
import { formatGoalDeadline, getGoalProgress } from '../utils/goals';
import { useGoBack } from '../contexts/NavigationContext';

export default function Goals() {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const [goals, setGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getGoals();
      // Ordena por data de criação
      data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setGoals(data);
      setIsLoading(false);
    }
    load();

    window.addEventListener('namao_data_changed', load);
    return () => window.removeEventListener('namao_data_changed', load);
  }, []);

  return (
    <div className="animate-fade-up" data-navigation-loading={isLoading}>
      <header className="app-header glass" style={{ borderRadius: '0 0 24px 24px', margin: '-24px -24px 24px -24px', display: 'flex', alignItems: 'center' }}>
        <button type="button" aria-label="Voltar" className="btn-icon" onClick={goBack} style={{ cursor: 'pointer' }}>{'<'}</button>
        <h1 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', textAlign: 'center', flex: 1, marginRight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Target size={20} color="var(--color-emerald-primary)" /> Metas
        </h1>
      </header>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
          Seus cofrinhos e objetivos.
        </p>
        <button 
          className="btn-primary" 
          style={{ padding: '8px 16px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
          onClick={() => navigate('/goal/new')}
        >
          <Plus size={16} /> Nova
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🐷</div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Nenhuma meta definida</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
            Crie sua primeira meta para começar a poupar para a viagem dos sonhos, um carro novo ou reserva de emergência.
          </p>
          <button className="btn-primary" style={{ display: 'block', margin: '0 auto' }} onClick={() => navigate('/goal/new')}>
            Criar Minha Primeira Meta
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {goals.map(goal => {
            const { currentAmount, targetAmount, percent, hasValidTarget, isCompleted } = getGoalProgress(goal);
            
            return (
              <div 
                key={goal.id} 
                className="glass-card" 
                style={{ padding: '16px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                onClick={() => navigate(`/goal/${goal.id}`)}
              >
                {isCompleted && (
                  <div style={{ position: 'absolute', top: '-10px', right: '-20px', background: 'var(--color-emerald-primary)', color: '#fff', fontSize: '0.7rem', fontWeight: 'bold', padding: '16px 24px 4px 24px', transform: 'rotate(45deg)' }}>
                    CONCLUÍDO
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '1.8rem' }}>{goal.icon || '🎯'}</div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)', fontSize: '1rem' }}>{goal.title}</h3>
                    {goal.deadline && (
                      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        Para: {formatGoalDeadline(goal.deadline)}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: isCompleted ? 'var(--color-emerald-primary)' : 'var(--text-primary)' }}>
                      R$ {currentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {hasValidTarget ? ` de R$ ${targetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ' — revise o objetivo'}
                    </span>
                  </div>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', fontWeight: '600' }}>
                    {hasValidTarget ? `${percent.toFixed(0)}%` : '—'}
                  </span>
                </div>

                <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: isCompleted ? 'var(--color-emerald-primary)' : 'var(--color-brand-primary)', width: `${percent}%`, transition: 'width 1s ease-out' }}></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
