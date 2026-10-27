import assert from 'node:assert/strict';
import test from 'node:test';
import process from 'node:process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

test('build com CSP mantém navegação, dados e PDF e bloqueia script inline', async () => {
  // Isolated build with test login; never uses dist/ or production accounts.
  const root = resolve('node_modules/.cache/namao-security-preview');
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  const headers = config.routes[0].headers;
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
    const target = resolve(root, `.${path}`);
    if (!target.startsWith(`${root}/`) && !target.startsWith(`${root}\\`) && target !== root) return res.writeHead(403).end();
    try {
      const filename = extname(path) ? target : resolve(root, 'index.html');
      const body = await readFile(filename);
      res.setHeader('Content-Type', types[extname(filename)] || 'application/octet-stream');
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.addInitScript(() => {
      localStorage.setItem('namao_local_test_user', 'true');
      localStorage.setItem('namao_auth_token', 'local-test');
      localStorage.setItem('namao_has_seen_help', 'true');
      sessionStorage.setItem('namao_pwa_dismissed', 'true');
      window.cspViolations = [];
      document.addEventListener('securitypolicyviolation', (event) => window.cspViolations.push({ directive: event.effectiveDirective, uri: event.blockedURI }));
    });
    const response = await page.goto(`${origin}/report`);
    assert.equal(response.headers()['x-frame-options'], 'DENY');
    await page.getByRole('heading', { name: 'Resumo', exact: true }).waitFor();
    await page.evaluate(async () => {
      const database = await new Promise((done, reject) => {
        const request = indexedDB.open('keyval-store', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('keyval');
        request.onsuccess = () => done(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((done, reject) => {
        const transaction = database.transaction('keyval', 'readwrite');
        const date = new Date();
        const monthDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
        transaction.objectStore('keyval').put([
          { id: 'income', description: 'Salário de exemplo', date: monthDate, type: 'income', status: 'paid', amount: 2499 },
          { id: 'expense', description: 'Mercado de exemplo', date: monthDate, type: 'expense', status: 'unpaid', category: 'mercado', amount: 175 },
        ], 'namao_expenses:local-test');
        transaction.oncomplete = done; transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    });
    await page.reload();
    await page.getByText(/Salário de exemplo/).waitFor({ state: 'attached' });
    await page.evaluate(() => { navigator.canShare = () => false; });
    const pending = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: 'Exportar e compartilhar', exact: true }).click();
    const download = await pending;
    const stream = await download.createReadStream();
    const chunks = []; for await (const chunk of stream) chunks.push(chunk);
    assert.equal(Buffer.concat(chunks).subarray(0, 5).toString(), '%PDF-');
    assert.deepEqual(await page.evaluate(() => window.cspViolations), [], 'PDF deve respeitar a CSP');
    for (const [path, heading] of [['/profile', 'Perfil'], ['/chat', 'NaMão IA'], ['/help', 'Central de Ajuda']]) {
      await page.goto(`${origin}${path}`);
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      assert.deepEqual(await page.evaluate(() => window.cspViolations), [], path);
    }
    await page.goto(`${origin}/privacy`);
    await page.getByRole('heading', { name: 'Política de Privacidade', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.untrustedScriptExecuted = true';
      document.body.appendChild(script);
    });
    assert.equal(await page.evaluate(() => window.untrustedScriptExecuted), undefined);
    await page.waitForFunction(() => window.cspViolations.some((v) => v.directive === 'script-src-elem' && v.uri === 'inline'));
  } catch (error) {
    console.error(JSON.stringify({ page: page.url(), errors, state: await page.evaluate(() => ({
      text: document.body.innerText.slice(0, 1800), violations: window.cspViolations,
    })) }));
    throw error;
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
});
