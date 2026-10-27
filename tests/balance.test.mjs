import assert from 'node:assert/strict';
import test from 'node:test';
import { getReportExpenses, summarizeReportExpenses } from '../src/utils/reporting.js';
import { buildFinancialContext } from '../src/utils/financialContext.js';

const entries = [
  { id: 'income', type: 'income', amount: 2499, date: '2026-11-30', status: 'paid' },
  { id: 'expense', type: 'expense', amount: 2675, date: '2026-11-04', status: 'unpaid' },
];

test('saldo do mês desconta pendências desde o lançamento', () => {
  const summary = summarizeReportExpenses(entries);
  assert.equal(summary.availableBalance, -176);
  assert.equal(summary.unpaidExpenseTotal, 2675);
  assert.equal(summary.cashBalance, 2499);
});

test('marcar como paga ou pendente não desconta a despesa novamente', () => {
  const paid = summarizeReportExpenses(entries.map((entry) => ({ ...entry, status: 'paid' })));
  assert.equal(paid.availableBalance, -176);
  assert.equal(paid.unpaidExpenseTotal, 0);
  assert.equal(paid.cashBalance, -176);
  assert.equal(summarizeReportExpenses(entries).availableBalance, paid.availableBalance);
});

test('planejamentos são separados e editar ou remover compromissos altera o saldo', () => {
  const withPlan = summarizeReportExpenses([...entries, { type: 'expense', status: 'planned', amount: 100 }]);
  assert.equal(withPlan.availableBalance, -176);
  assert.equal(withPlan.projectedBalance, -276);
  assert.equal(withPlan.plannedExpenseTotal, 100);
  assert.equal(summarizeReportExpenses(entries.map(e => e.id === 'expense' ? { ...e, amount: 1000 } : e)).availableBalance, 1499);
  assert.equal(summarizeReportExpenses(entries.filter(e => e.id !== 'expense')).availableBalance, 2499);
});

test('resumo isola o mês escolhido e não depende de busca ou filtros da lista', () => {
  const month = getReportExpenses([...entries, { type: 'expense', amount: 5000, date: '2026-12-01', status: 'unpaid' }], { filterMode: 'month', currentDate: new Date(2026, 10, 1) });
  assert.equal(summarizeReportExpenses(month).availableBalance, -176);
  assert.equal(month.length, 2);
});

test('arredondamento não mostra saldo negativo de frações de centavo', () => {
  assert.equal(summarizeReportExpenses([
    { type: 'income', amount: 0.3 },
    { type: 'expense', status: 'paid', amount: 0.1 },
    { type: 'expense', status: 'unpaid', amount: 0.2 },
  ]).availableBalance, 0);
});

test('IA recebe os conceitos de saldo separados e valores coerentes com o painel', () => {
  const context = buildFinancialContext({ expenses: entries, budgets: {}, goals: [] });
  assert.match(context, /saldo realizado \(receitas menos pagas\) R\$ 2\.499,00/);
  assert.match(context, /saldo do mês \(receitas menos pagas e pendentes\) R\$ -176,00/);
});
