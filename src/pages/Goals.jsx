import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGoals } from '../services/db';
import { Plus } from 'lucide-react';
import PageHeader from '../components/PageHeader';
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

  return <div className="modern-page" data-navigation-loading={isLoading}>
    <PageHeader title="Metas" onBack={goBack} />
    <div className="goals-topline"><p>Seus cofrinhos e objetivos.</p><button type="button" className="btn-primary" onClick={() => navigate('/goal/new')}><Plus size={18} aria-hidden="true" />Nova</button></div>
    {goals.length === 0 ? <section className="surface-card"><h2 style={{ fontSize: '1.1rem', marginBottom: 10 }}>Nenhuma meta definida</h2><p className="modern-subtitle">Crie sua primeira meta para guardar dinheiro para uma viagem, um carro ou sua reserva de emergência.</p><button type="button" className="btn-primary" onClick={() => navigate('/goal/new')}>Criar primeira meta</button></section> : <div className="goal-list">{goals.map(goal => {
      const { currentAmount, targetAmount, percent, hasValidTarget, isCompleted } = getGoalProgress(goal);
      return <button type="button" className="goal-card" key={goal.id} onClick={() => navigate(`/goal/${goal.id}`)}><div className="goal-card-top"><span className="goal-card-icon" aria-hidden="true">{goal.icon || '🎯'}</span><div className="goal-card-title"><h2>{goal.title}</h2>{goal.deadline && <small>Prazo: {formatGoalDeadline(goal.deadline)}</small>}</div></div><div className="goal-card-amounts"><div><strong style={{ color: isCompleted ? 'var(--color-emerald-dark)' : undefined }}>R$ {currentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong><small>{hasValidTarget ? `de R$ ${targetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Revise o objetivo'}</small></div><span>{hasValidTarget ? `${percent.toFixed(0)}%` : '—'}</span></div><div className="goal-track" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div></button>;
    })}</div>}
  </div>;
}
