import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';

test('saldo acompanha despesas, não duplica pagamento e preserva mês e filtros', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.addInitScript(() => {
      localStorage.setItem('namao_local_test_user', 'true');
      localStorage.setItem('namao_auth_token', 'local-test');
      localStorage.setItem('namao_has_seen_help', 'true');
      sessionStorage.setItem('namao_pwa_dismissed', 'true');
    });
    await page.goto(origin);
    await page.getByRole('button', { name: 'Próximo mês', exact: true }).waitFor();
    await page.evaluate(async () => {
      const { setExpensesData } = await import('/src/services/db.js');
      const next = new Date(); next.setMonth(next.getMonth() + 1, 1);
      const date = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-15`;
      await setExpensesData([
        { id: 'income', description: 'Salário de exemplo', amount: 2499, type: 'income', status: 'paid', date },
        { id: 'shopee', description: 'Shopee de exemplo', amount: 89, type: 'expense', status: 'unpaid', category: 'outros', date },
        { id: 'school', description: 'Escola de exemplo', amount: 280, type: 'expense', status: 'unpaid', category: 'educacao', date },
        { id: 'other', description: 'Outras despesas de exemplo', amount: 2306, type: 'expense', status: 'unpaid', category: 'outros', date },
        { id: 'plan', description: 'Planejamento de exemplo', amount: 100, type: 'expense', status: 'planned', category: 'outros', date },
        { id: 'outside', description: 'Outro mês', amount: 5000, type: 'expense', status: 'unpaid', category: 'outros', date: '2040-01-01' },
      ]);
    });
    await page.getByRole('button', { name: 'Próximo mês', exact: true }).click();
    const balance = page.getByRole('region', { name: 'Saldo do Mês', exact: true });
    const pending = page.getByRole('region', { name: 'Despesas a Pagar', exact: true });
    await balance.getByText('− R$ 176,00', { exact: true }).waitFor();
    await pending.getByText('R$ 2.675,00', { exact: true }).waitFor();
    await page.getByText('− R$ 276,00', { exact: true }).waitFor();
    await page.screenshot({ path: join(tmpdir(), 'namao-monthly-balance.png'), fullPage: true });

    await page.getByRole('searchbox').fill('Shopee');
    await page.locator('a[href="/expense/shopee"]').click();
    await page.getByRole('button', { name: 'Marcar como Pago', exact: true }).click();
    await balance.getByText('− R$ 176,00', { exact: true }).waitFor();
    await pending.getByText('R$ 2.586,00', { exact: true }).waitFor();
    assert.equal(await page.getByRole('searchbox').inputValue(), 'Shopee');

    await page.locator('a[href="/expense/shopee"]').click();
    await page.getByRole('button', { name: 'Editar Lançamento', exact: true }).click();
    await page.getByPlaceholder('0,00').fill('100');
    await page.locator('button[type="submit"]').click();
    await page.getByRole('heading', { name: 'Detalhamento', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await balance.getByText('− R$ 187,00', { exact: true }).waitFor();

    await page.locator('a[href="/expense/shopee"]').click();
    await page.getByRole('button', { name: 'Excluir Despesa', exact: true }).click();
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await balance.getByText('− R$ 87,00', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Limpar filtros', exact: true }).first().click();

    await page.getByRole('button', { name: 'Abrir menu de lançamentos', exact: true }).click();
    await page.getByRole('button', { name: 'Nova Despesa', exact: true }).click();
    await page.getByPlaceholder('ex: Salário, Aluguel').fill('Nova despesa de exemplo');
    await page.getByPlaceholder('0,00').fill('50');
    await page.locator('button[type="submit"]').click();
    await balance.getByText('− R$ 137,00', { exact: true }).waitFor();
    await pending.getByText('R$ 2.636,00', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Mês anterior', exact: true }).click();
    await balance.getByText('R$ 0,00', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Próximo mês', exact: true }).click();
    await balance.getByText('− R$ 137,00', { exact: true }).waitFor();
    await page.setViewportSize({ width: 320, height: 700 });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
