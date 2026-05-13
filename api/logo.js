// api/logo.js — Generador de logos con gpt-image-1
// Solo Premium/Empresarial. 5 generaciones por día. 3 opciones por generación.

import OpenAI from "openai";
import jwt from "jsonwebtoken";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const JWT_SECRET = process.env.JWT_SECRET || "av-mentorai-fixed-secret-2024";

const LOGO_LIMITS = { Gratis: 0, Premium: 10, Empresarial: 10 };
const VARIATIONS_PER_REQUEST = 1;

async function getKV() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

function verifyToken(req) {
  const auth = req.headers.authorization || "";
  const token = auth.replace("Bearer ", "");
  if (!token) throw new Error("No token");
  return jwt.verify(token, JWT_SECRET);
}

async function checkAndIncrement(email, plan) {
  const limit = LOGO_LIMITS[plan] ?? 0;
  if (limit === 0) return { ok: false, used: 0, limit: 0, reason: "plan" };
  const kv = await getKV();
  const today = new Date().toISOString().split("T")[0];
  const key = `logo_limit:${email}:${today}`;
  const used = (await kv.get(key)) || 0;
  if (used >= limit) return { ok: false, used, limit, reason: "limit" };
  await kv.set(key, used + 1, { ex: 86400 });
  return { ok: true, used: used + 1, limit };
}

// Construye el prompt para gpt-image-1 a partir de los datos del usuario
function buildLogoPrompt({ nombre, descripcion, estilo, paleta }) {
  const estiloMap = {
    "minimalista": "minimalist, clean, modern, lots of white space",
    "moderno": "modern, contemporary, fresh, trendy",
    "elegante": "elegant, premium, sophisticated, luxury",
    "divertido": "playful, fun, colorful, friendly",
    "joven": "youthful, urban, dynamic, bold",
    "profesional": "professional, corporate, trustworthy, serious",
    "disruptivo": "edgy, disruptive, rebellious, unconventional",
  };
  const estiloDesc = estiloMap[String(estilo).toLowerCase()] || "modern and clean";
  const paletaDesc = paleta ? `Color palette: ${paleta}.` : "Use a harmonious color palette suitable for the brand.";

  return `Professional logo design for a brand called "${nombre}". 
Brand description: ${descripcion}.
Style: ${estiloDesc}.
${paletaDesc}
The logo must be: vector-style, flat design, centered on a pure white background, high quality, suitable for business cards and social media profile pictures. 
Include the brand name "${nombre}" as part of the logo design, with clear and readable typography. 
Do NOT include any other text, slogans, or watermarks. 
No realistic photos. No human faces. No 3D rendering. 
Just a clean, modern, professional vector logo.`;
}

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
  maxDuration: 60, // gpt-image-1 puede tardar hasta 60 seg con n=3
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let decoded;
  try { decoded = verifyToken(req); }
  catch { return res.status(401).json({ error: "No autorizado" }); }

  const userEmail = decoded.email;

  // Leer plan del usuario desde KV
  const kv = await getKV();
  const user = await kv.get(`user:${userEmail}`);
  const plan = user?.plan || "Gratis";

  // Solo Premium/Empresarial
  if (plan === "Gratis") {
    return res.status(403).json({
      error: "Generar logos con IA es una función Premium. Actualizá tu plan para usarla.",
      premium_required: true,
    });
  }

  // Validar inputs
  const { nombre, descripcion, estilo, paleta } = req.body || {};
  if (!nombre || !descripcion) {
    return res.status(400).json({ error: "Faltan datos: nombre y descripción son obligatorios." });
  }
  if (String(nombre).length > 60) {
    return res.status(400).json({ error: "El nombre es demasiado largo (máximo 60 caracteres)." });
  }
  if (String(descripcion).length > 300) {
    return res.status(400).json({ error: "La descripción es demasiado larga (máximo 300 caracteres)." });
  }

  // Rate limit
  const check = await checkAndIncrement(userEmail, plan);
  if (!check.ok) {
    return res.status(429).json({
      error: `Llegaste al límite de ${check.limit} generaciones de logo por día. Probá mañana.`,
      limit_reached: true,
      used: check.used,
      limit: check.limit,
    });
  }

  // Construir prompt
  const prompt = buildLogoPrompt({ nombre, descripcion, estilo, paleta });

  try {
    // gpt-image-1: una sola imagen para no superar el timeout de Vercel (30s en Hobby)
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      n: VARIATIONS_PER_REQUEST,
      size: "1024x1024",
      quality: "medium",
    });

    // gpt-image-1 devuelve b64_json (NO URL)
    const images = (response?.data || [])
      .filter((d) => d.b64_json)
      .map((d) => ({
        // Convertimos a data URL para que el frontend la pueda mostrar directamente
        url: `data:image/png;base64,${d.b64_json}`,
        revised_prompt: d.revised_prompt || null,
      }));

    if (images.length === 0) {
      // No vino ninguna imagen, revertir el contador
      try {
        const today = new Date().toISOString().split("T")[0];
        const key = `logo_limit:${userEmail}:${today}`;
        const current = (await kv.get(key)) || 0;
        if (current > 0) await kv.set(key, current - 1, { ex: 86400 });
      } catch (e) { /* silencioso */ }
      return res.status(500).json({
        error: "No se pudo generar ningún logo. Probá de nuevo en un momento.",
      });
    }

    return res.status(200).json({
      images,
      used: check.used,
      limit: check.limit,
      partial: images.length < VARIATIONS_PER_REQUEST,
    });
  } catch (err) {
    console.error("Logo error:", err);

    // Revertir contador en caso de error de OpenAI
    try {
      const today = new Date().toISOString().split("T")[0];
      const key = `logo_limit:${userEmail}:${today}`;
      const current = (await kv.get(key)) || 0;
      if (current > 0) await kv.set(key, current - 1, { ex: 86400 });
    } catch (e) { /* silencioso */ }

    // Mensaje específico según el tipo de error
    const errMsg = err?.message || "Error desconocido";

    // Caso: organización no verificada (común con gpt-image-1)
    if (/verif|organization/i.test(errMsg)) {
      return res.status(400).json({
        error: "Tu cuenta de OpenAI necesita verificar la organización para usar gpt-image-1. Andá a platform.openai.com/settings/organization → Verifications.",
        verification_required: true,
      });
    }

    // Caso: filtro de moderación
    if (/safety|moderation|content_policy/i.test(errMsg)) {
      return res.status(400).json({
        error: "El sistema de seguridad de OpenAI rechazó el prompt. Probá con otra descripción.",
      });
    }

    return res.status(500).json({ error: "Error generando logo: " + errMsg });
  }
}
