// api/edit-image.js — Generación y edición de imágenes con IA
// Premium ilimitado, Gratis 1/día (probar)
// Si recibe imagen → modo edit. Si no → modo generate.

import OpenAI from "openai";
import jwt from "jsonwebtoken";
import { toFile } from "openai/uploads";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const JWT_SECRET = process.env.JWT_SECRET || "av-mentorai-fixed-secret-2024";

// Límites
const LIMITS = {
  Gratis: 1,
  Premium: 999,        // "ilimitado" práctico
  Empresarial: 999,
};

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
  try {
    let result;
    const promptLimpio = prompt.trim().slice(0, 1000);

    if (image_base64) {
      // ─ MODO EDIT ─
      const { mime, buffer } = dataUrlToBuffer(image_base64);

      if (buffer.length > 4 * 1024 * 1024) {
        return res.status(400).json({ error: "La imagen es muy grande (máx 4MB)" });
      }

      // gpt-image-1 acepta png/jpeg/webp para edición
      const ext = mime.includes("png") ? "png"
                : mime.includes("webp") ? "webp"
                : "jpg";
      const imageFile = await toFile(buffer, `input.${ext}`, { type: mime });

      result = await openai.images.edit({
        model: "gpt-image-1",
        image: imageFile,
        prompt: promptLimpio,
        size: "1024x1024",
        quality: "medium",
      });
    } else {
      // ─ MODO GENERATE ─
      result = await openai.images.generate({
        model: "gpt-image-1",
        prompt: promptLimpio,
        size: "1024x1024",
        quality: "medium",
      });
    }

    // gpt-image-1 devuelve b64_json
    const imgB64 = result?.data?.[0]?.b64_json;
    if (!imgB64) {
      console.error("Respuesta sin b64:", JSON.stringify(result).slice(0, 200));
      return res.status(500).json({ error: "La IA no devolvió imagen" });
    }
    const imageUrl = `data:image/png;base64,${imgB64}`;

    // Log opcional (para auditoría)
    try {
      await kv.set(`imggen_log:${userEmail}:${Date.now()}`, {
        prompt: promptLimpio,
        modo: image_base64 ? "edit" : "generate",
        ts: new Date().toISOString(),
      }, { ex: 60 * 60 * 24 * 30 }); // 30 días
    } catch {}

    return res.status(200).json({
      ok: true,
      image_url: imageUrl,
      modo: image_base64 ? "edit" : "generate",
      used: check.used,
      limit: check.limit,
    });

  } catch (err) {
    console.error("Error edit-image:", err);
    const errMsg = err?.error?.message || err?.message || "Error generando imagen";

    // Mensajes más amables para el usuario
    if (errMsg.toLowerCase().includes("safety") || errMsg.toLowerCase().includes("content_policy")) {
      return res.status(400).json({ error: "El pedido fue rechazado por las políticas de contenido. Probá con otro pedido." });
    }
    if (errMsg.toLowerCase().includes("rate")) {
      return res.status(429).json({ error: "Demasiadas solicitudes. Probá en unos segundos." });
    }
    return res.status(500).json({ error: errMsg });
  }
}
