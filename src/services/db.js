import { get, set, update } from 'idb-keyval';

const EXPENSES_KEY = 'namao_expenses';

export async function getExpenses() {
  const data = await get(EXPENSES_KEY);
  return data || [];
}

export async function getExpenseById(id) {
  const data = await getExpenses();
  return data.find(e => e.id === id);
}

export async function addExpense(expense) {
  const newExpense = {
    ...expense,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };
  
  await update(EXPENSES_KEY, (val) => {
    const list = val || [];
    return [...list, newExpense];
  });
  
  window.dispatchEvent(new CustomEvent('namao_data_changed'));
  return newExpense;
}

export async function updateExpense(updatedExpense) {
  await update(EXPENSES_KEY, (val) => {
    const list = val || [];
    return list.map(e => e.id === updatedExpense.id ? updatedExpense : e);
  });
  window.dispatchEvent(new CustomEvent('namao_data_changed'));
  return updatedExpense;
}

export async function deleteExpense(id) {
  await update(EXPENSES_KEY, (val) => {
    const list = val || [];
    return list.filter(e => e.id !== id);
  });
  window.dispatchEvent(new CustomEvent('namao_data_changed'));
}

export async function updateExpenseGroupAmount(groupId, newAmount, fromDate) {
  await update(EXPENSES_KEY, (val) => {
    const list = val || [];
    return list.map(e => (e.groupId === groupId && e.date >= fromDate) ? { ...e, amount: newAmount } : e);
  });
  window.dispatchEvent(new CustomEvent('namao_data_changed'));
}

export async function clearAllExpenses() {
  await set(EXPENSES_KEY, []);
  window.dispatchEvent(new CustomEvent('namao_data_changed'));
}

// Backup functions
export async function setExpensesData(data) {
  await set(EXPENSES_KEY, data);
  window.dispatchEvent(new CustomEvent('namao_data_changed'));
}

export async function exportBackup() {
  const data = await getExpenses();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `namao_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (Array.isArray(data)) {
          await set(EXPENSES_KEY, data);
          resolve(true);
        } else {
          reject('Formato inválido');
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}
