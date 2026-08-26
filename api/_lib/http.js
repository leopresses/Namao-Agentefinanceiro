const DEFAULT_APP_ORIGIN = 'https://namao-agentefinanceiro.vercel.app';

export function handleCors(req, res) {
  const configuredOrigin = process.env.APP_ORIGIN || DEFAULT_APP_ORIGIN;
  const origin = req.headers.origin;

  if (origin === configuredOrigin) {
    res.setHeader('Access-Control-Allow-Origin', configuredOrigin);
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return true;
  }

  return false;
}

export function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim() || null;
}

export function getAppOrigin() {
  return process.env.APP_ORIGIN || DEFAULT_APP_ORIGIN;
}
