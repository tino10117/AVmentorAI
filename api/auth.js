// api/auth.js — Autenticación AVAI
// Acciones:
//   - register: crear cuenta (con fecha_nacimiento + ciudad opcionales)
//   - login: iniciar sesión
//   - solicitar_reset: pedir código para recuperar contraseña
//   - confirmar_reset: usar código + nueva contraseña
//   - enviar_codigo_verif: enviar código verificación de email
//   - verificar_email: validar código y marcar como verificado
//   - actualizar_perfil: editar fecha_nacimiento, ciudad, etc.

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = "av-mentorai-fixed-secret-2024";

// ─── KV ──────────────────────────────────────────────────
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

// ─── EMAIL (Resend opcional) ─────────────────────────────
async function enviarEmail(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[MODO_DEV] Email para ${to}: ${subject}`);
    return { ok: true, modo_dev: true };
  }
  try {
    const fromEmail = process.env.RESEND_FROM || "AVAI <noreply@avai.ar>";
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from: fromEmail, to, subject, html }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error("Error Resend:", data);
      return { ok: false, error: data.message || "Error enviando email" };
    }
    return { ok: true, id: data.id };
  } catch (e) {
    console.error("Error fetch Resend:", e);
    return { ok: false, error: e.message };
  }
}

// ─── HELPERS ─────────────────────────────────────────────
function nuevoCodigo6digitos() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
function ahora() { return new Date().toISOString(); }
function en15min() { return new Date(Date.now() + 15 * 60 * 1000).toISOString(); }
function expirado(isoString) {
  if (!isoString) return true;
  return new Date(isoString).getTime() < Date.now();
}
function calcularEdad(fechaNac) {
  if (!fechaNac) return null;
  const hoy = new Date();
  const nac = new Date(fechaNac);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}
function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase().trim());
}

// ─── DEFAULT USER ────────────────────────────────────────
function defaultUser(nombre, email, extras = {}) {
  return {
    nombre, email, plan: "Gratis", xp: 0, racha: 0,
    messages: [], memoria_larga: [],
    onboarding_completo: false,
    objetivo: "", negocio: "", tipo_negocio: "",
    nivel_usuario: "Principiante", tiempo_diario: "",
    principal_dificultad: "", meta_mensual: "",
    ingresos_objetivo: 0, habito_clave: "",
    desafios_completados: 0, objetivos_completados: 0,
    logros: [], xp_history: [],
    ultima_fecha: "", fecha_desafio: "",
    desafio_actual: "", preguntas_hoy: 0, fecha_preguntas: "",
    english_nivel: "Principiante", english_lecciones_completadas: [],
    english_messages: [], english_xp: 0,
    english_roleplay_messages: [], english_roleplay_situacion: null,
    english_diary: [], english_quiz_scores: {},
    mate_nivel: "Básico", mate_lecciones_completadas: [],
    mate_messages: [], feedback: [],
    // NUEVOS CAMPOS:
    fecha_nacimiento: extras.fecha_nacimiento || null,
    ciudad: extras.ciudad || null,
    email_verificado: false,
    codigo_verif: null,
    codigo_verif_expira: null,
    reset_token: null,
    reset_expira: null,
    baneado: false,
    fecha_creacion: ahora(),
    ultima_actividad: ahora(),
  };
}

// ─── HANDLER ─────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action } = req.body || {};
  if (!action) return res.status(400).json({ error: "Falta acción" });

  try {
    // REGISTER
    if (action === "register") {
      const { nombre, email, password, fecha_nacimiento, ciudad } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: "Faltan datos" });
      if (!emailValido(email)) return res.status(400).json({ error: "Email inválido" });
      if (password.length < 6) return res.status(400).json({ error: "Contraseña: mínimo 6 caracteres" });

      if (fecha_nacimiento) {
        const edad = calcularEdad(fecha_nacimiento);
        if (edad !== null && edad < 13) {
          return res.status(400).json({ error: "Tenés que tener al menos 13 años" });
        }
      }

      const existing = await findUser(email);
      if (existing) return res.status(409).json({ error: "El email ya está registrado" });

      const hash = await bcrypt.hash(password, 10);
      const user = {
        ...defaultUser(nombre || "Usuario", email, { fecha_nacimiento, ciudad }),
        password_hash: hash
      };
      await saveUser(user);

      const token = jwt.sign({ email, nombre: user.nombre }, JWT_SECRET, { expiresIn: "30d" });
      const { password_hash, codigo_verif, reset_token, ...safeUser } = user;
      return res.status(201).json({ token, user: safeUser });
    }

    // LOGIN
    if (action === "login") {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: "Faltan datos" });

      const user = await findUser(email);
      if (!user) return res.status(401).json({ error: "Email o contraseña incorrectos" });
      if (user.baneado) return res.status(403).json({ error: "Cuenta suspendida. Contactá soporte." });

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: "Email o contraseña incorrectos" });

      user.ultima_actividad = ahora();
      await saveUser(user);

      const token = jwt.sign({ email, nombre: user.nombre }, JWT_SECRET, { expiresIn: "30d" });
      const { password_hash, codigo_verif, reset_token, ...safeUser } = user;
      return res.status(200).json({ token, user: safeUser });
    }

    // SOLICITAR RESET
    if (action === "solicitar_reset") {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ error: "Falta email" });

      const user = await findUser(email);
      if (!user) {
        return res.status(200).json({ ok: true, mensaje: "Si el email existe, recibirás un código" });
      }

      const codigo = nuevoCodigo6digitos();
      user.reset_token = codigo;
      user.reset_expira = en15min();
      await saveUser(user);

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#0d0d0d;color:#fff;">
          <h2 style="color:#fbbf24;">🔑 Recuperar contraseña — AVAI</h2>
          <p>Hola ${user.nombre || ""},</p>
          <p>Tu código de recuperación es:</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#1a1a1a;padding:20px;text-align:center;border-radius:8px;color:#fbbf24;">${codigo}</div>
          <p>Este código vence en 15 minutos.</p>
          <p>Si no pediste esto, ignorá este mensaje.</p>
          <p style="color:#888;font-size:12px;margin-top:30px;">— Equipo AVAI</p>
        </div>
      `;
      const enviado = await enviarEmail(email, "Tu código de recuperación AVAI", html);

      if (enviado.modo_dev) {
        return res.status(200).json({
          ok: true,
          mensaje: "Código generado (modo dev)",
          codigo_dev: codigo,
          aviso: "Configurá RESEND_API_KEY para envío real"
        });
      }
      return res.status(200).json({ ok: true, mensaje: "Código enviado a tu email" });
    }

    // CONFIRMAR RESET
    if (action === "confirmar_reset") {
      const { email, codigo, nueva_password } = req.body || {};
      if (!email || !codigo || !nueva_password) {
        return res.status(400).json({ error: "Faltan datos" });
      }
      if (nueva_password.length < 6) {
        return res.status(400).json({ error: "Contraseña: mínimo 6 caracteres" });
      }

      const user = await findUser(email);
      if (!user) return res.status(404).json({ error: "Email no encontrado" });
      if (!user.reset_token) return res.status(400).json({ error: "No hay solicitud de recuperación" });
      if (expirado(user.reset_expira)) return res.status(400).json({ error: "Código vencido. Pedí uno nuevo" });
      if (String(user.reset_token).trim() !== String(codigo).trim()) {
        return res.status(400).json({ error: "Código incorrecto" });
      }

      user.password_hash = await bcrypt.hash(nueva_password, 10);
      user.reset_token = null;
      user.reset_expira = null;
      user.ultima_actividad = ahora();
      await saveUser(user);

      const token = jwt.sign({ email, nombre: user.nombre }, JWT_SECRET, { expiresIn: "30d" });
      const { password_hash, codigo_verif, reset_token, ...safeUser } = user;
      return res.status(200).json({ ok: true, token, user: safeUser, mensaje: "Contraseña actualizada" });
    }

    // ENVIAR CÓDIGO VERIF (requiere JWT)
    if (action === "enviar_codigo_verif") {
      const auth = req.headers.authorization || "";
      const token = auth.replace("Bearer ", "");
      let decoded;
      try { decoded = jwt.verify(token, JWT_SECRET); }
      catch { return res.status(401).json({ error: "No autorizado" }); }

      const user = await findUser(decoded.email);
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
      if (user.email_verificado) return res.status(200).json({ ok: true, mensaje: "Email ya verificado" });

      const codigo = nuevoCodigo6digitos();
      user.codigo_verif = codigo;
      user.codigo_verif_expira = en15min();
      await saveUser(user);

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#0d0d0d;color:#fff;">
          <h2 style="color:#fbbf24;">✉️ Verificá tu email — AVAI</h2>
          <p>Hola ${user.nombre || ""},</p>
          <p>Tu código de verificación es:</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#1a1a1a;padding:20px;text-align:center;border-radius:8px;color:#a855f7;">${codigo}</div>
          <p>Este código vence en 15 minutos.</p>
          <p style="color:#888;font-size:12px;margin-top:30px;">— Equipo AVAI</p>
        </div>
      `;
      const enviado = await enviarEmail(decoded.email, "Verificá tu email — AVAI", html);
      if (enviado.modo_dev) {
        return res.status(200).json({ ok: true, mensaje: "Código generado (modo dev)", codigo_dev: codigo });
      }
      return res.status(200).json({ ok: true, mensaje: "Código enviado" });
    }

    // VERIFICAR EMAIL (requiere JWT)
    if (action === "verificar_email") {
      const auth = req.headers.authorization || "";
      const token = auth.replace("Bearer ", "");
      let decoded;
      try { decoded = jwt.verify(token, JWT_SECRET); }
      catch { return res.status(401).json({ error: "No autorizado" }); }

      const { codigo } = req.body || {};
      if (!codigo) return res.status(400).json({ error: "Falta código" });

      const user = await findUser(decoded.email);
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
      if (user.email_verificado) return res.status(200).json({ ok: true, mensaje: "Ya estaba verificado" });
      if (!user.codigo_verif) return res.status(400).json({ error: "No hay código pendiente. Solicitá uno" });
      if (expirado(user.codigo_verif_expira)) return res.status(400).json({ error: "Código vencido" });
      if (String(user.codigo_verif).trim() !== String(codigo).trim()) {
        return res.status(400).json({ error: "Código incorrecto" });
      }

      user.email_verificado = true;
      user.codigo_verif = null;
      user.codigo_verif_expira = null;
      await saveUser(user);

      return res.status(200).json({ ok: true, mensaje: "Email verificado" });
    }

    // ACTUALIZAR PERFIL (requiere JWT)
    if (action === "actualizar_perfil") {
      const auth = req.headers.authorization || "";
      const token = auth.replace("Bearer ", "");
      let decoded;
      try { decoded = jwt.verify(token, JWT_SECRET); }
      catch { return res.status(401).json({ error: "No autorizado" }); }

      const user = await findUser(decoded.email);
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

      const { nombre, fecha_nacimiento, ciudad } = req.body || {};
      if (nombre !== undefined) user.nombre = String(nombre).trim().slice(0, 50);
      if (fecha_nacimiento !== undefined) {
        const edad = calcularEdad(fecha_nacimiento);
        if (edad !== null && edad < 13) {
          return res.status(400).json({ error: "Tenés que tener al menos 13 años" });
        }
        user.fecha_nacimiento = fecha_nacimiento;
      }
      if (ciudad !== undefined) user.ciudad = String(ciudad).trim().slice(0, 100);

      user.ultima_actividad = ahora();
      await saveUser(user);

      const { password_hash, codigo_verif, reset_token, ...safeUser } = user;
      return res.status(200).json({ ok: true, user: safeUser });
    }

    return res.status(400).json({ error: "Acción inválida: " + action });
  } catch (err) {
    console.error("Error en auth:", err);
    return res.status(500).json({ error: "Error interno: " + err.message });
  }
}
