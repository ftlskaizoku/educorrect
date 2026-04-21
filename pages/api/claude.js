// pages/api/claude.js — Proxy sécurisé vers l'API Anthropic
// La clé API reste côté serveur (variable d'environnement Netlify), jamais exposée au navigateur.

export const config = {
  api: {
    bodyParser: { sizeLimit: "20mb" },   // PDFs et images base64 peuvent être lourds
    responseLimit: false,
    externalResolver: true,               // Indique à Next.js que ce handler gère lui-même la réponse
  },
};

export default async function handler(req, res) {
  // CORS — autorise uniquement les requêtes du même domaine
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method not allowed" } });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return res.status(500).json({
      error: { message: "ANTHROPIC_API_KEY manquante. Va dans Site configuration > Environment variables sur Netlify." }
    });
  }

  // Valide que le body est correct
  if (!req.body || !req.body.model || !req.body.messages) {
    return res.status(400).json({ error: { message: "Body invalide : model et messages requis." } });
  }

  try {
    // AbortController pour gérer le timeout côté proxy (24s < 26s limite Netlify)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 24000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      req.body.model,
        max_tokens: req.body.max_tokens || 1500,
        messages:   req.body.messages,
        // Passe system si fourni
        ...(req.body.system ? { system: req.body.system } : {}),
      }),
    });

    clearTimeout(timeout);

    // Relit le body une seule fois
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch { return res.status(502).json({ error: { message: "Réponse invalide de l'API Anthropic." } }); }

    return res.status(response.status).json(data);

  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({ error: { message: "L'IA a mis trop de temps à répondre. Réessaie ou raccourcis ta question." } });
    }
    return res.status(502).json({ error: { message: `Erreur réseau : ${error.message}` } });
  }
}
