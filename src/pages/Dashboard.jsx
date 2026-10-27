import { useEffect, useMemo, useRef, useState } from 'react';
import { getExpenses, getBudgets, getGoals } from '../services/db';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, Star, X, ShoppingCart, Utensils, Car, House, HeartPulse, GraduationCap, Shirt, Sparkles, PawPrint, Tv, PartyPopper, Plane, CreditCard, Receipt, Wallet } from 'lucide-react';
import { CATEGORIES, getCategory } from '../utils/categories';
import { getCachedProStatus, getUserProStatus, onAuthChange } from '../services/firebase';
import { useDialog } from '../contexts/DialogContext';
import { getGoalProgress } from '../utils/goals';
import {
  buildFinancialAlert,
  getBrowserNotificationPermission,
  getProNotificationsEnabled,
} from '../utils/proNotifications';
import { shiftMonth } from '../utils/advancedReports';
import { usePageState } from '../contexts/NavigationContext';
import { filterExpenseList } from '../utils/expenseList';
import { getReportExpenses, summarizeReportExpenses } from '../utils/reporting';
import './Dashboard.css';

const categoryIcons = {
  mercado: ShoppingCart, alimentacao: Utensils, transporte: Car, casa: House,
  saude: HeartPulse, educacao: GraduationCap, vestuario: Shirt, beleza: Sparkles,
  pets: PawPrint, assinaturas: Tv, lazer: PartyPopper, viagem: Plane, dividas: CreditCard,
};

function formatSummaryMoney(value) {
  return `${value < 0 ? '− ' : ''}R$ ${Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [allExpenses, setAllExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [budgets, setBudgets] = useState({});
  const [goals, setGoals] = useState([]);
  const [isPro, setIsPro] = useState(getCachedProStatus);
  const handledPaymentResult = useRef(null);
  const { showAlert, showProModal } = useDialog();
  
  // Date tracking for Month Filter
  const [currentDate, setCurrentDate] = usePageState('month', () => new Date());
  const displayedExpenses = useMemo(() => getReportExpenses(allExpenses, {
    filterMode: 'month', currentDate,
  }), [allExpenses, currentDate]);
  const summary = useMemo(() => summarizeReportExpenses(displayedExpenses), [displayedExpenses]);
  const { availableBalance: balance, unpaidExpenseTotal: toPay, categoryTotals } = summary;
  const [search, setSearch] = usePageState('search', '');
  const [categoryFilter, setCategoryFilter] = usePageState('categoryFilter', 'all');
  const [statusFilter, setStatusFilter] = usePageState('statusFilter', 'all');
  const [categoryFiltersOpen, setCategoryFiltersOpen] = usePageState('categoryFiltersOpen', false);
  const visibleExpenses = useMemo(() => filterExpenseList(displayedExpenses, {
    search, category: categoryFilter, status: statusFilter,
  }), [displayedExpenses, search, categoryFilter, statusFilter]);
  const hasFilters = !!search || categoryFilter !== 'all' || statusFilter !== 'all';
  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  useEffect(() => {
    async function loadData() {
      const data = await getExpenses();
      // Sort by date desc
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setAllExpenses(data);
      const bData = await getBudgets();
      setBudgets(bData);
      const gData = await getGoals();
      setGoals(gData);
      setIsLoading(false);
    }
    loadData();

    window.addEventListener('namao_data_changed', loadData);

    const unsubscribe = onAuthChange(async (user) => {
      if (user) {
        const proData = await getUserProStatus();
        setIsPro(proData.isPro);
      }
    });
    return () => {
      window.removeEventListener('namao_data_changed', loadData);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const paymentResult = new URLSearchParams(location.search).get('payment');
    if (!paymentResult) return undefined;
    const paymentKey = `${paymentResult}:${location.search}`;
    if (handledPaymentResult.current === paymentKey) return undefined;

    const params = new URLSearchParams(location.search);
    params.delete('payment');
    const cleanSearch = params.toString();
    window.history.replaceState(window.history.state, '', `${location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}`);

    let cancelled = false;
    const notifyOnce = (title, message) => {
      if (cancelled || handledPaymentResult.current === paymentKey) return;
      // Só registra como concluído depois de mostrar o resultado. No StrictMode,
      // um efeito pode ser cancelado antes de a consulta do plano terminar.
      handledPaymentResult.current = paymentKey;
      showAlert(title, message);
    };
    const notifyPaymentResult = async () => {
      if (paymentResult === 'failure') {
        notifyOnce('Pagamento não concluído', 'Nenhuma cobrança foi confirmada. Você pode tentar novamente quando quiser.');
        return;
      }
      if (paymentResult === 'pending') {
        notifyOnce('Pagamento pendente', 'Assim que o Mercado Pago aprovar o pagamento, seu acesso PRO será liberado automaticamente.');
        return;
      }
      if (paymentResult !== 'success') return;

      // O retorno do Mercado Pago pode chegar alguns segundos antes do webhook.
      // Consultamos novamente por pouco tempo para que o usuário não precise
      // atualizar a página manualmente após pagar.
      let proData = { isPro: false };
      for (let attempt = 0; attempt < 4; attempt += 1) {
        if (cancelled) return;
        try {
          proData = await getUserProStatus();
        } catch (error) {
          console.warn('Falha ao atualizar assinatura após pagamento:', error);
        }
        if (proData.isPro || attempt === 3) break;
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }

      if (cancelled) return;
      setIsPro(proData.isPro);
      if (proData.isPro) {
        notifyOnce('Pagamento aprovado!', 'Seu NaMão PRO já está ativo. Aproveite todos os recursos.');
      } else {
        notifyOnce('Pagamento recebido', 'Estamos confirmando o pagamento. Seu acesso PRO será liberado automaticamente em instantes.');
      }
    };

    notifyPaymentResult();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, navigate, showAlert]);

  const changeMonth = (offset) => {
    setCurrentDate((date) => shiftMonth(date, offset));
  };

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const formatLocalDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayStr = formatLocalDate(today);
  const tomorrowStr = formatLocalDate(tomorrow);

  const urgentItems = allExpenses.filter(item => 
    item.type === 'expense' && 
    (item.status === 'unpaid' || item.status === 'planned') && 
    (item.date === todayStr || item.date === tomorrowStr)
  );

  const budgetAlerts = useMemo(() => Object.entries(budgets)
    .filter(([, limit]) => Number(limit) > 0)
    .map(([categoryId, limit]) => ({
      categoryId,
      percent: ((Number(categoryTotals[categoryId]) || 0) / Number(limit)) * 100,
    }))
    .filter((alert) => alert.percent >= 80), [budgets, categoryTotals]);

  useEffect(() => {
    const now = new Date();
    const isCurrentMonth = currentDate.getMonth() === now.getMonth()
      && currentDate.getFullYear() === now.getFullYear();
    if (!isPro || !isCurrentMonth || !getProNotificationsEnabled()) return;
    if (getBrowserNotificationPermission() !== 'granted') return;

    // Os dados de orçamento e lançamentos chegam em operações separadas.
    // Atrasar um instante evita duas notificações enquanto a tela termina de
    // calcular os totais do mês.
    const timeoutId = window.setTimeout(() => {
      const alert = buildFinancialAlert({
        urgentItems,
        budgetAlerts,
        today: todayStr,
        tomorrow: tomorrowStr,
      });
      if (!alert) return;

      const storageKey = 'namao_last_pro_financial_alert';
      if (localStorage.getItem(storageKey) === alert.signature) return;

      try {
        new window.Notification(alert.title, {
          body: alert.body,
          icon: '/logo.png?v=20260901',
          tag: 'namao-financial-alerts',
        });
        localStorage.setItem(storageKey, alert.signature);
      } catch (error) {
        console.warn('Não foi possível exibir o alerta do navegador:', error);
      }
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [budgetAlerts, currentDate, isPro, todayStr, tomorrowStr, urgentItems]);

  return (
    <div className="dashboard animate-fade-up" data-navigation-loading={isLoading}>
      <header className="app-header dashboard-header">
        <h1 className="app-title" style={{ margin: 0 }}>
          <img src="/logo.png?v=20260901" alt="Logo do NaMão" className="logo-icon" />
          NaMão
        </h1>
      </header>

      {/* Banner PRO (Movido para baixo do cabeçalho para não encavalar com os ícones flutuantes) */}
      {!isPro && (
        <button
          type="button"
          className="dashboard-pro-banner"
          onClick={showProModal}
        >
          <Star size={18} aria-hidden="true" />
          <span><strong>Conheça o NaMão PRO</strong><small>IA sem cota mensal e backup na nuvem</small></span>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      )}

      {/* Seletor de Mês */}
      <div className="dashboard-month" data-tour="month">
        <button type="button" aria-label="Mês anterior" onClick={() => changeMonth(-1)}>
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <h3>
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h3>
        <button type="button" aria-label="Próximo mês" onClick={() => changeMonth(1)}>
          <ChevronRight size={22} aria-hidden="true" />
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

      <div className="monthly-summary" data-tour="balance" aria-live="polite" aria-atomic="true">
        <section className="glass-card monthly-summary-card" aria-labelledby="monthly-balance-title">
          <h2 id="monthly-balance-title">Saldo do Mês</h2>
          <p className={`monthly-summary-value ${balance < 0 ? 'negative' : 'positive'}`}>{formatSummaryMoney(balance)}</p>
        </section>
        <section className="glass-card monthly-summary-card" aria-labelledby="monthly-pending-title">
          <h2 id="monthly-pending-title" aria-label="Despesas a Pagar">A pagar</h2>
          <p className="monthly-summary-value">{formatSummaryMoney(toPay)}</p>
        </section>
        <div className="dashboard-breakdown">
          <p>Receitas <strong>{formatSummaryMoney(summary.incomeTotal)}</strong></p>
          <p>Despesas <strong>{formatSummaryMoney(summary.registeredExpenseTotal)}</strong></p>
        </div>
        <p className="sr-only">O saldo considera as receitas menos despesas pagas e pendentes. As despesas a pagar já estão descontadas do saldo.</p>
        {summary.plannedExpenseTotal > 0 && (
          <div className="monthly-planned-summary">
            <p>Com as planejadas: <strong className={summary.projectedBalance < 0 ? 'negative' : 'positive'}>{formatSummaryMoney(summary.projectedBalance)}</strong></p>
            <span>Inclui mais {formatSummaryMoney(summary.plannedExpenseTotal)} em despesas planejadas.</span>
          </div>
        )}
      </div>

      {/* Progresso dos Orçamentos */}
      {Object.entries(budgets).filter(([, limit]) => limit > 0).length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Orçamentos do Mês</h3>
            <Link to="/budgets" style={{ fontSize: '0.8rem', color: 'var(--color-emerald-primary)', textDecoration: 'none', fontWeight: '600' }}>EDITAR</Link>
          </div>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.entries(budgets)
              .filter(([, limit]) => limit > 0)
              .map(([catId, limit]) => {

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

      {/* Resumo das Metas Financeiras */}
      {goals.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Metas Financeiras</h3>
            <Link to="/goals" style={{ fontSize: '0.8rem', color: 'var(--color-emerald-primary)', textDecoration: 'none', fontWeight: '600' }}>VER TODAS</Link>
          </div>
          
          <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px', scrollSnapType: 'x mandatory' }} className="hide-scrollbar">
            {goals.map(goal => {
              const { currentAmount, percent, hasValidTarget, isCompleted } = getGoalProgress(goal);
              
              return (
                <div 
                  key={goal.id} 
                  className="glass-card" 
                  onClick={() => navigate(`/goal/${goal.id}`)}
                  style={{ minWidth: '220px', padding: '16px', cursor: 'pointer', scrollSnapAlign: 'start', position: 'relative', overflow: 'hidden' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '1.5rem' }}>{goal.icon || '🎯'}</div>
                    <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{goal.title}</h4>
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: isCompleted ? 'var(--color-emerald-primary)' : 'var(--text-primary)' }}>
                      R$ {currentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', fontWeight: '600' }}>
                      {hasValidTarget ? `${percent.toFixed(0)}%` : '—'}
                    </span>
                  </div>
                  
                  <div style={{ height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: isCompleted ? 'var(--color-emerald-primary)' : 'var(--color-brand-primary)', width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <section className="dashboard-transactions" data-tour="transactions" aria-label="Lançamentos do mês">
        <div className="dashboard-list-heading">
          <h3>Lançamentos</h3>
          <p aria-live="polite">{hasFilters ? `${visibleExpenses.length} de ${displayedExpenses.length}` : displayedExpenses.length} {visibleExpenses.length === 1 ? 'item' : 'itens'}</p>
        </div>
        <div className="expense-filters">
          <div className="dashboard-search-row">
            <div className="expense-search">
              <Search size={19} aria-hidden="true" />
              <input type="search" aria-label="Buscar lançamentos" placeholder="Buscar lançamento" value={search} onChange={(event) => setSearch(event.target.value)} />
              {search && <button type="button" aria-label="Limpar busca" onClick={() => setSearch('')}><X size={18} /></button>}
            </div>
            <button type="button" className="dashboard-filter-toggle" aria-label="Filtrar por categoria" aria-controls="dashboard-category-filter" aria-expanded={categoryFiltersOpen} data-active={categoryFilter !== 'all'} onClick={() => setCategoryFiltersOpen((open) => !open)}>
              <SlidersHorizontal size={20} aria-hidden="true" />
              {categoryFilter !== 'all' && <span className="dashboard-filter-dot" />}
            </button>
          </div>
          <div id="dashboard-category-filter" className="expense-category-filter" hidden={!categoryFiltersOpen}>
            <label htmlFor="expense-category-filter">Categoria</label>
            <select id="expense-category-filter" className="input-field" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">Todas as categorias</option>
              <option value="income">💰 Rendas</option>
              {CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.icon} {category.label}</option>)}
            </select>
          </div>
          <div className="expense-status-filters" role="group" aria-label="Filtrar por situação">
            {[
              ['all', 'Todos'], ['unpaid', 'Pendentes'], ['paid', 'Pagos / recebidos'], ['planned', 'Planejados'],
            ].map(([value, label]) => (
              <button key={value} type="button" aria-label={label} aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>{value === 'paid' ? 'Pagos' : label}</button>
            ))}
          </div>
          {hasFilters && <div className="expense-filter-summary">
            <p>{categoryFilter !== 'all' ? (categoryFilter === 'income' ? 'Rendas' : getCategory(categoryFilter).label) : 'Filtros ativos'}</p>
            <button type="button" onClick={clearFilters}>Limpar filtros</button>
          </div>}
        </div>
        {visibleExpenses.length === 0 ? (
          <div className="expense-empty">
            <p>{hasFilters ? 'Nenhum lançamento encontrado com esses filtros neste mês.' : 'Nenhuma movimentação neste mês.'}</p>
            {hasFilters && <button type="button" onClick={clearFilters}>Limpar filtros</button>}
          </div>
        ) : (
          <div className="dashboard-expense-list">
            {visibleExpenses.map((exp) => {
              const isIncome = exp.type === 'income';
              const isPaid = exp.status === 'paid';
              const isPlanned = exp.status === 'planned';
              const catInfo = getCategory(exp.category);
              
              const CategoryIcon = isIncome ? Wallet : (categoryIcons[exp.category] || Receipt);
              const sign = isIncome ? '+' : (isPlanned ? '~' : '−');
              const statusText = isIncome ? (isPaid ? 'Recebido' : 'A receber') : isPaid ? 'Pago' : isPlanned ? 'Planejado' : 'Pendente';

              return (
                <Link to={`/expense/${exp.id}`} key={exp.id} data-tour={exp.type === 'expense' ? 'expense' : undefined} className={`expense-list-item dashboard-expense-row${isIncome ? ' is-income' : ''}${isPlanned ? ' is-planned' : ''}`}>
                  <span className="dashboard-category-icon"><CategoryIcon size={19} aria-hidden="true" /></span>
                  <div className="dashboard-expense-description">
                    <h4>{exp.description}</h4>
                    <p><time dateTime={exp.date}>{exp.date.split('-').slice(1).reverse().join('/')}</time> · {isIncome ? 'Renda' : catInfo.label}</p>
                  </div>
                  <div className="dashboard-expense-amount">
                    <span>{sign} {formatSummaryMoney(exp.amount)}</span>
                    <small>{statusText}</small>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
