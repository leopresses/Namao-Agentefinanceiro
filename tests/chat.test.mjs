import assert from 'node:assert/strict';
import test from 'node:test';
import { generateChatReply, getChatFailure, isValidChatResponse, validateChatPayload } from '../api/_lib/chatGeneration.js';
import { isLocalChatRequest } from '../dev/localChatApi.js';
import handler from '../api/chat.js';

function fakeClient(results, calls) {
  return { getGenerativeModel: () => ({ generateContent: async (request) => {
    calls.push(request);
    const result = results.shift();
    if (result instanceof Error) throw result;
    return { response: { text: () => result.text, candidates: [{ finishReason: result.finishReason || 'STOP' }] } };
  } }) };
}

test('respostas válidas com valor, porcentagem ou emoji não são rejeitadas por pontuação', () => {
  assert.ok(isValidChatResponse('Reserve até 20%', 'STOP'));
  assert.ok(isValidChatResponse('- Mercado: R$ 150,00', 'STOP'));
  assert.ok(isValidChatResponse('Olá! 😊', 'STOP'));
  assert.ok(!isValidChatResponse('Resposta interrompida', 'MAX_TOKENS'));
  assert.ok(!isValidChatResponse('Plan for this reply', 'STOP'));
});

test('resposta válida usa uma única geração', async () => {
  const calls = [];
  const text = await generateChatReply({ userText: 'Como economizar?' }, { client: fakeClient([{ text: 'Reserve 20%' }], calls) });
  assert.equal(text, 'Reserve 20%');
  assert.equal(calls.length, 1);
});

test('resposta vazia ou truncada recebe uma tentativa sem mensagem de modelo vazia', async () => {
  const calls = [];
  const text = await generateChatReply({ userText: 'Como economizar?' }, { client: fakeClient([{ text: '', finishReason: 'MAX_TOKENS' }, { text: 'Comece registrando as despesas.' }], calls) });
  assert.equal(text, 'Comece registrando as despesas.');
  assert.equal(calls.length, 2);
  assert.ok(!calls[1].contents.some((entry) => entry.role === 'model'));
});

test('falha transitória recebe uma tentativa adicional; configuração inválida não', async () => {
  const calls = [];
  const temporary = Object.assign(new Error('Busy'), { status: 503 });
  const text = await generateChatReply({ userText: 'Olá' }, { client: fakeClient([temporary, { text: 'Olá.' }], calls), wait: async () => {} });
  assert.equal(text, 'Olá.');
  assert.equal(calls.length, 2);
  const invalidCalls = [];
  const invalid = Object.assign(new Error('API key rejected'), { status: 403 });
  await assert.rejects(generateChatReply({ userText: 'Olá' }, { client: fakeClient([invalid], invalidCalls) }));
  assert.equal(invalidCalls.length, 1);
  assert.equal(getChatFailure(invalid).code, 'AI_CONFIGURATION');
  assert.ok(!getChatFailure(invalid).error.includes('API key'));
});

test('limite de tentativas impede repetição infinita e erro de timeout tem mensagem útil', async () => {
  const calls = [];
  const temporary = Object.assign(new Error('Busy'), { status: 429 });
  await assert.rejects(generateChatReply({ userText: 'Olá' }, { client: fakeClient([temporary, temporary], calls), wait: async () => {} }));
  assert.equal(calls.length, 2);
  assert.equal(getChatFailure(temporary).code, 'AI_BUSY');
  assert.equal(getChatFailure(Object.assign(new Error('timeout'), { name: 'TimeoutError' })).status, 504);
});

test('validação recusa payload vazio e contexto excessivo', () => {
  assert.equal(validateChatPayload({ userText: '   ' }).status, 400);
  assert.equal(validateChatPayload({ userText: 'Olá', contextData: 'a'.repeat(60001) }).status, 413);
  assert.equal(validateChatPayload({ userText: ' Olá ' }).payload.userText, 'Olá');
});

test('chat local exige conexão de loopback e mesma origem', () => {
  const request = { headers: { origin: 'http://localhost:5173', host: 'localhost:5173' }, socket: { remoteAddress: '::1' } };
  assert.ok(isLocalChatRequest(request));
  assert.ok(!isLocalChatRequest({ ...request, headers: { ...request.headers, origin: 'https://outro-site.example' } }));
  assert.ok(!isLocalChatRequest({ ...request, socket: { remoteAddress: '192.168.0.10' } }));
  assert.ok(!isLocalChatRequest({ ...request, headers: { host: 'localhost:5173' } }));
});

test('API publicada mantém autenticação mesmo com o cabeçalho de teste local', async () => {
  let code;
  let body;
  const res = { status(value) { code = value; return this; }, json(value) { body = value; return this; }, setHeader() {} };
  await handler({ method: 'POST', headers: { 'x-namao-local-test': 'true' }, body: { userText: 'Olá' } }, res);
  assert.equal(code, 401);
  assert.match(body.error, /autenticação/);
});
