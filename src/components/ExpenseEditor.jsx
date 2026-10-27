import PageHeader from './PageHeader';
import RecurrenceScopeDialog from './RecurrenceScopeDialog';
import { CATEGORIES } from '../utils/categories';
import { parseBrazilianCurrency } from '../utils/currency';

export default function ExpenseEditor({ isLoading, goBack, isEditing, isIncome, handleSubmit, description, setDescription, category, setCategory, amount, setAmount, date, setDate, status, setStatus, isRecurring, setIsRecurring, recurrenceType, setRecurrenceType, installments, setInstallments, fixedMonths, setFixedMonths, budgetLimit, currentSpent, isSaving, showScopeDialog, chooseScope }) {
  return <div className="modern-page" data-navigation-loading={isLoading}>
    <PageHeader title={isEditing ? 'Editar Lançamento' : isIncome ? 'Nova Renda' : 'Nova Despesa'} onBack={goBack} />
    <div className="surface-card"><form onSubmit={handleSubmit}>
      <div className="input-group"><label className="input-label" htmlFor="entry-description">Descrição</label><input id="entry-description" type="text" placeholder="ex: Salário, Aluguel" className="input-field" value={description} onChange={event => setDescription(event.target.value)} required /></div>
      {!isIncome && <div className="input-group"><label className="input-label" htmlFor="entry-category">Categoria</label><select id="entry-category" className="input-field modern-category-select" value={category} onChange={event => setCategory(event.target.value)}>{CATEGORIES.map(cat => <option value={cat.id} key={cat.id}>{cat.icon} {cat.label}</option>)}</select>
        {budgetLimit > 0 && <div className="account-notice"><p>Orçamento mensal: <strong>R$ {budgetLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p><p>Já gasto: R$ {currentSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>{status !== 'planned' && currentSpent + (parseBrazilianCurrency(amount) || 0) > budgetLimit && <p className="report-negative">Ultrapassará o limite</p>}</div>}
      </div>}
      <div className="input-group"><label className="input-label" htmlFor="entry-amount">Valor (R$)</label><input id="entry-amount" type="text" inputMode="decimal" placeholder="0,00" className="input-field" value={amount} onChange={event => setAmount(event.target.value)} required /></div>
      <div className="input-group"><label className="input-label" htmlFor="entry-date">Data</label><input id="entry-date" type="date" className="input-field" value={date} onChange={event => setDate(event.target.value)} required /></div>
      {!isIncome && <div className="input-group"><label className="input-label" htmlFor="entry-status">Situação</label><select id="entry-status" className="input-field" value={status} onChange={event => setStatus(event.target.value)}><option value="paid">Paga (Já foi paga)</option><option value="unpaid">A Pagar (Fatura em aberto)</option><option value="planned">Planejamento / Lembrete Futuro</option></select></div>}
      {!isEditing && <>
        <button type="button" className="modern-repeat" role="switch" aria-label="Repetir" aria-checked={isRecurring} onClick={() => setIsRecurring(!isRecurring)}><span>Repetir lançamento</span><span className="modern-switch" aria-hidden="true" /></button>
        {isRecurring && <>
          <div className="modern-recurrence-types" role="group" aria-label="Tipo de repetição"><button type="button" aria-pressed={recurrenceType === 'fixa'} onClick={() => setRecurrenceType('fixa')}>Fixo</button><button type="button" aria-pressed={recurrenceType === 'parcelada'} onClick={() => setRecurrenceType('parcelada')}>Parcelado</button></div>
          {recurrenceType === 'parcelada' ? <div className="input-group"><label className="input-label" htmlFor="entry-installments">Número de Parcelas</label><input id="entry-installments" type="number" min="2" max="120" className="input-field" value={installments} onChange={event => setInstallments(event.target.value)} required /><p className="help-footnote">O valor informado é o valor de cada parcela.</p></div> : <div className="input-group"><label className="input-label" htmlFor="entry-months">Projetar por quantos meses?</label><input id="entry-months" type="number" min="2" max="240" className="input-field" value={fixedMonths} onChange={event => setFixedMonths(event.target.value)} required /><p className="help-footnote">Você pode ajustar o prazo de repetição. O padrão é 12 meses.</p></div>}
        </>}
      </>}
      <button type="submit" disabled={isSaving} className="btn-primary" style={{ width: '100%', marginTop: 18 }}>{isSaving ? 'Salvando...' : isEditing ? 'Atualizar Lançamento' : 'Salvar'}</button>
    </form></div>
    {showScopeDialog && <RecurrenceScopeDialog onChoose={chooseScope} />}
  </div>;
}
