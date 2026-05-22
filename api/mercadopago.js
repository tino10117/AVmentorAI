// api/mercadopago.js — Integración con Mercado Pago Suscripciones + AFIP
// 4 funcionalidades en un solo archivo:
//   1. action="crear_suscripcion"   → genera link de pago (con JWT auth)
//   2. action="estado_suscripcion"  → devuelve estado del Premium (con JWT auth)
//   3. action="cancelar_suscripcion"→ el user cancela (con JWT auth)
//   4. Webhook público (sin auth)   → MP nos avisa de pagos + AFIP factura

import jwt from "jsonwebtoken";

// 🆕 NUEVO: Importar helpers de AFIP
import { 
  generarFacturaC, 
  guardarFactura, 
  marcarFacturaPendiente 
} from "./_afip-helper.js";
import { 
  enviarFacturaPorEmail, 
  notificarAdminError 
} from "./_factura-email.js";

const JWT_SECRET = process.env.JWT_SECRET || "av-mentorai-fixed-secret-2024";

// ─── CONFIG MP ──────────────────────────────────────────────────
const MP_MODE = process.env.MP_MODE || "test";
const MP_ACCESS_TOKEN = MP_MODE === "prod"
  ? process.env.MP_ACCESS_TOKEN_PROD
  : process.env.MP_ACCESS_TOKEN_TEST;
const MP_API_BASE = "https://api.mercadopago.com";

const PREMIUM_PRICE = 8000;
const PREMIUM_CURRENCY = "ARS";
const PREMIUM_FREQUENCY = 1;
const PREMIUM_FREQUENCY_TYPE = "months";

function getAppUrl(req) {
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

  if (req.method === "POST" && !req.body?.action) {
    return handleWebhook(req, res);
  }
  if (req.method === "GET") {
    return handleWebhook(req, res);
  }

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
// 1. CREAR SUSCRIPCIÓN
// ═══════════════════════════════════════════════════════════════
async function crearSuscripcion(req, res, decoded) {
  const kv = await getKV();
  const userKey = `user:${decoded.email}`;
  const user = await kv.get(userKey);

  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  if (user.mp_subscription_id && user.plan === "Premium") {
    return res.status(400).json({
      error: "Ya tenés una suscripción Premium activa. Si querés cancelarla, andá a Configuración."
    });
  }

  const appUrl = getAppUrl(req);

  const preapprovalBody = {
    reason: "AVAI Premium - Suscripción Mensual",
    auto_recurring: {
      frequency: PREMIUM_FREQUENCY,
      frequency_type: PREMIUM_FREQUENCY_TYPE,
      transaction_amount: PREMIUM_PRICE,
      currency_id: PREMIUM_CURRENCY,
    },
    back_url: `${appUrl}/pago-exitoso.html`,
    external_reference: decoded.email,
    payer_email: decoded.email,
    status: "pending",
  };

  const preapproval = await mpFetch("/preapproval", {
    method: "POST",
    body: JSON.stringify(preapprovalBody),
  });

  user.mp_subscription_id = preapproval.id;
  user.mp_subscription_status = "pending";
  user.mp_subscription_created_at = new Date().toISOString();
  await kv.set(userKey, user);

  return res.status(200).json({
    ok: true,
    init_point: preapproval.init_point,
    subscription_id: preapproval.id,
  });
}

// ═══════════════════════════════════════════════════════════════
// 2. ESTADO DE SUSCRIPCIÓN
// ═══════════════════════════════════════════════════════════════
async function estadoSuscripcion(req, res, decoded) {
  try {
    const kv = await getKV();
    const userKey = `user:${decoded.email}`;
    const user = await kv.get(userKey);

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

  await mpFetch(`/preapproval/${subId}`, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled" }),
  });

  user.mp_subscription_status = "cancelled";
  user.mp_subscription_cancelled_at = new Date().toISOString();
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
    const type = req.query?.type || req.body?.type || req.body?.action;
    const id =
      req.query?.id ||
      req.query?.["data.id"] ||
      req.body?.data?.id ||
      req.body?.id;

    console.log("Webhook recibido:", { type, id, query: req.query, body: req.body });

    if (!type || !id) {
      return res.status(200).json({ ok: true, message: "Webhook recibido (sin datos)" });
    }

    if (type === "subscription_preapproval" || type === "preapproval") {
      await procesarPreapproval(id);
    }

    if (type === "subscription_authorized_payment" || type === "authorized_payment") {
      await procesarPagoAutorizado(id);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error en webhook:", err);
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

  if (preapproval.status === "authorized") {
    user.plan = "Premium";
    const nextDate = preapproval.next_payment_date
      ? new Date(preapproval.next_payment_date)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    user.premium_vence = nextDate.toISOString();
    user.premium_activated_at = user.premium_activated_at || new Date().toISOString();
  } else if (preapproval.status === "cancelled") {
    user.mp_subscription_status = "cancelled";
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
    const base = venceActual > ahora ? venceActual : ahora;
    user.premium_vence = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    user.ultimo_pago_at = ahora.toISOString();
    user.pagos_realizados = (user.pagos_realizados || 0) + 1;
    await kv.set(userKey, user);

    console.log(`Pago aprobado para ${email}. Premium hasta ${user.premium_vence}`);

    // 🆕 NUEVO: GENERAR FACTURA AFIP AUTOMÁTICAMENTE
    await generarYEnviarFactura({
      email,
      nombreCliente: user.name || user.email || "Consumidor Final",
      importe: payment.transaction_amount || PREMIUM_PRICE,
      mpPaymentId: paymentId,
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// 🆕 NUEVO: GENERAR Y ENVIAR FACTURA (con retry tolerante)
// ═══════════════════════════════════════════════════════════════
async function generarYEnviarFactura({ email, nombreCliente, importe, mpPaymentId }) {
  console.log(`Iniciando facturación AFIP para ${email}, MP payment ${mpPaymentId}`);

  try {
    // 1. Generar factura en AFIP
    const factura = await generarFacturaC({
      importe,
      emailCliente: email,
      nombreCliente,
      concepto: "AVAI Premium - Suscripción Mensual",
      mpPaymentId,
    });

    // 2. Guardar en Redis
    await guardarFactura(factura);

    // 3. Enviar por email al cliente (no bloqueante)
    enviarFacturaPorEmail(factura).catch(emailErr => {
      console.error(`Email factura falló para ${email}, factura igual generada:`, emailErr);
      notificarAdminError(emailErr, { 
        contexto: "Email factura", 
        email, 
        facturaNumero: factura.numero 
      }).catch(() => {});
    });

    console.log(`✅ Factura completa para ${email}: número ${factura.numero}, CAE ${factura.cae}`);
    return { ok: true, factura };

  } catch (err) {
    // AFIP falló → guardar como pendiente para reintentar después
    console.error(`Error generando factura AFIP para ${email}:`, err);

    try {
      await marcarFacturaPendiente({
        email,
        importe,
        mpPaymentId,
        errorMsg: err.message || String(err),
      });
    } catch (saveErr) {
      console.error("Error guardando factura pendiente:", saveErr);
    }

    // Notificar al admin (no bloqueante)
    notificarAdminError(err, {
      contexto: "Generación factura AFIP",
      email,
      importe,
      mpPaymentId,
    }).catch(() => {});

    // NO LANZAMOS EL ERROR — el user ya pagó y es Premium
    // La factura se reintenta después
    return { ok: false, error: err.message };
  }
}
