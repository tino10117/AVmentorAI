// api/ranking.js — Top usuarios por XP

import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "av-mentorai-fixed-secret-2024";

async function getAllUsers() {
  // Implementá según tu DB. Debe retornar array de usuarios.
  // SUPABASE: const { data } = await supabase.from('users').select('nombre,xp,racha,english_lecciones_completadas,english_diary,plan').order('xp', { ascending: false }).limit(50);
  // return data;
  throw new Error("DB_NOT_CONFIGURED");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const auth = req.headers.authorization || "";
    const token = auth.replace("Bearer ", "");
    jwt.verify(token, JWT_SECRET);

    const users = await getAllUsers();
    const ranking = users
      .map(u => ({
        nombre: u.nombre,
        xp: u.xp || 0,
        racha: u.racha || 0,
        lecciones: (u.english_lecciones_completadas || []).length,
        diario: (u.english_diary || []).length,
        plan: u.plan || "Gratis",
      }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 50);

    return res.status(200).json({ ranking });
  } catch (err) {
    if (err.message === "DB_NOT_CONFIGURED") {
      return res.status(200).json({ ranking: [] });
    }
    return res.status(401).json({ error: "No autorizado" });
  }
}
