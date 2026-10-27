import assert from 'node:assert/strict';
import process from 'node:process';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkout, invoke, payment, reset, signedRequest, state, UID, user, webhook } from './paymentsHarness.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';

async function prepare(page) {
  await page.addInitScript(() => {
    localStorage.setItem('namao_local_test_user', 'true');
    localStorage.setItem('namao_auth_token', 'local-test');
    localStorage.setItem('namao_has_seen_help', 'true');
    sessionStorage.setItem('namao_pwa_dismissed', 'true');
  });
  // Somente neste navegador temporário: autenticação e consulta do plano são
  // substituídas. O app e os handlers de checkout/webhook continuam os reais.
  await page.route('**/src/services/firebase.js', (route) => route.fulfill({
    contentType: 'application/javascript', body: `
      export * from '/src/services/firebase.js?payment-simulation-original';
      export async function getIdToken() { return 'simulation-token'; }
      export async function getUserProStatus() { return (await fetch('/__payment-simulation/account')).json(); }
      export function getCachedProStatus() { return false; }
      export function onAuthChange(callback) { let active = true; queueMicrotask(() => { if (active) callback({ uid: '${UID}' }); }); return () => { active = false; }; }
    `,
  }));
  await page.route('**/__payment-simulation/account', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ isPro: user()?.isPro === true, aiMessageCount: 0 }),
  }));
  await page.route('**/api/checkout', async (route) => {
    const result = await invoke(checkout, { method: 'POST', headers: route.request().headers(), body: route.request().postDataJSON() });
    await route.fulfill({ status: result.status, contentType: 'application/json', body: JSON.stringify(result.body) });
  });
}

for (const [plan, status, title] of [
  ['mensal', 'approved', 'Pagamento aprovado!'],
  ['anual', 'approved', 'Pagamento aprovado!'],
  ['mensal', 'pending', 'Pagamento pendente'],
  ['mensal', 'rejected', 'Pagamento não concluído'],
]) {
  test(`fluxo no celular: ${plan}, ${status}`, async () => {
    reset(); process.env.APP_ORIGIN = origin;
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await prepare(page);
      await page.route('https://www.mercadopago.com.br/**', (route) => route.fulfill({
        contentType: 'text/html', body: `<h1>Checkout simulado</h1><p>Ambiente isolado. Sem cobrança real.</p><button onclick="location.href='${origin}/__payment-simulation/return'">Simular ${status}</button>`,
      }));
      await page.route('**/__payment-simulation/return', async (route) => {
        const preference = state.preferences.at(-1);
        payment('browser-payment', { status, external_reference: preference.external_reference, transaction_amount: preference.items[0].unit_price });
        const result = await invoke(webhook, signedRequest('browser-payment'));
        assert.equal(result.status, 200);
        const outcome = status === 'approved' ? 'success' : status === 'pending' ? 'pending' : 'failure';
        await route.fulfill({ status: 302, headers: { location: `${origin}/?payment=${outcome}` }, body: '' });
      });
      await page.goto(origin);
      await page.getByRole('button', { name: /^Conheça o NaMão PRO/ }).click();
      await page.getByRole('button', { name: plan === 'anual' ? /Escolher plano anual/ : /Plano mensal/ }).click();
      await page.getByRole('heading', { name: 'Checkout simulado' }).waitFor();
      assert.equal(state.preferences.length, 1);
      await page.getByRole('button', { name: `Simular ${status}`, exact: true }).click();
      await page.getByRole('heading', { name: title, exact: true }).waitFor();
      assert.equal(user()?.isPro === true, status === 'approved');
      await page.screenshot({ path: join(tmpdir(), `namao-payment-${plan}-${status}.png`), fullPage: true });
      await page.getByRole('button', { name: 'OK', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: /^Conheça o NaMão PRO/ }).count(), status === 'approved' ? 0 : 1);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test('retorno success sem aprovação no servidor não libera PRO', async () => {
  reset();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await prepare(page);
    await page.goto(`${origin}/?payment=success`);
    await page.getByRole('heading', { name: 'Pagamento recebido', exact: true }).waitFor();
    assert.equal(user(), undefined);
    assert.equal(await page.getByRole('button', { name: /^Conheça o NaMão PRO/ }).count(), 1);
  } finally { await browser.close(); }
});
