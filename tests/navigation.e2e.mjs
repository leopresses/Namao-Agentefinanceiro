// Execute com o Vite em VITE_LOCAL_TEST_MODE=true. O navegador usa um perfil
// temporário e dados fictícios; não acessa a conta nem o backup de produção.
import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';

async function ready(page) {
  await page.waitForFunction(() => !document.querySelector('[data-navigation-loading="true"]'));
  // A animação de entrada desloca o conteúdo e altera o limite de rolagem.
  // Meça a posição somente depois de ela terminar.
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter((animation) => animation.effect.getComputedTiming().iterations !== Infinity)
    .map((animation) => animation.finished.catch(() => {}))));
}

async function expectPosition(page, expected) {
  try {
    await page.waitForFunction((y) => Math.abs(window.scrollY - y) < 5, expected);
  } catch (error) {
    const actual = await page.evaluate(() => window.scrollY);
    throw new Error(`Rolagem em ${page.url()}: esperado ${expected}, recebido ${actual}`, { cause: error });
  }
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`voltar preserva contexto em ${viewport.width}px`, async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
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
      await ready(page);
      const nextMonth = await page.evaluate(async () => {
        const { addExpenses, addGoal } = await import('/src/services/db.js');
        const date = new Date();
        date.setMonth(date.getMonth() + 1, 1);
        const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        await addExpenses(Array.from({ length: 60 }, (_, index) => ({
          description: `Despesa teste ${index}`, amount: 20 + index,
          date: `${prefix}-${String(index % 28 + 1).padStart(2, '0')}`,
          type: 'expense', status: 'unpaid', category: 'outros',
        })));
        await addGoal({ title: 'Meta de teste', icon: '🎯', targetAmount: 1000, currentAmount: 10 });
        const { setAllChats, setActiveChatId } = await import('/src/services/chatDb.js');
        setAllChats([{
          id: 'chat-test', title: 'Conversa de teste',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          messages: Array.from({ length: 60 }, (_, index) => ({
            id: index, sender: index % 2 ? 'user' : 'ai', text: `Mensagem de teste ${index}`,
          })),
        }]);
        setActiveChatId('chat-test');
        return `${prefix}-15`;
      });
      await page.getByRole('button', { name: 'Próximo mês', exact: true }).click();
      await page.locator('a[href^="/expense/"]').first().waitFor();
      assert.equal(await page.locator('a[href^="/expense/"]').count(), 60);
      assert.equal(await page.getByRole('button', { name: /Ver todos os .* lançamentos/ }).count(), 0);
      const heading = await page.locator('h3').filter({ hasText: /\d{4}/ }).first().textContent();
      const row = page.locator('a[href^="/expense/"]').nth(25);
      await row.scrollIntoViewIfNeeded();
      const position = await page.evaluate(() => window.scrollY);
      assert.ok(position > 500);
      await row.click();
      await page.getByRole('button', { name: 'Editar Lançamento', exact: true }).click();
      await ready(page);
      await page.getByPlaceholder('ex: Salário, Aluguel').fill('Despesa editada');
      await page.locator('button[type="submit"]').click();
      await page.getByRole('heading', { name: 'Detalhamento' }).waitFor();
      await page.getByRole('heading', { name: 'Despesa editada' }).waitFor();
      await page.getByRole('button', { name: 'Voltar', exact: true }).click();
      await page.locator('h3').filter({ hasText: heading }).waitFor();
      await ready(page);
      await expectPosition(page, position);
      assert.equal(await page.locator('a[href^="/expense/"]').count(), 60);

      // Criar um lançamento retorna diretamente à lista de onde foi aberto.
      const launchName = viewport.width < 768 ? 'Abrir menu de lançamentos' : 'Lançar';
      await page.getByRole('button', { name: launchName, exact: true }).click();
      await page.getByRole('button', { name: 'Nova Despesa', exact: true }).click();
      await page.getByPlaceholder('ex: Salário, Aluguel').fill('Despesa criada');
      await page.getByPlaceholder('0,00').fill('35,00');
      await page.locator('input[type="date"]').fill(nextMonth);
      await page.locator('button[type="submit"]').click();
      await page.locator('h3').filter({ hasText: heading }).waitFor();
      await ready(page);
      await expectPosition(page, position);

      // O botão do navegador recupera os filtros e a rolagem dos relatórios.
      await page.locator('a[href="/report"]').first().click();
      await page.getByRole('button', { name: 'Por Mês', exact: true }).click();
      await page.getByRole('button', { name: 'Próximo mês', exact: true }).click();
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      await ready(page);
      await page.locator('.report-composition summary').click();
      await page.getByRole('region', { name: 'Previsão e comparativo', exact: true }).scrollIntoViewIfNeeded();
      const reportPosition = await page.evaluate(() => window.scrollY);
      await page.locator('a[href="/profile"]').first().click();
      await page.getByRole('heading', { name: 'Perfil', exact: true }).waitFor();
      await page.goBack();
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      await ready(page);
      assert.equal(await page.locator('.report-composition').getAttribute('open'), '');
      await expectPosition(page, reportPosition);

      // Editar uma meta também retorna à página anterior e atualiza a lista.
      await page.locator('a[href="/profile"]').first().click();
      await page.getByRole('button', { name: /Metas Financeiras/ }).click();
      await page.getByText('Meta de teste', { exact: true }).click();
      await ready(page);
      await page.getByPlaceholder('ex: Viagem para Paris').fill('Meta atualizada');
      await page.getByRole('button', { name: 'Atualizar Meta', exact: true }).click();
      await page.getByRole('button', { name: 'OK', exact: true }).click();
      await page.getByText('Meta atualizada', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Voltar', exact: true }).click();
      await page.getByRole('heading', { name: 'Perfil', exact: true }).waitFor();

      // Voltar ao chat não deve forçar a conversa para a última mensagem.
      await page.locator('a[href="/chat"]').first().click();
      await page.getByText('Mensagem de teste 59', { exact: true }).waitFor();
      await ready(page);
      await page.getByText('Mensagem de teste 25', { exact: true }).scrollIntoViewIfNeeded();
      const chatPosition = await page.locator('[data-navigation-scroll="chat-messages"]').evaluate((element) => element.scrollTop);
      assert.ok(chatPosition > 500);
      await page.locator('a[href="/profile"]').first().click();
      await page.getByRole('heading', { name: 'Perfil', exact: true }).waitFor();
      await page.goBack();
      await page.getByText('Mensagem de teste 59', { exact: true }).waitFor();
      await ready(page);
      await page.waitForFunction((y) => Math.abs(document.querySelector('[data-navigation-scroll="chat-messages"]').scrollTop - y) < 5, chatPosition);
      await page.locator('a[href="/profile"]').first().click();

      // Ajuda -> privacidade -> voltar -> voltar recupera a página intermediária.
      await page.getByRole('button', { name: /Central de Ajuda/ }).click();
      const privacyLink = page.locator('a[href="/privacy"]').last();
      await privacyLink.waitFor();
      await ready(page);
      await privacyLink.scrollIntoViewIfNeeded();
      const helpPosition = await page.evaluate(() => window.scrollY);
      await privacyLink.click();
      await page.getByRole('button', { name: 'Voltar', exact: true }).click();
      await expectPosition(page, helpPosition);
      await page.getByRole('button', { name: 'Voltar', exact: true }).click();
      await page.getByRole('heading', { name: 'Perfil', exact: true }).waitFor();
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });
}

test('link direto usa um destino interno ao voltar', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/privacy`);
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await page.waitForURL(`${origin}/login`);
  } finally {
    await browser.close();
  }
});

test('voltar preserva a posição mesmo ao abrir um link imediatamente após rolar', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`${origin}/help`);
    await ready(page);
    const position = await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      const y = window.scrollY;
      document.querySelector('a[href="/privacy"]').click();
      return y;
    });
    assert.ok(position > 0);
    await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    await page.waitForFunction(y => Math.abs(window.scrollY - y) < 5, position, { timeout: 5000 });
  } finally { await browser.close(); }
});
