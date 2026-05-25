// api/admin.js — Endpoint protegido para administradores
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// 🆕 Imports AFIP para test/generación manual
import { 
  generarFacturaC, 
  guardarFactura,
  listarFacturasUsuario,
  reintentarPendientes 
} from "./_afip-helper.js";
import { enviarFacturaPorEmail } from "./_factura-email.js";

const JWT_SECRET = process.env.JWT_SECRET || "av-mentorai-fixed-secret-2024";

const ADMIN_EMAILS = new Set([
  "valen810a@gmail.com",
]);

const PLANES_VALIDOS = new Set(["Gratis", "Premium", "Empresarial"]);

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

function esAdmin(email) {
  return ADMIN_EMAILS.has((email || "").toLowerCase().trim());
}

async function escanearUsuarios(kv) {
  const lista = [];
  const emails = await kv.get("emails");
  if (Array.isArray(emails) && emails.length > 0) {
    for (const email of emails) {
      const u = await kv.get(`user:${email}`);
      if (u) lista.push(u);
    }
    return lista;
  }
  const keys = [];
  let cursor = 0;
  do {
    const result = await kv.scan(cursor, { match: "user:*", count: 200 });
    cursor = parseInt(result[0], 10);
    keys.push(...result[1]);
  } while (cursor !== 0 && keys.length < 1000);
  for (const key of keys) {
    try { const u = await kv.get(key); if (u) lista.push(u); } catch {}
  }
  return lista;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  let decoded;
  try { decoded = verifyToken(req); }
  catch { return res.status(401).json({ error: "No autorizado" }); }

  if (!esAdmin(decoded.email)) {
    return res.status(403).json({ error: "Solo administradores" });
  }

  const action = req.body?.action || req.query?.action;
  if (!action) return res.status(400).json({ error: "Falta action" });

  const kv = await getKV();

  try {
    // ═══════════════════════════════════════════════════════
    // LISTAR USUARIOS
    // ═══════════════════════════════════════════════════════
    if (action === "usuarios") {
      const usuarios = await escanearUsuarios(kv);
      const lista = usuarios.map(u => ({
        email: u.email,
        nombre: u.nombre || "(sin nombre)",
        plan: u.plan || "Gratis",
        xp: u.xp || 0,
        racha: u.racha || 0,
        baneado: !!u.baneado,
        email_verificado: !!u.email_verificado,
        fecha_nacimiento: u.fecha_nacimiento || null,
        ciudad: u.ciudad || null,
        fecha_creacion: u.fecha_creacion || u.created_at || null,
        ultima_actividad: u.ultima_actividad || u.last_seen || null,
        tiene_suscripcion_mp: !!u.mp_subscription_id,
        plan_otorgado_por_admin: !!u.plan_otorgado_por_admin,
        premium_vence: u.premium_vence || null,
      }));
      lista.sort((a, b) => {
        const da = a.fecha_creacion ? new Date(a.fecha_creacion).getTime() : 0;
        const db = b.fecha_creacion ? new Date(b.fecha_creacion).getTime() : 0;
        return db - da;
      });
      return res.status(200).json({ ok: true, total: lista.length, usuarios: lista });
    }

    // ═══════════════════════════════════════════════════════
    // STATS
    // ═══════════════════════════════════════════════════════
    if (action === "stats") {
      const usuarios = await escanearUsuarios(kv);
      let premium = 0, gratis = 0, empresarial = 0;
      let activos7d = 0, activos30d = 0, baneados = 0, verificados = 0;
      let nuevos_7d = 0;
      const ahora = Date.now();
      const dia7 = 7 * 24 * 60 * 60 * 1000;
      const dia30 = 30 * 24 * 60 * 60 * 1000;
      for (const u of usuarios) {
        const plan = u.plan || "Gratis";
        if (plan === "Premium") premium++;
        else if (plan === "Empresarial") empresarial++;
        else gratis++;
        if (u.baneado) baneados++;
        if (u.email_verificado) verificados++;
        const ult = u.ultima_actividad || u.last_seen;
        if (ult) {
          const diff = ahora - new Date(ult).getTime();
          if (diff < dia7) activos7d++;
          if (diff < dia30) activos30d++;
        }
        const fc = u.fecha_creacion || u.created_at;
        if (fc && (ahora - new Date(fc).getTime() < dia7)) nuevos_7d++;
      }
      const total = usuarios.length;
      const ingresos_estimados_mensual = premium * 8000;
      return res.status(200).json({
        ok: true,
        stats: {
          total,
          plan: { gratis, premium, empresarial },
          actividad: { activos_7d: activos7d, activos_30d: activos30d },
          baneados,
          email_verificados: verificados,
          nuevos_7d,
          conversion_premium: total > 0 ? Math.round((premium / total) * 100) : 0,
          ingresos_estimados_mensual_ars: ingresos_estimados_mensual,
        },
      });
    }

    // ═══════════════════════════════════════════════════════
    // 🔥 CAMBIAR PLAN — FIX: ahora setea TODOS los campos necesarios
    // ═══════════════════════════════════════════════════════
    if (action === "cambiar_plan") {
      const { email_objetivo, nuevo_plan } = req.body || {};
      if (!email_objetivo || !nuevo_plan) {
        return res.status(400).json({ error: "Faltan email_objetivo y nuevo_plan" });
      }
      if (!PLANES_VALIDOS.has(nuevo_plan)) {
        return res.status(400).json({ error: `Plan inválido. Válidos: ${Array.from(PLANES_VALIDOS).join(", ")}` });
      }
      const emailNorm = String(email_objetivo).toLowerCase().trim();
      const userKey = `user:${emailNorm}`;
      const usuario = await kv.get(userKey);
      if (!usuario) return res.status(404).json({ error: `Usuario "${emailNorm}" no encontrado` });

      const planAnterior = usuario.plan || "Gratis";

      // ✅ CAMBIO PRINCIPAL: setear el plan
      usuario.plan = nuevo_plan;

      // ✨ FIX: campos adicionales para que Premium funcione REAL
      if (nuevo_plan === "Premium" || nuevo_plan === "Empresarial") {
        // Si admin lo está dando Premium gratis (no por Mercado Pago)
        usuario.plan_otorgado_por_admin = true;
        usuario.plan_otorgado_por_admin_en = new Date().toISOString();
        usuario.plan_otorgado_por_admin_email = decoded.email;

        // Setear fecha de vencimiento (1 año por defecto si admin lo da)
        const unAno = new Date();
        unAno.setFullYear(unAno.getFullYear() + 1);
        usuario.premium_vence = unAno.toISOString();

        // Si no tiene suscripción MP real, marcar como manual
        if (!usuario.mp_subscription_id) {
          usuario.mp_subscription_status = "manual_admin";
        }

        // Limpiar campos que podrían bloquear funciones premium
        usuario.suscripcion_cancelada = false;
        usuario.suscripcion_cancelada_en = null;
      } else if (nuevo_plan === "Gratis") {
        // Al volver a Gratis, limpiamos los flags de premium
        usuario.plan_otorgado_por_admin = false;
        usuario.premium_vence = null;
        // Si era admin manual, marcamos como cancelado por admin
        if (usuario.mp_subscription_status === "manual_admin") {
          usuario.mp_subscription_status = "cancelled_by_admin";
        }
      }

      // Auditoría
      usuario.plan_modificado_por = decoded.email;
      usuario.plan_modificado_en = new Date().toISOString();
      usuario.plan_anterior = planAnterior;

      await kv.set(userKey, usuario);

      // ✨ INVALIDAR cache/sesión del usuario afectado
      // Marcar que necesita refrescar al próximo login/request
      try {
        await kv.set(`user_needs_refresh:${emailNorm}`, "1", { ex: 86400 });
      } catch (e) {}

      return res.status(200).json({
        ok: true,
        mensaje: `Plan de ${emailNorm} cambiado de "${planAnterior}" a "${nuevo_plan}"`,
        aviso: nuevo_plan !== planAnterior
          ? `⚠️ El usuario debe cerrar sesión y volver a entrar (o recargar la página con F5) para que se aplique el nuevo plan.`
          : "Sin cambios",
        usuario: {
          email: emailNorm,
          plan: nuevo_plan,
          nombre: usuario.nombre,
          premium_vence: usuario.premium_vence || null,
          plan_otorgado_por_admin: !!usuario.plan_otorgado_por_admin,
        },
      });
    }

    // ═══════════════════════════════════════════════════════
    // BUSCAR USUARIO
    // ═══════════════════════════════════════════════════════
    if (action === "buscar_usuario") {
      const { email_objetivo } = req.body || {};
      if (!email_objetivo) return res.status(400).json({ error: "Falta email_objetivo" });
      const emailNorm = String(email_objetivo).toLowerCase().trim();
      const usuario = await kv.get(`user:${emailNorm}`);
      if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
      const { password_hash, reset_token, codigo_verif, ...resto } = usuario;
      return res.status(200).json({ ok: true, usuario: resto });
    }

    // ═══════════════════════════════════════════════════════
    // BANEAR
    // ═══════════════════════════════════════════════════════
    if (action === "banear") {
      const { email_objetivo, estado } = req.body || {};
      if (!email_objetivo) return res.status(400).json({ error: "Falta email_objetivo" });
      const emailNorm = String(email_objetivo).toLowerCase().trim();
      if (ADMIN_EMAILS.has(emailNorm)) {
        return res.status(400).json({ error: "No podés banear a otro admin" });
      }
      const usuario = await kv.get(`user:${emailNorm}`);
      if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
      const baneadoNuevo = estado === undefined ? !usuario.baneado : !!estado;
      usuario.baneado = baneadoNuevo;
      usuario.baneado_por = decoded.email;
      usuario.baneado_en = new Date().toISOString();
      await kv.set(`user:${emailNorm}`, usuario);
      return res.status(200).json({
        ok: true,
        mensaje: baneadoNuevo ? `Usuario ${emailNorm} baneado` : `Usuario ${emailNorm} desbaneado`,
        baneado: baneadoNuevo,
      });
    }

    // ═══════════════════════════════════════════════════════
    // ELIMINAR USUARIO
    // ═══════════════════════════════════════════════════════
    if (action === "eliminar_usuario") {
      const { email_objetivo, confirmar } = req.body || {};
      if (!email_objetivo) return res.status(400).json({ error: "Falta email_objetivo" });
      if (confirmar !== "SI_ELIMINAR") {
        return res.status(400).json({ error: "Falta confirmar='SI_ELIMINAR'" });
      }
      const emailNorm = String(email_objetivo).toLowerCase().trim();
      if (ADMIN_EMAILS.has(emailNorm)) {
        return res.status(400).json({ error: "No podés eliminar a otro admin" });
      }
      const usuario = await kv.get(`user:${emailNorm}`);
      if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
      await kv.del(`user:${emailNorm}`);
      const emails = (await kv.get("emails")) || [];
      const nuevoEmails = emails.filter(e => e !== emailNorm);
      await kv.set("emails", nuevoEmails);
      return res.status(200).json({ ok: true, mensaje: `Usuario ${emailNorm} eliminado` });
    }

    // ═══════════════════════════════════════════════════════
    // RESETEAR PASS
    // ═══════════════════════════════════════════════════════
    if (action === "resetear_pass") {
      const { email_objetivo } = req.body || {};
      if (!email_objetivo) return res.status(400).json({ error: "Falta email_objetivo" });
      const emailNorm = String(email_objetivo).toLowerCase().trim();
      const usuario = await kv.get(`user:${emailNorm}`);
      if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
      const passTemp = Math.random().toString(36).slice(-10) + "A1!";
      usuario.password_hash = await bcrypt.hash(passTemp, 10);
      usuario.pass_reseteado_por = decoded.email;
      usuario.pass_reseteado_en = new Date().toISOString();
      await kv.set(`user:${emailNorm}`, usuario);
      return res.status(200).json({
        ok: true,
        mensaje: `Contraseña reseteada`,
        password_temporal: passTemp,
      });
    }

    // ═══════════════════════════════════════════════════════
    // PAGOS
    // ═══════════════════════════════════════════════════════
    if (action === "pagos") {
      const usuarios = await escanearUsuarios(kv);
      const pagos = [];
      for (const u of usuarios) {
        if (u.mp_subscription_id) {
          pagos.push({
            email: u.email,
            nombre: u.nombre,
            subscription_id: u.mp_subscription_id,
            status: u.mp_subscription_status || "unknown",
            plan: u.plan,
            creado: u.mp_subscription_created_at || null,
            premium_vence: u.premium_vence || null,
          });
        }
      }
      pagos.sort((a, b) => {
        const da = a.creado ? new Date(a.creado).getTime() : 0;
        const db = b.creado ? new Date(b.creado).getTime() : 0;
        return db - da;
      });
      return res.status(200).json({ ok: true, total: pagos.length, pagos });
    }

    // ═══════════════════════════════════════════════════════
    // EXPORTAR CSV
    // ═══════════════════════════════════════════════════════
    if (action === "exportar_csv") {
      const usuarios = await escanearUsuarios(kv);
      const headers = ["email","nombre","plan","xp","racha","ciudad","fecha_nacimiento","email_verificado","baneado","fecha_creacion","ultima_actividad"];
      const rows = [headers.join(",")];
      for (const u of usuarios) {
        const row = [
          u.email || "",
          (u.nombre || "").replace(/,/g, " "),
          u.plan || "Gratis",
          u.xp || 0,
          u.racha || 0,
          (u.ciudad || "").replace(/,/g, " "),
          u.fecha_nacimiento || "",
          u.email_verificado ? "si" : "no",
          u.baneado ? "si" : "no",
          u.fecha_creacion || "",
          u.ultima_actividad || "",
        ];
        rows.push(row.join(","));
      }
      const csv = rows.join("\n");
      return res.status(200).json({ ok: true, csv, total: usuarios.length });
    }

    // ═══════════════════════════════════════════════════════
    // GASTO Y CAP
    // ═══════════════════════════════════════════════════════
    if (action === "gasto") {
      const today = new Date().toISOString().split("T")[0];
      const capActual = parseFloat(await kv.get("system_cap_usd") || "10");
      const gastoHoy = parseFloat(await kv.get(`system_spent:${today}`) || "0");
      const dias = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split("T")[0];
        const monto = parseFloat(await kv.get(`system_spent:${dStr}`) || "0");
        dias.push({ fecha: dStr, gasto: monto });
      }
      return res.status(200).json({
        ok: true,
        gasto_hoy: gastoHoy,
        cap_actual: capActual,
        porcentaje_usado: capActual > 0 ? (gastoHoy / capActual) * 100 : 0,
        dias_recientes: dias,
        bloqueado: gastoHoy >= capActual,
      });
    }

    if (action === "set_cap") {
      const nuevoCap = parseFloat((req.body && req.body.cap) || "10");
      if (isNaN(nuevoCap) || nuevoCap < 1 || nuevoCap > 1000) {
        return res.status(400).json({ error: "El cap debe estar entre $1 y $1000 USD" });
      }
      await kv.set("system_cap_usd", nuevoCap.toString());
      return res.status(200).json({
        ok: true,
        message: `Cap actualizado a $${nuevoCap} USD/día`,
        cap_actual: nuevoCap,
      });
    }

    if (action === "reset_gasto") {
      const today = new Date().toISOString().split("T")[0];
      await kv.set(`system_spent:${today}`, "0", { ex: 172800 });
      return res.status(200).json({
        ok: true,
        message: "Contador de gasto del día reseteado a $0",
      });
    }

    // ═══════════════════════════════════════════════════════
    // 🆕 AFIP / FACTURACIÓN
    // ═══════════════════════════════════════════════════════

    if (action === "test_afip_factura") {
      const emailDestino = req.body?.email_destino || decoded.email;
      const importe = parseFloat(req.body?.importe || 8000);

      console.log(`[ADMIN] Test factura AFIP solicitado para ${emailDestino}, importe ${importe}`);

      try {
        const factura = await generarFacturaC({
          importe,
          emailCliente: emailDestino,
          nombreCliente: "Test AVAI (Homologación)",
          concepto: "Prueba de facturación electrónica",
          mpPaymentId: `test-${Date.now()}`,
        });

        await guardarFactura(factura);

        const emailResult = await enviarFacturaPorEmail(factura);

        return res.status(200).json({
          ok: true,
          mensaje: "Factura de prueba generada exitosamente",
          factura: {
            numero: factura.numero,
            puntoVenta: factura.puntoVenta,
            cae: factura.cae,
            caeVencimiento: factura.caeVencimiento,
            importe: factura.importe,
            tipo: factura.tipo,
            production: factura.production,
            emailCliente: factura.emailCliente,
          },
          email_enviado: emailResult.ok,
          email_error: emailResult.ok ? null : emailResult.error,
        });

      } catch (err) {
        console.error("[ADMIN] Error en test_afip_factura:", err);
        return res.status(500).json({
          ok: false,
          error: err.message || "Error generando factura",
          stack: err.stack?.split("\n").slice(0, 5).join("\n"),
        });
      }
    }

    if (action === "facturas_usuario") {
      const emailObjetivo = req.body?.email_objetivo;
      if (!emailObjetivo) return res.status(400).json({ error: "Falta email_objetivo" });

      try {
        const facturas = await listarFacturasUsuario(emailObjetivo);
        return res.status(200).json({
          ok: true,
          email: emailObjetivo.toLowerCase().trim(),
          total: facturas.length,
          facturas,
        });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (action === "reintentar_pendientes") {
      try {
        const resultado = await reintentarPendientes();
        return res.status(200).json({
          ok: true,
          mensaje: `Procesadas ${resultado.total} pendientes. Exitosas: ${resultado.exitosas}, Fallidas: ${resultado.fallidas}`,
          resultado,
        });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (action === "afip_status") {
      return res.status(200).json({
        ok: true,
        config: {
          cuit_configurado: !!process.env.AFIP_CUIT,
          punto_venta: parseInt(process.env.AFIP_PUNTO_VENTA || "0", 10),
          production: process.env.AFIP_PRODUCTION === "true",
          cert_configurado: !!process.env.AFIP_CERT && process.env.AFIP_CERT.length > 100,
          key_configurado: !!process.env.AFIP_KEY && process.env.AFIP_KEY.length > 100,
          resend_configurado: !!process.env.RESEND_API_KEY,
        },
      });
    }

    return res.status(400).json({ error: `Acción desconocida: ${action}` });
  } catch (err) {
    console.error("Error en admin:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
}
