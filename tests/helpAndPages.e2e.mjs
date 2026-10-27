import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://localhost:5173';

async function prepare(page) {
  await page.addInitScript(() => {
    localStorage.setItem('namao_local_test_user', 'true');
    localStorage.setItem('namao_auth_token', 'local-test');
    localStorage.setItem('namao_has_seen_help', 'true');
    sessionStorage.setItem('namao_pwa_dismissed', 'true');
  });
}

for (const width of [390, 1280]) test(`perguntas rápidas e tour real em ${width}px preservam dados e contexto`, async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await prepare(page);
    await page.goto(`${origin}/profile`);
    await page.getByRole('heading', { name: 'Perfil', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Ajuda', exact: true }).click();
    const help = page.getByRole('dialog', { name: 'Ajuda rápida', exact: true });
    await help.waitFor();
    assert.match(await help.locator('.help-answer').first().innerText(), /pagas e pendentes/);
    await help.getByText('Como funciona o backup?', { exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await help.isVisible(), false);
    await page.getByRole('button', { name: 'Ajuda', exact: true }).click();
    await help.getByRole('button', { name: /Conheça o app em 6 passos/ }).click();
    const tour = page.getByRole('dialog', { name: 'Escolha o mês', exact: true });
    await tour.waitFor();
    for (let i = 0; i < 6; i += 1) {
      const dialog = page.locator('.guided-tour-dialog');
      await dialog.getByText(`${i + 1} de 6`, { exact: true }).waitFor();
      await page.waitForFunction(() => !!document.querySelector('.tour-spotlight'));
      await page.waitForTimeout(150);
      const panel = await dialog.locator('.tour-panel').boundingBox();
      const spot = await dialog.locator('.tour-spotlight').boundingBox();
      assert.ok(panel.x >= 0 && panel.x + panel.width <= width + 1);
      assert.ok(panel.y >= 0 && panel.y + panel.height <= 845);
      assert.ok(panel.y >= spot.y + spot.height || panel.y + panel.height <= spot.y || panel.x >= spot.x + spot.width || panel.x + panel.width <= spot.x, `Destaque encoberto na etapa ${i + 1}`);
      if (i === 1) await page.screenshot({ path: join(tmpdir(), `namao-tour-${width}.png`) });
      await dialog.getByRole('button', { name: i === 5 ? 'Concluir' : 'Próximo', exact: true }).click();
    }
    await page.getByRole('heading', { name: 'Tudo pronto!', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Voltar ao app', exact: true }).click();
    await page.getByRole('heading', { name: 'Perfil', exact: true }).waitFor();
    assert.equal(await page.evaluate(async () => (await (await import('/src/services/db.js')).getExpenses()).length), 0);
    await page.getByRole('button', { name: 'Ajuda', exact: true }).click();
    await help.getByRole('button', { name: /Conheça o app em 6 passos/ }).click();
    await page.getByRole('button', { name: 'Pular tour', exact: true }).click();
    await page.getByRole('heading', { name: 'Perfil', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Ajuda', exact: true }).click();
    await help.getByRole('button', { name: 'Ver central de ajuda', exact: true }).click();
    await page.getByRole('heading', { name: 'Central de Ajuda', exact: true }).waitFor();
    await page.getByText('Como consulto e exporto o resumo?', { exact: true }).click();
    await page.locator('a[href="/privacy"]').click();
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await page.getByRole('heading', { name: 'Central de Ajuda', exact: true }).waitFor();
    assert.equal(await page.locator('.help-question[open]').count(), 1);
    assert.match(await page.locator('.help-question[open]').innerText(), /Resumo/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('tour preserva mês futuro e filtros e permite sair com Esc', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 320, height: 700 } });
  try {
    await prepare(page); await page.goto(origin);
    await page.getByRole('button', { name: 'Próximo mês', exact: true }).click();
    const month = await page.locator('.dashboard-month h3').textContent();
    await page.getByRole('searchbox').fill('Filtro preservado');
    await page.getByRole('button', { name: 'Ajuda', exact: true }).click();
    await page.getByRole('button', { name: /Conheça o app em 6 passos/ }).click();
    await page.getByRole('dialog', { name: 'Escolha o mês', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('searchbox').waitFor();
    assert.equal(await page.getByRole('searchbox').inputValue(), 'Filtro preservado');
    assert.equal(await page.locator('.dashboard-month h3').textContent(), month);
  } finally { await browser.close(); }
});

test('formulários modernizados salvam orçamento, meta e parcelas e voltam ao destino anterior', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await prepare(page); await page.goto(`${origin}/profile`);
    await page.getByRole('button', { name: 'Limites de Orçamento', exact: true }).click();
    await page.getByRole('button', { name: 'Definir limite de Mercado', exact: true }).click();
    await page.getByPlaceholder('R$ 0,00').fill('750,00');
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    assert.match(await page.getByRole('button', { name: 'Definir limite de Mercado', exact: true }).innerText(), /750,00/);
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await page.getByRole('button', { name: 'Metas Financeiras', exact: true }).click();
    await page.getByRole('button', { name: 'Criar primeira meta', exact: true }).click();
    await page.getByLabel('Nome da Meta').fill('Reserva de teste');
    await page.getByLabel('Objetivo Final (R$)').fill('1500');
    await page.getByLabel('Valor Guardado (R$)').fill('150');
    await page.getByRole('button', { name: 'Criar Meta', exact: true }).click();
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await page.getByRole('heading', { name: 'Reserva de teste', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await page.locator('a[href="/"]').first().click();
    await page.getByRole('button', { name: 'Abrir menu de lançamentos', exact: true }).click();
    await page.getByRole('button', { name: 'Nova Despesa', exact: true }).click();
    await page.getByLabel('Descrição', { exact: true }).fill('Compra parcelada');
    await page.getByLabel('Categoria', { exact: true }).selectOption('mercado');
    await page.getByLabel('Valor (R$)', { exact: true }).fill('75');
    await page.getByRole('switch', { name: 'Repetir', exact: true }).click();
    await page.getByRole('button', { name: 'Parcelado', exact: true }).click();
    await page.getByLabel('Número de Parcelas', { exact: true }).fill('3');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.getByRole('heading', { name: 'Compra parcelada (1/3)', exact: true }).waitFor();
    const expenses = await page.evaluate(async () => (await import('/src/services/db.js')).getExpenses());
    assert.equal(expenses.length, 3); assert.ok(expenses.every(e => e.amount === 75 && e.category === 'mercado'));
  } finally { await browser.close(); }
});

test('revisão visual de todas as páginas em celular e desktop, claro e escuro', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await prepare(page); await page.goto(origin);
    await page.getByRole('button', { name: 'Próximo mês', exact: true }).waitFor();
    await page.evaluate(async () => {
      const db = await import('/src/services/db.js');
      const date = new Date().toISOString().slice(0, 10);
      await db.setExpensesData([{ id: 'layout', description: 'Despesa de teste com descrição longa', amount: 1234.56, type: 'expense', status: 'unpaid', category: 'casa', date }]);
    });
    for (const path of ['/', '/expense/new', '/expense/layout', '/budgets', '/goals', '/goal/new', '/report', '/chat', '/profile', '/help', '/privacy', '/login']) {
      await page.goto(origin + path); await page.locator('h1').first().waitFor();
      await page.waitForFunction(() => !document.querySelector('[data-navigation-loading="true"]'));
      for (const theme of ['light', 'dark']) for (const width of [320, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
        await page.waitForTimeout(150);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} ${theme} ${width}: overflow`);
        if (width === 320) await page.screenshot({ path: join(tmpdir(), `namao-modern-${path.replaceAll('/', '-') || 'home'}-${theme}.png`), fullPage: true });
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
