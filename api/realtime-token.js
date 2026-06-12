// api/realtime-token.js — Genera token efímero para la Realtime API (modo voz en vivo)
// El browser usa este token para conectarse DIRECTO a OpenAI por WebRTC.
// Tu API key real nunca sale del servidor.

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "av-mentorai-fixed-secret-2024";

// Modelo de voz realtime y voz por defecto
const REALTIME_MODEL = "gpt-realtime";
const DEFAULT_VOICE = "marin";

function verifyToken(req) {
  const auth = req.headers.authorization || "";
  const token = auth.replace("Bearer ", "");
  if (!token) throw new Error("No token");
  return jwt.verify(token, JWT_SECRET);
}

async function getKV() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

// Hard cap diario (mismo sistema que chat.js)
const DEFAULT_DAILY_CAP_USD = 10;
async function checkSystemCap(kv) {
  const capRaw = await kv.get("system_cap_usd");
  const cap = capRaw ? parseFloat(capRaw) : DEFAULT_DAILY_CAP_USD;
  const today = new Date().toISOString().split("T")[0];
  const spentRaw = await kv.get(`system_spent:${today}`);
  const spent = spentRaw ? parseFloat(spentRaw) : 0;
  if (spent >= cap) {
    return { ok: false, message: "Servicio temporalmente saturado. Volvé en unas horas." };
  }
  return { ok: true };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // 1) Verificar usuario logueado
  let decoded;
  try { decoded = verifyToken(req); }
  catch { return res.status(401).json({ error: "No autorizado" }); }

  const kv = await getKV();

  // 2) Solo Premium/Empresarial pueden usar voz en vivo (es cara)
  let planReal = "Gratis";
  try {
    const dbUser = await kv.get(`user:${decoded.email}`);
    planReal = (dbUser && dbUser.plan) ? dbUser.plan : "Gratis";
  } catch (e) {
    planReal = "Gratis";
  }
  if (planReal === "Gratis") {
    return res.status(403).json({ error: "El modo voz en vivo es una función Premium. Activá Premium para usarlo." });
  }

  // 3) Hard cap global
  const capCheck = await checkSystemCap(kv);
  if (!capCheck.ok) {
    return res.status(503).json({ error: capCheck.message });
  }

  // 4) Límite diario de minutos de voz por usuario
  const today = new Date().toISOString().split("T")[0];
  const voiceKey = `realtime_sessions:${decoded.email}:${today}`;
  const used = parseInt(await kv.get(voiceKey) || "0", 10);
  const limit = planReal === "Empresarial" ? 50 : 20; // sesiones por día
  if (used >= limit) {
    return res.status(429).json({ error: `Llegaste al límite diario de ${limit} sesiones de voz.` });
  }

  // 5) Voz elegida (validada)
  const voicesValidas = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"];
  const voice = voicesValidas.includes(req.body?.voice) ? req.body.voice : DEFAULT_VOICE;

  // 6) Pedir el token efímero a OpenAI (endpoint GA: client_secrets)
  try {
    const sessionConfig = {
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        audio: {
          output: { voice },
        },
      },
    };

    const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionConfig),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("Error creando token realtime:", r.status, errText);
      return res.status(500).json({ error: "No se pudo iniciar la sesión de voz. Probá de nuevo." });
    }

    const data = await r.json();

    // Contabilizar la sesión
    await kv.set(voiceKey, used + 1, { ex: 86400 });

    // Devolver el token efímero (campo "value" con prefijo ek_) al browser
    return res.status(200).json({
      client_secret: data.value || data.client_secret?.value,
      model: REALTIME_MODEL,
      voice,
      expires_at: data.expires_at,
    });

  } catch (err) {
    console.error("Error en realtime-token:", err);
    return res.status(500).json({ error: "Error iniciando sesión de voz: " + (err?.message || "desconocido") });
  }
}
