import { getIdToken } from './firebase';

async function adminRequest(payload) {
  const token = await getIdToken();
  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível concluir a operação administrativa.');
  }

  return data;
}

export function getAdminSummary(pageToken) {
  return adminRequest({ action: 'summary', ...(pageToken ? { pageToken } : {}) });
}

export function findAdminUser(email) {
  return adminRequest({ action: 'find', email });
}

export function grantAdminPro(email, duration) {
  return adminRequest({ action: 'grant', email, duration });
}

export function revokeAdminPro(email) {
  return adminRequest({ action: 'revoke', email });
}
