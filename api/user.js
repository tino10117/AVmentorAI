import jwt from "jsonwebtoken";
const JWT_SECRET = "av-mentorai-fixed-secret-2024";

async function getKV() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

// Campos que NO se pueden modificar vía PATCH /api/user
// Estos solo se cambian por /api/accion (que valida límites diarios)
const CAMPOS_PROTEGIDOS = new Set([
  "email",
  "password_hash",
  "xp",
  "racha",
  "ultima_fecha",
  "desafios_completados",
  "objetivos_completados",
  "logros",
  "xp_history",
  "plan", // que nadie se haga Premium gratis editando localStorage
  "preguntas_hoy",
  "fecha_preguntas",
  "fecha_desafio",
  "desafio_actual",
  "english_xp",
  "english_lecciones_completadas",
  "mate_lecciones_completadas",
]);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    const decoded = jwt.verify(token, JWT_SECRET);
    const kv = await getKV();
    if (req.method === "GET") {
      const user = await kv.get(`user:${decoded.email}`);
      if (!user) return res.status(404).json({ error: "No encontrado" });
      const { password_hash, ...safeUser } = user;
      return res.status(200).json({ user: safeUser });
    }
    if (req.method === "PATCH") {
      const user = await kv.get(`user:${decoded.email}`);
      if (!user) return res.status(404).json({ error: "No encontrado" });
      const updates = req.body || {};

      // Borrar campos protegidos del request
      let camposBloqueados = 0;
      for (const campo of CAMPOS_PROTEGIDOS) {
        if (campo in updates) {
          delete updates[campo];
          camposBloqueados++;
        }
      }

      // Si después de filtrar no queda nada, no hacemos write
      if (Object.keys(updates).length === 0) {
        return res.status(200).json({
          ok: true,
          ignored: camposBloqueados > 0
            ? `Se bloquearon ${camposBloqueados} campos protegidos. Esos solo cambian vía /api/accion.`
            : "No hay nada para actualizar"
        });
      }

      await kv.set(`user:${decoded.email}`, { ...user, ...updates });
      return res.status(200).json({ ok: true, campos_bloqueados: camposBloqueados });
    }
  } catch (err) {
    return res.status(401).json({ error: "No autorizado: " + err.message });
  }
}
