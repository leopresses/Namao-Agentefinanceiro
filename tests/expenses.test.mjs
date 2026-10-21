import assert from 'node:assert/strict';
import test from 'node:test';
import { filterExpenseList, getEntryDate } from '../src/utils/expenseList.js';
import { applyExpenseEdit, isInExpenseScope } from '../src/utils/expenseSeries.js';

const expenses = [
  { id: 'past', groupId: 'group', description: 'Cartão (1/3)', date: '2026-10-15', status: 'paid', amount: 40, category: 'saude', type: 'expense', createdAt: 'original' },
  { id: 'current', groupId: 'group', description: 'Cartão (2/3)', date: '2026-11-15', status: 'unpaid', amount: 40, category: 'saude', type: 'expense', createdAt: 'original' },
  { id: 'future', groupId: 'group', description: 'Cartão (3/3)', date: '2026-12-15', status: 'planned', amount: 40, category: 'saude', type: 'expense', createdAt: 'original' },
  { id: 'other', groupId: 'other-group', description: 'Outro cartão', date: '2026-12-15', status: 'unpaid', amount: 10, category: 'outros', type: 'expense' },
  { id: 'income', description: 'Salário', date: '2026-11-01', status: 'paid', amount: 1000, category: 'outros', type: 'income' },
];
const changes = { description: 'Cartão atualizado', amount: 55, category: 'outros', date: '2027-01-01', status: 'paid' };

test('busca ignora acentos e caixa e combina categoria e situação', () => {
  assert.deepEqual(filterExpenseList(expenses, { search: ' CARTAO ', category: 'saude', status: 'unpaid' }).map(e => e.id), ['current']);
  assert.deepEqual(filterExpenseList(expenses, { category: 'income', status: 'paid' }).map(e => e.id), ['income']);
  assert.equal(filterExpenseList(expenses, { category: 'income', status: 'unpaid' }).length, 0);
  assert.equal(filterExpenseList(expenses, { search: 'inexistente' }).length, 0);
  assert.equal(filterExpenseList(expenses).length, expenses.length);
});

test('data do novo lançamento respeita mês, ano, dia atual e fevereiro', () => {
  const today = new Date(2026, 9, 31);
  assert.equal(getEntryDate(new Date(2026, 10, 1), today), '2026-11-30');
  assert.equal(getEntryDate(new Date(2027, 1, 1), today), '2027-02-28');
  assert.equal(getEntryDate(new Date(2028, 1, 1), today), '2028-02-29');
  assert.equal(getEntryDate(null, today), '2026-10-31');
});

for (const [scope, affected] of [['one', ['current']], ['future', ['current', 'future']], ['all', ['past', 'current', 'future']]]) {
  test(`edição ${scope}: respeita alcance e preserva datas, situações, sufixos e metadados`, () => {
    const result = applyExpenseEdit(expenses, 'current', changes, scope);
    for (const entry of expenses) {
      const edited = result.find(e => e.id === entry.id);
      if (!affected.includes(entry.id)) { assert.deepEqual(edited, entry); continue; }
      assert.equal(edited.amount, 55);
      assert.equal(edited.description, entry.description.replace('Cartão', 'Cartão atualizado'));
      assert.equal(edited.createdAt, 'original');
      assert.equal(edited.date, entry.id === 'current' ? changes.date : entry.date);
      assert.equal(edited.status, entry.id === 'current' ? changes.status : entry.status);
    }
    assert.equal(expenses[1].amount, 40);
    const original = expenses[1];
    assert.deepEqual(expenses.filter(e => !isInExpenseScope(e, original, scope)).map(e => e.id), expenses.filter(e => !affected.includes(e.id)).map(e => e.id));
  });
}

test('edição recusa item removido e opção inválida', () => {
  assert.throws(() => applyExpenseEdit(expenses, 'missing', changes), /não encontrado/);
  assert.throws(() => applyExpenseEdit(expenses, 'current', changes, 'invalid'), /inválida/);
});
