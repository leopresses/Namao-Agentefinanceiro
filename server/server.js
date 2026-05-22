const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: '.env.local' });
const Groq = require('groq-sdk');

const app = express();
const port = process.env.PORT || 3001;

const localSecret = process.env.VITE_LOCAL_API_SECRET;
if (!localSecret) {
  console.warn('AVISO: VITE_LOCAL_API_SECRET não definido no .env.local!');
}

// Configuração segura de CORS (CWE-942)
const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Acesso bloqueado pela política de CORS do NaMão'));
    }
  }
}));

app.use(express.json());

// Rate Limiting (CWE-799) - Previne spam na cota do Groq
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 15, // Limite de 15 requisições por minuto por IP
  message: { error: 'Muitas requisições. Por favor, aguarde um minuto e tente novamente.' }
});

if (!process.env.GROQ_API_KEY) {
  console.error('ERRO CRÍTICO: GROQ_API_KEY não foi definida no arquivo .env local.');
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post('/api/chat', apiLimiter, async (req, res) => {
  try {
    // Autenticação Secreta (CWE-306)
    const clientSecret = req.headers['x-api-secret'];
    if (localSecret && clientSecret !== localSecret) {
      return res.status(401).json({ error: 'Acesso negado: Secret inválido.' });
    }

    const { userText, contextData } = req.body;

    if (!userText) {
      return res.status(400).json({ error: 'Falta o texto do usuário.' });
    }

    const systemPrompt = `Você é o "Agente Financeiro NaMão", um consultor financeiro inteligente e útil integrado em um aplicativo.
    Use o contexto financeiro do usuário abaixo para responder à pergunta dele com precisão.
    
    COMO O APLICATIVO FUNCIONA (Ajuda Técnica):
    - O botão central "+" serve para registrar Rendas e Despesas.
    - Se a despesa não estiver paga, o usuário pode marcar "Pendente" (o valor vai para "Faturas a Pagar" e a despesa fica vermelha).
    - Para baixar a despesa (pagar), o usuário clica na despesa no Dashboard e aperta "Marcar como Pago". O valor é debitado do Saldo.
    - É possível gerar PDFs de relatório e fazer Backup na aba de Configurações.
    Se a pergunta for técnica sobre o app, ensine o usuário como usar. Se for sobre finanças, dê conselhos práticos e curtos usando o contexto abaixo.

    CONTEXTO FINANCEIRO DO USUÁRIO:
    ${contextData}
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_completion_tokens: 1024,
    });

    const text = chatCompletion.choices[0]?.message?.content || "Desculpe, não consegui processar a resposta.";
    res.json({ text });
  } catch (error) {
    console.error('Erro na API do Groq:', error);
    res.status(500).json({ error: 'A inteligência artificial encontrou um erro ao tentar gerar sua resposta. Tente novamente em alguns instantes.' });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando com segurança na porta ${port}`);
});
