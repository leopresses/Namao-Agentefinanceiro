import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBudgets, saveBudget } from '../services/db';
import { CATEGORIES } from '../utils/categories';
import { useDialog } from '../contexts/DialogContext';

export default function Budgets() {
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState({});
  const { showAlert, showPrompt } = useDialog();

  useEffect(() => {
    async function load() {
      const data = await getBudgets();
      setBudgets(data);
    }
    load();
  }, []);

  const handleSetLimit = async (categoryId, catLabel) => {
    const currentLimit = budgets[categoryId] || '';
    const newLimit = await showPrompt(`Defina o limite para ${catLabel}`, `Deixe em branco ou 0 para remover o limite mensal.`, currentLimit);
    
    if (newLimit === null) return; // cancelou

    const numValue = parseFloat(newLimit.toString().replace(',', '.'));
    
    if (newLimit.toString().trim() === '' || isNaN(numValue) || numValue <= 0) {
      // Remove o limite
      const updated = { ...budgets };
      delete updated[categoryId];
      await saveBudget(categoryId, null);
      setBudgets(updated);
      showAlert('Sucesso', `Limite de ${catLabel} removido.`);
    } else {
      await saveBudget(categoryId, numValue);
      setBudgets({ ...budgets, [categoryId]: numValue });
      showAlert('Sucesso', `Limite de ${catLabel} definido para R$ ${numValue.toFixed(2).replace('.', ',')}.`);
    }
  };

  return (
    <div className="animate-fade-up">
      <header className="app-header glass" style={{ borderRadius: '0 0 24px 24px', margin: '-24px -24px 24px -24px' }}>
        <div className="btn-icon" onClick={() => navigate(-1)} style={{ cursor: 'pointer' }}>{'<'}</div>
        <h1 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', textAlign: 'center', flex: 1, marginRight: '48px' }}>
          Limites de Orçamento
        </h1>
      </header>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px', textAlign: 'center' }}>
        Defina um teto máximo de gastos por mês para cada categoria. Nós te avisaremos se você ultrapassar.
      </p>

      <div className="glass-card" style={{ padding: '0' }}>
        {CATEGORIES.map((cat, index) => {
          const limit = budgets[cat.id];
          const hasLimit = limit > 0;

          return (
            <div 
              key={cat.id}
              onClick={() => handleSetLimit(cat.id, cat.label)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px', cursor: 'pointer',
                borderBottom: index < CATEGORIES.length - 1 ? '1px solid var(--glass-border)' : 'none',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.5rem' }}>{cat.icon}</span>
                <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{cat.label}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                {hasLimit ? (
                  <span style={{ color: 'var(--color-crimson-primary)', fontWeight: '600' }}>
                    R$ {limit.toFixed(2).replace('.', ',')}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                    Sem limite
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
