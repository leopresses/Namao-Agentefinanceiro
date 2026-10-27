import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useGoBack } from '../contexts/NavigationContext';
import { getBudgets, saveBudget } from '../services/db';
import { CATEGORIES } from '../utils/categories';
import { useDialog } from '../contexts/DialogContext';
import { parseBrazilianCurrency } from '../utils/currency';

export default function Budgets() {
  const goBack = useGoBack();
  const [budgets, setBudgets] = useState({});
  const { showAlert, showPrompt } = useDialog();

  useEffect(() => {
    async function load() {
      const data = await getBudgets();
      setBudgets(data);
    }
    load();

    window.addEventListener('namao_data_changed', load);
    return () => window.removeEventListener('namao_data_changed', load);
  }, []);

  const handleSetLimit = async (categoryId, catLabel) => {
    const currentLimit = budgets[categoryId] || '';
    const newLimit = await showPrompt(`Defina o limite para ${catLabel}`, `Deixe em branco ou 0 para remover o limite mensal.`, currentLimit);
    
    if (newLimit === null) return; // cancelou

    const numValue = parseBrazilianCurrency(newLimit);
    
    try {
      if (newLimit.toString().trim() === '' || numValue === 0) {
        const updated = { ...budgets };
        delete updated[categoryId];
        await saveBudget(categoryId, null);
        setBudgets(updated);
        showAlert('Sucesso', `Limite de ${catLabel} removido.`);
      } else if (numValue !== null && numValue > 0) {
        await saveBudget(categoryId, numValue);
        setBudgets({ ...budgets, [categoryId]: numValue });
        showAlert('Sucesso', `Limite de ${catLabel} definido para R$ ${numValue.toFixed(2).replace('.', ',')}.`);
      } else {
        showAlert('Atenção', 'Informe um limite válido maior que zero ou deixe em branco para remover.');
      }
    } catch (error) {
      console.error('Não foi possível salvar o limite de orçamento:', error);
      showAlert('Erro', 'Não foi possível salvar esse limite agora. Tente novamente.');
    }
  };

  return <div className="modern-page">
    <PageHeader title="Limites de Orçamento" onBack={goBack} />
    <p className="modern-subtitle">Defina um teto mensal por categoria. O painel considera despesas pagas e pendentes, sem planejamentos.</p>
    <div className="budget-list">{CATEGORIES.map(cat => {
      const limit = Number(budgets[cat.id]) || 0;
      return <button type="button" key={cat.id} className="budget-row" onClick={() => handleSetLimit(cat.id, cat.label)} aria-label={`Definir limite de ${cat.label}`}><span className="budget-category"><span aria-hidden="true">{cat.icon}</span>{cat.label}</span><span className={`budget-limit${limit > 0 ? '' : ' unset'}`}>{limit > 0 ? `R$ ${limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Sem limite'}</span></button>;
    })}</div>
  </div>;
}
