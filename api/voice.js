// api/voice.js — Whisper (transcribe) + TTS (speak)
// Rate limit: 5 interacciones de voz por día para plan Gratis

import OpenAI from "openai";
import { toFile } from "openai";
import jwt from "jsonwebtoken";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const JWT_SECRET = process.env.JWT_SECRET || "av-mentorai-fixed-secret-2024";

const VOICE_LIMITS = { Gratis: 5, Premium: 9999, Empresarial: 9999 };

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
  const limit = VOICE_LIMITS[plan] ?? VOICE_LIMITS.Gratis;
  if (limit >= 9999) return { ok: true, used: 0, limit };
  const kv = await getKV();
  const today = new Date().toISOString().split("T")[0];
  const key = `voice_limit:${email}:${today}`;
  const used = (await kv.get(key)) || 0;
  if (used >= limit) return { ok: false, used, limit };
  await kv.set(key, used + 1, { ex: 86400 });
  return { ok: true, used: used + 1, limit };
}

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  let decoded;
  try {
    decoded = verifyToken(req);
  } catch {
    return res.status(401).json({ error: "No autorizado" });
  }

  const action = (req.query.action || "").toLowerCase();
  const userEmail = decoded.email;

  // Plan del usuario
  const kv = await getKV();
  const user = await kv.get(`user:${userEmail}`);
  const plan = user?.plan || "Gratis";

  try {
    // ─── TRANSCRIBE (Whisper) ──────────────────────────────────
    if (action === "transcribe") {
      // Rate limit aplica solo aquí: 1 transcribe = 1 interacción de voz
      const check = await checkAndIncrement(userEmail, plan);
      if (!check.ok) {
        return res.status(429).json({
          error: `Llegaste al límite de ${check.limit} interacciones de voz por día. Activá Premium para voz ilimitada.`,
          limit_reached: true,
          used: check.used,
          limit: check.limit,
        });
      }

      const { audio, language } = req.body || {};
      if (!audio) return res.status(400).json({ error: "Falta audio" });

      // Aceptar tanto data URL como base64 puro
      const base64 = String(audio).replace(/^data:audio\/[^;]+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      const file = await toFile(buffer, "audio.webm");

      const transcription = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
        language: language || undefined,
      });

      return res.status(200).json({
        text: transcription.text,
        used: check.used,
        limit: check.limit,
      });
    }

    // ─── SPEAK (TTS) ───────────────────────────────────────────
    if (action === "speak") {
      const { text, voice } = req.body || {};
      if (!text) return res.status(400).json({ error: "Falta texto" });

      const allowedVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
      const v = allowedVoices.includes(voice) ? voice : "alloy";

      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: v,
        input: String(text).slice(0, 2000),
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(buffer);
    }

    return res
      .status(400)
      .json({ error: "Acción inválida. Usá ?action=transcribe o ?action=speak" });
  } catch (err) {
    console.error("Voice error:", err);
    return res.status(500).json({ error: "Error: " + err.message });
  }
}
