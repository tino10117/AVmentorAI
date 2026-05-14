// api/accion.js — Endpoint central anti-trampa
// Es el ÚNICO endpoint que puede modificar xp, racha, desafios_completados, etc.
// Cada acción se valida en el backend antes de aplicarse.

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "av-mentorai-fixed-secret-2024";

async function getKV() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

// ─── LÓGICA DE RACHA BIEN CALCULADA ─────────────────────────────
// Reglas:
// - Si última fecha === hoy → no cambia (ya actuó hoy)
// - Si última fecha === ayer → racha + 1 (días consecutivos)
// - Si pasó más de 1 día (o nunca actuó) → racha = 1 (reinicia)
function actualizarRacha(user) {
  const hoy = today();
  const ayer = yesterday();
  const ultima = user.ultima_fecha || "";

  if (ultima === hoy) return user; // ya actuó hoy

  if (ultima === ayer) {
    user.racha = (user.racha || 0) + 1;
  } else {
    user.racha = 1; // reset (pasaron varios días o primera vez)
  }
  user.ultima_fecha = hoy;
  return user;
}

// ─── LÓGICA DE LOGROS ───────────────────────────────────────────
function desbloquearLogros(user) {
  const loks = (user.english_lecciones_completadas || []).length;
  const diary = (user.english_diary || []).length;
  const reglas = [
    [user.xp >= 100, "Primeros 100 XP"],
    [user.xp >= 300, "Mente en crecimiento"],
    [user.xp >= 700, "Estratega en formación"],
    [user.racha >= 3, "Racha de 3 días"],
    [user.racha >= 7, "Semana imparable"],
    [user.desafios_completados >= 5, "5 desafíos completados"],
    [user.objetivos_completados >= 3, "Constructor de objetivos"],
    [loks >= 3, "Estudiante de inglés"],
    [loks >= 8, "Angloparlante en progreso"],
    [loks >= 12, "Inglés dominado 🏆"],
    [diary >= 7, "Diario de 7 días"],
    [diary >= 30, "Escritor constante 📝"],
  ];
  if (!user.logros) user.logros = [];
  for (const [cond, logro] of reglas) {
    if (cond && !user.logros.includes(logro)) user.logros.push(logro);
  }
  return user;
}

// ─── XP HISTORY ─────────────────────────────────────────────────
function pushXpHistory(user) {
  if (!user.xp_history) user.xp_history = [];
  const hoy = today();
  // Si ya hay entrada de hoy, actualizamos el valor; sino, creamos nueva
  const idx = user.xp_history.findIndex(e => e.fecha === hoy);
  if (idx >= 0) {
    user.xp_history[idx].xp = user.xp;
  } else {
    user.xp_history.push({ fecha: hoy, xp: user.xp });
  }
  // Limitar a últimos 90 días para no crecer infinito
  if (user.xp_history.length > 90) {
    user.xp_history = user.xp_history.slice(-90);
  }
  return user;
}

// ─── LÍMITES DIARIOS POR ACCIÓN ─────────────────────────────────
const LIMITES_DIARIOS = {
  chat_message: { xp: 10, max_por_dia: 20, max_xp_dia: 100 }, // máx 100 XP/día por chats
  desafio_completado: { xp: 40, max_por_dia: 1 }, // 1 desafío por día
  objetivo_completado: { xp: 60, max_por_dia: 1 }, // 1 objetivo por día
  leccion_ingles: { xp: 30, max_por_dia: 5 }, // máx 5 lecciones de inglés por día
  leccion_mate: { xp: 30, max_por_dia: 5 }, // idem mate
  diario_ingles: { xp: 20, max_por_dia: 1 }, // 1 entrada de diario por día
  viaje_generado: { xp: 20, max_por_dia: 10 },
  viaje_refinado: { xp: 5, max_por_dia: 20 },
  bienestar_generado: { xp: 20, max_por_dia: 10 },
  bienestar_refinado: { xp: 5, max_por_dia: 20 },
  herramienta_usada: { xp: 10, max_por_dia: 10, max_xp_dia: 50 }, // herramientas → máx 50 XP/día
  logo_generado: { xp: 20, max_por_dia: 10 },
};

// ─── HANDLER PRINCIPAL ──────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Auth
  let decoded;
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "No autorizado" });
  }

  const userEmail = decoded.email;
  const { tipo } = req.body || {};

  if (!tipo || !LIMITES_DIARIOS[tipo]) {
    return res.status(400).json({ error: "Tipo de acción inválido" });
  }

  const kv = await getKV();
  const user = await kv.get(`user:${userEmail}`);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const limite = LIMITES_DIARIOS[tipo];
  const hoy = today();

  // ─── VALIDAR LÍMITE DIARIO POR TIPO ─────────────────────
  const counterKey = `action_count:${userEmail}:${tipo}:${hoy}`;
  const usados = (await kv.get(counterKey)) || 0;

  if (usados >= limite.max_por_dia) {
    return res.status(429).json({
      error: `Ya alcanzaste el máximo diario de esta acción (${limite.max_por_dia}). Volvé mañana.`,
      limit_reached: true,
      tipo,
      max_por_dia: limite.max_por_dia,
    });
  }

  // ─── VALIDAR LÍMITE DE XP DIARIO POR CATEGORÍA ──────────
  let xpASumar = limite.xp;
  if (limite.max_xp_dia) {
    const xpHoyKey = `xp_categoria:${userEmail}:${tipo}:${hoy}`;
    const xpYaSumadoHoy = (await kv.get(xpHoyKey)) || 0;
    const xpRestante = limite.max_xp_dia - xpYaSumadoHoy;
    if (xpRestante <= 0) {
      xpASumar = 0; // ya llegó al tope, la acción se permite pero no suma XP
    } else {
      xpASumar = Math.min(limite.xp, xpRestante);
      await kv.set(xpHoyKey, xpYaSumadoHoy + xpASumar, { ex: 86400 });
    }
  }

  // ─── APLICAR LA ACCIÓN ─────────────────────────────────
  // Sumar XP
  user.xp = (user.xp || 0) + xpASumar;

  // Incrementar contador del tipo
  if (tipo === "desafio_completado") {
    user.desafios_completados = (user.desafios_completados || 0) + 1;
  } else if (tipo === "objetivo_completado") {
    user.objetivos_completados = (user.objetivos_completados || 0) + 1;
  }

  // Actualizar racha (solo si sumó XP real, para no inflarla con acciones que no sumaron)
  if (xpASumar > 0) {
    actualizarRacha(user);
    pushXpHistory(user);
  }

  // Desbloquear logros
  desbloquearLogros(user);

  // Guardar usuario
  await kv.set(`user:${userEmail}`, user);

  // Incrementar contador de acción
  await kv.set(counterKey, usados + 1, { ex: 86400 });

  // Devolver el user actualizado (sin password)
  const { password_hash, ...safeUser } = user;
  return res.status(200).json({
    ok: true,
    user: safeUser,
    xp_sumado: xpASumar,
    accion_usada: usados + 1,
    limite_diario: limite.max_por_dia,
  });
}
