import crypto from 'node:crypto';
import { mock } from 'node:test';
import process from 'node:process';

export const SECRET = 'isolated-simulation-secret';
export const UID = 'simulation-user';
export const state = { records: new Map(), payments: new Map(), preferences: [], providerError: null };

function ref(path) {
  return { path, id: path.split('/').at(-1), collection: (name) => ({ doc: (id) => ref(`${path}/${name}/${id}`) }) };
}

const db = {
  collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
  runTransaction: async (callback) => {
    const writes = [];
    const value = await callback({
      get: async (reference) => ({ exists: state.records.has(reference.path), data: () => structuredClone(state.records.get(reference.path)) }),
      set: (reference, data, options) => writes.push({ reference, data, options }),
    });
    for (const { reference, data, options } of writes) {
      state.records.set(reference.path, options?.merge ? { ...state.records.get(reference.path), ...structuredClone(data) } : structuredClone(data));
    }
    return value;
  },
};

mock.module('../api/_lib/firebaseAdmin.js', { exports: {
  getAdminDb: () => db,
  getAdminAuth: () => ({ verifyIdToken: async (token) => {
    if (token !== 'simulation-token') throw new Error('Token inválido.');
    return { uid: UID, email: 'simulation@example.test' };
  } }),
} });
mock.module('mercadopago', { exports: {
  MercadoPagoConfig: class {},
  Preference: class { async create(request) {
    if (state.providerError) throw state.providerError;
    state.preferences.push(structuredClone(request.body));
    return { id: 'simulated-preference', init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=isolated-simulation' };
  } },
  Payment: class { async get({ id }) {
    if (state.providerError) throw state.providerError;
    const value = state.payments.get(String(id));
    if (!value) throw new Error('Pagamento inexistente no teste.');
    return structuredClone(value);
  } },
} });

export const checkout = (await import('../api/checkout.js')).default;
export const webhook = (await import('../api/webhook.js')).default;

export function reset() {
  state.records.clear(); state.payments.clear(); state.preferences.length = 0; state.providerError = null;
  process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST-ISOLATED-SIMULATION';
  process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
  process.env.APP_ORIGIN = 'https://app.example.test';
}

export function payment(id = 'payment-1', changes = {}) {
  const value = {
    id, status: 'approved', external_reference: `${UID}:mensal`, currency_id: 'BRL',
    transaction_amount: 9.9, date_approved: new Date().toISOString(), ...changes,
  };
  state.payments.set(String(id), value);
  return value;
}

export function signedRequest(id, changes = {}) {
  const requestId = 'simulation-request';
  const ts = String(Date.now());
  const signature = crypto.createHmac('sha256', SECRET).update(`id:${String(id).toLowerCase()};request-id:${requestId};ts:${ts};`).digest('hex');
  return {
    method: 'POST', query: { 'data.id': String(id), type: 'payment' },
    headers: { 'x-request-id': requestId, 'x-signature': `ts=${ts},v1=${signature}` },
    body: { type: 'payment', data: { id } }, ...changes,
  };
}

export async function invoke(handler, request) {
  const result = { status: 200, body: null, headers: {} };
  const response = {
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
    send(body) { result.body = body; return this; },
    setHeader(name, value) { result.headers[name] = value; },
  };
  await handler({ headers: {}, ...request }, response);
  return result;
}

export function user() { return state.records.get(`users/${UID}`); }
