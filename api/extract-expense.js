import { Groq } from 'groq-sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Missing text input' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server missing GROQ_API_KEY' });
    }

    const groq = new Groq({ apiKey });

    const prompt = `Você é um assistente financeiro de um app chamado NaMão. Extraia as informações da seguinte fala do usuário: "${text}".
    
    Responda APENAS com um objeto JSON puro, sem crases, sem a palavra json. 
    O objeto deve ter as seguintes chaves e formatos exatos:
    - "amount": número (em formato float, ex: 15.50). Se não dito, retorne nulo.
    - "description": string curta (ex: "Gasolina", "Almoço", "Uber"). Se não dito, retorne nulo.
    - "category": string. Escolha obrigatoriamente um destes IDs (em minúsculas): mercado, alimentacao, transporte, casa, saude, educacao, vestuario, beleza, pets, assinaturas, lazer, viagem, dividas, outros. Se não tiver certeza, use "outros".
    - "type": string. Retorne "expense" (para despesas) ou "income" (para receitas).

    Exemplo de fala: "Gastei 150 de gasolina hoje"
    Resposta esperada: {"amount": 150, "description": "Gasolina", "category": "transporte", "type": "expense"}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const aiText = chatCompletion.choices[0]?.message?.content || "{}";
    const parsedData = JSON.parse(aiText);

    return res.status(200).json(parsedData);

  } catch (error) {
    console.error('Erro no extract-expense:', error);
    return res.status(500).json({ error: 'Erro ao processar a fala com IA.' });
  }
}
