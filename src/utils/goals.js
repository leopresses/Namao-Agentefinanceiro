function toNonNegativeAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

export function getGoalProgress(goal) {
  const rawTarget = Number(goal?.targetAmount);
  const hasValidTarget = Number.isFinite(rawTarget) && rawTarget > 0;
  const currentAmount = toNonNegativeAmount(goal?.currentAmount);
  const targetAmount = hasValidTarget ? rawTarget : 0;
  const percent = hasValidTarget ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;

  return {
    currentAmount,
    targetAmount,
    percent,
    hasValidTarget,
    isCompleted: hasValidTarget && currentAmount >= targetAmount,
  };
}

export function formatGoalDeadline(deadline) {
  const match = String(deadline || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('pt-BR');
}
