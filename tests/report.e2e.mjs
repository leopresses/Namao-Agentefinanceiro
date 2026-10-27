import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://localhost:4174';

async function openReport(page, pro = false) {
  await page.addInitScript(() => {
    localStorage.setItem('namao_local_test_user', 'true');
    localStorage.setItem('namao_auth_token', 'local-test');
    localStorage.setItem('namao_has_seen_help', 'true');
    sessionStorage.setItem('namao_pwa_dismissed', 'true');
  });
  if (pro) {
    // Fixture visual isolada: renderiza o componente PRO sem alterar conta,
    // assinatura, autenticação nem o código servido a outros navegadores.
    await page.route('**/src/components/ReportSummary.jsx*', async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      const body = source.replace('const [compositionOpen, setCompositionOpen]', 'isPro = true;\nconst [compositionOpen, setCompositionOpen]');
      assert.ok(source !== body, 'Fixture PRO precisa atingir o componente');
      await route.fulfill({ response, body });
    });
  }
  await page.goto(`${origin}/report`);
  await page.getByRole('heading', { name: 'Resumo', exact: true }).waitFor();
  const labels = await page.evaluate(async () => {
    const { setExpensesData } = await import('/src/services/db.js');
    const current = new Date(); current.setDate(1);
    const next = new Date(current); next.setMonth(next.getMonth() + 1);
    const date = (d, day = 1) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    await setExpensesData([
      { id: 'past', type: 'income', status: 'paid', amount: 1000, description: 'Receita atual', date: date(current) },
      { id: 'income', type: 'income', status: 'paid', amount: 2499, description: 'Salário', date: date(next) },
      { id: 'paid', type: 'expense', status: 'paid', amount: 600, category: 'casa', description: 'Despesa paga', date: date(next) },
      { id: 'pending', type: 'expense', status: 'unpaid', amount: 1700, category: 'casa', description: 'Despesa pendente', date: date(next) },
      { id: 'school', type: 'expense', status: 'unpaid', amount: 375, category: 'educacao', description: 'Escola', date: date(next) },
      { id: 'planned', type: 'expense', status: 'planned', amount: 100, category: 'lazer', description: 'Passeio planejado', date: date(next) },
    ]);
    return { current: current.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), next: next.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) };
  });
  await page.getByRole('button', { name: 'Próximo mês', exact: true }).click();
  await page.locator('.report-balance-value').getByText('− R$ 176,00', { exact: true }).waitFor();
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))));
  return labels;
}

test('resumo direto: composição, categorias, períodos, celular e PDF real', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await openReport(page);
    await page.locator('.report-composition summary').click();
    const composition = page.locator('.report-composition');
    assert.match(await composition.innerText(), /R\$ 1\.899,00/);
    assert.match(await composition.innerText(), /− R\$ 276,00/);
    const categories = page.getByRole('region', { name: 'Para onde foi o dinheiro', exact: true });
    assert.equal(await categories.locator('.report-category-row').count(), 2);
    assert.match(await categories.innerText(), /R\$ 2\.300,00/);
    assert.match(await categories.innerText(), /86%/);
    assert.equal(await categories.getByText('Lazer', { exact: true }).count(), 0, 'Planejadas não entram nas categorias');
    assert.equal(await page.getByRole('button', { name: 'Desbloquear insights PRO', exact: true }).count(), 1);
    for (const theme of ['light', 'dark']) for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
      await page.waitForTimeout(350);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme} ${width}: overflow`);
      await page.screenshot({ path: join(tmpdir(), `namao-report-direct-${theme}-${width}.png`), fullPage: true });
    }
    await page.getByRole('button', { name: 'Geral', exact: true }).click();
    await page.locator('.report-balance-value').getByText('R$ 1.000,00', { exact: true }).waitFor();
    assert.equal(await page.locator('.report-insights').count(), 0);
    await page.getByRole('button', { name: 'Por Mês', exact: true }).click();
    await page.locator('.report-balance-value').getByText('− R$ 176,00', { exact: true }).waitFor();
    // Força o caminho de download para não abrir o compartilhador do Windows.
    await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
    const downloadEvent = page.waitForEvent('download', { timeout: 60000 });
    await page.getByRole('button', { name: 'Exportar e compartilhar', exact: true }).click();
    const download = await downloadEvent;
    const path = join(tmpdir(), 'namao-resumo-direto.pdf');
    await download.saveAs(path);
    const pdf = await readFile(path);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 10000);
    assert.ok((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length >= 2, 'PDF completo tem várias páginas');
    await page.getByRole('button', { name: 'Próximo mês', exact: true }).click();
    await page.getByRole('heading', { name: 'Nenhum lançamento no período', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Exportar e compartilhar', exact: true }).isDisabled(), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('resumo direto PRO: previsão, comparação sem base e pendências', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 320, height: 700 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await openReport(page, true);
    const insights = page.getByRole('region', { name: 'Previsão e comparativo', exact: true });
    await insights.getByText('− R$ 276,00', { exact: true }).waitFor();
    assert.ok((await insights.locator('.report-forecast > strong').boundingBox()).height < 30, 'Previsão deve ser legível em uma linha no celular');
    assert.match(await insights.innerText(), /Ainda não há despesas/);
    await insights.locator('summary').click();
    assert.match(await insights.innerText(), /R\$ 2\.175,00/);
    await page.evaluate(async () => {
      const { getExpenses, setExpensesData } = await import('/src/services/db.js');
      const rows = await getExpenses();
      rows.push({ id: 'baseline', type: 'expense', status: 'paid', amount: 3000, category: 'casa', description: 'Base anterior', date: rows.find(e => e.id === 'past').date });
      await setExpensesData(rows);
    });
    await insights.getByText(/Abaixo de .*R\$ 225,00 \(7\.5%\)/).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: join(tmpdir(), 'namao-report-direct-pro-320.png'), fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
