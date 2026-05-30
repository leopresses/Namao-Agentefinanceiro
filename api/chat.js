import { Groq } from 'groq-sdk';
import admin from 'firebase-admin';

// Inicializa Firebase Admin (Singleton para Serverless Functions)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'namaowebapp'
  });
}

export default async function handler(req, res) {
  // CORS Headers para Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  // Validação do Token do Firebase
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação ausente.' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  let decodedUser;
  try {
    decodedUser = await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    console.error('Token inválido:', err.message);
    return res.status(401).json({ error: 'Token de autenticação inválido ou expirado.' });
  }

  const { userText, contextData } = req.body;
  if (!userText) {
    return res.status(400).json({ error: 'Falta o texto do usuário.' });
  }

  console.log(`[Chat API] Requisição autenticada do UID: ${decodedUser.uid}`);

  const db = admin.firestore();
  const userRef = db.collection('users').doc(decodedUser.uid);
  
  let isPro = false;
  let aiMessageCount = 0;
  let aiLastMessageMonth = '';
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    const docSnap = await userRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      isPro = !!data.isPro;
      aiLastMessageMonth = data.aiLastMessageMonth || '';
      aiMessageCount = data.aiMessageCount || 0;
      
      // Reseta a contagem se for um novo mês
      if (aiLastMessageMonth !== currentMonth) {
        aiMessageCount = 0;
      }
    }
  } catch (err) {
    console.error('Erro ao buscar dados do usuário:', err);
    return res.status(500).json({ error: 'Erro de validação do usuário.' });
  }

  // Verifica o limite Freemium
  if (!isPro && aiMessageCount >= 5) {
    return res.status(403).json({ error: 'Limite de mensagens gratuitas atingido. Assine o plano Pro para continuar.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('GROQ_API_KEY não definida no ambiente.');
    return res.status(500).json({ error: 'Erro de configuração do servidor.' });
  }

  const groq = new Groq({ apiKey });

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

  try {
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
    
    // Se não for PRO, incrementa a contagem de uso após sucesso
    if (!isPro) {
      await userRef.set({
        aiMessageCount: aiMessageCount + 1,
        aiLastMessageMonth: currentMonth
      }, { merge: true });
    }

    res.status(200).json({ text });
  } catch (error) {
    console.error('Erro na API do Groq:', error);
    res.status(500).json({ error: 'A inteligência artificial encontrou um erro ao tentar gerar sua resposta.' });
  }
}
