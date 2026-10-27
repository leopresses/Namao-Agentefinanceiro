import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addExpenses, getExpenseById, editExpenseSeries, getBudgets, getExpenses } from '../services/db';
import { useDialog } from '../contexts/DialogContext';
import { CATEGORIES } from '../utils/categories';
import { parseBrazilianCurrency } from '../utils/currency';
import { useGoBack } from '../contexts/NavigationContext';
import ExpenseEditor from '../components/ExpenseEditor';

function formatLocalDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const RECURRENCE_SUFFIX_PATTERN = /\s\(\d+\/\d+\)$/;

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && formatLocalDate(date) === value;
}

function normalizeCategory(value) {
  return CATEGORIES.some((category) => category.id === value) ? value : 'outros';
}

function getRecurrenceSuffix(description) {
  return String(description || '').match(RECURRENCE_SUFFIX_PATTERN)?.[0] || '';
}

function removeRecurrenceSuffix(description) {
  return String(description || '').replace(RECURRENCE_SUFFIX_PATTERN, '').trim();
}

// Função para adicionar meses a uma data (YYYY-MM-DD)
function addMonths(dateString, monthsToAdd) {
  const date = new Date(dateString + 'T12:00:00'); // Evitar problemas de timezone
  const targetMonth = (date.getMonth() + monthsToAdd) % 12;
  date.setMonth(date.getMonth() + monthsToAdd);
  
  // Se pulou para o próximo mês devido ao dia 31, voltar para o último dia do mês esperado
  if (date.getMonth() !== targetMonth) {
    date.setDate(0); 
  }
  return formatLocalDate(date);
}

export default function ExpenseForm() {
  const goBack = useGoBack();
  const [searchParams] = useSearchParams();
  const requestedType = searchParams.get('type');
  const editId = searchParams.get('id');
  const [entryType, setEntryType] = useState(requestedType === 'income' ? 'income' : 'expense');
  const isIncome = entryType === 'income';
  const isEditing = !!editId;
  const [isLoading, setIsLoading] = useState(isEditing);
  const requestedDate = searchParams.get('date');

  const [description, setDescription] = useState(searchParams.get('description') || '');
  const [amount, setAmount] = useState(searchParams.get('amount') || '');
  const [date, setDate] = useState(isValidDate(requestedDate) ? requestedDate : formatLocalDate(new Date()));
  const [status, setStatus] = useState(isIncome ? 'paid' : 'unpaid');
  const [category, setCategory] = useState(normalizeCategory(searchParams.get('category')));
  
  // Opções de Recorrência (Apenas para novas despesas)
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('fixa'); // 'parcelada', 'fixa'
  const [installments, setInstallments] = useState(2);
  const [fixedMonths, setFixedMonths] = useState(12);
  const [groupId, setGroupId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showScopeDialog, setShowScopeDialog] = useState(false);
  const scopeResolver = useRef(null);
  const saveLockRef = useRef(false);
  const { showAlert } = useDialog();
  const chooseScope = (scope) => {
    setShowScopeDialog(false);
    scopeResolver.current?.(scope);
    scopeResolver.current = null;
  };

  useEffect(() => () => { scopeResolver.current?.(null); }, []);

  const [budgetLimit, setBudgetLimit] = useState(0);
  const [currentSpent, setCurrentSpent] = useState(0);

  useEffect(() => {
    if (isIncome) return;
    async function checkBudget() {
      const limits = await getBudgets();
      const limit = Number(limits[category]) || 0;
      setBudgetLimit(limit);

      if (limit > 0) {
        const allExp = await getExpenses();
        const monthDate = new Date(date + 'T12:00:00');
        const month = monthDate.getMonth();
        const year = monthDate.getFullYear();
        
        let spent = 0;
        allExp.forEach(e => {
          if (e.type === 'expense' && e.category === category && e.status !== 'planned' && e.id !== editId) {
            const eDate = new Date(e.date + 'T12:00:00');
            if (eDate.getMonth() === month && eDate.getFullYear() === year) {
              spent += e.amount;
            }
          }
        });
        setCurrentSpent(spent);
      }
    }
    checkBudget();
  }, [category, date, isIncome, editId]);

  useEffect(() => {
    if (isEditing) {
      async function loadExpense() {
        try {
          const expense = await getExpenseById(editId);
          if (!expense) {
            showAlert('Lançamento não encontrado', 'Este lançamento já foi removido ou não está disponível neste dispositivo.');
            goBack();
            return;
          }

          const suffix = expense.groupId ? getRecurrenceSuffix(expense.description) : '';
          setDescription(suffix ? removeRecurrenceSuffix(expense.description) : expense.description);
          setAmount(expense.amount.toString());
          setDate(expense.date);
          setEntryType(expense.type === 'income' ? 'income' : 'expense');
          setStatus(expense.type === 'income' ? 'paid' : expense.status);
          setCategory(normalizeCategory(expense.category));
          setGroupId(expense.groupId || null);
        } catch (error) {
          console.error('Falha ao carregar lançamento:', error);
          showAlert('Erro', 'Não foi possível abrir este lançamento para edição.');
          goBack();
        } finally {
          setIsLoading(false);
        }
      }
      loadExpense();
    }
  }, [editId, isEditing, goBack, showAlert]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saveLockRef.current || !amount || !date) return;

    const cleanDescription = description.trim();
    if (!cleanDescription) {
      showAlert('Atenção', 'Informe uma descrição para o lançamento.');
      return;
    }

    const parsedAmount = parseBrazilianCurrency(amount);
    if (parsedAmount === null || parsedAmount <= 0) {
      showAlert('Atenção', 'Informe um valor válido maior que zero. Ex.: 1.250,50');
      return;
    }

    let loops = 1;
    let currentRecurrence = 'unica';
    if (!isEditing && isRecurring) {
      currentRecurrence = recurrenceType;
      loops = Number(recurrenceType === 'parcelada' ? installments : fixedMonths);
      const maximum = recurrenceType === 'parcelada' ? 120 : 240;
      if (!Number.isInteger(loops) || loops < 2 || loops > maximum) {
        showAlert('Atenção', `Informe um número inteiro entre 2 e ${maximum} para a recorrência.`);
        return;
      }
    }

    saveLockRef.current = true;
    setIsSaving(true);
    try {
      if (isEditing) {
        const newAmount = parsedAmount;
        const baseDescription = groupId ? removeRecurrenceSuffix(cleanDescription) : cleanDescription;
        let scope = 'one';
        if (groupId) {
          scope = await new Promise((resolve) => {
            scopeResolver.current = resolve;
            setShowScopeDialog(true);
          });
          if (!scope) return;
        }

        await editExpenseSeries(editId, {
          description: baseDescription,
          amount: newAmount,
          date,
          type: entryType,
          status: isIncome ? 'paid' : status,
          category,
        }, scope);
      } else {
        const valuePerInstallment = parsedAmount;
        const recurringGroupId = loops > 1 ? Date.now().toString() + Math.random().toString(36).substring(2, 9) : null;

        const newExpenses = Array.from({ length: loops }, (_, index) => {
          const desc = currentRecurrence === 'unica'
            ? cleanDescription
            : `${cleanDescription} (${index + 1}/${loops})`;
          return {
            groupId: recurringGroupId,
            description: desc,
            amount: valuePerInstallment,
            date: addMonths(date, index),
            type: entryType,
            // Rendas entram no saldo do mês no restante do aplicativo. Mantê-las
            // como pagas evita que detalhes e relatórios mostrem "Pendente".
            status: isIncome ? 'paid' : (index === 0 ? status : 'unpaid'),
            category
          };
        });
        await addExpenses(newExpenses);
      }

      goBack();
    } catch (error) {
      console.error('Falha ao salvar lançamento:', error);
      showAlert('Erro', error.message === 'Lançamento não encontrado para atualização.'
        ? 'Este lançamento não existe mais. Atualize a lista e tente novamente.'
        : 'Não foi possível salvar o lançamento. Tente novamente.');
    } finally {
      saveLockRef.current = false;
      setIsSaving(false);
    }
  };

  return <ExpenseEditor
    isLoading={isLoading} goBack={goBack} isEditing={isEditing} isIncome={isIncome}
    handleSubmit={handleSubmit} description={description} setDescription={setDescription}
    category={category} setCategory={setCategory} amount={amount} setAmount={setAmount}
    date={date} setDate={setDate} status={status} setStatus={setStatus}
    isRecurring={isRecurring} setIsRecurring={setIsRecurring} recurrenceType={recurrenceType}
    setRecurrenceType={setRecurrenceType} installments={installments} setInstallments={setInstallments}
    fixedMonths={fixedMonths} setFixedMonths={setFixedMonths} budgetLimit={budgetLimit}
    currentSpent={currentSpent} isSaving={isSaving} showScopeDialog={showScopeDialog} chooseScope={chooseScope}
  />;
}
