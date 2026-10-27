import crypto from 'node:crypto';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { getAdminDb } from './_lib/firebaseAdmin.js';

const PLANS = {
  mensal: { price: 9.90, durationDays: 30 },
  anual: { price: 89.00, durationDays: 365 },
};

function isValidSignature(req) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return false;

  const signature = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'] || '';
  const paymentId = String(req.query?.['data.id'] || '').toLowerCase();
  const bodyId = String(req.body?.data?.id || '').toLowerCase();
  if (typeof signature !== 'string' || typeof requestId !== 'string' || !requestId
    || !paymentId || paymentId !== bodyId) return false;

  const values = Object.fromEntries(
    signature.split(',').map((part) => part.trim().split('='))
  );
  if (!/^\d+$/.test(values.ts || '') || !/^[a-fA-F0-9]{64}$/.test(values.v1 || '')) return false;

  const manifest = `id:${paymentId};request-id:${requestId};ts:${values.ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(values.v1, 'hex'));
}

function parseReference(reference) {
  const [uid, planId, ...rest] = String(reference || '').split(':');
  if (!uid || !Object.hasOwn(PLANS, planId) || rest.length > 0) return null;
  return { uid, planId, plan: PLANS[planId] };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  if (!process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()) {
    console.error('[Webhook MP] Segredo de assinatura não configurado.');
    return res.status(503).send('Notificações de pagamento temporariamente indisponíveis');
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
    if (!Number.isFinite(paidAmount) || paidAmount <= 0 || payment.currency_id !== 'BRL'
      || Math.round(paidAmount * 100) !== Math.round(reference.plan.price * 100)) {
      throw new Error('Valor ou moeda do pagamento não corresponde ao plano.');
    }

    const paymentDate = payment.date_approved ? new Date(payment.date_approved) : new Date();
    if (!Number.isFinite(paymentDate.getTime())) throw new Error('Data de aprovação inválida.');

    const db = getAdminDb();
    const paymentId = String(payment.id);
    const receiptRef = db.collection('paymentReceipts').doc(paymentId);
    const userRef = db.collection('users').doc(reference.uid);
    await db.runTransaction(async (transaction) => {
      // Um recibo por pagamento impede repetição mesmo após outras compras.
      // Recibo e acesso são gravados na mesma transação.
      const receipt = await transaction.get(receiptRef);
      if (receipt.exists) return;
      const current = await transaction.get(userRef);
      const previous = current.exists ? current.data() : {};
      const previousReceiptRef = previous.lastPaymentId && previous.lastPaymentId !== paymentId
        ? db.collection('paymentReceipts').doc(String(previous.lastPaymentId))
        : null;
      const previousReceipt = previousReceiptRef ? await transaction.get(previousReceiptRef) : null;
      if (previousReceiptRef && !previousReceipt.exists) {
        // Conserva também o último pagamento reconhecido pela versão anterior.
        transaction.set(previousReceiptRef, { uid: reference.uid, migrated: true });
      }
      transaction.set(receiptRef, {
        uid: reference.uid,
        planType: reference.planId,
        amount: paidAmount,
        approvedAt: paymentDate.toISOString(),
      });
      if (previous.lastPaymentId === paymentId) return;

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
        lastPaymentId: paymentId,
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
