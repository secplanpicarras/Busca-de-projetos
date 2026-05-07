import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { pdfText } = await req.json();

    if (!pdfText) {
      return new Response(JSON.stringify({ error: "pdfText é obrigatório" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Você é especialista em matrículas de imóveis brasileiros.

Analise o texto abaixo de uma matrícula e extraia os nomes de pessoas físicas que constam como proprietários, compradores ou averbados como donos ao longo do histórico.

Para cada nome, avalie a CONFIANÇA na leitura (considere que o PDF pode ser escaneado com qualidade ruim):
- "alta": nome claramente legível
- "media": provável mas pode ter letras erradas  
- "baixa": parcialmente ilegível, pode estar errado

Retorne SOMENTE um JSON array, sem markdown, sem texto extra:
[{"name":"JOAO DA SILVA","confidence":"alta"}]

Texto da matrícula:
${pdfText.substring(0, 8000)}`
        }],
      }),
    });

    const data = await resp.json();
    const raw  = data.content[0].text.trim().replace(/```json|```/g, "").trim();
    const names = JSON.parse(raw);

    return new Response(JSON.stringify({ names }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
