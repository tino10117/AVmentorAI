// api/bienestar.js — Vida Sana: Alimentación + Ejercicio con IA
// Solo Premium. Web search activado para precios/recomendaciones reales.
// 4 modos: alimentacion, ejercicio, refinar-alim, refinar-ej

import OpenAI from "openai";
import jwt from "jsonwebtoken";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const JWT_SECRET = process.env.JWT_SECRET || "av-mentorai-fixed-secret-2024";

const BIENESTAR_LIMITS = { Gratis: 0, Premium: 10, Empresarial: 10 };

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
  const limit = BIENESTAR_LIMITS[plan] ?? 0;
  if (limit === 0) return { ok: false, used: 0, limit: 0, reason: "plan" };
  const kv = await getKV();
  const today = new Date().toISOString().split("T")[0];
  const key = `bienestar_limit:${email}:${today}`;
  const used = (await kv.get(key)) || 0;
  if (used >= limit) return { ok: false, used, limit, reason: "limit" };
  await kv.set(key, used + 1, { ex: 86400 });
  return { ok: true, used: used + 1, limit };
}

// ─── DETECTOR DE SEÑALES DE ALARMA ──────────────────────────────

function detectarRiesgo(formData, modo) {
  const text = JSON.stringify(formData || {}).toLowerCase();
  const senales = [
    "anorexia", "bulimia", "atracon", "atracón", "vomito", "vómito",
    "ayuno extremo", "no comer", "dejar de comer", "purga", "laxante",
    "trastorno alimentar", "tca"
  ];
  for (const s of senales) {
    if (text.includes(s)) return { riesgo: true, tipo: "tca" };
  }

  // Pérdida de peso excesiva en alimentación
  if (modo === "alimentacion" && formData?.peso_actual && formData?.peso_objetivo) {
    const actual = parseFloat(formData.peso_actual);
    const objetivo = parseFloat(formData.peso_objetivo);
    if (actual > 0 && objetivo > 0) {
      // Objetivo muy bajo en adultos
      if (objetivo < 45) return { riesgo: true, tipo: "peso_bajo" };
      // Pérdida >20% del peso actual
      const perdidaPct = ((actual - objetivo) / actual) * 100;
      if (perdidaPct > 20) return { riesgo: true, tipo: "perdida_extrema" };
    }
  }

  return { riesgo: false };
}

// ─── SYSTEM PROMPTS ──────────────────────────────────────────────

const DISCLAIMER = `⚠️ **Importante:** Este plan es orientativo. No reemplaza el asesoramiento de un nutricionista, médico o entrenador personal. Si tenés condiciones médicas (diabetes, hipertensión, embarazo, alergias serias) o dudas, consultá a un profesional antes de aplicarlo.`;

const SYSTEM_ALIMENTACION = `Sos un asistente experto en alimentación saludable para argentinos. NO sos nutricionista certificado.

REGLAS CRÍTICAS:
- Tono argentino: "vos", "tenés", "podés". NUNCA "tú".
- Usá web search para precios REALES y actualizados en Argentina (supermercados como Coto, Carrefour, Día, Disco, Jumbo).
- Adaptate al presupuesto, restricciones alimentarias, gustos y objetivo.
- NO promuevas dietas extremas, ayunos prolongados, ni pérdidas de peso agresivas.
- Si la persona dice tener una condición médica (diabetes, hipertensión, embarazo), recomendá consulta médica antes del plan.
- Promové variedad, comida real, alimentos accesibles en Argentina.
- Considerá el clima y costumbres argentinas (mate, asado los domingos, etc).
- INCLUÍ el disclaimer al inicio.

FORMATO DE RESPUESTA (Markdown):

${DISCLAIMER}

---

## 🥗 Tu Plan de Alimentación

**Objetivo:** {qué busca}
**Calorías diarias estimadas:** {kcal aproximadas según datos}
**Presupuesto semanal:** {ARS}

---

### 📅 Lunes
**🌅 Desayuno:** {comida + porciones aproximadas}
**🍽️ Almuerzo:** {comida principal}
**🧉 Merienda:** {comida + opcional mate}
**🌙 Cena:** {comida liviana}
**💧 Hidratación:** {recordatorio agua}

### 📅 Martes
{misma estructura}

(... así para los 7 días, evitando repetir las mismas comidas)

---

### 🛒 Lista de compras semanal

**🥩 Carnes y proteínas:**
- {ítem + cantidad + precio aprox supermercados Argentina}

**🥦 Verduras y frutas:**
- {ítem + cantidad + precio}

**🌾 Almacén y granos:**
- {ítem + cantidad + precio}

**🥛 Lácteos:**
- {ítem + cantidad + precio}

**🥖 Panadería:**
- {ítem + cantidad + precio}

**💰 TOTAL ESTIMADO: ~$X ARS**

### 💡 Tips para que funcione

- {3-5 tips concretos: meal prep, qué comprar congelado, cómo organizar la heladera, qué evitar}

### 🍴 Recetas rápidas sugeridas

- {2-3 recetas simples de menos de 20 minutos con ingredientes de la lista}

CIERRE: "¿Querés que ajuste algo? Pedíme: más vegetariano, sin gluten, más económico, más proteína, menos carbohidratos, etc."`;

const SYSTEM_EJERCICIO = `Sos un asistente experto en ejercicio físico. NO sos entrenador certificado.

REGLAS CRÍTICAS:
- Tono argentino: "vos", "tenés", "podés". NUNCA "tú".
- Usá web search para encontrar ejercicios actualizados y técnicas seguras.
- Adaptate al objetivo, lugar de entrenamiento, días disponibles, experiencia y limitaciones.
- NO recomendes pesos extremos, técnicas avanzadas a principiantes, ni rutinas que ignoren lesiones declaradas.
- Si menciona lesión grave (espalda, rodilla, hombro), recomendá consulta a kinesiólogo antes.
- Si es principiante, enfocá técnica antes que carga.
- Incluí calentamiento y enfriamiento siempre.
- INCLUÍ el disclaimer al inicio.

FORMATO DE RESPUESTA (Markdown):

⚠️ **Importante:** Esta rutina es orientativa. No reemplaza el asesoramiento de un entrenador personal, kinesiólogo o médico. Si tenés lesiones, condiciones médicas o sos principiante absoluto, consultá a un profesional antes de empezar.

---

## 🏋️ Tu Rutina de Ejercicio

**Objetivo:** {qué busca}
**Lugar:** {dónde entrena}
**Días por semana:** {n}
**Duración por sesión:** {min}
**Nivel:** {experiencia}

---

### 🔥 Calentamiento (5-10 min) — Hacelo SIEMPRE
- {ejercicios de movilidad y activación}

---

### 📅 Día 1 — {grupo muscular o foco del día}

**Ejercicio 1: {nombre}**
- Series: {n} × Reps: {n} (Descanso: {seg})
- Cómo se hace: {breve descripción técnica}
- 🎥 Video referencia: [Buscar "{nombre exacto} técnica" en YouTube](https://www.youtube.com/results?search_query=NOMBRE+EJERCICIO+tecnica)

**Ejercicio 2: {nombre}**
{misma estructura}

(... 4-6 ejercicios por día)

### 📅 Día 2 — {foco}
{misma estructura}

(... así para todos los días pedidos)

---

### 🧘 Enfriamiento (5 min) — También importante
- {estiramientos de los músculos trabajados}

### 💡 Tips clave

- {3-5 tips concretos: cómo progresar, cuándo subir peso, importancia del descanso, hidratación}

### ⚡ Cómo progresar

{Explicación corta de cómo aumentar carga/dificultad semana a semana sin lesionarse}

### 🚨 Cuándo PARAR un ejercicio

{Señales de alerta: dolor agudo, mareo, etc → consultar profesional}

CIERRE: "¿Querés que ajuste algo? Pedíme: más cardio, menos pesado, agregar día de descanso, enfocado en glúteos/espalda/abdomen, más corto, etc."`;

const SYSTEM_REFINAR_ALIM = `Sos un asistente de alimentación que YA armó un plan y ahora te piden ajustes.

REGLAS:
- Tono argentino: "vos", "tenés", "podés".
- Mantené el formato Markdown del plan original.
- Si pide algo razonable, ajustá el plan completo.
- Si pide algo inviable o riesgoso (ej. "dieta de 500 cal"), explicá por qué no y ofrecé alternativa saludable.
- Mantené disclaimer al inicio.
- Usá web search si necesitás precios o info actualizada.`;

const SYSTEM_REFINAR_EJ = `Sos un asistente de ejercicio que YA armó una rutina y ahora te piden ajustes.

REGLAS:
- Tono argentino: "vos", "tenés", "podés".
- Mantené el formato Markdown de la rutina original.
- Si pide algo razonable, ajustá la rutina completa.
- Si pide algo inseguro (ej. "rutina de fisicoculturista para alguien que nunca entrenó"), explicá por qué y ofrecé alternativa progresiva.
- Mantené disclaimer al inicio.
- Usá web search para técnicas actualizadas si hace falta.`;

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
      error: "Vida Sana es una función Premium. Activá Premium para usarla.",
      premium_required: true,
    });
  }

  // Inputs
  const { mode, messages, formData } = req.body || {};
  if (!mode || !["alimentacion", "ejercicio", "refinar-alim", "refinar-ej"].includes(mode)) {
    return res.status(400).json({ error: "Modo inválido" });
  }
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Faltan mensajes" });
  }

  // Detector de riesgo (solo en primeras solicitudes, no refinamientos)
  if (mode === "alimentacion" || mode === "ejercicio") {
    const riesgo = detectarRiesgo(formData, mode);
    if (riesgo.riesgo) {
      let mensaje;
      if (riesgo.tipo === "tca") {
        mensaje = `Detecté en tu mensaje algunas palabras que me preocupan. Si estás pasando por un momento difícil con la comida o tu cuerpo, **no estás solo/a**.

Antes de armarte un plan, te recomiendo hablar con un profesional de salud mental o un nutricionista especializado.

📞 **Recursos en Argentina:**
- **ALUBA** (Asociación de Lucha Contra Bulimia y Anorexia): aluba.org.ar / (011) 4807-9444
- **Línea de ayuda Salud Mental**: 0800-999-0091 (gratuita, 24hs)

Si querés, puedo armarte un plan general de alimentación balanceada **sin enfoque en bajar peso**, solo en comer bien. ¿Te interesa?`;
      } else if (riesgo.tipo === "peso_bajo") {
        mensaje = `Mirá, el peso objetivo que pusiste (menos de 45kg) es muy bajo para un adulto y puede ser peligroso para tu salud.

Antes de armar un plan, te pido que hables con un médico o nutricionista. Ellos van a evaluar si ese objetivo es seguro para vos.

Si querés, puedo armarte un plan de **alimentación saludable balanceada** que te haga sentir bien, sin enfocarse en bajar tanto. ¿Te interesa?`;
      } else if (riesgo.tipo === "perdida_extrema") {
        mensaje = `Querer bajar más del 20% de tu peso actual es un objetivo agresivo que puede traer problemas de salud (caída de pelo, debilidad, problemas hormonales, efecto rebote).

Te recomiendo MUCHO consultar con un nutricionista antes. Si querés, puedo armarte un plan de **descenso gradual y saludable** (perder ~0.5kg por semana en lugar de tanto rápido). ¿Vamos por ahí?`;
      }

      // Configurar SSE para mandar este mensaje protector
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      if (res.flushHeaders) res.flushHeaders();
      res.write(`event: delta\ndata: ${JSON.stringify({ text: mensaje })}\n\n`);
      res.write(`event: done\ndata: ${JSON.stringify({ reply: mensaje, riesgo_detectado: true })}\n\n`);
      return res.end();
    }
  }

  // Rate limit
  const check = await checkAndIncrement(userEmail, plan);
  if (!check.ok) {
    return res.status(429).json({
      error: `Llegaste al límite de ${check.limit} planes por día. Probá mañana.`,
      limit_reached: true,
      used: check.used,
      limit: check.limit,
    });
  }

  // System prompt según modo
  let systemPrompt;
  if (mode === "alimentacion") systemPrompt = SYSTEM_ALIMENTACION;
  else if (mode === "ejercicio") systemPrompt = SYSTEM_EJERCICIO;
  else if (mode === "refinar-alim") systemPrompt = SYSTEM_REFINAR_ALIM;
  else systemPrompt = SYSTEM_REFINAR_EJ;

  // Si hay formData, lo agregamos al primer mensaje del user
  let finalMessages = [...messages];
  if (formData && !mode.startsWith("refinar") && finalMessages.length > 0) {
    const lastUserIdx = finalMessages.length - 1;
    const last = finalMessages[lastUserIdx];
    if (last.role === "user") {
      finalMessages[lastUserIdx] = {
        role: "user",
        content: `${last.content}\n\nDATOS:\n${formatFormData(formData, mode)}`,
      };
    }
  }

  // ─── MODO STREAMING ─────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (res.flushHeaders) res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-search-preview",
      messages: [{ role: "system", content: systemPrompt }, ...finalMessages],
      max_tokens: 3500,
      stream: true,
    });

    let fullReply = "";
    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta?.content || "";
      if (delta) {
        fullReply += delta;
        sendEvent("delta", { text: delta });
      }
    }

    if (!fullReply) {
      // Revertir contador
      try {
        const today = new Date().toISOString().split("T")[0];
        const key = `bienestar_limit:${userEmail}:${today}`;
        const current = (await kv.get(key)) || 0;
        if (current > 0) await kv.set(key, current - 1, { ex: 86400 });
      } catch (e) { /* silencioso */ }
      sendEvent("error", { error: "No se pudo generar la respuesta. Probá de nuevo." });
      return res.end();
    }

    sendEvent("done", {
      reply: fullReply,
      used: check.used,
      limit: check.limit,
    });
    return res.end();
  } catch (err) {
    console.error("Bienestar error:", err);
    // Revertir contador
    try {
      const today = new Date().toISOString().split("T")[0];
      const key = `bienestar_limit:${userEmail}:${today}`;
      const current = (await kv.get(key)) || 0;
      if (current > 0) await kv.set(key, current - 1, { ex: 86400 });
    } catch (e) { /* silencioso */ }
    if (res.headersSent) {
      sendEvent("error", { error: "Error generando el plan: " + (err.message || "desconocido") });
      return res.end();
    }
    return res.status(500).json({ error: "Error generando el plan: " + (err.message || "desconocido") });
  }
}

// Helper para formatear los datos del formulario
function formatFormData(d, mode) {
  const lines = [];
  if (mode === "alimentacion") {
    if (d.edad) lines.push(`- Edad: ${d.edad} años`);
    if (d.sexo) lines.push(`- Sexo: ${d.sexo}`);
    if (d.peso_actual) lines.push(`- Peso actual: ${d.peso_actual} kg`);
    if (d.altura) lines.push(`- Altura: ${d.altura} cm`);
    if (d.peso_objetivo) lines.push(`- Peso objetivo: ${d.peso_objetivo} kg`);
    if (d.actividad) lines.push(`- Nivel de actividad: ${d.actividad}`);
    if (d.restricciones) lines.push(`- Restricciones: ${d.restricciones}`);
    if (d.gustos) lines.push(`- Le gusta / no le gusta: ${d.gustos}`);
    if (d.presupuesto) lines.push(`- Presupuesto semanal: ${d.presupuesto} ARS`);
    if (d.objetivo) lines.push(`- Objetivo: ${d.objetivo}`);
  } else if (mode === "ejercicio") {
    if (d.edad) lines.push(`- Edad: ${d.edad} años`);
    if (d.sexo) lines.push(`- Sexo: ${d.sexo}`);
    if (d.objetivo) lines.push(`- Objetivo: ${d.objetivo}`);
    if (d.lugar) lines.push(`- Lugar de entrenamiento: ${d.lugar}`);
    if (d.dias) lines.push(`- Días por semana: ${d.dias}`);
    if (d.tiempo) lines.push(`- Tiempo por sesión: ${d.tiempo} min`);
    if (d.experiencia) lines.push(`- Experiencia: ${d.experiencia}`);
    if (d.limitaciones) lines.push(`- Lesiones/limitaciones: ${d.limitaciones}`);
  }
  return lines.join("\n");
}
