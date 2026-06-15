export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Missing text input' });
    }

    // Usando fetch direto para a API do Gemini via REST
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
    }

    const prompt = `Você é um assistente financeiro de um app chamado NaMão. Extraia as informações da seguinte fala do usuário: "${text}".
    
    Responda APENAS com um objeto JSON puro, sem crases, sem a palavra json. 
    O objeto deve ter as seguintes chaves e formatos exatos:
    - "amount": número (em formato float, ex: 15.50). Se não dito, retorne nulo.
    - "description": string curta (ex: "Gasolina", "Almoço", "Uber"). Se não dito, retorne nulo.
    - "category": string. Escolha obrigatoriamente um destes IDs (em minúsculas): mercado, alimentacao, transporte, casa, saude, educacao, vestuario, beleza, pets, assinaturas, lazer, viagem, dividas, outros. Se não tiver certeza, use "outros".
    - "type": string. Retorne "expense" (para despesas) ou "income" (para receitas).

    Exemplo de fala: "Gastei 150 de gasolina hoje"
    Resposta esperada: {"amount": 150, "description": "Gasolina", "category": "transporte", "type": "expense"}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'Gemini API Error');
    }

    const aiText = data.candidates[0].content.parts[0].text;
    const parsedData = JSON.parse(aiText);

    return res.status(200).json(parsedData);

  } catch (error) {
    console.error('Erro no extract-expense:', error);
    return res.status(500).json({ error: 'Erro ao processar a fala com IA.' });
  }
}
