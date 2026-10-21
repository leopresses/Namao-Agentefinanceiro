export function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

export function filterExpenseList(expenses, { search = '', category = 'all', status = 'all' } = {}) {
  const query = normalizeSearch(search);
  return expenses.filter((expense) => {
    if (query && !normalizeSearch(expense.description).includes(query)) return false;
    if (category === 'income' && expense.type !== 'income') return false;
    if (category !== 'all' && category !== 'income'
      && (expense.type !== 'expense' || expense.category !== category)) return false;
    if (status === 'paid') return expense.status === 'paid';
    if (status !== 'all') return expense.type === 'expense' && expense.status === status;
    return true;
  });
}

// Usa o dia de hoje no mês escolhido, limitado ao último dia desse mês.
export function getEntryDate(month, today = new Date()) {
  const date = month instanceof Date ? month : today;
  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  const day = Math.min(today.getDate(), new Date(year, monthIndex + 1, 0).getDate());
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
