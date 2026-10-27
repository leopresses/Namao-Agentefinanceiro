import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import process from 'node:process';
import { checkout, invoke, payment, reset, signedRequest, state, UID, user, webhook } from './paymentsHarness.mjs';

beforeEach(reset);

for (const [planType, price] of [['mensal', 9.9], ['anual', 89]]) {
  test(`checkout ${planType}: servidor define preço, conta e retorno`, async () => {
    const result = await invoke(checkout, { method: 'POST', headers: { authorization: 'Bearer simulation-token' }, body: { planType, price: 0.01, uid: 'another-user' } });
    assert.equal(result.status, 200);
    assert.match(result.body.init_point, /^https:\/\/www.mercadopago.com.br\//);
    const preference = state.preferences[0];
    assert.equal(preference.items[0].unit_price, price);
    assert.equal(preference.items[0].currency_id, 'BRL');
    assert.equal(preference.external_reference, `${UID}:${planType}`);
    assert.equal(preference.back_urls.success, 'https://app.example.test/?payment=success');
    assert.equal(preference.back_urls.pending, 'https://app.example.test/?payment=pending');
    assert.equal(preference.back_urls.failure, 'https://app.example.test/?payment=failure');
  });
}

test('checkout recusa acesso sem login, token inválido e plano desconhecido', async () => {
  assert.equal((await invoke(checkout, { method: 'POST', body: { planType: 'mensal' } })).status, 401);
  assert.equal((await invoke(checkout, { method: 'POST', headers: { authorization: 'Bearer invalid' }, body: {} })).status, 401);
  assert.equal((await invoke(checkout, { method: 'POST', headers: { authorization: 'Bearer simulation-token' }, body: { planType: 'unknown' } })).status, 400);
  assert.equal(state.preferences.length, 0);
});

for (const [plan, amount, days] of [['mensal', 9.9, 30], ['anual', 89, 365]]) {
  test(`pagamento ${plan} aprovado libera ${days} dias de PRO`, async () => {
    const original = payment('approved', { external_reference: `${UID}:${plan}`, transaction_amount: amount });
    const result = await invoke(webhook, signedRequest(original.id));
    assert.equal(result.status, 200);
    assert.equal(user().isPro, true);
    assert.equal(user().planType, plan);
    assert.equal(new Date(user().proExpiresAt).getTime() - new Date(original.date_approved).getTime(), days * 86400000);
    const expiry = user().proExpiresAt;
    await invoke(webhook, signedRequest(original.id));
    assert.equal(user().proExpiresAt, expiry);
  });
}

for (const status of ['pending', 'in_process', 'rejected', 'cancelled']) {
  test(`${status}: PRO não é liberado`, async () => {
    payment(status, { status });
    assert.equal((await invoke(webhook, signedRequest(status))).status, 200);
    assert.equal(user(), undefined);
  });
}

test('renovação soma o período ao vencimento existente', async () => {
  const expiresAt = new Date(Date.now() + 90 * 86400000).toISOString();
  state.records.set(`users/${UID}`, { isPro: true, planType: 'mensal', proExpiresAt: expiresAt });
  payment();
  await invoke(webhook, signedRequest('payment-1'));
  assert.equal(new Date(user().proExpiresAt).getTime() - new Date(expiresAt).getTime(), 30 * 86400000);
});

test('pagamento antigo repetido após nova compra não renova novamente', async () => {
  payment('first'); payment('second');
  await invoke(webhook, signedRequest('first'));
  await invoke(webhook, signedRequest('second'));
  const expiry = user().proExpiresAt;
  await invoke(webhook, signedRequest('first'));
  assert.equal(user().proExpiresAt, expiry);
});

test('último pagamento da versão anterior também é protegido após uma nova compra', async () => {
  const expiresAt = new Date(Date.now() + 20 * 86400000).toISOString();
  state.records.set(`users/${UID}`, { isPro: true, proExpiresAt: expiresAt, lastPaymentId: 'legacy' });
  payment('legacy'); payment('new');
  await invoke(webhook, signedRequest('new'));
  const expiry = user().proExpiresAt;
  await invoke(webhook, signedRequest('legacy'));
  assert.equal(user().proExpiresAt, expiry);
});

for (const changes of [{ transaction_amount: 1 }, { currency_id: 'USD' }, { external_reference: 'invalid' }, { transaction_amount: undefined }]) {
  test(`aprovação inconsistente é recusada: ${JSON.stringify(changes)}`, async () => {
    payment('inconsistent', changes);
    assert.notEqual((await invoke(webhook, signedRequest('inconsistent'))).status, 200);
    assert.equal(user(), undefined);
  });
}

test('assinatura inválida não altera a conta', async () => {
  payment();
  assert.equal((await invoke(webhook, signedRequest('payment-1', { headers: {} }))).status, 401);
  assert.equal(user(), undefined);
});

test('falha do provedor retorna erro para permitir nova tentativa', async () => {
  state.providerError = new Error('Falha simulada do provedor.');
  assert.equal((await invoke(webhook, signedRequest('payment-1'))).status, 500);
  assert.equal(user(), undefined);
  assert.equal((await invoke(checkout, { method: 'POST', headers: { authorization: 'Bearer simulation-token' }, body: { planType: 'mensal' } })).status, 500);
});

test('configuração ausente do Mercado Pago não cria checkout', async () => {
  delete process.env.MERCADOPAGO_ACCESS_TOKEN;
  assert.equal((await invoke(checkout, { method: 'POST', headers: { authorization: 'Bearer simulation-token' }, body: { planType: 'mensal' } })).status, 500);
  assert.equal(state.preferences.length, 0);
});
