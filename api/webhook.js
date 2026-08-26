import crypto from 'node:crypto';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { getAdminDb } from './_lib/firebaseAdmin.js';

const PLANS = {
  mensal: { price: 9.90, durationDays: 30 },
  anual: { price: 89.00, durationDays: 365 },
};

function isValidSignature(req) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return true;

  const signature = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'] || '';
  const paymentId = String(req.body?.data?.id || '');
  if (!signature || !paymentId) return false;

  const values = Object.fromEntries(
    signature.split(',').map((part) => part.trim().split('='))
  );
  if (!values.ts || !values.v1) return false;

  const manifest = `id:${paymentId};request-id:${requestId};ts:${values.ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const received = values.v1;
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function parseReference(reference) {
  const [uid, planId, ...rest] = String(reference || '').split(':');
  if (!uid || !PLANS[planId] || rest.length > 0) return null;
  return { uid, planId, plan: PLANS[planId] };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  if (!isValidSignature(req)) {
    return res.status(401).json({ error: 'Assinatura do webhook inválida.' });
  }

  try {
    if (req.body?.type !== 'payment' || !req.body?.data?.id) {
      return res.status(200).send('Evento ignorado');
    }

    const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!mpAccessToken) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado.');

    const paymentClient = new Payment(new MercadoPagoConfig({ accessToken: mpAccessToken }));
    const payment = await paymentClient.get({ id: req.body.data.id });
    if (payment.status !== 'approved') {
      return res.status(200).send('Pagamento ainda não aprovado');
    }

    const reference = parseReference(payment.external_reference);
    if (!reference) throw new Error('Referência de pagamento inválida.');

    const paidAmount = Number(payment.transaction_amount);
    if (payment.currency_id !== 'BRL' || Math.abs(paidAmount - reference.plan.price) > 0.01) {
      throw new Error('Valor ou moeda do pagamento não corresponde ao plano.');
    }

    const paymentDate = payment.date_approved ? new Date(payment.date_approved) : new Date();
    if (!Number.isFinite(paymentDate.getTime())) throw new Error('Data de aprovação inválida.');

    const userRef = getAdminDb().collection('users').doc(reference.uid);
    await getAdminDb().runTransaction(async (transaction) => {
      const current = await transaction.get(userRef);
      const previous = current.exists ? current.data() : {};
      if (previous.lastPaymentId === String(payment.id)) return;

      const existingExpiry = new Date(previous.proExpiresAt || '');
      const baseDate = Number.isFinite(existingExpiry.getTime()) && existingExpiry > paymentDate
        ? existingExpiry
        : paymentDate;
      const expiresAt = new Date(baseDate);
      expiresAt.setDate(expiresAt.getDate() + reference.plan.durationDays);

      transaction.set(userRef, {
        isPro: true,
        planType: reference.planId,
        proExpiresAt: expiresAt.toISOString(),
        aiMessageCount: 0,
        aiLastMessageMonth: new Date().toISOString().slice(0, 7),
        lastPaymentId: String(payment.id),
        lastPaymentAt: paymentDate.toISOString(),
      }, { merge: true });
    });

    return res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook MP] Erro ao processar:', error.message);
    // Código 5xx faz o Mercado Pago tentar novamente em falhas transitórias.
    return res.status(500).send('Falha temporária no processamento');
  }
}
