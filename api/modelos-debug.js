// api/modelos-debug.js — TEMPORAL: lista los modelos disponibles en la cuenta.
// ⚠️ BORRAR este archivo después de usarlo. No mergear a main.

export default async function handler(req, res) {
  try {
    const r = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    const data = await r.json();
    const ids = (data.data || []).map((m) => m.id).sort();
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(200).send(ids.join("\n") || JSON.stringify(data));
  } catch (e) {
    return res.status(500).send("Error: " + (e?.message || "desconocido"));
  }
}
