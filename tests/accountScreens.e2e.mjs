import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://localhost:5173';

async function prepare(page, google = false) {
  await page.addInitScript((google) => {
    localStorage.setItem('namao_local_test_user', 'true');
    localStorage.setItem('namao_auth_token', google ? 'google' : 'local-test');
    localStorage.setItem('namao_user_name', 'Leonardo de exemplo');
    localStorage.setItem('namao_has_seen_help', 'true');
    sessionStorage.setItem('namao_pwa_dismissed', 'true');
  }, google);
}

test('IA: sugestões enviam contexto real, nova conversa, histórico e exclusão confirmada', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await prepare(page);
    const calls = [];
    await page.route('**/api/chat', async route => {
      calls.push(route.request().postDataJSON());
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ text: 'Resposta de teste baseada nos seus lançamentos.' }) });
    });
    await page.goto(`${origin}/chat`);
    await page.getByRole('heading', { name: 'NaMão IA', exact: true }).waitFor();
    await page.evaluate(async () => {
      const { setExpensesData } = await import('/src/services/db.js');
      const now = new Date(); const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      await setExpensesData([{ id: 'test', type: 'expense', status: 'unpaid', category: 'mercado', description: 'Mercado de teste', amount: 137, date }]);
    });
    await page.getByRole('button', { name: 'Como está meu mês?', exact: true }).click();
    await page.getByText('Resposta de teste baseada nos seus lançamentos.', { exact: true }).waitFor();
    assert.equal(calls[0].userText, 'Como está meu mês?');
    assert.match(calls[0].contextData, /137/);
    assert.equal(await page.locator('.chat-welcome').count(), 0);
    await page.getByRole('button', { name: 'Nova conversa', exact: true }).click();
    await page.getByRole('button', { name: 'Onde estou gastando mais?', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Histórico de conversas', exact: true }).click();
    const history = page.getByRole('dialog', { name: 'Conversas', exact: true });
    await history.getByRole('button', { name: /^Como está meu mês\?/ }).click();
    await page.getByText('Resposta de teste baseada nos seus lançamentos.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Histórico de conversas', exact: true }).click();
    await history.getByRole('button', { name: 'Excluir conversa Como está meu mês?', exact: true }).click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await history.waitFor();
    assert.equal(await history.locator('.chat-history-row').count(), 2);
    await history.getByRole('button', { name: 'Excluir conversa Como está meu mês?', exact: true }).click();
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await history.waitFor();
    assert.equal(await history.locator('.chat-history-row').count(), 1);
    await page.keyboard.press('Escape');
    assert.equal(await history.isVisible(), false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Perfil: tema persistente, telas de dados, confirmações e ações em nuvem preservadas', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await prepare(page, true);
    await page.goto(`${origin}/profile`);
    await page.getByRole('heading', { name: 'Perfil', exact: true }).waitFor();
    await page.getByRole('switch', { name: 'Modo Escuro', exact: true }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem('namao_theme')), 'dark');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.getByRole('button', { name: 'Backup e sincronização', exact: true }).click();
    await page.getByRole('heading', { name: 'Backup e sincronização', exact: true }).waitFor();
    for (const name of ['Fazer Backup na Nuvem', 'Restaurar da Nuvem', 'Excluir Backup da Nuvem']) {
      await page.getByRole('button', { name, exact: true }).click();
      await page.getByRole('heading', { name: 'Teste local', exact: true }).waitFor();
      await page.getByRole('button', { name: 'OK', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await page.getByRole('heading', { name: 'Perfil', exact: true }).waitFor();
    assert.equal(await page.getByRole('switch', { name: 'Modo Escuro', exact: true }).getAttribute('aria-checked'), 'true');
    await page.evaluate(async () => {
      const { setExpensesData } = await import('/src/services/db.js');
      await setExpensesData([{ id: 'preserve', type: 'expense', status: 'paid', amount: 10, description: 'Não apagar', date: '2026-10-01' }]);
    });
    await page.getByRole('button', { name: 'Gerenciar dados locais', exact: true }).click();
    await page.getByRole('button', { name: 'Apagar dados locais', exact: true }).click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    assert.equal(await page.evaluate(async () => (await (await import('/src/services/db.js')).getExpenses()).length), 1);
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await page.getByRole('button', { name: 'Alertas financeiros PRO', exact: true }).click();
    await page.getByRole('button', { name: 'Fechar planos', exact: true }).click();
    await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('heading', { name: 'Perfil', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('namao_auth_token')), 'google');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('IA e Perfil: legibilidade, botões e campo de mensagem em celular e desktop', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  try {
    await prepare(page);
    for (const route of ['chat', 'profile']) {
      await page.goto(`${origin}/${route}`);
      await page.getByRole('heading', { name: route === 'chat' ? 'NaMão IA' : 'Perfil', exact: true }).waitFor();
      for (const theme of ['light', 'dark']) for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
        await page.waitForTimeout(350);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} ${theme} ${width}: overflow`);
        await page.screenshot({ path: join(tmpdir(), `namao-${route}-layout-${theme}-${width}.png`), fullPage: true });
        if (route === 'chat') {
          const composer = await page.locator('.chat-composer').boundingBox();
          const nav = width < 768 ? await page.locator('.bottom-nav').boundingBox() : { y: 844 };
          assert.ok(composer.y + composer.height < nav.y, 'Menu não cobre o campo de mensagem');
        }
      }
      if (route === 'chat') {
        for (const height of [600, 420]) {
          await page.setViewportSize({ width: 320, height });
          await page.locator('textarea').focus();
          const field = await page.locator('.chat-composer').boundingBox();
          const nav = await page.locator('.bottom-nav').boundingBox();
          assert.ok(field.y + field.height < nav.y);
        }
      }
    }
  } finally { await browser.close(); }
});
