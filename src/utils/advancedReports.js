function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/**
 * Cria uma data estável para o primeiro dia de outro mês. Usar o dia 1 evita
 * que navegar a partir de dias 29–31 pule um mês em calendários menores.
 */
export function shiftMonth(date, offset) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1, 12);
}

/**
 * Mostra o total de saídas que o usuário já pagou ou ainda pretende pagar no
 * mês: pagas, a pagar e planejadas.
 */
export function getExpectedExpenses(summary = {}) {
  return asNumber(summary.paidExpenseTotal)
    + asNumber(summary.unpaidExpenseTotal)
    + asNumber(summary.plannedExpenseTotal);
}

export function getComparison(currentValue, previousValue) {
  const current = asNumber(currentValue);
  const previous = asNumber(previousValue);
  const difference = current - previous;

  return {
    current,
    previous,
    difference,
    percent: previous > 0 ? (difference / previous) * 100 : null,
    hasBaseline: previous > 0,
    direction: difference > 0 ? 'up' : difference < 0 ? 'down' : 'stable',
  };
}

export function getMonthlyInsights(currentSummary = {}, previousSummary = {}) {
  const expectedExpenses = getExpectedExpenses(currentSummary);
  const previousExpectedExpenses = getExpectedExpenses(previousSummary);

  return {
    expectedExpenses,
    pendingAndPlanned: asNumber(currentSummary.unpaidExpenseTotal)
      + asNumber(currentSummary.plannedExpenseTotal),
    projectedBalance: asNumber(currentSummary.projectedBalance),
    expensesComparison: getComparison(expectedExpenses, previousExpectedExpenses),
    incomeComparison: getComparison(
      asNumber(currentSummary.incomeTotal),
      asNumber(previousSummary.incomeTotal),
    ),
  };
}
