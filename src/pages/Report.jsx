import { useEffect, useMemo, useRef, useState } from 'react';
import { getExpenses } from '../services/db';
import { useDialog } from '../contexts/DialogContext';
import { getCachedProStatus, getUserProStatus, onAuthChange } from '../services/firebase';
import ReportSummary from '../components/ReportSummary';
import { getCategory } from '../utils/categories';
import {
  formatLocalFileDate,
  getReportExpenses,
  summarizeReportExpenses,
} from '../utils/reporting';
import { getMonthlyInsights, shiftMonth } from '../utils/advancedReports';
import { usePageState } from '../contexts/NavigationContext';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatMoney(value) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatSignedMoney(value) {
  return `${value < 0 ? '- ' : ''}${formatMoney(Math.abs(value))}`;
}

function getStatusInfo(expense) {
  if (expense.type === 'income') {
    return { label: 'Recebida', background: 'rgba(16, 185, 129, 0.1)', color: '#059669' };
  }
  if (expense.status === 'paid') {
    return { label: 'Pago', background: 'rgba(16, 185, 129, 0.1)', color: '#059669' };
  }
  if (expense.status === 'planned') {
    return { label: 'Planejado', background: 'rgba(245, 158, 11, 0.1)', color: '#b45309' };
  }
  return { label: 'A pagar', background: 'rgba(244, 63, 94, 0.1)', color: '#E11D48' };
}

/**
 * Converte um bloco do relatório em tantas páginas A4 quanto forem
 * necessárias. Sem isso, uma imagem maior que A4 era cortada no rodapé.
 */
function addCanvasToPdf(pdf, sourceCanvas, hasContent) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const printableWidth = pageWidth - (margin * 2);
  const printableHeight = pageHeight - (margin * 2);
  const pixelsPerMillimeter = sourceCanvas.width / printableWidth;
  const maxSliceHeight = Math.max(1, Math.floor(printableHeight * pixelsPerMillimeter));
  let offsetY = 0;
  let shouldAddPage = hasContent;

  while (offsetY < sourceCanvas.height) {
    const sliceHeight = Math.min(maxSliceHeight, sourceCanvas.height - offsetY);
    const slice = document.createElement('canvas');
    slice.width = sourceCanvas.width;
    slice.height = sliceHeight;
    const context = slice.getContext('2d');
    context.drawImage(
      sourceCanvas,
      0,
      offsetY,
      sourceCanvas.width,
      sliceHeight,
      0,
      0,
      sourceCanvas.width,
      sliceHeight,
    );

    if (shouldAddPage) pdf.addPage();
    pdf.addImage(
      slice.toDataURL('image/png'),
      'PNG',
      margin,
      margin,
      printableWidth,
      sliceHeight / pixelsPerMillimeter,
    );

    shouldAddPage = true;
    offsetY += sliceHeight;
  }

  return shouldAddPage;
}

export default function Report() {
  const [allExpenses, setAllExpenses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filterMode, setFilterMode] = usePageState('filterMode', 'month');
  const [currentDate, setCurrentDate] = usePageState('month', () => new Date());
  const [isExporting, setIsExporting] = useState(false);
  const [isPro, setIsPro] = useState(getCachedProStatus);
  const reportRefs = useRef([]);
  const { showAlert, showConfirm, showProModal } = useDialog();

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const data = await getExpenses();
        if (!active) return;
        setAllExpenses(Array.isArray(data) ? data : []);
        setLoadError(false);
      } catch (error) {
        console.error('Falha ao carregar relatórios:', error);
        if (active) setLoadError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadData();
    window.addEventListener('namao_data_changed', loadData);
    return () => {
      active = false;
      window.removeEventListener('namao_data_changed', loadData);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthChange(async (user) => {
      if (!user) {
        if (active) setIsPro(false);
        return;
      }

      try {
        const status = await getUserProStatus();
        if (active) setIsPro(status.isPro);
      } catch (error) {
        console.warn('Não foi possível atualizar o plano no relatório:', error);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const displayedExpenses = useMemo(() => getReportExpenses(allExpenses, {
    filterMode,
    currentDate,
  }), [allExpenses, filterMode, currentDate]);
  const summary = useMemo(() => summarizeReportExpenses(displayedExpenses), [displayedExpenses]);
  const previousMonthDate = useMemo(() => shiftMonth(currentDate, -1), [currentDate]);
  const previousMonthExpenses = useMemo(() => getReportExpenses(allExpenses, {
    filterMode: 'month',
    currentDate: previousMonthDate,
  }), [allExpenses, previousMonthDate]);
  const previousMonthSummary = useMemo(
    () => summarizeReportExpenses(previousMonthExpenses),
    [previousMonthExpenses],
  );
  const monthlyInsights = useMemo(
    () => getMonthlyInsights(summary, previousMonthSummary),
    [summary, previousMonthSummary],
  );
  const categoryEntries = useMemo(() => Object.entries(summary.categoryTotals)
    .sort(([, amountA], [, amountB]) => amountB - amountA), [summary.categoryTotals]);

  const chunks = useMemo(() => {
    const firstPageRows = categoryEntries.length > 0 ? 3 : 7;
    const otherPageRows = 15;
    const remaining = [...displayedExpenses];
    const pages = [];

    if (remaining.length === 0) return [[]];
    pages.push(remaining.splice(0, firstPageRows));
    while (remaining.length > 0) pages.push(remaining.splice(0, otherPageRows));
    return pages;
  }, [categoryEntries.length, displayedExpenses]);

  useEffect(() => {
    reportRefs.current.length = chunks.length;
  }, [chunks.length]);

  const reportTitle = filterMode === 'all'
    ? 'Relatório Geral (Histórico até hoje)'
    : `Relatório - ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  const periodDescription = filterMode === 'all'
    ? 'O geral considera lançamentos com data até hoje. Projeções futuras aparecem no mês correspondente.'
    : 'Valores do mês selecionado, incluindo despesas a pagar e planejamentos.';
  const selectedMonthLabel = `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  const previousMonthLabel = `${MONTH_NAMES[previousMonthDate.getMonth()]} ${previousMonthDate.getFullYear()}`;
  const expenseComparison = monthlyInsights.expensesComparison;
  const expenseComparisonColor = expenseComparison.direction === 'up'
    ? 'var(--color-crimson-dark)'
    : expenseComparison.direction === 'down'
      ? 'var(--color-emerald-dark)'
      : 'var(--text-primary)';
  const expenseComparisonText = !expenseComparison.hasBaseline
    ? `Ainda não há despesas em ${previousMonthLabel} para comparar.`
    : expenseComparison.direction === 'stable'
      ? `As despesas previstas ficaram iguais a ${previousMonthLabel}.`
      : `${expenseComparison.direction === 'up' ? 'Acima' : 'Abaixo'} de ${previousMonthLabel} em ${formatMoney(Math.abs(expenseComparison.difference))} (${Math.abs(expenseComparison.percent).toFixed(1)}%).`;

  const changeMonth = (offset) => {
    if (isExporting) return;
    setCurrentDate((date) => shiftMonth(date, offset));
  };

  const handleExportPDF = async () => {
    if (displayedExpenses.length === 0) {
      showAlert('Atenção', 'Não há movimentações no período selecionado para exportar.');
      return;
    }

    const reportElements = chunks.map((_, index) => reportRefs.current[index]);
    if (reportElements.some((element) => !element)) {
      showAlert('Atenção', 'O relatório ainda está sendo preparado. Tente novamente em um instante.');
      return;
    }

    setIsExporting(true);
    try {
      // As bibliotecas pesadas só são baixadas quando o usuário exporta.
      const [pdfModule, canvasModule] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);
      const JsPdf = pdfModule.jsPDF || pdfModule.default;
      const html2canvas = canvasModule.default || canvasModule;
      const pdf = new JsPdf('p', 'mm', 'a4');
      let hasPdfContent = false;

      for (const element of reportElements) {
        const canvas = await html2canvas(element, {
          scale: 1.5,
          backgroundColor: '#F8FAFC',
          useCORS: true,
        });
        hasPdfContent = addCanvasToPdf(pdf, canvas, hasPdfContent);
      }

      if (!hasPdfContent) throw new Error('Não foi possível montar as páginas do relatório.');

      const filename = `relatorio_namao_${formatLocalFileDate()}.pdf`;
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], filename, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        const confirmed = await showConfirm(
          'Compartilhar',
          'Deseja compartilhar o relatório direto no WhatsApp ou outro aplicativo? Cancele para apenas salvar no dispositivo.',
        );
        if (confirmed) {
          try {
            await navigator.share({
              title: 'Relatório NaMão',
              text: 'Aqui está meu relatório financeiro.',
              files: [file],
            });
            return;
          } catch (shareError) {
            console.log('Compartilhamento cancelado ou indisponível:', shareError);
          }
        }
      }

      pdf.save(filename);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      showAlert('Erro', 'Não foi possível gerar o PDF. Tente novamente em alguns instantes.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="report-page animate-fade-up" data-navigation-loading={isLoading}>
      <ReportSummary
        filterMode={filterMode} setFilterMode={setFilterMode} selectedMonthLabel={selectedMonthLabel}
        changeMonth={changeMonth} isExporting={isExporting} onExport={handleExportPDF}
        isLoading={isLoading} loadError={loadError} summary={summary} categoryEntries={categoryEntries}
        hasExpenses={displayedExpenses.length > 0} isPro={isPro} showProModal={showProModal}
        monthlyInsights={monthlyInsights} expenseComparison={expenseComparison}
        expenseComparisonText={expenseComparisonText} expenseComparisonColor={expenseComparisonColor}
      />

      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        {chunks.map((chunk, pageIndex) => (
          <div key={pageIndex} ref={(element) => { reportRefs.current[pageIndex] = element; }} style={{ width: '800px', padding: '40px', background: '#F8FAFC', color: '#1E293B', fontFamily: 'Arial, sans-serif' }}>
            {pageIndex === 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', borderBottom: '2px solid rgba(16, 185, 129, 0.2)', paddingBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <img src="/logo.png?v=20260901" alt="Logo do NaMão" style={{ width: '54px', height: '54px', borderRadius: '14px' }} crossOrigin="anonymous" />
                    <div><h1 style={{ color: '#059669', margin: 0, fontSize: '27px' }}>NaMão</h1><p style={{ color: '#64748B', margin: '3px 0 0', fontSize: '14px' }}>Gestão Financeira Inteligente</p></div>
                  </div>
                  <div style={{ textAlign: 'right' }}><h2 style={{ margin: 0, color: '#1E293B', fontSize: '18px' }}>{reportTitle}</h2><p style={{ margin: '6px 0 0', color: '#64748B', fontSize: '13px' }}>Gerado em: {new Date().toLocaleDateString('pt-BR')}</p></div>
                </div>
                <p style={{ color: '#64748B', margin: '0 0 18px', fontSize: '13px' }}>{periodDescription}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
                  {[
                    ['Receitas lançadas', summary.incomeTotal, '#059669'], ['Despesas pagas', summary.paidExpenseTotal, '#E11D48'],
                    ['A pagar', summary.unpaidExpenseTotal, '#E11D48'], ['Planejadas', summary.plannedExpenseTotal, '#b45309'],
                    ['Saldo realizado', summary.cashBalance, summary.cashBalance >= 0 ? '#059669' : '#E11D48'],
                    ['Saldo previsto', summary.projectedBalance, summary.projectedBalance >= 0 ? '#047857' : '#E11D48'],
                  ].map(([label, value, color]) => (
                    <div key={label} style={{ background: '#FFFFFF', padding: '13px 16px', borderRadius: '14px', border: '1px solid rgba(15, 23, 42, 0.06)' }}>
                      <p style={{ margin: '0 0 4px', color: '#64748B', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
                      <strong style={{ color, fontSize: '17px' }}>{String(label).includes('Saldo') ? formatSignedMoney(value) : formatMoney(value)}</strong>
                    </div>
                  ))}
                </div>
                {summary.registeredExpenseTotal > 0 && (
                  <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '16px', border: '1px solid rgba(15, 23, 42, 0.06)', marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 6px', color: '#1E293B', fontSize: '16px' }}>Despesas por categoria</h3>
                    <p style={{ margin: '0 0 12px', color: '#64748B', fontSize: '12px' }}>Pagas e a pagar: {formatMoney(summary.registeredExpenseTotal)}.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {categoryEntries.map(([categoryId, amount]) => {
                        const category = getCategory(categoryId);
                        const percent = (amount / summary.registeredExpenseTotal) * 100;
                        return <div key={categoryId}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '12px' }}><span>{category.icon} {category.label}</span><span style={{ color: '#64748B', fontWeight: '600' }}>{formatMoney(amount)} ({percent.toFixed(1)}%)</span></div><div style={{ width: '100%', height: '6px', background: '#F1F5F9', borderRadius: '3px', overflow: 'hidden' }}><div style={{ width: `${percent}%`, height: '100%', background: '#E11D48', borderRadius: '3px' }} /></div></div>;
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {pageIndex > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(15, 23, 42, 0.1)', paddingBottom: '12px' }}><h2 style={{ color: '#059669', margin: 0, fontSize: '18px' }}>NaMão — continuação</h2><span style={{ color: '#64748B', fontSize: '12px' }}>Página {pageIndex + 1}</span></div>}

            <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '16px', border: '1px solid rgba(15, 23, 42, 0.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#1E293B', fontSize: '12px' }}>
                <thead><tr style={{ background: '#F1F5F9', textAlign: 'left' }}><th style={{ width: '13%', padding: '11px 8px', color: '#64748B' }}>Data</th><th style={{ width: '29%', padding: '11px 8px', color: '#64748B' }}>Descrição</th><th style={{ width: '18%', padding: '11px 8px', color: '#64748B' }}>Categoria</th><th style={{ width: '16%', padding: '11px 8px', color: '#64748B' }}>Situação</th><th style={{ width: '24%', padding: '11px 8px', textAlign: 'right', color: '#64748B' }}>Valor</th></tr></thead>
                <tbody>
                  {chunk.map((expense, index) => {
                    const status = getStatusInfo(expense);
                    const category = expense.type === 'expense' ? getCategory(expense.category) : null;
                    return (
                      <tr key={expense.id} style={{ borderBottom: index === chunk.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                        <td style={{ padding: '11px 8px', color: '#64748B' }}>{expense.date.split('-').reverse().join('/')}</td>
                        <td style={{ padding: '11px 8px', fontWeight: '500', overflowWrap: 'anywhere' }}>{expense.type === 'income' ? '💰 ' : `${category.icon} `}{expense.description}</td>
                        <td style={{ padding: '11px 8px', color: '#64748B' }}>{category ? category.label : 'Renda'}</td>
                        <td style={{ padding: '11px 8px' }}><span style={{ background: status.background, color: status.color, padding: '3px 7px', borderRadius: '99px', fontSize: '10px', fontWeight: '600', whiteSpace: 'nowrap' }}>{status.label}</span></td>
                        <td style={{ padding: '11px 8px', textAlign: 'right', fontWeight: '700', color: expense.type === 'income' ? '#059669' : '#E11D48', whiteSpace: 'nowrap' }}>{expense.type === 'income' ? '+' : '-'} {formatMoney(expense.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pageIndex === chunks.length - 1 && <div style={{ textAlign: 'center', marginTop: '24px', color: '#94A3B8', fontSize: '12px' }}>Documento gerado automaticamente pelo aplicativo NaMão</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
