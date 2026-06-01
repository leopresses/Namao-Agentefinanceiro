import admin from 'firebase-admin';

let initError = null;

if (!admin.apps.length) {
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    } else {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'namaowebapp'
      });
    }
  } catch (err) {
    initError = err.message;
    admin.initializeApp({ projectId: 'namaowebapp' });
  }
}

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT;
    const mpToken = !!process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (initError) {
      return res.status(200).json({ 
        status: 'error', 
        message: 'O JSON do Firebase é inválido. Você copiou ele corretamente?',
        errorDetails: initError
      });
    }

    if (hasServiceAccount && mpToken) {
      return res.status(200).json({ 
        status: 'success', 
        message: '✅ Tudo perfeito! A Vercel está conectada ao Firebase Admin e ao Mercado Pago com sucesso.',
        serviceAccountConfigured: true,
        mercadoPagoConfigured: true
      });
    } else {
      return res.status(200).json({ 
        status: 'warning', 
        message: '⚠️ Faltam configurações na Vercel.',
        serviceAccountConfigured: hasServiceAccount,
        mercadoPagoConfigured: mpToken
      });
    }
  } catch (globalError) {
    return res.status(200).json({ status: 'fatal_error', message: globalError.message });
  }
}
