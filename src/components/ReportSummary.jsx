import { ChevronDown, ChevronLeft, ChevronRight, Download, LoaderCircle, Lock, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { getCategory } from '../utils/categories';
import { usePageState } from '../contexts/NavigationContext';
import '../pages/Report.css';

function money(value) {
  return `${value < 0 ? '− ' : ''}R$ ${Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ReportSummary({
  filterMode, setFilterMode, selectedMonthLabel, changeMonth, isExporting, onExport,
  isLoading, loadError, summary, categoryEntries, hasExpenses, isPro, showProModal,
  monthlyInsights, expenseComparison, expenseComparisonText, expenseComparisonColor,
}) {
  const [compositionOpen, setCompositionOpen] = usePageState('compositionOpen', false);
  const composition = [
    ['Receitas', summary.incomeTotal], ['Despesas pagas', summary.paidExpenseTotal],
    ['A pagar', summary.unpaidExpenseTotal], ['Planejadas', summary.plannedExpenseTotal],
    ['Saldo realizado', summary.cashBalance], ['Saldo previsto', summary.projectedBalance],
  ];

  return (
    <>
      <header className="report-brand-header">
        <div className="app-title"><img src="/logo.png?v=20260901" alt="" className="logo-icon" />NaMão</div>
      </header>
      <div className="report-title-row">
        <h1>Resumo</h1>
        <button type="button" className="report-icon-button report-export" aria-label={isExporting ? 'Gerando PDF' : 'Exportar e compartilhar'} disabled={isExporting || isLoading || loadError || !hasExpenses} onClick={onExport}>
          {isExporting ? <LoaderCircle size={20} className="spin" aria-hidden="true" /> : <Download size={20} aria-hidden="true" />}
        </button>
        <span className="report-sr-only" role="status">{isExporting ? 'Gerando PDF...' : ''}</span>
      </div>

      <div className="report-period" role="group" aria-label="Período do resumo">
        <button type="button" aria-pressed={filterMode === 'month'} disabled={isExporting} onClick={() => setFilterMode('month')}>Por Mês</button>
        <button type="button" aria-pressed={filterMode === 'all'} disabled={isExporting} onClick={() => setFilterMode('all')}>Geral</button>
      </div>
      {filterMode === 'month' ? (
        <div className="report-month">
          <button type="button" className="report-icon-button" aria-label="Mês anterior" disabled={isExporting} onClick={() => changeMonth(-1)}><ChevronLeft size={22} aria-hidden="true" /></button>
          <h2>{selectedMonthLabel}</h2>
          <button type="button" className="report-icon-button" aria-label="Próximo mês" disabled={isExporting} onClick={() => changeMonth(1)}><ChevronRight size={22} aria-hidden="true" /></button>
        </div>
      ) : <div className="report-history"><h2>Histórico até hoje</h2><p>Meses futuros aparecem em “Por Mês”.</p></div>}

      {loadError ? (
        <section className="report-notice" role="alert"><h2>Não foi possível carregar os relatórios</h2><p>Verifique o armazenamento do dispositivo e tente abrir a página novamente.</p></section>
      ) : isLoading ? (
        <p className="report-loading" role="status">Carregando seu resumo...</p>
      ) : !hasExpenses ? (
        <section className="report-notice"><h2>Nenhum lançamento no período</h2><p>Altere o mês ou adicione novas receitas e despesas para gerar o relatório.</p></section>
      ) : (
        <>
          <section className="report-balance" aria-label={filterMode === 'month' ? 'Saldo do mês' : 'Saldo do período'}>
            <h2>{filterMode === 'month' ? 'Saldo do mês' : 'Saldo do período'}</h2>
            <p className={`report-balance-value ${summary.availableBalance < 0 ? 'report-negative' : 'report-positive'}`}>{money(summary.availableBalance)}</p>
            <p className="report-caption">Já considera as despesas pagas e pendentes</p>
            <div className="report-totals">
              <div><span>Receitas</span><strong>{money(summary.incomeTotal)}</strong></div>
              <div><span>Despesas</span><strong>{money(summary.registeredExpenseTotal)}</strong></div>
            </div>
          </section>
          <details className="report-composition" open={compositionOpen} onToggle={(event) => setCompositionOpen(event.currentTarget.open)}>
            <summary>Ver composição do saldo <ChevronDown size={17} aria-hidden="true" /></summary>
            <dl>{composition.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl>
            <p className="report-caption">Realizado: receitas menos despesas pagas. Previsto: desconta também pendências e planejadas.</p>
          </details>

          {summary.registeredExpenseTotal > 0 && (
            <section className="report-categories" aria-labelledby="report-categories-title">
              <div className="report-section-heading"><h2 id="report-categories-title">Para onde foi o dinheiro</h2><span>Por categoria</span></div>
              <div className="report-category-list">
                {categoryEntries.map(([id, amount]) => {
                  const category = getCategory(id);
                  const percent = amount / summary.registeredExpenseTotal * 100;
                  return <div key={id} className="report-category-row">
                    <div className="report-category-top">
                      <span className="report-category-name"><span aria-hidden="true">{category.icon}</span>{category.label}</span>
                      <span className="report-category-value"><strong>{money(amount)}</strong><small>{percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</small></span>
                    </div>
                    <div className="report-category-track" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
                  </div>;
                })}
              </div>
              <p className="report-footnote">Despesas pagas e pendentes. Planejadas à parte.</p>
            </section>
          )}
        </>
      )}

      {filterMode === 'month' && !loadError && !isLoading && hasExpenses && (
        <section className="report-insights" aria-labelledby="report-insights-title">
          <div className="report-section-heading"><h2 id="report-insights-title">Previsão e comparativo</h2><span className="report-pro-tag">{isPro ? <Sparkles size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}PRO</span></div>
          <div className="report-insight-content">
            {isPro ? <>
              <div className="report-forecast"><div><h3>Fechamento previsto</h3><p>Inclui {money(summary.plannedExpenseTotal)} em planejadas</p></div><strong className={monthlyInsights.projectedBalance < 0 ? 'report-negative' : 'report-positive'}>{money(monthlyInsights.projectedBalance)}</strong></div>
              <div className="report-comparison">
                {expenseComparison.direction === 'down' ? <TrendingDown size={18} aria-hidden="true" /> : <TrendingUp size={18} aria-hidden="true" />}
                <div><h3>Comparativo de despesas previstas</h3><p style={{ color: expenseComparisonColor }}>{expenseComparisonText}</p><small>Em {selectedMonthLabel}: {money(monthlyInsights.expectedExpenses)}.</small></div>
              </div>
              <details className="report-insight-details"><summary>Ver compromissos pendentes</summary><p>A pagar e planejadas: <strong>{money(monthlyInsights.pendingAndPlanned)}</strong></p></details>
            </> : <>
              <p className="report-caption">Compare meses e acompanhe a previsão de fechamento com o NaMão PRO.</p>
              <button type="button" className="report-unlock" onClick={showProModal}>Desbloquear insights PRO</button>
            </>}
          </div>
        </section>
      )}
    </>
  );
}
