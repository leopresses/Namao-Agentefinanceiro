import { get, set, update } from 'idb-keyval';

const EXPENSES_KEY = 'namao_expenses';
const BUDGETS_KEY = 'namao_budgets';
const GOALS_KEY = 'namao_goals';

export async function getExpenses() {
  const data = await get(EXPENSES_KEY);
  return data || [];
}

export async function getExpenseById(id) {
  const data = await getExpenses();
  return data.find(e => e.id === id);
}

export async function addExpense(expense) {
  const [newExpense] = await addExpenses([expense]);
  return newExpense;
}

// Uma recorrência precisa ser gravada de uma só vez. Assim, uma interrupção
// durante o salvamento não deixa apenas parte das parcelas no dispositivo ou
// no backup automático.
export async function addExpenses(expenses) {
  const createdAt = new Date().toISOString();
  const newExpenses = expenses.map((expense) => ({
    ...expense,
    id: crypto.randomUUID(),
    createdAt,
  }));

  if (newExpenses.length === 0) return [];

  await update(EXPENSES_KEY, (val) => {
    const list = val || [];
    return [...list, ...newExpenses];
  });

  window.dispatchEvent(new CustomEvent('namao_data_changed'));
  return newExpenses;
}

export async function updateExpense(updatedExpense) {
  let wasUpdated = false;
  await update(EXPENSES_KEY, (val) => {
    const list = val || [];
    return list.map((expense) => {
      if (expense.id !== updatedExpense.id) return expense;
      wasUpdated = true;
      return updatedExpense;
    });
  });

  if (!wasUpdated) {
    throw new Error('Lançamento não encontrado para atualização.');
  }

  window.dispatchEvent(new CustomEvent('namao_data_changed'));
  return updatedExpense;
}

export async function deleteExpense(id) {
  let wasDeleted = false;
  await update(EXPENSES_KEY, (val) => {
    const list = val || [];
    const nextList = list.filter((expense) => expense.id !== id);
    wasDeleted = nextList.length !== list.length;
    return nextList;
  });
  if (wasDeleted) {
    window.dispatchEvent(new CustomEvent('namao_data_changed'));
  }
  return wasDeleted;
}

export async function deleteExpenseGroup(groupId) {
  let deletedCount = 0;
  await update(EXPENSES_KEY, (val) => {
    const list = val || [];
    const nextList = list.filter((expense) => expense.groupId !== groupId);
    deletedCount = list.length - nextList.length;
    return nextList;
  });

  if (deletedCount > 0) {
    window.dispatchEvent(new CustomEvent('namao_data_changed'));
  }
  return deletedCount;
}

export async function updateExpenseGroup(groupId, updates) {
  await update(EXPENSES_KEY, (val) => {
    const list = val || [];
    return list.map(e => {
      if (e.groupId !== groupId) return e;
      const resolvedUpdates = typeof updates === 'function' ? updates(e) : updates;
      return { ...e, ...resolvedUpdates };
    });
  });
  window.dispatchEvent(new CustomEvent('namao_data_changed'));
}

export async function clearAllExpenses() {
  await set(EXPENSES_KEY, []);
  window.dispatchEvent(new CustomEvent('namao_data_changed'));
}

export async function clearAllFinancialData() {
  await Promise.all([
    set(EXPENSES_KEY, []),
    set(BUDGETS_KEY, {}),
    set(GOALS_KEY, []),
  ]);
  window.dispatchEvent(new CustomEvent('namao_data_changed'));
}

export async function getBudgets() {
  const data = await get(BUDGETS_KEY);
  return data || {};
}

export async function saveBudget(categoryId, limitAmount) {
  await update(BUDGETS_KEY, (val) => {
    const budgets = val || {};
    if (limitAmount === null) {
      delete budgets[categoryId];
    } else {
      budgets[categoryId] = limitAmount;
    }
    return budgets;
  });
  window.dispatchEvent(new CustomEvent('namao_data_changed'));
}

// Goals functions
export async function getGoals() {
  const data = await get(GOALS_KEY);
  return data || [];
}

export async function addGoal(goal) {
  const newGoal = {
    ...goal,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString()
  };
  await update(GOALS_KEY, (val) => {
    const goals = val || [];
    return [...goals, newGoal];
  });
  window.dispatchEvent(new CustomEvent('namao_data_changed'));
}

export async function updateGoal(id, updates) {
  await update(GOALS_KEY, (val) => {
    const goals = val || [];
    return goals.map(g => g.id === id ? { ...g, ...updates } : g);
  });
  window.dispatchEvent(new CustomEvent('namao_data_changed'));
}

export async function deleteGoal(id) {
  await update(GOALS_KEY, (val) => {
    const goals = val || [];
    return goals.filter(g => g.id !== id);
  });
  window.dispatchEvent(new CustomEvent('namao_data_changed'));
}

// Backup functions
export async function setExpensesData(data) {
  await set(EXPENSES_KEY, data || []);
  window.dispatchEvent(new CustomEvent('namao_data_changed'));
}

export async function setBudgetsData(data) {
  await set(BUDGETS_KEY, data || {});
  window.dispatchEvent(new CustomEvent('namao_data_changed'));
}

export async function setGoalsData(data) {
  await set(GOALS_KEY, data || []);
  window.dispatchEvent(new CustomEvent('namao_data_changed'));
}

export async function restoreCloudData({ expenses, budgets, goals }) {
  await Promise.all([
    set(EXPENSES_KEY, expenses || []),
    set(BUDGETS_KEY, budgets || {}),
    set(GOALS_KEY, goals || [])
  ]);
  window.dispatchEvent(new CustomEvent('namao_data_changed'));
}
