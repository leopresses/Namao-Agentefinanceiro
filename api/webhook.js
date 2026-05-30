import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'namaowebapp'
  });
}

export default async function handler(req, res) {
  // Webhooks geralmente são POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { action, data, type } = req.body;
    
    // O Mercado Pago envia o ID do pagamento dentro de data.id quando type === 'payment'
    // Mas, como este é apenas um boilerplate de webhook, vamos simular a leitura do status.
    // Em produção, você faria um GET na API do MP usando este ID para confirmar o status:
    // const paymentId = data?.id;
    
    // Exemplo simplificado confiando no payload (Não recomendado sem checar a assinatura/API do MP)
    const paymentStatus = req.body.action || type; 

    // O Webhook do MercadoPago pode variar bastante. Para garantir que este código funcione de exemplo:
    // Nós lemos o external_reference se ele vier no payload, ou simulamos sucesso se for teste
    // Ideal: GET https://api.mercadopago.com/v1/payments/${paymentId} para pegar o external_reference
    
    // ATENÇÃO: Código simplificado para fins educacionais da IA
    console.log('[Webhook MP] Payload recebido:', JSON.stringify(req.body));
    
    res.status(200).send('OK');

  } catch (error) {
    console.error('[Webhook MP] Erro:', error);
    res.status(500).json({ error: 'Erro interno.' });
  }
}
