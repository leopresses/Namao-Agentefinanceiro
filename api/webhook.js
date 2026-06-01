import admin from 'firebase-admin';
import { MercadoPagoConfig, Payment } from 'mercadopago';

// Inicializa Firebase Admin usando Service Account (necessário para escrita no banco)
if (!admin.apps.length) {
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('✅ Firebase Admin inicializado com Service Account no Webhook.');
    } else {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'namaowebapp'
      });
      console.warn('⚠️ Firebase Admin sem Service Account. Gravação no banco falhará.');
    }
  } catch (err) {
    console.error('❌ Erro na inicialização do Firebase Admin:', err);
    admin.initializeApp({ projectId: 'namaowebapp' });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { action, data, type } = req.body;
    
    // O Mercado Pago envia a notificação com type === 'payment'
    if (type === 'payment' && data && data.id) {
      const paymentId = data.id;

      const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (!mpAccessToken) {
        throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado.');
      }

      // Configurar o cliente Mercado Pago
      const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
      const paymentClient = new Payment(client);

      // Buscar detalhes ATUALIZADOS do pagamento diretamente da fonte segura (Mercado Pago)
      const payment = await paymentClient.get({ id: paymentId });
      
      console.log(`[Webhook] Status do Pagamento ${paymentId}: ${payment.status}`);

      // Se o pagamento foi aprovado, vamos dar o PRO para o usuário
      if (payment.status === 'approved') {
        const uid = payment.external_reference; // Recupera o UID que enviamos no Checkout
        
        if (!uid) {
          throw new Error('Pagamento aprovado, mas sem external_reference (UID) associado.');
        }

        // Atualiza o banco de dados do usuário no Firestore
        const db = admin.firestore();
        await db.collection('users').doc(uid).set({
          isPro: true,
          aiMessageCount: 0 // Reseta a contagem de mensagens de IA
        }, { merge: true });

        console.log(`✅ [Webhook] Usuário ${uid} atualizado para PRO com sucesso!`);
      }
    }

    // Mercado Pago exige que você responda com 200 OK rapidamente
    res.status(200).send('OK');

  } catch (error) {
    console.error('[Webhook MP] Erro ao processar:', error);
    // Retornamos 200 mesmo no erro para que o Mercado Pago não fique retentando infinitamente se for um erro de código nosso
    // (Em produção mais complexa, você retornaria erro se quisesse que o MP reenviasse depois)
    res.status(200).send('Erro processado');
  }
}
