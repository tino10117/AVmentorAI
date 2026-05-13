// api/viajes.js — Planificador de Viajes con IA
// Solo Premium. Web search activado para precios/datos reales.
// 2 modos: "itinerario" (tengo destino) e "inspirame" (no sé a dónde ir)

import OpenAI from "openai";
import jwt from "jsonwebtoken";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const JWT_SECRET = process.env.JWT_SECRET || "av-mentorai-fixed-secret-2024";

const VIAJES_LIMITS = { Gratis: 0, Premium: 10, Empresarial: 10 };

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
  const limit = VIAJES_LIMITS[plan] ?? 0;
  if (limit === 0) return { ok: false, used: 0, limit: 0, reason: "plan" };
  const kv = await getKV();
  const today = new Date().toISOString().split("T")[0];
  const key = `viajes_limit:${email}:${today}`;
  const used = (await kv.get(key)) || 0;
  if (used >= limit) return { ok: false, used, limit, reason: "limit" };
  await kv.set(key, used + 1, { ex: 86400 });
  return { ok: true, used: used + 1, limit };
}

// ─── SYSTEM PROMPTS ──────────────────────────────────────────────

const SYSTEM_ITINERARIO = `Sos un planificador experto de viajes para emprendedores LATAM, especialmente argentinos.

Tu tarea: armar itinerarios DÍA POR DÍA con info REAL y actualizada.

REGLAS CRÍTICAS:
- Tono argentino: usá "vos", "tenés", "podés". Nunca "tú".
- Usá web search SIEMPRE para precios reales, lugares actuales, recomendaciones recientes.
- Adaptate al presupuesto del usuario (no recomendes hoteles de lujo si dice "económico").
- Considerá la época del año (clima, alta/baja temporada).
- Si viajan con niños, perro, problemas de movilidad, etc, adaptá TODO al caso.

FORMATO DE RESPUESTA (estricto, usá Markdown):

## ✈️ Tu viaje a {destino}
**Resumen:** {1-2 líneas con el espíritu del viaje}
**Presupuesto estimado:** {monto en USD y ARS}
**Mejor época:** {confirmá si es buena la fecha que eligió}

---

### 📅 Día 1 — {tema del día}
**Mañana:** {actividad con horario sugerido + lugar específico + precio aprox}
**Mediodía:** {dónde comer, plato típico recomendado, rango de precio}
**Tarde:** {actividad o paseo}
**Noche:** {dónde cenar / qué hacer}
**🏨 Dónde dormir:** {opción según presupuesto, con nombre real}

### 📅 Día 2 — {tema del día}
{misma estructura}

(... y así para todos los días)

---

### 💰 Resumen de gastos estimados
- Alojamiento ({n} noches): $X
- Comida: $X
- Excursiones/tickets: $X
- Transporte local: $X
- **TOTAL aproximado: $X USD / $X ARS**

### 💡 Tips clave del viaje
- {3-5 tips MUY específicos del destino, no genéricos}

### 🎒 Qué llevar imprescindible
- {lista corta de cosas específicas del destino y época}

CIERRE: Terminá con "¿Querés que ajuste algo? Podés pedirme: hacerlo más barato, más días, sumar excursiones, cambiar el ritmo, etc."`;

const SYSTEM_INSPIRAME = `Sos un experto en viajes que sugiere destinos a emprendedores LATAM, especialmente argentinos, que NO saben dónde ir.

Tu tarea: en base a sus gustos y presupuesto, sugerir 4-5 DESTINOS REALES con info clara, NO un itinerario completo.

REGLAS CRÍTICAS:
- Tono argentino: usá "vos", "tenés", "podés".
- Usá web search SIEMPRE para precios actuales de vuelos y temporada.
- Mezclá destinos: algunos cercanos (Argentina/Sudamérica) y otros más lejos según presupuesto.
- Si dice "económico", priorizá destinos accesibles (no le sugieras Japón si tiene $500 USD).
- Considerá la época del año.

FORMATO DE RESPUESTA (usá Markdown):

## 🌎 Destinos pensados para vos

Acá te tiro {n} opciones que pegan con lo que buscás:

---

### 🎯 Opción 1: {destino, país}
**¿Por qué te puede gustar?** {2-3 líneas conectando con sus intereses}
**Presupuesto estimado:** {USD por persona, alojamiento + actividades + comida, sin vuelos}
**Vuelo aproximado desde {origen}:** {USD ida y vuelta}
**Mejor para:** {tipo de viajero}
**Duración recomendada:** {días}
**Lo más imperdible:** {1-2 actividades icónicas}
**Vibe:** {1 línea: aventurero/relax/cultural/etc}

### 🎯 Opción 2: {destino, país}
{misma estructura}

(... así hasta 4-5 opciones MUY diversas entre sí)

---

### 🤔 Cómo elegir
{Breve guía: "Si te tira más X, andá a Y. Si querés Z, mejor W."}

CIERRE: "¿Alguno te pinta? Decime cuál y te armo el itinerario completo con todo (día por día, dónde dormir, qué comer, cuánto gastar)."`;

const SYSTEM_REFINAR = `Sos un planificador de viajes que YA armó un itinerario para el usuario y ahora él te pide ajustes.

REGLAS:
- Tono argentino: "vos", "tenés", "podés".
- Si pide algo razonable (más barato, menos días, sin actividad X), ajustá el itinerario completo.
- Si pide algo inviable (ej. "5 estrellas con $200"), explicale por qué y ofrecé alternativas.
- Mantené el formato Markdown del itinerario original.
- Usá web search si necesitás precios actualizados.`;

// ─── HANDLER ─────────────────────────────────────────────────────

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
  maxDuration: 60,
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Auth
  let decoded;
  try { decoded = verifyToken(req); }
  catch { return res.status(401).json({ error: "No autorizado" }); }

  const userEmail = decoded.email;

  // Plan
  const kv = await getKV();
  const user = await kv.get(`user:${userEmail}`);
  const plan = user?.plan || "Gratis";

  if (plan === "Gratis") {
    return res.status(403).json({
      error: "El Planificador de Viajes es una función Premium. Activá Premium para usarla.",
      premium_required: true,
    });
  }

  // Inputs
  const { mode, messages, formData } = req.body || {};
  if (!mode || !["itinerario", "inspirame", "refinar"].includes(mode)) {
    return res.status(400).json({ error: "Modo inválido" });
  }
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Faltan mensajes" });
  }

  // Rate limit
  const check = await checkAndIncrement(userEmail, plan);
  if (!check.ok) {
    return res.status(429).json({
      error: `Llegaste al límite de ${check.limit} planificaciones por día. Probá mañana.`,
      limit_reached: true,
      used: check.used,
      limit: check.limit,
    });
  }

  // System prompt según modo
  let systemPrompt;
  if (mode === "itinerario") systemPrompt = SYSTEM_ITINERARIO;
  else if (mode === "inspirame") systemPrompt = SYSTEM_INSPIRAME;
  else systemPrompt = SYSTEM_REFINAR;

  // Si hay formData, lo agregamos al primer mensaje del user
  let finalMessages = [...messages];
  if (formData && mode !== "refinar" && finalMessages.length > 0) {
    const lastUserIdx = finalMessages.length - 1;
    const last = finalMessages[lastUserIdx];
    if (last.role === "user") {
      finalMessages[lastUserIdx] = {
        role: "user",
        content: `${last.content}\n\nDATOS DEL VIAJE:\n${formatFormData(formData)}`,
      };
    }
  }

  try {
    // gpt-4o-search-preview = modelo con web search nativo
    const response = await openai.chat.completions.create({
      model: "gpt-4o-search-preview",
      messages: [{ role: "system", content: systemPrompt }, ...finalMessages],
      max_tokens: 3000,
    });

    const reply = response?.choices?.[0]?.message?.content || "";
    if (!reply) {
      // Revertir contador
      try {
        const today = new Date().toISOString().split("T")[0];
        const key = `viajes_limit:${userEmail}:${today}`;
        const current = (await kv.get(key)) || 0;
        if (current > 0) await kv.set(key, current - 1, { ex: 86400 });
      } catch (e) { /* silencioso */ }
      return res.status(500).json({ error: "No se pudo generar la respuesta. Probá de nuevo." });
    }

    return res.status(200).json({
      reply,
      used: check.used,
      limit: check.limit,
    });
  } catch (err) {
    console.error("Viajes error:", err);
    // Revertir contador
    try {
      const today = new Date().toISOString().split("T")[0];
      const key = `viajes_limit:${userEmail}:${today}`;
      const current = (await kv.get(key)) || 0;
      if (current > 0) await kv.set(key, current - 1, { ex: 86400 });
    } catch (e) { /* silencioso */ }
    return res.status(500).json({ error: "Error generando el viaje: " + (err.message || "desconocido") });
  }
}

// Helper para formatear los datos del formulario
function formatFormData(d) {
  const lines = [];
  if (d.destino) lines.push(`- Destino: ${d.destino}`);
  if (d.origen) lines.push(`- Sale desde: ${d.origen}`);
  if (d.dias) lines.push(`- Duración: ${d.dias} días`);
  if (d.personas) lines.push(`- Cantidad de personas: ${d.personas}`);
  if (d.presupuesto) lines.push(`- Presupuesto total: ${d.presupuesto}`);
  if (d.intereses) lines.push(`- Le gusta: ${d.intereses}`);
  if (d.fecha) lines.push(`- Cuándo viaja: ${d.fecha}`);
  if (d.especial) lines.push(`- Consideración especial: ${d.especial}`);
  if (d.vibe) lines.push(`- Vibe del viaje: ${d.vibe}`);
  return lines.join("\n");
}
