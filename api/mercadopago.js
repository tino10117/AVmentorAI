// api/mercadopago.js — Integración con Mercado Pago Suscripciones
// 4 funcionalidades en un solo archivo:
//   1. action="crear_suscripcion"   → genera link de pago (con JWT auth)
//   2. action="estado_suscripcion"  → devuelve estado del Premium (con JWT auth)
//   3. action="cancelar_suscripcion"→ el user cancela (con JWT auth)
//   4. Webhook público (sin auth)   → MP nos avisa de pagos

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "av-mentorai-fixed-secret-2024";

// ─── CONFIG MP ──────────────────────────────────────────────────
const MP_MODE = process.env.MP_MODE || "test"; // "test" o "prod"
const MP_ACCESS_TOKEN = MP_MODE === "prod"
  ? process.env.MP_ACCESS_TOKEN_PROD
  : process.env.MP_ACCESS_TOKEN_TEST;
const MP_API_BASE = "https://api.mercadopago.com";

// Precio del plan Premium en ARS
const PREMIUM_PRICE = 8000;
const PREMIUM_CURRENCY = "ARS";
const PREMIUM_FREQUENCY = 1;      // cada 1 mes
const PREMIUM_FREQUENCY_TYPE = "months";

// URL base de la app (cambia según el dominio que esté funcionando)
function getAppUrl(req) {
  // Si avai.ar ya propagó, usamos ese. Si no, fallback a vercel.app
  const host = req.headers.host || "";
  if (host.includes("avai.ar")) return "https://avai.ar";
  return "https://a-vmentor-ai.vercel.app";
}

// ─── KV Helper ──────────────────────────────────────────────────
async function getKV() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

// ─── JWT Helper ─────────────────────────────────────────────────
function verifyToken(req) {
  const auth = req.headers.authorization || "";
  const token = auth.replace("Bearer ", "");
  if (!token) throw new Error("No token");
  return jwt.verify(token, JWT_SECRET);
}

// ─── MP API Helper ──────────────────────────────────────────────
async function mpFetch(path, options = {}) {
  if (!MP_ACCESS_TOKEN) {
    throw new Error("MP_ACCESS_TOKEN no configurado");
  }
  const resp = await fetch(MP_API_BASE + path, {
    ...options,
    headers: {
      "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await resp.json();
  if (!resp.ok) {
    console.error("MP Error:", resp.status, data);
    throw new Error(data.message || `MP error ${resp.status}`);
  }
  return data;
}

// ═══════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ─────────────────────────────────────────────────────────────
  // WEBHOOK (sin auth, MP lo llama desde sus servidores)
  // ─────────────────────────────────────────────────────────────
  // MP nos llama a: POST /api/mercadopago?type=subscription_preapproval&id=XXX
  // O también: POST con body { type, data: { id } }
  if (req.method === "POST" && !req.body?.action) {
    return handleWebhook(req, res);
  }

  if (req.method === "GET") {
    return handleWebhook(req, res);
  }

  // ─────────────────────────────────────────────────────────────
  // ENDPOINTS CON AUTH (frontend nos llama con JWT)
  // ─────────────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let decoded;
  try { decoded = verifyToken(req); }
  catch { return res.status(401).json({ error: "No autorizado" }); }

  const action = req.body?.action;

  try {
    if (action === "crear_suscripcion") {
      return await crearSuscripcion(req, res, decoded);
    }
    if (action === "estado_suscripcion") {
      return await estadoSuscripcion(req, res, decoded);
    }
    if (action === "cancelar_suscripcion") {
      return await cancelarSuscripcion(req, res, decoded);
    }
    return res.status(400).json({ error: `Acción desconocida: ${action}` });
  } catch (err) {
    console.error("Error MP:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. CREAR SUSCRIPCIÓN — devuelve link de pago de MP
// ═══════════════════════════════════════════════════════════════
async function crearSuscripcion(req, res, decoded) {
  const kv = await getKV();
  const userKey = `user:${decoded.email}`;
  const user = await kv.get(userKey);

  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  // Si ya tiene una suscripción activa, no crear otra
  if (user.mp_subscription_id && user.plan === "Premium") {
    return res.status(400).json({
      error: "Ya tenés una suscripción Premium activa. Si querés cancelarla, andá a Configuración."
    });
  }

  const appUrl = getAppUrl(req);

  // Crear "preapproval" en MP (suscripción sin plan asociado, Opción A)
  const preapprovalBody = {
    reason: "AVAI Premium - Suscripción Mensual",
    auto_recurring: {
      frequency: PREMIUM_FREQUENCY,
      frequency_type: PREMIUM_FREQUENCY_TYPE,
      transaction_amount: PREMIUM_PRICE,
      currency_id: PREMIUM_CURRENCY,
    },
    back_url: `${appUrl}/pago-exitoso.html`,
    external_reference: decoded.email,  // así sabemos qué user es en el webhook
    payer_email: decoded.email,         // el email del que paga
    status: "pending",
  };

  const preapproval = await mpFetch("/preapproval", {
    method: "POST",
    body: JSON.stringify(preapprovalBody),
  });

  // Guardar el ID en el usuario (no Premium aún, hasta que MP confirme el pago)
  user.mp_subscription_id = preapproval.id;
  user.mp_subscription_status = "pending";
  user.mp_subscription_created_at = new Date().toISOString();
  await kv.set(userKey, user);

  return res.status(200).json({
    ok: true,
    init_point: preapproval.init_point,    // URL a la que redirigir al user
    subscription_id: preapproval.id,
  });
}

// ═══════════════════════════════════════════════════════════════
// 2. ESTADO DE SUSCRIPCIÓN
// ═══════════════════════════════════════════════════════════════
async function estadoSuscripcion(req, res, decoded) {
  // SAFE: nunca tira 500. Si algo falla, devolvemos "sin suscripción"
  try {
    const kv = await getKV();
    const userKey = `user:${decoded.email}`;
    const user = await kv.get(userKey);

    // Si no hay user en KV, devolvemos estado por defecto (Gratis, sin suscripción)
    if (!user) {
      return res.status(200).json({
        ok: true,
        tiene_suscripcion: false,
        plan: "Gratis",
      });
    }

    const subId = user.mp_subscription_id;
    if (!subId) {
      return res.status(200).json({
        ok: true,
        tiene_suscripcion: false,
        plan: user.plan || "Gratis",
      });
    }

    // Consultar el estado actual en MP (si falla, usamos datos locales)
    let mpData = null;
    try {
      mpData = await mpFetch(`/preapproval/${subId}`);
    } catch (e) {
      console.warn("No se pudo consultar MP, usamos datos locales:", e.message);
    }

    return res.status(200).json({
      ok: true,
      tiene_suscripcion: true,
      plan: user.plan || "Gratis",
      subscription_id: subId,
      status: mpData?.status || user.mp_subscription_status || "unknown",
      next_payment_date: mpData?.next_payment_date || user.premium_vence || null,
      amount: PREMIUM_PRICE,
      currency: PREMIUM_CURRENCY,
    });
  } catch (err) {
    // SAFETY NET: cualquier error en KV o lo que sea, devolvemos estado vacío
    // Mejor que un 500 que rompa el frontend
    console.error("Error en estadoSuscripcion:", err);
    return res.status(200).json({
      ok: true,
      tiene_suscripcion: false,
      plan: "Gratis",
      error_internal: err.message,
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. CANCELAR SUSCRIPCIÓN
// ═══════════════════════════════════════════════════════════════
async function cancelarSuscripcion(req, res, decoded) {
  const kv = await getKV();
  const userKey = `user:${decoded.email}`;
  const user = await kv.get(userKey);

  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const subId = user.mp_subscription_id;
  if (!subId) {
    return res.status(400).json({ error: "No tenés una suscripción activa" });
  }

  // Cancelar en MP
  await mpFetch(`/preapproval/${subId}`, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled" }),
  });

  // Marcar localmente (mantenemos Premium hasta que venza el período pago)
  user.mp_subscription_status = "cancelled";
  user.mp_subscription_cancelled_at = new Date().toISOString();
  // NO bajamos el plan a Gratis acá: el user tiene Premium hasta premium_vence
  await kv.set(userKey, user);

  return res.status(200).json({
    ok: true,
    message: "Suscripción cancelada. Mantenés Premium hasta el final del período pago.",
  });
}

// ═══════════════════════════════════════════════════════════════
// 4. WEBHOOK — MP nos avisa de cambios
// ═══════════════════════════════════════════════════════════════
async function handleWebhook(req, res) {
  try {
    // MP puede mandar la info de 2 formas:
    // a) Query params: ?type=X&id=Y
    // b) Body JSON: { type, data: { id } }
    const type = req.query?.type || req.body?.type || req.body?.action;
    const id =
      req.query?.id ||
      req.query?.["data.id"] ||
      req.body?.data?.id ||
      req.body?.id;

    console.log("Webhook recibido:", { type, id, query: req.query, body: req.body });

    if (!type || !id) {
      // MP a veces hace "ping" sin datos para verificar que el endpoint existe
      return res.status(200).json({ ok: true, message: "Webhook recibido (sin datos)" });
    }

    // ─── EVENTO: cambios en la suscripción ────────────────────
    if (type === "subscription_preapproval" || type === "preapproval") {
      await procesarPreapproval(id);
    }

    // ─── EVENTO: cobro autorizado (mensual) ───────────────────
    if (type === "subscription_authorized_payment" || type === "authorized_payment") {
      await procesarPagoAutorizado(id);
    }

    // Siempre respondemos 200 OK rápido a MP (sino reintenta)
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error en webhook:", err);
    // IMPORTANTE: igual devolvemos 200 para que MP no retire
    return res.status(200).json({ ok: false, error: err.message });
  }
}

// Procesar evento "preapproval" — cambios en la suscripción
async function procesarPreapproval(preapprovalId) {
  const kv = await getKV();
  const preapproval = await mpFetch(`/preapproval/${preapprovalId}`);

  const email = preapproval.external_reference;
  if (!email) {
    console.warn("Preapproval sin external_reference:", preapprovalId);
    return;
  }

  const userKey = `user:${email.toLowerCase().trim()}`;
  const user = await kv.get(userKey);
  if (!user) {
    console.warn("Usuario no encontrado para preapproval:", email);
    return;
  }

  user.mp_subscription_id = preapproval.id;
  user.mp_subscription_status = preapproval.status;
  user.mp_subscription_updated_at = new Date().toISOString();

  // ─── Activar/desactivar Premium según status ───
  if (preapproval.status === "authorized") {
    // Suscripción activa → Premium ON
    user.plan = "Premium";
    const nextDate = preapproval.next_payment_date
      ? new Date(preapproval.next_payment_date)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    user.premium_vence = nextDate.toISOString();
    user.premium_activated_at = user.premium_activated_at || new Date().toISOString();
  } else if (preapproval.status === "cancelled") {
    // Cancelada → mantener Premium hasta que venza el período actual
    user.mp_subscription_status = "cancelled";
    // NO cambiamos user.plan acá (eso lo hace un cron job o cuando intenta usar Premium después de vencido)
  } else if (preapproval.status === "paused") {
    user.mp_subscription_status = "paused";
  }

  await kv.set(userKey, user);
  console.log(`Premium actualizado para ${email}: status=${preapproval.status}`);
}

// Procesar evento "authorized_payment" — un cobro mensual exitoso
async function procesarPagoAutorizado(paymentId) {
  const kv = await getKV();
  const payment = await mpFetch(`/authorized_payments/${paymentId}`);

  const preapprovalId = payment.preapproval_id;
  if (!preapprovalId) return;

  // Buscar el preapproval para sacar el email
  const preapproval = await mpFetch(`/preapproval/${preapprovalId}`);
  const email = preapproval.external_reference;
  if (!email) return;

  const userKey = `user:${email.toLowerCase().trim()}`;
  const user = await kv.get(userKey);
  if (!user) return;

  // Si el cobro fue aprobado → extender 30 días el Premium
  if (payment.status === "approved") {
    user.plan = "Premium";
    const ahora = new Date();
    const venceActual = user.premium_vence ? new Date(user.premium_vence) : ahora;
    // Si todavía no venció, extender desde la fecha de vencimiento
    // Si ya venció, extender desde hoy
    const base = venceActual > ahora ? venceActual : ahora;
    user.premium_vence = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    user.ultimo_pago_at = ahora.toISOString();
    user.pagos_realizados = (user.pagos_realizados || 0) + 1;
    await kv.set(userKey, user);
    console.log(`Pago aprobado para ${email}. Premium hasta ${user.premium_vence}`);
  }
}
