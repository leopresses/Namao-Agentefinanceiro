import React, { useEffect, useState } from 'react';
import { getExpenses, getBudgets } from '../services/db';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { getCategory } from '../utils/categories';
import { getUserProStatus, onAuthChange } from '../services/firebase';
import { useDialog } from '../contexts/DialogContext';

export default function Dashboard() {
  const [allExpenses, setAllExpenses] = useState([]);
  const [displayedExpenses, setDisplayedExpenses] = useState([]);
  const [balance, setBalance] = useState(0);
  const [toPay, setToPay] = useState(0);
  const [budgets, setBudgets] = useState({});
  const [categoryTotals, setCategoryTotals] = useState({});
  const [isPro, setIsPro] = useState(localStorage.getItem('namao_is_pro') === 'true');
  const { showProModal } = useDialog();
  
  // Date tracking for Month Filter
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    async function loadData() {
      const data = await getExpenses();
      // Sort by date desc
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setAllExpenses(data);
      const bData = await getBudgets();
      setBudgets(bData);
    }
    loadData();

    const unsubscribe = onAuthChange(async (user) => {
      if (user) {
        const proData = await getUserProStatus();
        setIsPro(proData.isPro);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Filter data by currently selected month and year
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    
    const filtered = allExpenses.filter(item => {
      const itemDate = new Date(item.date + 'T12:00:00');
      return itemDate.getMonth() === month && itemDate.getFullYear() === year;
    });

    setDisplayedExpenses(filtered);
    
    let currentBalance = 0;
    let currentToPay = 0;
    let currentTotals = {};

    filtered.forEach(item => {
      if (item.type === 'income') {
        currentBalance += item.amount;
      } else if (item.type === 'expense') {
        if (item.status === 'paid') {
          currentBalance -= item.amount;
        }
        if (item.status === 'unpaid') {
          currentToPay += item.amount;
        }
        if (item.status !== 'planned') {
          currentTotals[item.category] = (currentTotals[item.category] || 0) + item.amount;
        }
      }
    });

    setBalance(currentBalance);
    setToPay(currentToPay);
    setCategoryTotals(currentTotals);
  }, [allExpenses, currentDate]);

  const changeMonth = (offset) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + offset);
    setCurrentDate(newDate);
  };

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const urgentItems = allExpenses.filter(item => 
    item.type === 'expense' && 
    (item.status === 'unpaid' || item.status === 'planned') && 
    (item.date === todayStr || item.date === tomorrowStr)
  );

  return (
    <div className="animate-fade-up">
      <header className="app-header glass" style={{ borderRadius: '0 0 24px 24px', margin: '-24px -24px 24px -24px' }}>
        <h1 className="app-title" style={{ margin: 0 }}>
          <img src="/logo.png" alt="NaMão Logo" className="logo-icon" />
          NaMão
        </h1>
      </header>

      {/* Banner PRO (Movido para baixo do cabeçalho para não encavalar com os ícones flutuantes) */}
      {!isPro && (
        <div 
          className="animate-pulse-glow"
          onClick={showProModal}
          style={{
            background: 'linear-gradient(135deg, var(--color-emerald-primary) 0%, var(--color-emerald-dark) 100%)',
            borderRadius: '16px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'white',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
              <Star size={20} fill="currentColor" /> Seja PRO Agora
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9, marginTop: '4px' }}>IA Ilimitada e Backup Seguro na Nuvem</p>
          </div>
          <ChevronRight size={24} />
        </div>
      )}

      {/* Seletor de Mês */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', marginBottom: '24px' }}>
        <button onClick={() => changeMonth(-1)} style={{ background: 'transparent', color: 'var(--text-secondary)' }}>
          <ChevronLeft size={24} />
        </button>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0, fontWeight: '600' }}>
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h3>
        <button onClick={() => changeMonth(1)} style={{ background: 'transparent', color: 'var(--text-secondary)' }}>
          <ChevronRight size={24} />
        </button>
      </div>

      {urgentItems.length > 0 && (
        <div style={{ background: 'var(--color-crimson-primary)', color: '#fff', borderRadius: '16px', padding: '16px', marginBottom: '24px', boxShadow: '0 4px 12px rgba(244, 63, 94, 0.3)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚠️ Atenção: Vencimentos Próximos
          </h3>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem' }}>
            {urgentItems.map(u => (
              <li key={u.id} style={{ marginBottom: '4px' }}>
                {u.description} ({u.date === todayStr ? 'Hoje' : 'Amanhã'}) - R$ {u.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Saldo do Mês</h2>
          <h1 style={{ 
            fontSize: balance.toString().length > 7 ? '1.1rem' : '1.4rem', 
            marginTop: '8px', 
            color: balance >= 0 ? 'var(--color-emerald-dark)' : 'var(--color-crimson-dark)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textAlign: 'center'
          }}>
            {balance < 0 ? '- R$ ' : 'R$ '}{Math.abs(balance).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h1>
        </div>
        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Faturas a Pagar</h2>
          <h1 style={{ 
            fontSize: toPay.toString().length > 7 ? '1.1rem' : '1.4rem', 
            marginTop: '8px', 
            color: 'var(--color-crimson-dark)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textAlign: 'center'
          }}>
            R$ {toPay.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h1>
        </div>
      </div>

      {/* Progresso dos Orçamentos */}
      {Object.keys(budgets).length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Orçamentos do Mês</h3>
            <Link to="/budgets" style={{ fontSize: '0.8rem', color: 'var(--color-emerald-primary)', textDecoration: 'none', fontWeight: '600' }}>EDITAR</Link>
          </div>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.keys(budgets).map(catId => {
              const limit = budgets[catId];
              const spent = categoryTotals[catId] || 0;
              const percent = Math.min((spent / limit) * 100, 100);
              const catData = getCategory(catId) || { label: 'Outros', icon: '💸' };
              const isOver = spent >= limit;
              const isWarning = percent >= 80 && !isOver;

              let barColor = 'var(--color-emerald-primary)';
              if (isWarning) barColor = '#f59e0b'; // amber
              if (isOver) barColor = 'var(--color-crimson-primary)';

              return (
                <div key={catId}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: '500' }}>
                      <span>{catData.icon}</span> {catData.label}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      <strong style={{ color: isOver ? 'var(--color-crimson-primary)' : 'var(--text-primary)' }}>R$ {spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> / R$ {limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: barColor, width: `${percent}%`, transition: 'width 0.5s ease-out' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <div>
        <h3 style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Lançamentos</h3>
        {displayedExpenses.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '32px' }}>Nenhuma movimentação neste mês.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {displayedExpenses.map((exp) => {
              const isIncome = exp.type === 'income';
              const isPaid = exp.status === 'paid';
              const isPlanned = exp.status === 'planned';
              const catInfo = getCategory(exp.category);
              
              let color = 'var(--color-crimson-primary)'; 
              if (isIncome) color = 'var(--color-emerald-primary)';
              else if (isPaid) color = 'var(--color-emerald-dark)';
              else if (isPlanned) color = '#f59e0b'; // amber for planned

              const sign = isIncome ? '+' : (isPlanned ? '~' : '-');
              
              let statusText = '• Pendente';
              if (isIncome) statusText = '• Renda';
              else if (isPaid) statusText = '• Pago';
              else if (isPlanned) statusText = '• Planejado';

              return (
                <Link to={`/expense/${exp.id}`} key={exp.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ width: '4px', height: '100%', background: color, borderRadius: '4px' }}></div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: (isPaid || isPlanned) && !isIncome ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: isPaid && !isIncome ? 'line-through' : 'none' }}>
                        {isIncome ? '💰' : catInfo.icon} {exp.description}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {exp.date.split('-').reverse().join('/')} {statusText}
                      </p>
                    </div>
                  </div>
                  <div style={{ fontWeight: '600', color: color }}>
                    {sign} R$ {exp.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
