import { generateChatReply, getChatFailure, validateChatPayload } from '../api/_lib/chatGeneration.js';
import { Buffer } from 'node:buffer';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function isLocalChatRequest(req) {
  try {
    const origin = new URL(req.headers.origin);
    return LOOPBACK.has(req.socket.remoteAddress)
      && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
      && origin.host === req.headers.host;
  } catch { return false; }
}

export function localChatApi(env) {
  let active = false;
  return {
    name: 'namao-local-chat',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== '/api/chat' || req.headers['x-namao-local-test'] !== 'true') return next();
        const send = (status, body) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(body));
        };
        // Esta rota só existe no Vite, em modo de teste e via mesma origem local.
        // A função publicada continua exigindo Firebase e verificando a cota.
        if (env.VITE_LOCAL_TEST_MODE !== 'true' || !isLocalChatRequest(req)) return send(403, { error: 'Teste de IA permitido apenas no localhost.' });
        if (req.method !== 'POST') return send(405, { error: 'Método não permitido.' });
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Envie uma mensagem JSON.' });
        if (!env.GEMINI_API_KEY) return send(503, { error: 'Configure GEMINI_API_KEY no .env.local para testar a IA.' });
        if (active) return send(429, { error: 'Aguarde a resposta atual antes de enviar outra mensagem.' });
        active = true;
        try {
          const chunks = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 128 * 1024) { send(413, { error: 'A mensagem enviada é grande demais.' }); return; }
            chunks.push(chunk);
          }
          let body;
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
          catch { return send(400, { error: 'Mensagem JSON inválida.' }); }
          const validated = validateChatPayload(body);
          if (validated.error) return send(validated.status, { error: validated.error });
          const text = await generateChatReply(validated.payload, { apiKey: env.GEMINI_API_KEY, modelName: env.GEMINI_MODEL || undefined });
          send(200, { text });
        } catch (error) {
          const failure = getChatFailure(error);
          console.error('Falha no chat local:', { code: failure.code, providerStatus: error.status || null });
          if (!res.writableEnded) send(failure.status, { error: failure.error, code: failure.code });
        } finally { active = false; }
      });
    },
  };
}
