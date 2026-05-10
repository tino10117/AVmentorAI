import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = "av-mentorai-fixed-secret-2024";

async function getKV() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

async function findUser(email) {
  const kv = await getKV();
  return await kv.get(`user:${email}`);
}

async function saveUser(data) {
  const kv = await getKV();
  await kv.set(`user:${data.email}`, data);
  const emails = (await kv.get("emails")) || [];
  if (!emails.includes(data.email)) await kv.set("emails", [...emails, data.email]);
}

function defaultUser(nombre, email) {
  return { nombre, email, plan: "Gratis", xp: 0, racha: 0, messages: [], memoria_larga: [], onboarding_completo: false, objetivo: "", negocio: "", tipo_negocio: "", nivel_usuario: "Principiante", tiempo_diario: "", principal_dificultad: "", meta_mensual: "", ingresos_objetivo: 0, habito_clave: "", desafios_completados: 0, objetivos_completados: 0, logros: [], xp_history: [], ultima_fecha: "", fecha_desafio: "", desafio_actual: "", preguntas_hoy: 0, fecha_preguntas: "", english_nivel: "Principiante", english_lecciones_completadas: [], english_messages: [], english_xp: 0, english_roleplay_messages: [], english_roleplay_situacion: null, english_diary: [], english_quiz_scores: {}, mate_nivel: "Básico", mate_lecciones_completadas: [], mate_messages: [], feedback: [] };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { action, nombre, email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Faltan datos" });
  try {
    if (action === "register") {
      const existing = await findUser(email);
      if (existing) return res.status(409).json({ error: "El email ya está registrado" });
      const hash = await bcrypt.hash(password, 10);
      const user = { ...defaultUser(nombre || "Usuario", email), password_hash: hash };
      await saveUser(user);
      const token = jwt.sign({ email, nombre: user.nombre }, JWT_SECRET, { expiresIn: "30d" });
      const { password_hash, ...safeUser } = user;
      return res.status(201).json({ token, user: safeUser });
    }
    if (action === "login") {
      const user = await findUser(email);
      if (!user) return res.status(401).json({ error: "Email o contraseña incorrectos" });
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: "Email o contraseña incorrectos" });
      const token = jwt.sign({ email, nombre: user.nombre }, JWT_SECRET, { expiresIn: "30d" });
      const { password_hash, ...safeUser } = user;
      return res.status(200).json({ token, user: safeUser });
    }
    return res.status(400).json({ error: "Acción inválida" });
  } catch (err) {
    return res.status(500).json({ error: "Error interno: " + err.message });
  }
}
