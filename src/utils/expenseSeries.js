const SUFFIX = /\s\(\d+\/\d+\)$/;

export function isInExpenseScope(expense, original, scope) {
  if (expense.id === original.id) return true;
  if (!original.groupId || expense.groupId !== original.groupId || scope === 'one') return false;
  return scope === 'all' || (scope === 'future' && expense.date >= original.date);
}

export function applyExpenseEdit(expenses, id, changes, scope = 'one') {
  if (!['one', 'future', 'all'].includes(scope)) throw new Error('Opção de recorrência inválida.');
  const original = expenses.find((expense) => expense.id === id);
  if (!original) throw new Error('Lançamento não encontrado para atualização.');
  const description = original.groupId ? changes.description.replace(SUFFIX, '') : changes.description;
  return expenses.map((expense) => {
    if (!isInExpenseScope(expense, original, scope)) return expense;
    const suffix = original.groupId ? expense.description.match(SUFFIX)?.[0] || '' : '';
    const shared = { amount: changes.amount, category: changes.category, description: `${description}${suffix}` };
    // A decisão considera a data original, mesmo se a parcela aberta mudar de mês.
    // Não altera datas, situações ou metadados das outras parcelas.
    return expense.id === id
      ? { ...expense, ...changes, ...shared }
      : { ...expense, ...shared };
  });
}
