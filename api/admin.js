// api/admin.js — Endpoint protegido para administradores
// Solo accesible para emails en ADMIN_EMAILS.
// Permite: listar usuarios, ver estadísticas, cambiar plan de usuarios.

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "av-mentorai-fixed-secret-2024";

// ─── ADMINS HARDCODED ───────────────────────────────────────────
// Si querés sumar más admins, agregalos acá (en minúsculas).
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

// ─── HANDLER ────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ─── AUTH ─────────────────────────────────────────
  let decoded;
  try {
    decoded = verifyToken(req);
  } catch {
    return res.status(401).json({ error: "No autorizado" });
  }

  if (!esAdmin(decoded.email)) {
    return res.status(403).json({ error: "Solo administradores" });
  }

  const action = req.body?.action || req.query?.action;

  if (!action) {
    return res.status(400).json({ error: "Falta action" });
  }

  const kv = await getKV();

  try {
    // ─── LISTAR USUARIOS ──────────────────────────────
    if (action === "usuarios") {
      // Buscar todas las keys que empiezan con "user:"
      const keys = [];
      let cursor = 0;
      do {
        const result = await kv.scan(cursor, { match: "user:*", count: 200 });
        cursor = parseInt(result[0], 10);
        keys.push(...result[1]);
      } while (cursor !== 0 && keys.length < 1000);

      const usuarios = [];
      for (const key of keys) {
        try {
          const u = await kv.get(key);
          if (!u) continue;
          usuarios.push({
            email: u.email || key.replace("user:", ""),
            nombre: u.nombre || "(sin nombre)",
            plan: u.plan || "Gratis",
            xp: u.xp || 0,
            racha: u.racha || 0,
            fecha_creacion: u.fecha_creacion || u.created_at || null,
            ultima_actividad: u.ultima_actividad || u.last_seen || null,
            modos_de_uso: Array.isArray(u.modos_de_uso) ? u.modos_de_uso : [],
          });
        } catch (e) {
          // ignorar usuarios con error de parseo
        }
      }
      // Ordenar por fecha de creación (más recientes primero)
      usuarios.sort((a, b) => {
        const da = a.fecha_creacion ? new Date(a.fecha_creacion).getTime() : 0;
        const db = b.fecha_creacion ? new Date(b.fecha_creacion).getTime() : 0;
        return db - da;
      });
      return res.status(200).json({ ok: true, total: usuarios.length, usuarios });
    }

    // ─── ESTADÍSTICAS ─────────────────────────────────
    if (action === "stats") {
      const keys = [];
      let cursor = 0;
      do {
        const result = await kv.scan(cursor, { match: "user:*", count: 200 });
        cursor = parseInt(result[0], 10);
        keys.push(...result[1]);
      } while (cursor !== 0 && keys.length < 1000);

      let total = 0, premium = 0, gratis = 0, empresarial = 0;
      let activos7d = 0, activos30d = 0;
      const ahora = Date.now();
      const dia7 = 7 * 24 * 60 * 60 * 1000;
      const dia30 = 30 * 24 * 60 * 60 * 1000;

      for (const key of keys) {
        try {
          const u = await kv.get(key);
          if (!u) continue;
          total++;
          const plan = u.plan || "Gratis";
          if (plan === "Premium") premium++;
          else if (plan === "Empresarial") empresarial++;
          else gratis++;

          const ult = u.ultima_actividad || u.last_seen;
          if (ult) {
            const diff = ahora - new Date(ult).getTime();
            if (diff < dia7) activos7d++;
            if (diff < dia30) activos30d++;
          }
        } catch {}
      }

      return res.status(200).json({
        ok: true,
        stats: {
          total,
          plan: { gratis, premium, empresarial },
          actividad: { activos_7d: activos7d, activos_30d: activos30d },
          conversion_premium: total > 0 ? Math.round((premium / total) * 100) : 0,
        },
      });
    }

    // ─── CAMBIAR PLAN ─────────────────────────────────
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
      if (!usuario) {
        return res.status(404).json({ error: `Usuario "${emailNorm}" no encontrado` });
      }
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

    // ─── BUSCAR UN USUARIO ────────────────────────────
    if (action === "buscar_usuario") {
      const { email_objetivo } = req.body || {};
      if (!email_objetivo) return res.status(400).json({ error: "Falta email_objetivo" });
      const emailNorm = String(email_objetivo).toLowerCase().trim();
      const usuario = await kv.get(`user:${emailNorm}`);
      if (!usuario) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      // No devolvemos info sensible
      const { password_hash, ...resto } = usuario;
      return res.status(200).json({ ok: true, usuario: resto });
    }

    return res.status(400).json({ error: `Acción desconocida: ${action}` });

  } catch (err) {
    console.error("Error en admin:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
}
