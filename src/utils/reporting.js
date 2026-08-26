function parseLocalDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function dayAtNoon(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

/**
 * Normaliza registros antigos/importados antes de apresentá-los no relatório.
 * Um registro sem data ou valor válido não pode quebrar toda a página.
 */
function normalizeExpense(expense) {
  const amount = Number(expense?.amount);
  const date = parseLocalDate(expense?.date);
  if (!expense || !date || !Number.isFinite(amount) || amount < 0) return null;

  return { ...expense, amount };
}

/**
 * O modo geral representa o histórico concluído até hoje. Projeções futuras
 * aparecem apenas ao selecionar o mês correspondente, evitando que gastos
 * recorrentes dos próximos anos inflem o relatório histórico.
 */
export function getReportExpenses(expenses, { filterMode, currentDate, today = new Date() }) {
  const normalized = (Array.isArray(expenses) ? expenses : [])
    .map(normalizeExpense)
    .filter(Boolean);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const todayAtNoon = dayAtNoon(today);

  return normalized
    .filter((expense) => {
      const date = parseLocalDate(expense.date);
      if (!date) return false;

      if (filterMode === 'month') {
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      }

      return date <= todayAtNoon;
    })
    .sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date));
}

/**
 * Mantém os conceitos separados:
 * - saldo realizado: entradas menos despesas efetivamente pagas;
 * - saldo previsto: entradas menos pagamentos, pendências e planejamentos;
 * - categorias: despesas registradas (pagas + a pagar), sem planejamentos.
 */
export function summarizeReportExpenses(expenses) {
  const summary = {
    incomeTotal: 0,
    paidExpenseTotal: 0,
    unpaidExpenseTotal: 0,
    plannedExpenseTotal: 0,
    registeredExpenseTotal: 0,
    categoryTotals: {},
  };

  expenses.forEach((expense) => {
    const amount = Number(expense.amount);
    if (!Number.isFinite(amount)) return;

    if (expense.type === 'income') {
      summary.incomeTotal += amount;
      return;
    }

    if (expense.type !== 'expense') return;

    if (expense.status === 'paid') {
      summary.paidExpenseTotal += amount;
    } else if (expense.status === 'planned') {
      summary.plannedExpenseTotal += amount;
      return;
    } else {
      summary.unpaidExpenseTotal += amount;
    }

    const category = expense.category || 'outros';
    summary.categoryTotals[category] = (summary.categoryTotals[category] || 0) + amount;
    summary.registeredExpenseTotal += amount;
  });

  return {
    ...summary,
    cashBalance: summary.incomeTotal - summary.paidExpenseTotal,
    projectedBalance: summary.incomeTotal
      - summary.paidExpenseTotal
      - summary.unpaidExpenseTotal
      - summary.plannedExpenseTotal,
  };
}

export function formatLocalFileDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
