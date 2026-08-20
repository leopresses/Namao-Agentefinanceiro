import { MercadoPagoConfig, Preference } from 'mercadopago';
import { getAdminAuth } from './_lib/firebaseAdmin.js';
import { getAppOrigin, getBearerToken, handleCors } from './_lib/http.js';

const PLANS = {
  mensal: {
    id: 'mensal',
    title: 'NaMão PRO - acesso por 30 dias',
    price: 9.90,
    durationDays: 30,
  },
  anual: {
    id: 'anual',
    title: 'NaMão PRO - acesso por 365 dias',
    price: 89.00,
    durationDays: 365,
  },
};

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const idToken = getBearerToken(req);
  if (!idToken) {
    return res.status(401).json({ error: 'Token de autenticação ausente.' });
  }

  let decodedUser;
  try {
    decodedUser = await getAdminAuth().verifyIdToken(idToken);
  } catch (error) {
    if (error.message.includes('FIREBASE_SERVICE_ACCOUNT')) {
      return res.status(503).json({ error: 'Serviço de autenticação temporariamente indisponível.' });
    }
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }

  const plan = PLANS[req.body?.planType];
  if (!plan) {
    return res.status(400).json({ error: 'Plano inválido.' });
  }

  const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!mpAccessToken) {
    return res.status(500).json({ error: 'Mercado Pago não configurado no servidor.' });
  }

  const appOrigin = getAppOrigin();
  const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
  const preference = new Preference(client);

  try {
    const response = await preference.create({
      body: {
        items: [{
          id: `namao_pro_${plan.id}`,
          title: plan.title,
          quantity: 1,
          unit_price: plan.price,
          currency_id: 'BRL',
        }],
        payer: { email: decodedUser.email || 'usuario@namao.app' },
        // O tipo do plano é vinculado ao usuário e validado novamente no webhook.
        external_reference: `${decodedUser.uid}:${plan.id}`,
        back_urls: {
          success: `${appOrigin}/?payment=success`,
          failure: `${appOrigin}/?payment=failure`,
          pending: `${appOrigin}/?payment=pending`,
        },
        auto_return: 'approved',
      },
    });

    return res.status(200).json({ init_point: response.init_point });
  } catch (error) {
    console.error('Erro ao gerar preferência Mercado Pago:', error.message);
    return res.status(500).json({ error: 'Falha ao criar sessão de pagamento.' });
  }
}
