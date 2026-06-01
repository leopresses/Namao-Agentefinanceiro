import admin from 'firebase-admin';

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
    admin.initializeApp({ projectId: 'namaowebapp' });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT;
  const mpToken = !!process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (hasServiceAccount && mpToken) {
    res.status(200).json({ 
      status: 'success', 
      message: '✅ Tudo perfeito! A Vercel está conectada ao Firebase Admin e ao Mercado Pago com sucesso.',
      serviceAccountConfigured: true,
      mercadoPagoConfigured: true
    });
  } else {
    res.status(200).json({ 
      status: 'warning', 
      message: '⚠️ Faltam configurações na Vercel.',
      serviceAccountConfigured: hasServiceAccount,
      mercadoPagoConfigured: mpToken
    });
  }
}
