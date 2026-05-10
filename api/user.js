import jwt from "jsonwebtoken";
const JWT_SECRET = "av-mentorai-fixed-secret-2024";

async function getKV() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

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
      delete updates.email; delete updates.password_hash;
      await kv.set(`user:${decoded.email}`, { ...user, ...updates });
      return res.status(200).json({ ok: true });
    }
  } catch (err) {
    return res.status(401).json({ error: "No autorizado: " + err.message });
  }
}
