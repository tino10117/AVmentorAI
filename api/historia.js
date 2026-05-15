// api/historia.js — Modo Historia (juego narrativo con IA)
// Gratis: 5 turnos/día. Premium: 30 turnos/día.
// Modelo: gpt-4o-mini con streaming SSE.
// Estado guardado en user.historias_activas (máx 3 partidas).

import OpenAI from "openai";
import jwt from "jsonwebtoken";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const JWT_SECRET = process.env.JWT_SECRET || "av-mentorai-fixed-secret-2024";

const TURNOS_LIMITS = { Gratis: 5, Premium: 30, Empresarial: 30 };
const MAX_PARTIDAS_ACTIVAS = 3;
const MODEL = "gpt-4o-mini";

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
  const limit = TURNOS_LIMITS[plan] ?? 5;
  const kv = await getKV();
  const today = new Date().toISOString().split("T")[0];
  const key = `historia_limit:${email}:${today}`;
  const used = (await kv.get(key)) || 0;
  if (used >= limit) return { ok: false, used, limit, reason: "limit" };
  await kv.set(key, used + 1, { ex: 86400 });
  return { ok: true, used: used + 1, limit };
}

// ─── ESCENARIOS PREARMADOS ──────────────────────────────────────

const ESCENARIOS = {
  startup: {
    titulo: "🚀 Lanzá tu startup",
    setup: "Tenés 25 años, $50.000 USD ahorrados, una idea de negocio (que vos definirás) y muchas ganas. Estás en Buenos Aires. Hoy es el día 1: dejaste tu trabajo y querés construir algo desde cero.",
    metricas_iniciales: { plata: 50000, salud: 90, reputacion: 50, energia: 100 },
    objetivo: "Llevar tu startup a facturar $100.000 USD/mes",
  },
  herencia: {
    titulo: "👔 Heredás un negocio familiar",
    setup: "Tu viejo (que se acaba de jubilar) te dejó la empresa familiar: una distribuidora de productos de limpieza que factura $80.000/mes pero está en pérdida desde hace 6 meses. Tenés 30 años, nunca trabajaste ahí, y los 12 empleados no te tienen confianza.",
    metricas_iniciales: { plata: 30000, salud: 80, reputacion: 30, energia: 80 },
    objetivo: "Volver la empresa rentable en 90 días o cerrarla con dignidad",
  },
  separado: {
    titulo: "💔 Recién separado, con un hijo",
    setup: "Te separaste hace 2 semanas. Tenés un hijo de 6 años en custodia compartida, $0 en la cuenta, alquilás un monoambiente y trabajás en un call center ganando $400.000/mes. Tu ex te pide $200.000/mes de cuota alimentaria. Hoy empezás de cero — emocional y económicamente.",
    metricas_iniciales: { plata: 0, salud: 60, reputacion: 50, energia: 50 },
    objetivo: "Estabilizar tu vida y duplicar tus ingresos en 6 meses",
  },
  ny: {
    titulo: "🌎 Mudás a Nueva York con $500",
    setup: "Llegaste a NYC esta mañana. Tenés $500 USD, una mochila con ropa, una visa de turista (90 días) y nadie que conozcas. Querés conseguir trabajo y quedarte. Estás en Manhattan, son las 2pm.",
    metricas_iniciales: { plata: 500, salud: 80, reputacion: 0, energia: 70 },
    objetivo: "Conseguir trabajo legal y residencia antes de que se venza la visa",
  },
  detective: {
    titulo: "🕵️ Detective privado",
    setup: "Sos detective privado en Rosario. Esta mañana entró Sandra Méndez a tu oficina con $50.000 en efectivo y un pedido: 'Mi marido desapareció hace 3 días. La policía no me cree. Encontrámelo.' Te dejó una foto, una dirección y su teléfono.",
    metricas_iniciales: { plata: 50000, salud: 85, reputacion: 60, energia: 90 },
    objetivo: "Resolver el caso y cobrar el saldo de $50.000 prometido al final",
  },
  influencer: {
    titulo: "🎬 Influencer caído",
    setup: "Hace 2 años eras viral con 800K seguidores. Hoy quedaste en 120K, las marcas no te llaman, tu última colab fue hace 4 meses, tenés $5.000 USD ahorrados y el alquiler vence en 15 días. Tenés 26 años. Subiste un video llorando que no funcionó.",
    metricas_iniciales: { plata: 5000, salud: 60, reputacion: 40, energia: 40 },
    objetivo: "Reinventarte y volver a vivir de tu marca personal",
  },
  isla: {
    titulo: "🏝️ Naufragio en isla desierta",
    setup: "El barco crucero en el que estabas naufragó. Llegaste nadando a una isla desierta en el Pacífico. Sos uno de 4 sobrevivientes. Estás con: una ingeniera (Laura, 35), un cocinero (Pablo, 50) y una adolescente (Mía, 17). Es el día 1. Tenés un encendedor, una botella de agua medio vacía y la ropa puesta.",
    metricas_iniciales: { plata: 0, salud: 70, reputacion: 50, energia: 60 },
    objetivo: "Sobrevivir y volver a casa",
  },
};

// ─── SYSTEM PROMPTS ──────────────────────────────────────────────

const SYSTEM_BASE = `Sos el DIRECTOR DEL JUEGO de una aventura narrativa interactiva, en español argentino (usá "vos", "tenés", "podés", nunca "tú").

TU ROL:
- Narrás una historia en SEGUNDA PERSONA (al jugador): "Entrás al bar...", "Tu socio te dice...".
- Cada turno avanza la historia 1 día. Sos quien decide qué pasa.
- Inventás personajes con nombre, personalidad y motivaciones. Los RECORDÁS turno a turno.
- Inventás problemas, oportunidades y consecuencias lógicas.
- Mantenés un TONO realista pero envolvente. No es novela rosa, es una historia con tensión.

REGLAS CRÍTICAS DE FORMATO:
- Narrá MÁXIMO 3-4 párrafos cortos. NUNCA respondas con un texto enorme.
- Terminá SIEMPRE con 3 o 4 opciones de decisión en este formato EXACTO (con apertura Y cierre obligatorios):

[OPCIONES]
A) Texto de la opción A
B) Texto de la opción B
C) Texto de la opción C
D) Texto de la opción D (opcional)
[/OPCIONES]

⚠️ MUY IMPORTANTE: SIEMPRE cerrá con [/OPCIONES]. Sin esa línea de cierre el juego se rompe.

- Las opciones tienen que ser MOVIDAS REALES distintas entre sí, no "Sí/No". Cada una abre un camino diferente.
- NO escribas las consecuencias de cada opción en la lista — solo describí brevemente la acción.

REGLAS DE COHERENCIA:
- Si el jugador inventa algo absurdo (ej. "saco un misil del bolsillo"), la respuesta lo hace fallar de forma cómica o realista.
- Si las métricas del jugador llegan a 0 (salud, energía, etc), narrá un final acorde y declará GAME OVER.
- Cada 7 días en el juego, mete un EVENTO IMPORTANTE (oportunidad grande, problema serio, giro de trama).
- Los personajes tienen memoria: si Javier te traicionó hace 5 días, todavía está enojado.

REGLAS DE MÉTRICAS:
Al final de cada respuesta, AGREGÁ ESTA LÍNEA DESPUÉS de [/OPCIONES] (es obligatorio):

[METRICAS]
plata: +/-NÚMERO
salud: +/-NÚMERO (0-100)
reputacion: +/-NÚMERO (0-100)
energia: +/-NÚMERO (0-100)
dia: +1
[/METRICAS]

⚠️ SIEMPRE cerrá el bloque con [/METRICAS]. Sin eso el juego no procesa los cambios.

Los números son CAMBIOS desde el estado anterior. Pueden ser 0, positivos o negativos. Sé realista: comprar un café no cambia métricas; firmar un contrato millonario suma mucha plata; una noche sin dormir baja energía.

EJEMPLO COMPLETO DE FINAL DE RESPUESTA:
...última oración de la narración.

[OPCIONES]
A) Aceptar el trato
B) Rechazar y buscar otro inversor
C) Negociar mejores términos
[/OPCIONES]

[METRICAS]
plata: 0
salud: 0
reputacion: 0
energia: -5
dia: 1
[/METRICAS]`;

const SYSTEM_INICIO = SYSTEM_BASE + `

VAS A INICIAR UNA HISTORIA NUEVA.
- Empezá con un párrafo evocador que ponga al jugador en escena.
- Mostrale el conflicto inicial.
- Terminá con las 3-4 opciones para que decida su primera movida.
- En la sección [METRICAS], poné todos en 0 (porque las iniciales ya están seteadas afuera).`;

const SYSTEM_AVANZAR = SYSTEM_BASE + `

CONTINUÁS UNA HISTORIA EN CURSO.
- Tomá la decisión del jugador y narrá las consecuencias.
- Avanzá 1 día.
- Si fue una opción del menú, contá lo que pasa. Si escribió libre, integralo creativamente.
- Si la acción es muy absurda o imposible, redirigí con humor o realismo.`;

const SYSTEM_RECAP = `Sos el DIRECTOR DEL JUEGO. El jugador volvió después de un rato y necesita un MINI-RECAP de su historia.

Generá un recap de MÁXIMO 3 oraciones que resuma:
- Qué estaba haciendo en el último turno
- Personajes principales presentes
- Próxima decisión pendiente

Después de la frase final, agregá las 3-4 opciones [OPCIONES]...[/OPCIONES] tal cual quedaron pendientes.

Tono argentino. No uses "tú".`;

// ─── HANDLER PRINCIPAL ──────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Auth
  let decoded;
  try {
    decoded = verifyToken(req);
  } catch {
    return res.status(401).json({ error: "No autorizado" });
  }

  const userEmail = decoded.email;
  const { action, escenario_id, escenario_libre, partida_id, decision } = req.body || {};

  // Cargar user
  const kv = await getKV();
  const user = await kv.get(`user:${userEmail}`);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const plan = user.plan || "Gratis";

  // ─── ACCIÓN: LISTAR PARTIDAS ACTIVAS ──────────────────
  if (action === "listar") {
    const partidas = user.historias_activas || [];
    return res.status(200).json({
      ok: true,
      partidas: partidas.map(p => ({
        id: p.id,
        titulo: p.titulo,
        dia: p.dia,
        metricas: p.metricas,
        fecha_ultima: p.fecha_ultima,
        ultimo_resumen: (p.history?.[p.history.length - 1]?.content || "").slice(0, 100) + "...",
      })),
    });
  }

  // ─── ACCIÓN: BORRAR PARTIDA ──────────────────────────
  if (action === "borrar") {
    if (!partida_id) return res.status(400).json({ error: "Falta partida_id" });
    user.historias_activas = (user.historias_activas || []).filter(p => p.id !== partida_id);
    await kv.set(`user:${userEmail}`, user);
    return res.status(200).json({ ok: true });
  }

  // ─── ACCIONES QUE CONSUMEN TURNOS: INICIAR / AVANZAR ──────
  if (action !== "iniciar" && action !== "avanzar" && action !== "retomar") {
    return res.status(400).json({ error: "Acción inválida" });
  }

  // Validar límite diario
  if (action === "iniciar" || action === "avanzar") {
    const check = await checkAndIncrement(userEmail, plan);
    if (!check.ok) {
      return res.status(429).json({
        error: check.reason === "limit"
          ? `Llegaste al máximo diario (${check.limit} turnos). Volvé mañana o subí a Premium.`
          : "Tu plan no permite jugar Modo Historia.",
        used: check.used,
        limit: check.limit,
      });
    }
  }

  // Setup SSE
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    let partida = null;
    let messages = [];

    if (action === "iniciar") {
      // ── Crear partida nueva ──────────────────────────
      if ((user.historias_activas || []).length >= MAX_PARTIDAS_ACTIVAS) {
        sendEvent("error", { error: `Ya tenés ${MAX_PARTIDAS_ACTIVAS} partidas activas. Borrá una para empezar otra.` });
        return res.end();
      }

      let setup, titulo, metricas_iniciales, objetivo;
      if (escenario_id && ESCENARIOS[escenario_id]) {
        const esc = ESCENARIOS[escenario_id];
        setup = esc.setup;
        titulo = esc.titulo;
        metricas_iniciales = esc.metricas_iniciales;
        objetivo = esc.objetivo;
      } else if (escenario_libre && escenario_libre.trim().length > 10) {
        setup = escenario_libre.trim();
        titulo = "🎮 Historia libre";
        // Métricas por defecto para modo libre
        metricas_iniciales = { plata: 1000, salud: 80, reputacion: 50, energia: 80 };
        objetivo = "Tu historia, tus reglas — definí vos qué considerás ganar";
      } else {
        sendEvent("error", { error: "Elegí un escenario o escribí uno libre (mínimo 10 caracteres)." });
        return res.end();
      }

      const partidaId = "h_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      partida = {
        id: partidaId,
        titulo,
        escenario_id: escenario_id || "libre",
        setup,
        objetivo,
        dia: 1,
        metricas: metricas_iniciales,
        history: [],
        fecha_creacion: new Date().toISOString(),
        fecha_ultima: new Date().toISOString(),
      };

      const userPrompt = `Iniciá la historia con este setup:\n\n${setup}\n\nObjetivo del jugador: ${objetivo}\n\nMétricas iniciales: plata=$${metricas_iniciales.plata}, salud=${metricas_iniciales.salud}, reputación=${metricas_iniciales.reputacion}, energía=${metricas_iniciales.energia}.\n\nArrancá la historia y dame las primeras 3-4 opciones.`;

      messages = [
        { role: "system", content: SYSTEM_INICIO },
        { role: "user", content: userPrompt },
      ];

    } else if (action === "retomar") {
      // ── Recap de partida existente ──────────────────
      partida = (user.historias_activas || []).find(p => p.id === partida_id);
      if (!partida) {
        sendEvent("error", { error: "Partida no encontrada" });
        return res.end();
      }

      // Tomar últimos 6 mensajes para contexto
      const ultimos = partida.history.slice(-6);
      const contextStr = ultimos.map(m => `${m.role === "user" ? "JUGADOR" : "DIRECTOR"}: ${m.content}`).join("\n\n");

      messages = [
        { role: "system", content: SYSTEM_RECAP },
        { role: "user", content: `Estado actual:\nDía ${partida.dia}\nMétricas: plata=$${partida.metricas.plata}, salud=${partida.metricas.salud}, reputación=${partida.metricas.reputacion}, energía=${partida.metricas.energia}\n\nÚltimos turnos:\n${contextStr}\n\nHaceme un recap corto y mostrame las opciones para seguir.` },
      ];

    } else {
      // ── Avanzar historia con decisión del jugador ──
      partida = (user.historias_activas || []).find(p => p.id === partida_id);
      if (!partida) {
        sendEvent("error", { error: "Partida no encontrada" });
        return res.end();
      }
      if (!decision || decision.trim().length === 0) {
        sendEvent("error", { error: "Falta la decisión" });
        return res.end();
      }

      // Game over check antes de seguir
      if (partida.metricas.salud <= 0 || partida.metricas.energia <= 0) {
        sendEvent("error", { error: "Esta partida ya terminó. Empezá una nueva." });
        return res.end();
      }

      // Contexto: setup + últimos 16 turnos (8 pares user/assistant)
      const ultimos = partida.history.slice(-16);
      messages = [
        { role: "system", content: SYSTEM_AVANZAR + `\n\nCONTEXTO DE LA HISTORIA:\nSetup inicial: ${partida.setup}\nObjetivo: ${partida.objetivo}\nDía actual: ${partida.dia}\nMétricas actuales: plata=$${partida.metricas.plata}, salud=${partida.metricas.salud}, reputación=${partida.metricas.reputacion}, energía=${partida.metricas.energia}` },
        ...ultimos.map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: decision.trim() },
      ];
    }

    // ─── LLAMADA A OPENAI CON STREAMING ─────────────────────
    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages,
      stream: true,
      max_tokens: 700,
      temperature: 0.85,
    });

    let fullReply = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) {
        fullReply += delta;
        sendEvent("delta", { text: delta });
      }
    }

    // ─── PARSEAR MÉTRICAS Y OPCIONES ────────────────────────
    // Parser de métricas — acepta [METRICAS] con o sin cierre, y formato flexible
    const parseMetricas = (texto) => {
      // Intento 1: con cierre [/METRICAS]
      let match = texto.match(/\[METRICAS\]([\s\S]*?)\[\/METRICAS\]/i);
      // Intento 2: sin cierre — desde [METRICAS] hasta el final
      if (!match) match = texto.match(/\[METRICAS\]([\s\S]*?)$/i);
      if (!match) return null;
      const m = {};
      const lines = match[1].split("\n");
      for (const line of lines) {
        const kv = line.match(/^\s*(plata|salud|reputacion|energia|dia)\s*:\s*([+-]?\d+)/i);
        if (kv) m[kv[1].toLowerCase()] = parseInt(kv[2], 10);
      }
      return Object.keys(m).length > 0 ? m : null;
    };

    // Parser de opciones — acepta [OPCIONES] con o sin cierre
    const parseOpciones = (texto) => {
      let dentroDelBloque = "";
      // Intento 1: con cierre [/OPCIONES]
      let match = texto.match(/\[OPCIONES\]([\s\S]*?)\[\/OPCIONES\]/i);
      if (match) {
        dentroDelBloque = match[1];
      } else {
        // Intento 2: sin cierre — desde [OPCIONES] hasta [METRICAS] o fin del texto
        match = texto.match(/\[OPCIONES\]([\s\S]*?)(?=\[METRICAS\]|$)/i);
        if (match) dentroDelBloque = match[1];
      }
      // Intento 3: si no hay [OPCIONES] pero hay líneas con A) B) C) D) al final
      if (!dentroDelBloque) {
        // Buscar las últimas líneas que empiecen con A) B) C) D)
        const lines = texto.split("\n");
        const opLines = [];
        for (let i = lines.length - 1; i >= 0; i--) {
          if (/^\s*[A-D]\s*\)/.test(lines[i])) opLines.unshift(lines[i]);
          else if (opLines.length > 0) break; // ya pasamos las opciones
        }
        if (opLines.length >= 2) dentroDelBloque = opLines.join("\n");
      }
      if (!dentroDelBloque) return [];
      const opts = [];
      const lines = dentroDelBloque.split("\n");
      for (const line of lines) {
        const m = line.match(/^\s*([A-D])\s*\)\s*(.+?)\s*$/);
        if (m) opts.push({ letra: m[1], texto: m[2] });
      }
      return opts;
    };

    const cambiosMetricas = parseMetricas(fullReply);
    const opciones = parseOpciones(fullReply);

    // Limpiar el texto narrativo (sin las secciones meta, incluso si están sin cerrar)
    const narrativaLimpia = fullReply
      // Bloques con cierre
      .replace(/\[METRICAS\][\s\S]*?\[\/METRICAS\]/gi, "")
      .replace(/\[OPCIONES\][\s\S]*?\[\/OPCIONES\]/gi, "")
      // Bloques SIN cierre: desde [METRICAS]/[OPCIONES] hasta fin de texto
      .replace(/\[METRICAS\][\s\S]*$/gi, "")
      .replace(/\[OPCIONES\][\s\S]*$/gi, "")
      // Líneas A) B) C) D) sueltas al final (por si quedó algo)
      .replace(/(\n\s*[A-D]\s*\).*)+$/g, "")
      .trim();

    // ─── APLICAR CAMBIOS A LA PARTIDA ──────────────────────
    let gameOver = false;
    let mensajeFin = "";

    if (action !== "retomar" && cambiosMetricas) {
      partida.metricas.plata += cambiosMetricas.plata || 0;
      partida.metricas.salud = Math.max(0, Math.min(100, partida.metricas.salud + (cambiosMetricas.salud || 0)));
      partida.metricas.reputacion = Math.max(0, Math.min(100, partida.metricas.reputacion + (cambiosMetricas.reputacion || 0)));
      partida.metricas.energia = Math.max(0, Math.min(100, partida.metricas.energia + (cambiosMetricas.energia || 0)));
      partida.dia += cambiosMetricas.dia || (action === "avanzar" ? 1 : 0);

      // Chequear game over
      if (partida.metricas.salud <= 0) {
        gameOver = true;
        mensajeFin = "💔 Game Over — tu salud llegó a 0. Tu personaje no pudo seguir.";
      } else if (partida.metricas.energia <= 0) {
        gameOver = true;
        mensajeFin = "🧠 Game Over — tu energía mental llegó a 0. Burnout total.";
      } else if (partida.metricas.reputacion <= 0) {
        gameOver = true;
        mensajeFin = "⭐ Game Over — tu reputación se hundió. Nadie quiere saber nada de vos.";
      }
    }

    // Guardar mensajes en historia (solo iniciar/avanzar, no retomar)
    if (action === "iniciar") {
      partida.history.push({ role: "assistant", content: narrativaLimpia });
    } else if (action === "avanzar") {
      partida.history.push({ role: "user", content: decision.trim() });
      partida.history.push({ role: "assistant", content: narrativaLimpia });
    }

    // Limitar historial a 40 mensajes (para no crecer infinito)
    if (partida.history.length > 40) {
      partida.history = partida.history.slice(-40);
    }

    partida.fecha_ultima = new Date().toISOString();

    // Guardar partida en user (solo iniciar/avanzar)
    if (action === "iniciar" || action === "avanzar") {
      if (!user.historias_activas) user.historias_activas = [];
      const idx = user.historias_activas.findIndex(p => p.id === partida.id);
      if (idx >= 0) {
        user.historias_activas[idx] = partida;
      } else {
        user.historias_activas.push(partida);
      }
      await kv.set(`user:${userEmail}`, user);
    }

    // ─── DONE EVENT ────────────────────────────────────────
    const today = new Date().toISOString().split("T")[0];
    const keyLimit = `historia_limit:${userEmail}:${today}`;
    const usadosHoy = (await kv.get(keyLimit)) || 0;

    sendEvent("done", {
      reply: narrativaLimpia,
      partida: {
        id: partida.id,
        titulo: partida.titulo,
        dia: partida.dia,
        metricas: partida.metricas,
        objetivo: partida.objetivo,
      },
      opciones,
      game_over: gameOver,
      mensaje_fin: mensajeFin,
      used: usadosHoy,
      limit: TURNOS_LIMITS[plan] ?? 5,
    });

    return res.end();

  } catch (err) {
    console.error("Error en historia:", err);
    sendEvent("error", { error: err.message || "Error generando historia" });
    return res.end();
  }
}
