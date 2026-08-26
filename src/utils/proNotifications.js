const NOTIFICATIONS_ENABLED_KEY = 'namao_pro_notifications_enabled';

export function areBrowserNotificationsAvailable() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission() {
  return areBrowserNotificationsAvailable() ? window.Notification.permission : 'unsupported';
}

export function getProNotificationsEnabled() {
  return localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === 'true';
}

export function setProNotificationsEnabled(enabled) {
  localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');
}

/**
 * Agrupa os alertas para não criar uma notificação por lançamento. O aviso é
 * preparado para ser exibido, no máximo, uma vez para a combinação atual.
 */
export function buildFinancialAlert({ urgentItems = [], budgetAlerts = [], today, tomorrow }) {
  const dueToday = urgentItems.filter((item) => item.date === today).length;
  const dueTomorrow = urgentItems.filter((item) => item.date === tomorrow).length;
  const budgetsOverLimit = budgetAlerts.filter((alert) => alert.percent >= 100).length;
  const budgetsNearLimit = budgetAlerts.filter((alert) => alert.percent >= 80 && alert.percent < 100).length;
  const parts = [];

  if (dueToday > 0) parts.push(`${dueToday} vencimento${dueToday > 1 ? 's' : ''} hoje`);
  if (dueTomorrow > 0) parts.push(`${dueTomorrow} para amanhã`);
  if (budgetsOverLimit > 0) parts.push(`${budgetsOverLimit} orçamento${budgetsOverLimit > 1 ? 's' : ''} no limite`);
  if (budgetsNearLimit > 0) parts.push(`${budgetsNearLimit} orçamento${budgetsNearLimit > 1 ? 's' : ''} perto do limite`);

  if (parts.length === 0) return null;

  const signature = JSON.stringify({
    urgent: urgentItems.map((item) => `${item.id}:${item.date}:${item.status}`).sort(),
    budgets: budgetAlerts.map((alert) => `${alert.categoryId}:${alert.percent.toFixed(0)}`).sort(),
  });

  return {
    title: 'Alertas financeiros NaMão',
    body: parts.join(' · '),
    signature,
  };
}
