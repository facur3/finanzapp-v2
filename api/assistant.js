const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    intent: { type: 'string', enum: ['transaction', 'recurring', 'card_payment', 'none'] },
    transactionType: { type: 'string', enum: ['gasto', 'ingreso', 'none'] },
    amount: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    currency: { type: 'string', enum: ['ARS', 'USD'] },
    merchant: { type: 'string' },
    categoryRef: { type: 'string' },
    accountRef: { type: 'string' },
    cardRef: { type: 'string' },
    recurringRef: { type: 'string' },
    dateISO: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    explanation: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['intent', 'transactionType', 'amount', 'currency', 'merchant', 'categoryRef', 'accountRef', 'cardRef', 'recurringRef', 'dateISO', 'tags', 'explanation', 'confidence'],
};

function outputText(payload) {
  for (const item of (payload && payload.output) || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }
  return '';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({ error: 'ai_not_configured' });
    return;
  }
  const text = String(req.body && req.body.text || '').trim().slice(0, 800);
  const today = String(req.body && req.body.today || '').slice(0, 10);
  if (!text) {
    res.status(400).json({ error: 'missing_text' });
    return;
  }

  const instructions = [
    'Interpretá una orden breve en español argentino para registrar finanzas personales.',
    'Solo extraé datos; no des consejos financieros ni ejecutes acciones.',
    'Devolvé referencias textuales mencionadas por el usuario; nunca inventes ids ni información de cuentas.',
    'Si falta un dato, devolvé string vacío o amount null.',
    'Si parece un recurrente sin monto, elegí intent recurring y usá recurringRef con las palabras del usuario.',
    'Para pago total o completo de tarjeta usá card_payment con amount null.',
    'No ejecutes nada: el cliente siempre mostrará una confirmación.',
    'Fecha local: ' + today,
  ].join('\n');

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: {
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
        store: false,
        input: [
          { role: 'system', content: instructions },
          { role: 'user', content: text },
        ],
        text: { format: { type: 'json_schema', name: 'finanzapp_command', strict: true, schema } },
        max_output_tokens: 700,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      res.status(502).json({ error: 'openai_error', detail: payload && payload.error && payload.error.code });
      return;
    }
    const raw = outputText(payload);
    if (!raw) {
      res.status(502).json({ error: 'empty_model_response' });
      return;
    }
    const draft = JSON.parse(raw);
    res.status(200).json({ draft: { ...draft, source: 'openai' } });
  } catch (error) {
    res.status(502).json({ error: 'assistant_unavailable' });
  }
}
