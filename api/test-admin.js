// Rota de diagnóstico mantida somente para não quebrar links antigos.
// Nunca exponha o estado de credenciais ou detalhes internos em produção.
export default function handler(_req, res) {
  return res.status(404).json({ error: 'Rota não encontrada.' });
}
