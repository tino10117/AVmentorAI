// api/edit-image.js — Generación y edición de imágenes con IA
// Premium ilimitado, Gratis 1/día (probar)
// Si recibe imagen → modo edit. Si no → modo generate.

import OpenAI from "openai";
import jwt from "jsonwebtoken";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const JWT_SECRET = process.env.JWT_SECRET || "av-mentorai-fixed-secret-2024";

// Límites
const LIMITS = {
  Gratis: 1,
  Premium: 999,        // "ilimitado" práctico
  Empresarial: 999,
};

// Modelo principal y fallback
const MODEL_PRIMARY = "gpt-image-1";
const MODEL_FALLBACK = "dall-e-3";

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
  const limit = LIMITS[plan] ?? LIMITS.Gratis;
  const kv = await getKV();
  const today = new Date().toISOString().split("T")[0];
  const key = `imggen_limit:${email}:${today}`;
  const used = (await kv.get(key)) || 0;
  if (used >= limit) {
    return {
      ok: false, used, limit,
      reason: plan === "Gratis"
        ? "Ya usaste tu imagen del día. Subí a Premium para generar más."
        : "Llegaste al límite diario de imágenes.",
    };
  }
  await kv.set(key, used + 1, { ex: 86400 });
  return { ok: true, used: used + 1, limit };
}

// Convierte data URL (base64) a Buffer
function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl).match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!match) throw new Error("Formato de imagen inválido (esperaba data:image/...)");
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

// Convierte Buffer a un File-like compatible con OpenAI SDK (sin usar "openai/uploads")
async function bufferToFileLike(buffer, filename, mimeType) {
  // En entornos modernos de Node 18+, File está disponible globalmente
  if (typeof File !== "undefined") {
    return new File([buffer], filename, { type: mimeType });
  }
  // Fallback: crear un Blob-like manualmente (compatible con el SDK)
  // OpenAI SDK acepta cualquier objeto con propiedades correctas
  const blob = new Blob([buffer], { type: mimeType });
  blob.name = filename;
  return blob;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ─── AUTH ──────────────────────────────────────
  let decoded;
  try { decoded = verifyToken(req); }
  catch { return res.status(401).json({ error: "No autorizado" }); }

  const userEmail = decoded.email;
  const kv = await getKV();
  const user = await kv.get(`user:${userEmail}`);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const plan = user.plan || "Gratis";
  const { prompt, image_base64 } = req.body || {};

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({ error: "Falta el prompt" });
  }
  if (prompt.length > 1000) {
    return res.status(400).json({ error: "El prompt es muy largo (máx 1000 caracteres)" });
  }

  // ─── Rate limit ─────────────────────────────────
  const check = await checkAndIncrement(userEmail, plan);
  if (!check.ok) {
    return res.status(429).json({
      error: check.reason,
      used: check.used,
      limit: check.limit,
      requires_premium: plan === "Gratis",
    });
  }

  // ─── Generación o Edición ───────────────────────
  const promptLimpio = prompt.trim().slice(0, 1000);
  const tieneImagen = !!image_base64;

  // Función interna: intentar con un modelo, devolver result o lanzar error
  async function intentarConModelo(modelo) {
    if (tieneImagen) {
      // Modo edit (solo disponible con gpt-image-1)
      if (modelo !== "gpt-image-1") {
        throw new Error("La edición de imágenes solo está disponible con gpt-image-1");
      }
      const { mime, buffer } = dataUrlToBuffer(image_base64);
      if (buffer.length > 4 * 1024 * 1024) {
        throw new Error("La imagen es muy grande (máx 4MB)");
      }
      const ext = mime.includes("png") ? "png"
                : mime.includes("webp") ? "webp"
                : "jpg";
      const fileLike = await bufferToFileLike(buffer, `input.${ext}`, mime);
      return await openai.images.edit({
        model: "gpt-image-1",
        image: fileLike,
        prompt: promptLimpio,
        size: "1024x1024",
      });
    } else {
      // Modo generate
      const opts = {
        model: modelo,
        prompt: promptLimpio,
        size: "1024x1024",
        n: 1,
      };
      // dall-e-3 requiere response_format explícito
      if (modelo === "dall-e-3") {
        opts.response_format = "b64_json";
      }
      return await openai.images.generate(opts);
    }
  }

  try {
    let result;
    let modeloUsado = MODEL_PRIMARY;

    // Intento 1: gpt-image-1
    try {
      result = await intentarConModelo(MODEL_PRIMARY);
    } catch (err1) {
      // Si es error de modelo no encontrado, intentar fallback (solo si no tiene imagen)
      const errMsg1 = (err1?.error?.message || err1?.message || "").toLowerCase();
      const esErrorDeModelo = errMsg1.includes("model") && (errMsg1.includes("not found") || errMsg1.includes("does not exist") || errMsg1.includes("invalid"));
      if (esErrorDeModelo && !tieneImagen) {
        console.warn("gpt-image-1 no disponible, usando dall-e-3");
        result = await intentarConModelo(MODEL_FALLBACK);
        modeloUsado = MODEL_FALLBACK;
      } else {
        throw err1;
      }
    }

    // Procesar resultado: puede venir como b64_json o url
    const imgData = result?.data?.[0];
    let imageUrl = null;
    if (imgData?.b64_json) {
      imageUrl = `data:image/png;base64,${imgData.b64_json}`;
    } else if (imgData?.url) {
      imageUrl = imgData.url;
    }
    if (!imageUrl) {
      console.error("Respuesta sin imagen:", JSON.stringify(result).slice(0, 200));
      return res.status(500).json({ error: "La IA no devolvió imagen" });
    }

    // Log opcional (para auditoría)
    try {
      await kv.set(`imggen_log:${userEmail}:${Date.now()}`, {
        prompt: promptLimpio,
        modo: tieneImagen ? "edit" : "generate",
        modelo: modeloUsado,
        ts: new Date().toISOString(),
      }, { ex: 60 * 60 * 24 * 30 });
    } catch {}

    return res.status(200).json({
      ok: true,
      image_url: imageUrl,
      modo: tieneImagen ? "edit" : "generate",
      modelo: modeloUsado,
      used: check.used,
      limit: check.limit,
    });

  } catch (err) {
    console.error("Error edit-image:", err);
    const errMsg = err?.error?.message || err?.message || "Error generando imagen";
    const errLower = errMsg.toLowerCase();

    if (errLower.includes("safety") || errLower.includes("content_policy")) {
      return res.status(400).json({ error: "El pedido fue rechazado por las políticas de contenido. Probá con otro pedido." });
    }
    if (errLower.includes("rate")) {
      return res.status(429).json({ error: "Demasiadas solicitudes. Probá en unos segundos." });
    }
    if (errLower.includes("model") && (errLower.includes("not found") || errLower.includes("does not exist"))) {
      return res.status(500).json({ error: "El modelo de imágenes no está disponible en tu cuenta de OpenAI. Verificá que tengas acceso a gpt-image-1 o dall-e-3." });
    }
    return res.status(500).json({ error: errMsg });
  }
}
