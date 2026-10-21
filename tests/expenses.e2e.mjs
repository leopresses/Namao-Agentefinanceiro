import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';

for (const width of [390, 1280]) {
  test(`busca, mês e recorrências em ${width}px`, async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const list = page.getByRole('region', { name: 'Lançamentos do mês' });
    const rows = list.locator('a[href^="/expense/"]');
    const back = page.getByRole('button', { name: 'Voltar', exact: true });
    try {
      await page.addInitScript(() => {
        localStorage.setItem('namao_local_test_user', 'true');
        localStorage.setItem('namao_auth_token', 'local-test');
        localStorage.setItem('namao_has_seen_help', 'true');
        sessionStorage.setItem('namao_pwa_dismissed', 'true');
      });
      await page.goto(origin);
      await page.getByRole('button', { name: 'Próximo mês', exact: true }).waitFor();
      const seed = await page.evaluate(async () => {
        const { setExpensesData } = await import('/src/services/db.js');
        const day = (offset, day = 15) => {
          const date = new Date(); date.setMonth(date.getMonth() + offset, day);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        };
        const series = [0, 1, 2].map((offset) => ({
          id: `series-${offset}`, groupId: 'series', description: `Cartão de todos (${offset + 1}/3)`,
          amount: 40, date: day(offset), status: offset === 0 ? 'paid' : 'unpaid', category: 'saude', type: 'expense', createdAt: 'original',
        }));
        const entries = [...series,
          { id: 'paid', description: 'Mercado pago', amount: 90, date: day(1, 10), status: 'paid', category: 'mercado', type: 'expense' },
          { id: 'planned', description: 'Cinema', amount: 30, date: day(1, 12), status: 'planned', category: 'lazer', type: 'expense' },
          { id: 'income', description: 'Salário', amount: 2000, date: day(1, 1), status: 'paid', type: 'income', category: 'outros' },
        ];
        await setExpensesData(entries);
        const selected = new Date(day(1));
        const today = new Date();
        const expectedDay = Math.min(today.getDate(), new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate());
        return { entries, date: `${day(1).slice(0, 7)}-${String(expectedDay).padStart(2, '0')}` };
      });
      await page.getByRole('button', { name: 'Próximo mês', exact: true }).click();
      await rows.first().waitFor();
      await page.waitForFunction(() => document.querySelectorAll('section[aria-label="Lançamentos do mês"] a[href^="/expense/"]').length === 4);
      assert.equal(await rows.count(), 4);
      await page.getByRole('searchbox', { name: 'Buscar lançamentos' }).fill('CARTAO');
      await page.getByLabel('Categoria', { exact: true }).selectOption('saude');
      await page.getByRole('button', { name: 'Pendentes', exact: true }).click();
      await rows.first().click();
      await page.getByRole('heading', { name: 'Detalhamento', exact: true }).waitFor();
      const details = page.getByRole('region', { name: 'Cartão de todos (2/3)', exact: true });
      assert.equal(await details.locator('.glass-card').count(), 0);
      assert.equal((await back.boundingBox()).width, 48);
      await page.screenshot({ path: join(tmpdir(), `namao-details-${width}.png`) });
      await back.click();
      await page.getByRole('searchbox').waitFor();
      assert.equal(await page.getByRole('searchbox').inputValue(), 'CARTAO');
      assert.equal(await page.getByLabel('Categoria', { exact: true }).inputValue(), 'saude');
      assert.equal(await page.getByRole('button', { name: 'Pendentes', exact: true }).getAttribute('aria-pressed'), 'true');
      assert.equal(await rows.count(), 1);
      await page.getByRole('searchbox').fill('não existe');
      await page.getByText('Nenhum lançamento encontrado com esses filtros neste mês.').waitFor();
      await page.getByRole('button', { name: 'Limpar filtros', exact: true }).first().click();
      await page.getByRole('button', { name: 'Pagos / recebidos', exact: true }).click();
      assert.equal(await rows.count(), 2);
      await page.getByRole('button', { name: 'Planejados', exact: true }).click();
      assert.equal(await rows.count(), 1);
      await page.getByRole('button', { name: 'Todos', exact: true }).click();

      const launch = width < 768 ? 'Abrir menu de lançamentos' : 'Lançar';
      await page.getByRole('button', { name: launch, exact: true }).click();
      await page.getByRole('button', { name: 'Nova Despesa', exact: true }).click();
      await page.getByPlaceholder('ex: Salário, Aluguel').waitFor();
      assert.equal(await page.locator('input[type="date"]').inputValue(), seed.date);
      await page.getByPlaceholder('ex: Salário, Aluguel').fill('Nova no mês selecionado');
      await page.getByPlaceholder('0,00').fill('10');
      await page.locator('button[type="submit"]').click();
      await page.getByRole('searchbox').waitFor();
      await list.getByRole('heading', { name: /Nova no mês selecionado/ }).waitFor();

      for (const [label, affected] of [['Somente esta', ['series-1']], ['Esta e próximas', ['series-1', 'series-2']], ['Todas', ['series-0', 'series-1', 'series-2']]]) {
        await page.evaluate(async (entries) => {
          const { setExpensesData } = await import('/src/services/db.js'); await setExpensesData(entries);
        }, seed.entries);
        await page.locator('a[href="/expense/series-1"]').click();
        await page.getByRole('button', { name: 'Editar Lançamento', exact: true }).click();
        await page.getByPlaceholder('ex: Salário, Aluguel').fill('Cartão atualizado');
        await page.getByPlaceholder('0,00').fill('55');
        await page.locator('button[type="submit"]').click();
        const dialog = page.getByRole('dialog', { name: 'Quais parcelas atualizar?' });
        await dialog.waitFor();
        if (label === 'Somente esta') await page.screenshot({ path: join(tmpdir(), `namao-recurrence-${width}.png`) });
        await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
        const unchanged = await page.evaluate(async () => (await (await import('/src/services/db.js')).getExpenseById('series-1')).amount);
        assert.equal(unchanged, 40);
        await page.locator('button[type="submit"]').click();
        await dialog.waitFor();
        await dialog.getByRole('button', { name: new RegExp(`^${label}`) }).click();
        await page.getByRole('heading', { name: 'Cartão atualizado (2/3)', exact: true }).waitFor();
        const result = await page.evaluate(async () => (await import('/src/services/db.js')).getExpenses());
        for (const original of seed.entries) {
          const edited = result.find((entry) => entry.id === original.id);
          assert.equal(edited.amount, affected.includes(original.id) ? 55 : original.amount);
          assert.equal(edited.date, original.date);
          assert.equal(edited.status, original.status);
          assert.equal(edited.createdAt, original.createdAt);
        }
        await back.click();
        await page.getByRole('searchbox').waitFor();
      }
      await page.locator('a[href="/expense/series-1"]').click();
      await page.getByRole('button', { name: 'Excluir Despesa', exact: true }).click();
      const deletion = page.getByRole('dialog', { name: 'Quais parcelas excluir?' });
      await deletion.waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await deletion.count(), 0);
      await page.getByRole('button', { name: 'Excluir Despesa', exact: true }).click();
      await deletion.getByRole('button', { name: /^Esta e próximas/ }).click();
      await page.getByRole('searchbox').waitFor();
      const remaining = await page.evaluate(async () => (await (await import('/src/services/db.js')).getExpenses()).map((entry) => entry.id));
      assert.ok(remaining.includes('series-0'));
      assert.ok(!remaining.includes('series-1') && !remaining.includes('series-2'));
      assert.deepEqual(errors, []);
      await page.screenshot({ path: join(tmpdir(), `namao-filters-${width}.png`), fullPage: true });
    } finally { await browser.close(); }
  });
}
