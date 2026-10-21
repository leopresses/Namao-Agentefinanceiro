import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildChatPrompt } from './chatPrompt.js';

const INTERNAL_RESPONSE_PATTERN = /\b(?:plan for|acknowledge and validate|analyze fixed)\b/i;
const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

export function validateChatPayload(body) {
  const userText = typeof body?.userText === 'string' ? body.userText.trim() : '';
  const contextData = typeof body?.contextData === 'string' ? body.contextData : '';
  const conversationHistory = typeof body?.conversationHistory === 'string' ? body.conversationHistory.trim() : '';
  if (!userText) return { status: 400, error: 'Falta o texto do usuário.' };
  if (userText.length > 2000 || contextData.length > 60000 || conversationHistory.length > 8000) {
    return { status: 413, error: 'A mensagem enviada é grande demais.' };
  }
  return { payload: { userText, contextData, conversationHistory } };
}

export function isValidChatResponse(text, finishReason) {
  // Pontuação não determina completude: uma lista pode terminar em valor ou %.
  return !!text && !INTERNAL_RESPONSE_PATTERN.test(text)
    && !['MAX_TOKENS', 'SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT'].includes(finishReason);
}

export function getChatFailure(error) {
  const status = Number(error?.status);
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError' || /timed?\s?out|timeout/i.test(error?.message || '')) {
    return { status: 504, code: 'AI_TIMEOUT', error: 'A IA demorou para responder. Tente novamente em instantes.' };
  }
  if (status === 429) return { status: 503, code: 'AI_BUSY', error: 'A IA está com muitas solicitações no momento. Tente novamente em instantes.' };
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return { status: 503, code: 'AI_CONFIGURATION', error: 'O serviço de IA está temporariamente indisponível. Tente novamente mais tarde.' };
  }
  return { status: 503, code: 'AI_UNAVAILABLE', error: 'Não foi possível concluir a resposta da IA agora. Tente novamente.' };
}

export async function generateChatReply(payload, {
  apiKey = process.env.GEMINI_API_KEY,
  modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  client,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  if (!apiKey && !client) throw Object.assign(new Error('GEMINI_API_KEY não configurada.'), { status: 503 });
  const model = (client || new GoogleGenerativeAI(apiKey)).getGenerativeModel({
    model: modelName, systemInstruction: buildChatPrompt(payload),
  });
  let contents = [{ role: 'user', parts: [{ text: payload.userText }] }];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await model.generateContent({
        contents,
        generationConfig: { temperature: 0.35, maxOutputTokens: 4096, responseMimeType: 'text/plain' },
      }, { timeout: 25000 });
      const finishReason = String(result?.response?.candidates?.[0]?.finishReason || '');
      const text = String(result?.response?.text?.() || '').trim();
      if (isValidChatResponse(text, finishReason)) return text;
      if (attempt === 1) throw new Error('A IA não concluiu uma resposta válida.');
      // Não reenvia uma resposta vazia como mensagem de modelo: a API rejeita.
      contents = [
        { role: 'user', parts: [{ text: payload.userText }] },
        ...(text ? [{ role: 'model', parts: [{ text }] }] : []),
        { role: 'user', parts: [{ text: 'Responda novamente, de forma breve e completa, em português brasileiro. Entregue apenas a orientação final, sem texto de bastidor.' }] },
      ];
    } catch (error) {
      if (attempt === 1 || !TRANSIENT_STATUS.has(Number(error?.status))) throw error;
      await wait(600 + Math.floor(Math.random() * 400));
    }
  }
  throw new Error('A IA não concluiu uma resposta válida.');
}
