import { MercadoPagoConfig, Preference } from 'mercadopago';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'namaowebapp'
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }

  const { planType } = req.body;
  
  let unitPrice = 9.90;
  let title = "NaMão PRO - Mensal";
  
  if (planType === 'anual') {
    unitPrice = 89.00;
    title = "NaMão PRO - Anual";
  }

  const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!mpAccessToken) {
    return res.status(500).json({ error: 'Mercado Pago não configurado no servidor.' });
  }

  const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
  const preference = new Preference(client);

  try {
    const response = await preference.create({
      body: {
        items: [
          {
            id: `plan_${planType}`,
            title: title,
            quantity: 1,
            unit_price: unitPrice,
            currency_id: 'BRL',
          }
        ],
        payer: {
          email: decodedUser.email || 'usuario@namao.app',
        },
        external_reference: decodedUser.uid, // Extremamente importante para sabermos quem pagou no Webhook
        back_urls: {
          success: `${req.headers.origin || 'https://namao-agentefinanceiro.vercel.app'}/?payment=success`,
          failure: `${req.headers.origin || 'https://namao-agentefinanceiro.vercel.app'}/?payment=failure`,
          pending: `${req.headers.origin || 'https://namao-agentefinanceiro.vercel.app'}/?payment=pending`
        },
        auto_return: 'approved'
      }
    });

    res.status(200).json({ init_point: response.init_point });
  } catch (error) {
    console.error('Erro ao gerar preference Mercado Pago:', error);
    res.status(500).json({ error: 'Falha ao criar sessão de pagamento.' });
  }
}
