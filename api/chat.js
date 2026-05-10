// api/chat.js — Llamadas a OpenAI (mentor, english, mate)

import OpenAI from "openai";
import jwt from "jsonwebtoken";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const JWT_SECRET = process.env.JWT_SECRET || "av-mentorai-fixed-secret-2024";

const RATE_LIMITS = { Gratis: 10, Premium: 9999, Empresarial: 9999 };

function verifyToken(req) {
  const auth = req.headers.authorization || "";
  const token = auth.replace("Bearer ", "");
  if (!token) throw new Error("No token");
  return jwt.verify(token, JWT_SECRET);
}

// ─── System prompts ──────────────────────────────────────────

function systemNegocio(user, modo, desafio) {
  const mem = (user.memoria_larga || []).slice(-6).join("\n");
  return `Eres AV MentorAI, mentor premium de negocios, ventas y marketing para LATAM.
Usuario: ${user.nombre} | Plan: ${user.plan} | Objetivo: ${user.objetivo || "no definido"}
Negocio: ${user.negocio || "no definido"} | Tipo: ${user.tipo_negocio || "no definido"} | Nivel: ${user.nivel_usuario}
XP: ${user.xp} | Racha: ${user.racha} días | Modo: ${modo} | Desafío: ${desafio || "ninguno"}
Memoria: ${mem || "primera sesión"}
Identidad: Moderno, directo, motivador. "No lo pienses tanto, ejecutalo." "El negocio premia al que acciona mejor."
Estilo: Español latino, claro, práctico. Ejemplos de WhatsApp, Instagram, Mercado Libre.
Siempre terminá con una acción concreta para HOY.
Si tenés acceso a búsqueda web, usala para datos actualizados. Indicá con "🌐 Dato actualizado:".`;
}

function systemEnglish(user, leccion, modo) {
  const nivel = user.english_nivel || "Principiante";
  const loks = (user.english_lecciones_completadas || []).length;
  const lec = leccion ? `\nLección actual: ${leccion}` : "";
  let extra = "";
  if (modo === "roleplay") {
    const sit = user.english_roleplay_situacion || "";
    extra = `\n\nESTÁS EN MODO ROLEPLAY. Situación: ${sit}. Actuá el rol del personaje en esa situación. Hablá en inglés. Si el estudiante comete errores, después de responder en el personaje, agregá una nota de corrección al final separada con —.`;
  }
  if (modo === "traductor") extra = "\n\nESTÁS EN MODO TRADUCTOR INTELIGENTE. El usuario te da texto en inglés. Vos: 1) Traducís al español 2) Explicás las palabras más importantes 3) Explicás la gramática 4) Dás el contexto de uso.";
  if (modo === "diario") extra = "\n\nESTÁS EN MODO DIARIO. El usuario escribió en inglés. Vos: 1) Corregís los errores 2) Mostrás versión corregida 3) Explicás los errores principales 4) Lo felicitás.";
  return `Sos Alex, el profesor de inglés de AV MentorAI. Divertido, moderno, como un amigo que sabe mucho inglés.
Estudiante: ${user.nombre} | Nivel: ${nivel} | Lecciones completadas: ${loks}${lec}
Explicás en ESPAÑOL pero enseñás INGLÉS. Usás emojis. Corregís errores así: "✅ Correcto sería: [forma correcta]".
Celebrás logros. Frases tuyas: "¡Genial!", "You're killing it! 🔥", "Let's practice!"${extra}`;
}

function systemMate(user, leccion, modo) {
  const nivel = user.mate_nivel || "Básico";
  const loks = (user.mate_lecciones_completadas || []).length;
  const lec = leccion ? `\nLección actual: ${leccion}` : "";
  let extra = "";
  if (modo === "calculadora") extra = "\n\nESTÁS EN MODO CALCULADORA. El usuario te da un problema de su negocio. Vos: 1) Identificás la fórmula 2) Mostrás el cálculo paso a paso 3) Das el resultado claro 4) Explicás qué significa para el negocio.";
  return `Sos Bruno, el profesor de matemáticas de AV MentorAI. Motivador, con ejemplos de la vida real y negocios.
Estudiante: ${user.nombre} | Nivel: ${nivel} | Lecciones completadas: ${loks}${lec}
Explicás en español simple. Ejemplos de negocios, precios, ventas, ganancias.
Nunca usás jerga matemática innecesaria. Terminás con "¿Lo entendiste? ¿Querés que practiquemos más?" 🔢
Frases: "Los números no mienten:", "Esto en tu negocio significa:", "¡Muy bien! 💪"${extra}`;
}

function systemContent() {
  return "Sos el mejor copywriter de LATAM. Escribís contenido que vende, engancha y genera acción. Conocés el mercado argentino, el lenguaje de la gente joven y cómo hablar de forma auténtica en cada plataforma. Tu contenido nunca suena a publicidad genérica — suena real, cercano y efectivo.";
}

function systemBrand() {
  return "Experto en branding y marketing digital para LATAM. Creás identidades de marca modernas y auténticas.";
}

function systemCompetitor(user, modo, desafio) {
  return systemNegocio(user, modo, desafio);
}

function systemFinance() {
  return "Asesor financiero personal para Argentina. Consejos prácticos y directos.";
}

// ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let decoded;
  try { decoded = verifyToken(req); }
  catch { return res.status(401).json({ error: "No autorizado" }); }

  const {
    type,           // "negocio" | "english" | "mate" | "content" | "brand" | "competitor" | "finance"
    messages,       // array de {role, content}
    user,           // datos del usuario (sin password)
    modo,           // modo actual del mentor
    desafio,        // desafío del día
    leccion,        // lección activa (english/mate)
    englishModo,    // "chat" | "roleplay" | "traductor" | "diario"
    mateModo,       // "chat" | "calculadora"
    useWebSearch,   // boolean
  } = req.body || {};

  if (!type || !messages || !user) {
    return res.status(400).json({ error: "Faltan parámetros" });
  }

  // Rate limit básico (plan Gratis)
  if (user.plan === "Gratis") {
    const today = new Date().toISOString().split("T")[0];
    const questionsToday = user.fecha_preguntas === today ? (user.preguntas_hoy || 0) : 0;
    if (questionsToday >= RATE_LIMITS.Gratis) {
      return res.status(429).json({ error: "Límite diario de 10 preguntas alcanzado. Actualizá a Premium." });
    }
  }

  // Seleccionar system prompt
  let systemPrompt = "";
  switch (type) {
    case "negocio":    systemPrompt = systemNegocio(user, modo, desafio); break;
    case "english":    systemPrompt = systemEnglish(user, leccion, englishModo || "chat"); break;
    case "mate":       systemPrompt = systemMate(user, leccion, mateModo || "chat"); break;
    case "content":    systemPrompt = systemContent(); break;
    case "brand":      systemPrompt = systemBrand(); break;
    case "competitor": systemPrompt = systemCompetitor(user, modo, desafio); break;
    case "finance":    systemPrompt = systemFinance(); break;
    default: return res.status(400).json({ error: "Tipo inválido" });
  }

  try {
    let reply;

    if (useWebSearch) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-search-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        web_search_options: { search_context_size: "medium" },
        max_tokens: 1000,
      });
      reply = response.choices[0].message.content;
    } else {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.85,
        max_tokens: 1000,
      });
      reply = response.choices[0].message.content;
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("OpenAI error:", err);
    return res.status(500).json({ error: "Error al llamar a OpenAI: " + err.message });
  }
}
