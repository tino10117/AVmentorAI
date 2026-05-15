// api/empire.js — Business Empire IA (juego de gestión empresarial con IA)
// Gratis: 5 turnos/día. Premium: 30 turnos/día.
// Modelo: gpt-4o-mini con streaming SSE.
// Estado guardado en user.empires_activas (máx 3 partidas).

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
  const key = `empire_limit:${email}:${today}`;
  const used = (await kv.get(key)) || 0;
  if (used >= limit) return { ok: false, used, limit, reason: "limit" };
  await kv.set(key, used + 1, { ex: 86400 });
  return { ok: true, used: used + 1, limit };
}

// ─── DEFINICIÓN DE LOS 6 NEGOCIOS ───────────────────────────────

const NEGOCIOS = {
  kiosco: {
    nombre: "Kiosco / Almacén",
    emoji: "🏪",
    capital_inicial: 50000,
    facturacion_inicial: 0, // empieza día 1 sin ventas
    contexto: "Almacén de barrio. Vendés gaseosas, golosinas, cigarrillos, snacks. Tus clientes son los vecinos del barrio.",
    rubro_descripcion: "kiosco/almacén de barrio",
    socio_default: { nombre: "Lucas", rol: "tu mano derecha", sueldo: 0, performance: 70, lealtad: 80, descripcion: "Tu primo, empezó con vos. Conoce el barrio." },
    costos_fijos_inicial: 35000, // alquiler + servicios mensuales aprox
    sueldo_promedio: 45000,
  },
  cafeteria: {
    nombre: "Cafetería",
    emoji: "☕",
    capital_inicial: 120000,
    facturacion_inicial: 0,
    contexto: "Cafetería de especialidad. Café de grano, medialunas, tostados, ambiente cálido. Tus clientes son oficinistas y gente que trabaja remoto.",
    rubro_descripcion: "cafetería de especialidad",
    socio_default: { nombre: "Sofía", rol: "tu barista estrella y socia", sueldo: 0, performance: 85, lealtad: 75, descripcion: "Sabe de café de verdad. Tenía sueños de abrir su propia cafetería." },
    costos_fijos_inicial: 85000,
    sueldo_promedio: 55000,
  },
  peluqueria: {
    nombre: "Peluquería",
    emoji: "💈",
    capital_inicial: 80000,
    facturacion_inicial: 0,
    contexto: "Peluquería de barrio. Cortes, color, peinados. Trabajás por turnos.",
    rubro_descripcion: "peluquería",
    socio_default: { nombre: "Carla", rol: "tu peluquera estrella", sueldo: 0, performance: 90, lealtad: 70, descripcion: "Tiene fila de clientas fieles. Si se va, te llevás un golpe duro." },
    costos_fijos_inicial: 45000,
    sueldo_promedio: 50000,
  },
  foodtruck: {
    nombre: "Food Truck",
    emoji: "🚚",
    capital_inicial: 200000,
    facturacion_inicial: 0,
    contexto: "Food truck de hamburguesas gourmet. Movés el camión a eventos, ferias, parques. El clima y la ubicación son críticos.",
    rubro_descripcion: "food truck de hamburguesas",
    socio_default: { nombre: "Diego", rol: "tu chef y socio", sueldo: 0, performance: 80, lealtad: 75, descripcion: "Ex cocinero de un restaurante caro. Las recetas son suyas." },
    costos_fijos_inicial: 60000,
    sueldo_promedio: 55000,
  },
  ropa: {
    nombre: "Tienda de ropa",
    emoji: "👗",
    capital_inicial: 150000,
    facturacion_inicial: 0,
    contexto: "Tienda de ropa para mujer 20-35 años. Temporadas, tendencias, fast fashion. Vendés online y en local.",
    rubro_descripcion: "tienda de ropa de mujer",
    socio_default: { nombre: "Valentina", rol: "tu compradora y socia", sueldo: 0, performance: 75, lealtad: 70, descripcion: "Va a Once a buscar lo último. Tiene buen ojo, pero a veces se equivoca con la temporada." },
    costos_fijos_inicial: 70000,
    sueldo_promedio: 50000,
  },
  ecommerce: {
    nombre: "E-commerce",
    emoji: "💻",
    capital_inicial: 50000,
    facturacion_inicial: 0,
    contexto: "Tienda online de productos para mascotas. Comprás barato a mayoristas, vendés con Mercado Libre y tienda propia. Logística por correo argentino.",
    rubro_descripcion: "e-commerce de productos para mascotas",
    socio_default: { nombre: "Martín", rol: "tu socio técnico y de marketing", sueldo: 0, performance: 80, lealtad: 85, descripcion: "Sabe de Google Ads y SEO. Maneja todo lo digital." },
    costos_fijos_inicial: 30000,
    sueldo_promedio: 45000,
  },
};

// ─── DEFINICIÓN DE LOS 5 NIVELES ─────────────────────────────────

const NIVELES = [
  { nombre: "Micro", numero: 1, facturacion_min: 0,        sucursales_min: 1, max_empleados: 5 },
  { nombre: "Local", numero: 2, facturacion_min: 300000,   sucursales_min: 1, max_empleados: 15 },
  { nombre: "Cadena", numero: 3, facturacion_min: 1000000, sucursales_min: 3, max_empleados: 50 },
  { nombre: "Empresa", numero: 4, facturacion_min: 5000000, sucursales_min: 8, max_empleados: 200 },
  { nombre: "Imperio", numero: 5, facturacion_min: 20000000, sucursales_min: 20, max_empleados: 999 },
];

function calcularNivel(empire) {
  const fact = empire.facturacion_mensual || 0;
  const sucs = empire.sucursales || 1;
  // Buscamos el nivel más alto que cumple ambos requisitos
  let nivelActual = NIVELES[0];
  for (const n of NIVELES) {
    if (fact >= n.facturacion_min && sucs >= n.sucursales_min) {
      nivelActual = n;
    }
  }
  return nivelActual;
}

function siguienteNivel(empire) {
  const actual = calcularNivel(empire);
  return NIVELES.find(n => n.numero === actual.numero + 1) || null;
}

// ─── SYSTEM PROMPTS ─────────────────────────────────────────────

const SYSTEM_BASE = `Sos el DIRECTOR DE JUEGO de un simulador de gestión empresarial, en español argentino (usá "vos", "tenés", "podés", nunca "tú").

TU ROL:
- Sos el "mundo" del negocio del jugador: competidores, empleados, clientes, eventos, problemas, oportunidades.
- Cada turno avanza 1 DÍA en el negocio del jugador.
- Sos REALISTA con los números — un kiosco no factura $1M/día, una cafetería tiene costos altos, un food truck depende del clima.
- Personajes (socio, empleados) son persistentes — RECORDÁS sus nombres, sueldos, personalidad turno a turno.
- Inventás eventos lógicos según el contexto y nivel del negocio.

REGLAS CRÍTICAS DE FORMATO:
- Narrá MÁXIMO 2-3 párrafos cortos. NUNCA respondas con un texto enorme.
- Terminá SIEMPRE con 3 o 4 opciones de decisión en este formato EXACTO (con apertura Y cierre obligatorios):

[OPCIONES]
A) Texto corto de la opción A
B) Texto corto de la opción B
C) Texto corto de la opción C
D) Texto corto de la opción D (opcional)
[/OPCIONES]

⚠️ MUY IMPORTANTE: SIEMPRE cerrá con [/OPCIONES]. Sin esa línea de cierre el juego se rompe.

- Las opciones tienen que ser movidas REALES distintas. Cada una abre un camino diferente.
- Las opciones NO deben mencionar las consecuencias — solo la acción.

REGLAS DE MÉTRICAS:
Al final de cada respuesta, AGREGÁ ESTA SECCIÓN DESPUÉS de [/OPCIONES]:

[METRICAS]
plata: +/-NÚMERO
facturacion_mensual: +/-NÚMERO (cambio en facturación mensual estimada)
reputacion: +/-NÚMERO (0-100)
estres: +/-NÚMERO (0-100, qué tan agotado está el dueño)
stock: +/-NÚMERO (0-100, solo si el rubro tiene stock físico)
empleados_delta: NÚMERO (cuántos contratá/despide, 0 si no cambia, negativo si se va alguien)
dia: +NÚMERO (cuántos días pasan, normalmente 1)
[/METRICAS]

⚠️ SIEMPRE cerrá [/METRICAS]. Sé REALISTA con los números — son cambios pequeños en el día a día.

Ejemplos de cambios típicos por día:
- Día normal: plata: +/-2000, facturacion: 0, reputacion: 0, estres: +/-3
- Decisión importante (campaña, contratar): plata: +/-15000, facturacion: +/-20000
- Crisis (robo, pleito, renuncia): plata: -50000+, reputacion: -10, estres: +20

REGLAS DE COHERENCIA:
- Si el jugador hace algo absurdo o imposible (ej. "compro Microsoft"), redirigí con humor/realismo.
- Si plata < 0 al cerrar el turno, declarar QUIEBRA (game over).
- Si estres llega a 100, narrar burnout y posible game over.
- Cada 7-10 días, mete un EVENTO IMPORTANTE: competencia nueva, inspección, oportunidad de inversión, renuncia clave.
- Cada 30 días (mes "cerrado") podés sugerir un balance o cambio de nivel.`;

const SYSTEM_INICIO = SYSTEM_BASE + `

VAS A INICIAR UNA EMPRESA NUEVA.
- Empezá con UN PÁRRAFO corto y evocador que ponga al dueño en el día 1.
- Mencioná el socio (con nombre).
- Termina con las 3-4 opciones para la PRIMERA decisión.
- En [METRICAS], poné todos los valores en 0 (las iniciales ya están seteadas).`;

const SYSTEM_AVANZAR = SYSTEM_BASE + `

CONTINUÁS UNA EMPRESA EN CURSO.
- Tomá la decisión del jugador y narrá las consecuencias del día.
- Avanzá 1 día (a veces 2-3 si la acción lo justifica).
- Si fue opción de menú, contá lo que pasa. Si escribió libre, integralo creativamente.
- Si pidió GESTIONAR EMPRESA (acción operativa), narrá MUY breve y mostrá el efecto inmediato.`;

const SYSTEM_RECAP = `Sos el DIRECTOR DEL JUEGO. El jugador volvió y necesita un MINI-RECAP rápido.

Generá un recap de MÁXIMO 3 oraciones que resuma:
- Estado actual del negocio (qué onda)
- Decisión pendiente / situación
- Personajes presentes

Después del recap, agregá las 3-4 opciones [OPCIONES]...[/OPCIONES] para que el jugador siga.

Tono argentino. No uses "tú". No incluyas [METRICAS] en el recap.`;

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
  const { action, negocio_id, partida_id, decision, gestion_accion } = req.body || {};

  // Cargar user
  const kv = await getKV();
  const user = await kv.get(`user:${userEmail}`);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const plan = user.plan || "Gratis";

  // ─── LISTAR PARTIDAS ──────────────────────────────────
  if (action === "listar") {
    const partidas = user.empires_activas || [];
    return res.status(200).json({
      ok: true,
      partidas: partidas.map(p => ({
        id: p.id,
        nombre_empresa: p.nombre_empresa,
        negocio_id: p.negocio_id,
        emoji: NEGOCIOS[p.negocio_id]?.emoji || "💼",
        nivel: calcularNivel(p),
        dia: p.dia,
        plata: p.plata,
        facturacion_mensual: p.facturacion_mensual,
        empleados: p.empleados_total,
        fecha_ultima: p.fecha_ultima,
      })),
      negocios_disponibles: Object.entries(NEGOCIOS).map(([id, n]) => ({
        id,
        nombre: n.nombre,
        emoji: n.emoji,
        capital_inicial: n.capital_inicial,
        descripcion: n.contexto.split(".")[0] + ".",
      })),
    });
  }

  // ─── BORRAR PARTIDA ───────────────────────────────────
  if (action === "borrar") {
    if (!partida_id) return res.status(400).json({ error: "Falta partida_id" });
    user.empires_activas = (user.empires_activas || []).filter(p => p.id !== partida_id);
    await kv.set(`user:${userEmail}`, user);
    return res.status(200).json({ ok: true });
  }

  // ─── DETALLE FINANCIERO (no consume turno) ───────────
  if (action === "detalle") {
    const partida = (user.empires_activas || []).find(p => p.id === partida_id);
    if (!partida) return res.status(404).json({ error: "Partida no encontrada" });

    // Calcular planilla financiera
    const ingresos_mes = partida.facturacion_mensual || 0;
    const sueldos_mes = (partida.empleados_total || 1) * (NEGOCIOS[partida.negocio_id]?.sueldo_promedio || 45000);
    const costos_fijos = (NEGOCIOS[partida.negocio_id]?.costos_fijos_inicial || 35000) * (partida.sucursales || 1);
    const mercaderia = Math.round(ingresos_mes * 0.45); // 45% de la facturación va a mercadería estimada
    const marketing_mes = partida.marketing_mes_actual || 0;
    const total_costos = sueldos_mes + costos_fijos + mercaderia + marketing_mes;
    const ganancia_mes = ingresos_mes - total_costos;

    return res.status(200).json({
      ok: true,
      detalle: {
        ingresos: { ventas: ingresos_mes, total: ingresos_mes },
        costos: {
          mercaderia,
          sueldos: sueldos_mes,
          fijos: costos_fijos,
          marketing: marketing_mes,
          total: total_costos,
        },
        ganancia_neta: ganancia_mes,
        margen: ingresos_mes > 0 ? Math.round((ganancia_mes / ingresos_mes) * 100) : 0,
        empleados_detalle: partida.personajes || [],
      },
    });
  }

  // ─── ACCIONES QUE CONSUMEN TURNOS ────────────────────
  const accionesQueConsumenTurno = ["iniciar", "avanzar", "gestionar"];
  if (!accionesQueConsumenTurno.includes(action) && action !== "retomar") {
    return res.status(400).json({ error: "Acción inválida" });
  }

  if (accionesQueConsumenTurno.includes(action)) {
    const check = await checkAndIncrement(userEmail, plan);
    if (!check.ok) {
      return res.status(429).json({
        error: `Llegaste al máximo diario (${check.limit} turnos). Volvé mañana o subí a Premium.`,
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
      // ── Validaciones ──
      if ((user.empires_activas || []).length >= MAX_PARTIDAS_ACTIVAS) {
        sendEvent("error", { error: `Ya tenés ${MAX_PARTIDAS_ACTIVAS} empresas activas. Vendé o cerrá una para empezar otra.` });
        return res.end();
      }
      const neg = NEGOCIOS[negocio_id];
      if (!neg) {
        sendEvent("error", { error: "Negocio inválido" });
        return res.end();
      }

      const partidaId = "e_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      partida = {
        id: partidaId,
        nombre_empresa: `Mi ${neg.nombre}`,
        negocio_id,
        dia: 1,
        plata: neg.capital_inicial,
        facturacion_mensual: 0,
        reputacion: 50,
        estres: 20,
        stock: 100,
        empleados_total: 1, // el socio cuenta
        sucursales: 1,
        marketing_mes_actual: 0,
        personajes: [{ ...neg.socio_default, id: "socio" }],
        history: [],
        fecha_creacion: new Date().toISOString(),
        fecha_ultima: new Date().toISOString(),
      };

      const userPrompt = `Iniciá el primer día de un nuevo negocio:

Rubro: ${neg.contexto}
Capital inicial: $${neg.capital_inicial.toLocaleString("es-AR")}
Socio: ${neg.socio_default.nombre}, ${neg.socio_default.rol}. ${neg.socio_default.descripcion}

Día 1. Recién abriste. Arrancá con una situación inicial breve y dame las primeras opciones de qué hacer hoy.`;

      messages = [
        { role: "system", content: SYSTEM_INICIO },
        { role: "user", content: userPrompt },
      ];

    } else if (action === "retomar") {
      partida = (user.empires_activas || []).find(p => p.id === partida_id);
      if (!partida) {
        sendEvent("error", { error: "Partida no encontrada" });
        return res.end();
      }
      const ultimos = partida.history.slice(-6);
      const contextStr = ultimos.map(m => `${m.role === "user" ? "DUEÑO" : "DIRECTOR"}: ${m.content}`).join("\n\n");

      const neg = NEGOCIOS[partida.negocio_id];
      messages = [
        { role: "system", content: SYSTEM_RECAP },
        { role: "user", content: `Empresa: ${partida.nombre_empresa} (${neg?.nombre || partida.negocio_id})\nDía ${partida.dia} · Nivel ${calcularNivel(partida).nombre}\nPlata: $${partida.plata.toLocaleString("es-AR")}\nFacturación: $${partida.facturacion_mensual.toLocaleString("es-AR")}/mes\nEmpleados: ${partida.empleados_total}\n\nÚltimos turnos:\n${contextStr}\n\nHaceme un recap corto y mostrame las opciones para seguir.` },
      ];

    } else if (action === "avanzar" || action === "gestionar") {
      partida = (user.empires_activas || []).find(p => p.id === partida_id);
      if (!partida) {
        sendEvent("error", { error: "Partida no encontrada" });
        return res.end();
      }
      if (partida.plata < 0) {
        sendEvent("error", { error: "Esta empresa quebró. Empezá una nueva." });
        return res.end();
      }
      const inputTexto = action === "gestionar" ? gestion_accion : decision;
      if (!inputTexto || inputTexto.trim().length === 0) {
        sendEvent("error", { error: "Falta la decisión" });
        return res.end();
      }

      const neg = NEGOCIOS[partida.negocio_id];
      const nivel = calcularNivel(partida);
      const personajesStr = (partida.personajes || []).map(p => `${p.nombre} (${p.rol}, sueldo $${p.sueldo}, performance ${p.performance}, lealtad ${p.lealtad})`).join("; ");

      const ultimos = partida.history.slice(-12);
      const decisionPrefix = action === "gestionar" ? "[ACCIÓN OPERATIVA] " : "";

      messages = [
        { role: "system", content: SYSTEM_AVANZAR + `\n\nCONTEXTO DEL NEGOCIO:\nEmpresa: ${partida.nombre_empresa}\nRubro: ${neg?.contexto || "negocio"}\nNivel actual: ${nivel.nombre}\nDía: ${partida.dia}\nPlata: $${partida.plata.toLocaleString("es-AR")}\nFacturación mensual: $${partida.facturacion_mensual.toLocaleString("es-AR")}\nReputación: ${partida.reputacion}/100\nEstrés del dueño: ${partida.estres}/100\nStock: ${partida.stock}%\nEmpleados: ${partida.empleados_total}\nSucursales: ${partida.sucursales}\n\nPersonajes activos: ${personajesStr}` },
        ...ultimos.map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: decisionPrefix + inputTexto.trim() },
      ];
    }

    // ─── STREAMING ─────────────────────────────────────────
    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages,
      stream: true,
      max_tokens: 600,
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

    // ─── PARSEO ROBUSTO DE OPCIONES Y MÉTRICAS ─────────────
    const parseMetricas = (texto) => {
      let match = texto.match(/\[METRICAS\]([\s\S]*?)\[\/METRICAS\]/i);
      if (!match) match = texto.match(/\[METRICAS\]([\s\S]*?)$/i);
      if (!match) return null;
      const m = {};
      const lines = match[1].split("\n");
      for (const line of lines) {
        const kv = line.match(/^\s*(plata|facturacion_mensual|reputacion|estres|stock|empleados_delta|dia)\s*:\s*([+-]?\d+)/i);
        if (kv) m[kv[1].toLowerCase()] = parseInt(kv[2], 10);
      }
      return Object.keys(m).length > 0 ? m : null;
    };

    const parseOpciones = (texto) => {
      let dentroDelBloque = "";
      let match = texto.match(/\[OPCIONES\]([\s\S]*?)\[\/OPCIONES\]/i);
      if (match) dentroDelBloque = match[1];
      else {
        match = texto.match(/\[OPCIONES\]([\s\S]*?)(?=\[METRICAS\]|$)/i);
        if (match) dentroDelBloque = match[1];
      }
      if (!dentroDelBloque) {
        const lines = texto.split("\n");
        const opLines = [];
        for (let i = lines.length - 1; i >= 0; i--) {
          if (/^\s*[A-D]\s*\)/.test(lines[i])) opLines.unshift(lines[i]);
          else if (opLines.length > 0) break;
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

    const cambios = parseMetricas(fullReply);
    const opciones = parseOpciones(fullReply);

    const narrativaLimpia = fullReply
      .replace(/\[METRICAS\][\s\S]*?\[\/METRICAS\]/gi, "")
      .replace(/\[OPCIONES\][\s\S]*?\[\/OPCIONES\]/gi, "")
      .replace(/\[METRICAS\][\s\S]*$/gi, "")
      .replace(/\[OPCIONES\][\s\S]*$/gi, "")
      .replace(/(\n\s*[A-D]\s*\)[^\n]*)+\s*$/g, "")
      .trim();

    // ─── APLICAR CAMBIOS ───────────────────────────────────
    let gameOver = false;
    let mensajeFin = "";
    let subioDeNivel = false;
    let nuevoNivel = null;

    if (action !== "retomar" && cambios) {
      partida.plata += cambios.plata || 0;
      partida.facturacion_mensual = Math.max(0, partida.facturacion_mensual + (cambios.facturacion_mensual || 0));
      partida.reputacion = Math.max(0, Math.min(100, partida.reputacion + (cambios.reputacion || 0)));
      partida.estres = Math.max(0, Math.min(100, partida.estres + (cambios.estres || 0)));
      partida.stock = Math.max(0, Math.min(100, partida.stock + (cambios.stock || 0)));
      partida.empleados_total = Math.max(1, partida.empleados_total + (cambios.empleados_delta || 0));
      partida.dia += cambios.dia || 1;

      // Chequeo de quiebra
      if (partida.plata < 0) {
        gameOver = true;
        mensajeFin = "💸 QUIEBRA — Te quedaste sin plata. La empresa cierra.";
      } else if (partida.estres >= 100) {
        gameOver = true;
        mensajeFin = "🧠 BURNOUT — El estrés te tumbó. Tuviste que cerrar.";
      }

      // Chequeo de subida de nivel
      const nivelAntes = calcularNivel({ ...partida, facturacion_mensual: partida.facturacion_mensual - (cambios.facturacion_mensual || 0) });
      const nivelDespues = calcularNivel(partida);
      if (nivelDespues.numero > nivelAntes.numero) {
        subioDeNivel = true;
        nuevoNivel = nivelDespues;
      }
    }

    // Guardar en historial
    if (action === "iniciar") {
      partida.history.push({ role: "assistant", content: narrativaLimpia });
    } else if (action === "avanzar" || action === "gestionar") {
      const inputUsr = action === "gestionar" ? `[Gestión] ${gestion_accion}` : decision;
      partida.history.push({ role: "user", content: inputUsr });
      partida.history.push({ role: "assistant", content: narrativaLimpia });
    }
    if (partida.history.length > 40) partida.history = partida.history.slice(-40);
    partida.fecha_ultima = new Date().toISOString();

    if (action === "iniciar" || action === "avanzar" || action === "gestionar") {
      if (!user.empires_activas) user.empires_activas = [];
      const idx = user.empires_activas.findIndex(p => p.id === partida.id);
      if (idx >= 0) user.empires_activas[idx] = partida;
      else user.empires_activas.push(partida);
      await kv.set(`user:${userEmail}`, user);
    }

    // ─── DONE ─────────────────────────────────────────────
    const today = new Date().toISOString().split("T")[0];
    const usadosHoy = (await kv.get(`empire_limit:${userEmail}:${today}`)) || 0;

    sendEvent("done", {
      reply: narrativaLimpia,
      partida: {
        id: partida.id,
        nombre_empresa: partida.nombre_empresa,
        negocio_id: partida.negocio_id,
        emoji: NEGOCIOS[partida.negocio_id]?.emoji || "💼",
        dia: partida.dia,
        plata: partida.plata,
        facturacion_mensual: partida.facturacion_mensual,
        reputacion: partida.reputacion,
        estres: partida.estres,
        stock: partida.stock,
        empleados_total: partida.empleados_total,
        sucursales: partida.sucursales,
        nivel: calcularNivel(partida),
        siguiente_nivel: siguienteNivel(partida),
        personajes: partida.personajes,
      },
      opciones,
      game_over: gameOver,
      mensaje_fin: mensajeFin,
      subio_de_nivel: subioDeNivel,
      nuevo_nivel: nuevoNivel,
      used: usadosHoy,
      limit: TURNOS_LIMITS[plan] ?? 5,
    });

    return res.end();

  } catch (err) {
    console.error("Error en empire:", err);
    sendEvent("error", { error: err.message || "Error generando turno" });
    return res.end();
  }
}
