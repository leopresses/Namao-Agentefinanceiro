const MAX_BACKUP_BYTES = 850_000;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isMoney = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isText = (value, max = 5000) => typeof value === 'string' && value.length <= max;
const isId = (value) => isText(value, 256) && value.length > 0;
function isDate(value) {
  if (!isText(value, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function safeJson(value, depth = 0) {
  if (depth > 12) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => safeJson(item, depth + 1));
  return isRecord(value) && Object.entries(value).every(([key, item]) =>
    !['__proto__', 'prototype', 'constructor'].includes(key) && safeJson(item, depth + 1));
}

export function validateBackupInput(input) {
  if (!isRecord(input) || !Object.keys(input).every((key) =>
    ['expenses', 'chats', 'budgets', 'goals', 'expectedRevision'].includes(key))) {
    return { status: 400, error: 'Formato de backup inválido.' };
  }
  if (!safeJson(input) || (input.expectedRevision != null && !isId(input.expectedRevision))) {
    return { status: 400, error: 'O backup contém dados inválidos.' };
  }
  if (new TextEncoder().encode(JSON.stringify(input)).byteLength > MAX_BACKUP_BYTES) {
    return { status: 413, error: 'O backup ficou grande demais. Exclua conversas antigas e tente novamente.' };
  }
  if (!Array.isArray(input.expenses) || input.expenses.length > 10_000
    || !input.expenses.every((item) => isRecord(item) && isId(item.id)
      && isText(item.description) && isMoney(item.amount) && isDate(item.date)
      && (item.type == null || ['expense', 'income'].includes(item.type))
      && (item.status == null || ['paid', 'unpaid', 'planned'].includes(item.status)))) {
    return { status: 400, error: 'Os lançamentos do backup estão inválidos.' };
  }
  if (input.chats != null && (!Array.isArray(input.chats) || input.chats.length > 500
    || !input.chats.every((chat) => isRecord(chat) && isId(chat.id) && isText(chat.title)
      && Array.isArray(chat.messages) && chat.messages.length <= 5000
      && chat.messages.every((message) => isRecord(message) && isText(message.text, 60_000)
        && ['user', 'ai'].includes(message.sender))))) {
    return { status: 400, error: 'As conversas do backup estão inválidas.' };
  }
  if (input.budgets != null && (!isRecord(input.budgets) || Object.keys(input.budgets).length > 200
    || !Object.values(input.budgets).every(isMoney))) {
    return { status: 400, error: 'Os orçamentos do backup estão inválidos.' };
  }
  if (input.goals != null && (!Array.isArray(input.goals) || input.goals.length > 1000
    || !input.goals.every((goal) => isRecord(goal) && isId(goal.id) && isText(goal.title)
      && isMoney(goal.targetAmount) && isMoney(goal.currentAmount ?? 0)
      && (goal.deadline == null || goal.deadline === '' || isDate(goal.deadline))))) {
    return { status: 400, error: 'As metas do backup estão inválidas.' };
  }
  // Only these fields ever reach Firestore; privileges cannot be imported.
  const payload = { expenses: input.expenses };
  for (const key of ['chats', 'budgets', 'goals']) {
    if (input[key] != null) payload[key] = input[key];
  }
  return { payload, expectedRevision: input.expectedRevision ?? null };
}
