// api/auth.js — Autenticación AVAI
// Acciones:
//   - register: crear cuenta (con fecha_nacimiento + ciudad opcionales)
//                + envía AUTOMÁTICAMENTE código de verificación al email
//   - login: iniciar sesión
//   - solicitar_reset: pedir código para recuperar contraseña
//   - confirmar_reset: usar código + nueva contraseña
//   - enviar_codigo_verif: enviar código verificación de email
//   - verificar_email: validar código y marcar como verificado
//   - actualizar_perfil: editar fecha_nacimiento, ciudad, etc.

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = "av-mentorai-fixed-secret-2024";
// ═══ TRIAL DE PREMIUM (Paso 2) ═══
// Días de Premium gratis para toda cuenta nueva. Al vencerse, el barrido
// de api/chat.js (Paso 1) la baja a Gratis automáticamente.
// 🧪 PARA PROBAR el barrido: poné TRIAL_DIAS = -1 (la cuenta nace Premium
// pero ya vencida), registrá una cuenta de prueba, mandá un mensaje y
// verificá que baja a Gratis. Después volvé a dejarlo en 10.
const TRIAL_DIAS = -1;
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

// ✨ NUEVO: Helper para enviar código de verificación de email
async function enviarCodigoVerificacion(user) {
  const codigo = nuevoCodigo6digitos();
  user.codigo_verif = codigo;
  user.codigo_verif_expira = en15min();
  await saveUser(user);

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px 20px;background:#0d0d0d;color:#fff;border-radius:12px;">
      <div style="text-align:center;margin-bottom:30px;">
        <div style="font-size:32px;font-weight:900;background:linear-gradient(90deg,#facc15,#f97316,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">⚡ AVAI</div>
      </div>
      <h2 style="color:#facc15;margin-bottom:16px;">✉️ ¡Bienvenido a AVAI!</h2>
      <p style="color:#cbd5e1;line-height:1.6;">Hola <b>${user.nombre || "capo"}</b>,</p>
      <p style="color:#cbd5e1;line-height:1.6;">Gracias por sumarte a AVAI 🚀 Para verificar tu email, usá este código:</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:10px;background:#1a1a1a;padding:24px;text-align:center;border-radius:12px;color:#facc15;margin:24px 0;border:1px solid rgba(250,204,21,0.3);">${codigo}</div>
      <p style="color:#94a3b8;font-size:13px;">⏱️ El código vence en 15 minutos.</p>
      <p style="color:#94a3b8;font-size:13px;line-height:1.6;">Si no creaste esta cuenta, ignorá este mensaje.</p>
      <div style="border-top:1px solid #2a2a2a;margin-top:30px;padding-top:20px;text-align:center;">
        <p style="color:#64748b;font-size:11px;">— Equipo AVAI · Formosa, Argentina 🇦🇷</p>
      </div>
    </div>
  `;
  const enviado = await enviarEmail(user.email, "Verificá tu email — AVAI", html);
  return { enviado, codigo };
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
    // ═══════════════════════════════════════════════════════
    // REGISTER — ✨ AHORA ENVÍA CÓDIGO AUTOMÁTICO
    // ═══════════════════════════════════════════════════════
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

      const emailNorm = String(email).toLowerCase().trim();
      const existing = await findUser(emailNorm);
      if (existing) return res.status(409).json({ error: "El email ya está registrado" });

      const hash = await bcrypt.hash(password, 10);
      const user = {
        ...defaultUser(nombre || "Usuario", emailNorm, { fecha_nacimiento, ciudad }),
        password_hash: hash,
        // PASO 2 — TRIAL: toda cuenta nueva nace con Premium de prueba
        plan: "Premium",
        es_trial: true,
        premium_vence: new Date(Date.now() + TRIAL_DIAS * 24 * 60 * 60 * 1000).toISOString(),
      };
      await saveUser(user);
      // ✨ NUEVO: enviar código de verificación automáticamente
      let codigoInfo = { enviado: { ok: false } };
      try {
        codigoInfo = await enviarCodigoVerificacion(user);
      } catch (errCodigo) {
        console.error("Error enviando código de verif al registrarse:", errCodigo);
        // No fallamos el registro, solo logueamos
      }

      const token = jwt.sign({ email: emailNorm, nombre: user.nombre }, JWT_SECRET, { expiresIn: "30d" });
      const { password_hash, codigo_verif, reset_token, ...safeUser } = user;
      return res.status(201).json({
        token,
        user: safeUser,
        verificacion_email: {
          enviado: codigoInfo.enviado.ok,
          modo_dev: !!codigoInfo.enviado.modo_dev,
          codigo_dev: codigoInfo.enviado.modo_dev ? codigoInfo.codigo : undefined,
        },
      });
    }

    // ═══════════════════════════════════════════════════════
    // LOGIN
    // ═══════════════════════════════════════════════════════
    if (action === "login") {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: "Faltan datos" });

      const emailNorm = String(email).toLowerCase().trim();
      const user = await findUser(emailNorm);
      if (!user) return res.status(401).json({ error: "Email o contraseña incorrectos" });
      if (user.baneado) return res.status(403).json({ error: "Cuenta suspendida. Contactá soporte." });

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: "Email o contraseña incorrectos" });

      user.ultima_actividad = ahora();
      await saveUser(user);

      const token = jwt.sign({ email: emailNorm, nombre: user.nombre }, JWT_SECRET, { expiresIn: "30d" });
      const { password_hash, codigo_verif, reset_token, ...safeUser } = user;
      return res.status(200).json({ token, user: safeUser });
    }

    // ═══════════════════════════════════════════════════════
    // SOLICITAR RESET — pedir código por email
    // ═══════════════════════════════════════════════════════
    if (action === "solicitar_reset") {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ error: "Falta email" });

      const emailNorm = String(email).toLowerCase().trim();
      const user = await findUser(emailNorm);
      if (!user) {
        // Por seguridad NO le decimos si el email existe o no
        return res.status(200).json({ ok: true, mensaje: "Si el email existe, recibirás un código" });
      }

      const codigo = nuevoCodigo6digitos();
      user.reset_token = codigo;
      user.reset_expira = en15min();
      await saveUser(user);

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px 20px;background:#0d0d0d;color:#fff;border-radius:12px;">
          <div style="text-align:center;margin-bottom:30px;">
            <div style="font-size:32px;font-weight:900;background:linear-gradient(90deg,#facc15,#f97316,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">⚡ AVAI</div>
          </div>
          <h2 style="color:#facc15;margin-bottom:16px;">🔑 Recuperar contraseña</h2>
          <p style="color:#cbd5e1;line-height:1.6;">Hola <b>${user.nombre || "capo"}</b>,</p>
          <p style="color:#cbd5e1;line-height:1.6;">Tu código de recuperación es:</p>
          <div style="font-size:36px;font-weight:bold;letter-spacing:10px;background:#1a1a1a;padding:24px;text-align:center;border-radius:12px;color:#facc15;margin:24px 0;border:1px solid rgba(250,204,21,0.3);">${codigo}</div>
          <p style="color:#94a3b8;font-size:13px;">⏱️ El código vence en 15 minutos.</p>
          <p style="color:#94a3b8;font-size:13px;line-height:1.6;">Si no pediste esto, ignorá este mensaje. Tu contraseña actual sigue funcionando.</p>
          <div style="border-top:1px solid #2a2a2a;margin-top:30px;padding-top:20px;text-align:center;">
            <p style="color:#64748b;font-size:11px;">— Equipo AVAI · Formosa, Argentina 🇦🇷</p>
          </div>
        </div>
      `;
      const enviado = await enviarEmail(emailNorm, "Tu código de recuperación AVAI", html);

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

    // ═══════════════════════════════════════════════════════
    // CONFIRMAR RESET — usar código + nueva contraseña
    // ═══════════════════════════════════════════════════════
    if (action === "confirmar_reset") {
      const { email, codigo, nueva_password } = req.body || {};
      if (!email || !codigo || !nueva_password) {
        return res.status(400).json({ error: "Faltan datos" });
      }
      if (nueva_password.length < 6) {
        return res.status(400).json({ error: "Contraseña: mínimo 6 caracteres" });
      }

      const emailNorm = String(email).toLowerCase().trim();
      const user = await findUser(emailNorm);
      if (!user) return res.status(404).json({ error: "Email no encontrado" });
      if (!user.reset_token) return res.status(400).json({ error: "No hay solicitud de recuperación. Pedí un código nuevo." });
      if (expirado(user.reset_expira)) return res.status(400).json({ error: "Código vencido. Pedí uno nuevo" });
      if (String(user.reset_token).trim() !== String(codigo).trim()) {
        return res.status(400).json({ error: "Código incorrecto" });
      }

      user.password_hash = await bcrypt.hash(nueva_password, 10);
      user.reset_token = null;
      user.reset_expira = null;
      user.ultima_actividad = ahora();
      await saveUser(user);

      const token = jwt.sign({ email: emailNorm, nombre: user.nombre }, JWT_SECRET, { expiresIn: "30d" });
      const { password_hash, codigo_verif, reset_token, ...safeUser } = user;
      return res.status(200).json({ ok: true, token, user: safeUser, mensaje: "Contraseña actualizada" });
    }

    // ═══════════════════════════════════════════════════════
    // ENVIAR CÓDIGO VERIF (requiere JWT) — reenvío manual
    // ═══════════════════════════════════════════════════════
    if (action === "enviar_codigo_verif") {
      const auth = req.headers.authorization || "";
      const token = auth.replace("Bearer ", "");
      let decoded;
      try { decoded = jwt.verify(token, JWT_SECRET); }
      catch { return res.status(401).json({ error: "No autorizado" }); }

      const user = await findUser(decoded.email);
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
      if (user.email_verificado) return res.status(200).json({ ok: true, mensaje: "Email ya verificado" });

      const codigoInfo = await enviarCodigoVerificacion(user);

      if (codigoInfo.enviado.modo_dev) {
        return res.status(200).json({
          ok: true,
          mensaje: "Código generado (modo dev)",
          codigo_dev: codigoInfo.codigo
        });
      }
      return res.status(200).json({ ok: true, mensaje: "Código enviado a tu email" });
    }

    // ═══════════════════════════════════════════════════════
    // VERIFICAR EMAIL (requiere JWT)
    // ═══════════════════════════════════════════════════════
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
      if (expirado(user.codigo_verif_expira)) return res.status(400).json({ error: "Código vencido. Pedí uno nuevo." });
      if (String(user.codigo_verif).trim() !== String(codigo).trim()) {
        return res.status(400).json({ error: "Código incorrecto" });
      }

      user.email_verificado = true;
      user.codigo_verif = null;
      user.codigo_verif_expira = null;
      await saveUser(user);

      return res.status(200).json({ ok: true, mensaje: "Email verificado correctamente ✨" });
    }

    // ═══════════════════════════════════════════════════════
    // ACTUALIZAR PERFIL (requiere JWT)
    // ═══════════════════════════════════════════════════════
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
