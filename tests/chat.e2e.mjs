import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';

async function openChat(page) {
  await page.addInitScript(() => {
    localStorage.setItem('namao_local_test_user', 'true');
    localStorage.setItem('namao_auth_token', 'local-test');
    localStorage.setItem('namao_has_seen_help', 'true');
    sessionStorage.setItem('namao_pwa_dismissed', 'true');
  });
  await page.goto(`${origin}/chat`);
  await page.getByRole('heading', { name: 'NaMão IA', exact: true }).waitFor();
}

test('chat mostra a resposta e permite tentar novamente após erro do servidor', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    let calls = 0;
    await page.route('**/api/chat', async (route) => {
      calls += 1;
      assert.equal(route.request().headers()['x-namao-local-test'], 'true');
      await route.fulfill({ status: calls === 1 ? 503 : 200, contentType: 'application/json', body: JSON.stringify(calls === 1
        ? { error: 'A IA está com muitas solicitações no momento. Tente novamente em instantes.' }
        : { text: 'Uma meta de exemplo é reservar 20%' }) });
    });
    await openChat(page);
    const input = page.locator('textarea');
    await input.fill('Como economizar?');
    await page.getByRole('button', { name: '➔', exact: true }).click();
    await page.getByText('A IA está com muitas solicitações no momento. Tente novamente em instantes.', { exact: true }).waitFor();
    await input.fill('Tente novamente.');
    await page.getByRole('button', { name: '➔', exact: true }).click();
    await page.getByText('Uma meta de exemplo é reservar 20%', { exact: true }).waitFor();
    assert.equal(calls, 2);
  } finally { await browser.close(); }
});

test('tempo limite informa o usuário e libera o envio; cancelamento continua silencioso', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.clock.install();
    await page.route('**/api/chat', () => {});
    await openChat(page);
    await page.locator('textarea').fill('Olá.');
    await page.getByRole('button', { name: '➔', exact: true }).click();
    await page.getByText('O Agente está digitando...', { exact: true }).waitFor();
    await page.clock.fastForward(66000);
    await page.getByText('A IA demorou para responder. Tente novamente em instantes.', { exact: true }).waitFor();
    await page.locator('textarea').fill('Nova tentativa.');
    await page.getByRole('button', { name: '➔', exact: true }).click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    assert.equal(await page.getByText('O Agente está digitando...', { exact: true }).count(), 0);
  } finally { await browser.close(); }
});

test('IA real no localhost responde usando somente dados fictícios', { skip: process.env.RUN_LIVE_AI !== 'true' }, async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await openChat(page);
    await page.evaluate(async () => {
      const { addExpenses } = await import('/src/services/db.js');
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      await addExpenses([
        { description: 'Renda fictícia para teste', type: 'income', amount: 1000, status: 'paid', date },
        { description: 'Mercado fictício para teste', type: 'expense', amount: 150, status: 'paid', category: 'mercado', date },
      ]);
    });
    const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/chat') && response.request().method() === 'POST', { timeout: 65000 });
    await page.locator('textarea').fill('Nos dados fictícios deste teste, quanto recebi e quanto gastei em mercado neste mês? Responda brevemente.');
    await page.getByRole('button', { name: '➔', exact: true }).click();
    const response = await responsePromise;
    const data = await response.json();
    assert.equal(response.status(), 200, data.error);
    assert.ok(typeof data.text === 'string' && data.text.length > 10);
    await page.getByText(data.text, { exact: true }).waitFor();
    assert.match(data.text, /1[.\s]?000/);
    assert.match(data.text, /150/);
    await page.screenshot({ path: join(tmpdir(), 'namao-ai-local.png'), fullPage: true });
  } finally { await browser.close(); }
});
