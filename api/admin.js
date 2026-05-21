// api/admin.js — Endpoint protegido para administradores

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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
    // LISTAR USUARIOS
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
      }));
      lista.sort((a, b) => {
        const da = a.fecha_creacion ? new Date(a.fecha_creacion).getTime() : 0;
        const db = b.fecha_creacion ? new Date(b.fecha_creacion).getTime() : 0;
        return db - da;
      });
      return res.status(200).json({ ok: true, total: lista.length, usuarios: lista });
    }

    // STATS
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

    // CAMBIAR PLAN
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
      usuario.plan = nuevo_plan;
      usuario.plan_modificado_por = decoded.email;
      usuario.plan_modificado_en = new Date().toISOString();
      await kv.set(userKey, usuario);

      return res.status(200).json({
        ok: true,
        mensaje: `Plan de ${emailNorm} cambiado de "${planAnterior}" a "${nuevo_plan}"`,
        usuario: { email: emailNorm, plan: nuevo_plan, nombre: usuario.nombre },
      });
    }

    // BUSCAR USUARIO
    if (action === "buscar_usuario") {
      const { email_objetivo } = req.body || {};
      if (!email_objetivo) return res.status(400).json({ error: "Falta email_objetivo" });
      const emailNorm = String(email_objetivo).toLowerCase().trim();
      const usuario = await kv.get(`user:${emailNorm}`);
      if (!usuario) return res.status(404).json({ error: "Usuario no encontrado" });
      const { password_hash, reset_token, codigo_verif, ...resto } = usuario;
      return res.status(200).json({ ok: true, usuario: resto });
    }

    // BANEAR
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

    // ELIMINAR USUARIO
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

    // RESETEAR PASS
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

    // PAGOS
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

    // EXPORTAR CSV
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

    // GASTO Y CAP (preservado)
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

    return res.status(400).json({ error: `Acción desconocida: ${action}` });

  } catch (err) {
    console.error("Error en admin:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
}
