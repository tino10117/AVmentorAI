// ── app.js — State, API calls, Utilities ──

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
const App = {
  user: null,
  token: null,
  currentTab: "mentor",
  currentSubnav: {},
  modo: "Mentor de Negocios",
  chatMessages: { negocio: [], english: [], englishRoleplay: [], mate: [] },
  desafio: "",
  quizState: {},
};

// ═══════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════
const Store = {
  save() {
    if (!App.user) return;
    localStorage.setItem("av_token", App.token || "");
    localStorage.setItem("av_user", JSON.stringify(App.user));
  },
  load() {
    App.token = localStorage.getItem("av_token") || null;
    const u = localStorage.getItem("av_user");
    if (u) { try { App.user = JSON.parse(u); } catch { App.user = null; } }
  },
  clear() {
    localStorage.removeItem("av_token");
    localStorage.removeItem("av_user");
  },
};

// ═══════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════
const API = {
  base: "",

  async req(path, method = "GET", body = null) {
    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (App.token) opts.headers["Authorization"] = `Bearer ${App.token}`;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(this.base + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error del servidor");
    return data;
  },

  async login(email, password) {
    return this.req("/api/auth", "POST", { action: "login", email, password });
  },
  async register(nombre, email, password) {
    return this.req("/api/auth", "POST", { action: "register", nombre, email, password });
  },
  async saveUser(updates) {
    return this.req("/api/user", "PATCH", updates);
  },
  async getRanking() {
    return this.req("/api/ranking");
  },

  async chat({ type, messages, modo, desafio, leccion, englishModo, mateModo, useWebSearch, image }) {
    return this.req("/api/chat", "POST", {
      type, messages, user: App.user, modo: modo || App.modo,
      desafio: desafio || App.desafio, leccion, englishModo, mateModo, useWebSearch, image,
    });
  },
};

// ═══════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════
const Toast = {
  show(msg, type = "success", duration = 3500) {
    const c = document.getElementById("toast-container");
    if (!c) return;
    const t = document.createElement("div");
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; setTimeout(() => t.remove(), 300); }, duration);
  },
  success(m) { this.show(m, "success"); },
  error(m) { this.show(m, "error"); },
  info(m) { this.show(m, "info"); },
};

// ═══════════════════════════════════════════════
// USER HELPERS
// ═══════════════════════════════════════════════
const UserHelper = {
  calcNivel(xp) {
    if (xp < 100) return "Nivel 1 — Inicial";
    if (xp < 300) return "Nivel 2 — En crecimiento";
    if (xp < 700) return "Nivel 3 — Estratega";
    if (xp < 1200) return "Nivel 4 — Empresario Pro";
    return "Nivel 5 — Élite";
  },
  calcProgress(xp) {
    if (xp < 100) return xp / 100;
    if (xp < 300) return (xp - 100) / 200;
    if (xp < 700) return (xp - 300) / 400;
    if (xp < 1200) return (xp - 700) / 500;
    return 1;
  },
  sumarXP(n) {
    if (!App.user) return;
    App.user.xp = (App.user.xp || 0) + n;
    const hoy = today();
    if (App.user.ultima_fecha !== hoy) {
      App.user.racha = (App.user.racha || 0) + 1;
      App.user.ultima_fecha = hoy;
    }
    if (!App.user.xp_history) App.user.xp_history = [];
    App.user.xp_history.push({ fecha: hoy, xp: App.user.xp });
    Store.save();
    refreshHeader();
    API.saveUser({ xp: App.user.xp, racha: App.user.racha, ultima_fecha: App.user.ultima_fecha, xp_history: App.user.xp_history }).catch(() => {});
  },
  desbloquearLogros() {
    if (!App.user) return;
    const u = App.user;
    const loks = (u.english_lecciones_completadas || []).length;
    const diary = (u.english_diary || []).length;
    const reglas = [
      [u.xp >= 100, "Primeros 100 XP"],
      [u.xp >= 300, "Mente en crecimiento"],
      [u.xp >= 700, "Estratega en formación"],
      [u.racha >= 3, "Racha de 3 días"],
      [u.racha >= 7, "Semana imparable"],
      [u.desafios_completados >= 5, "5 desafíos completados"],
      [u.objetivos_completados >= 3, "Constructor de objetivos"],
      [loks >= 3, "Estudiante de inglés"],
      [loks >= 8, "Angloparlante en progreso"],
      [loks >= 12, "Inglés dominado 🏆"],
      [diary >= 7, "Diario de 7 días"],
      [diary >= 30, "Escritor constante 📝"],
    ];
    if (!u.logros) u.logros = [];
    reglas.forEach(([cond, logro]) => {
      if (cond && !u.logros.includes(logro)) u.logros.push(logro);
    });
  },
  genDesafio() {
    const DESAFIOS = [
      "Mandá mensajes a 3 clientes potenciales.",
      "Publicá un producto o servicio hoy.",
      "Analizá un negocio local y anotá qué harías mejor.",
      "Pensá una oferta irresistible: producto + beneficio + urgencia.",
      "Grabá un video corto vendiendo algo.",
      "Diseñá una promoción simple por WhatsApp.",
      "Buscá 3 competidores en Instagram y analizá qué hacen bien.",
      "Mejorá la descripción de un producto o servicio.",
      "Creá una lista de 10 productos que podrías vender.",
      "Armá una estrategia para vender más sin bajar el margen.",
    ];
    const hoy = today();
    const u = App.user;
    if (!u) return DESAFIOS[0];
    if (u.fecha_desafio !== hoy) {
      u.desafio_actual = DESAFIOS[Math.floor(Math.random() * DESAFIOS.length)];
      u.fecha_desafio = hoy;
      Store.save();
    }
    App.desafio = u.desafio_actual || DESAFIOS[0];
    return App.desafio;
  },
};

// ═══════════════════════════════════════════════
// DOM UTILITIES
// ═══════════════════════════════════════════════
function today() { return new Date().toISOString().split("T")[0]; }
function esc(str) { return String(str).replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function nl2br(str) { return esc(str).replace(/\n/g, "<br>"); }

// Limpia links Markdown largos: [texto](https://url) → 🔗 texto
// También quita parámetros tipo ?utm_source y dominios completos huérfanos en paréntesis.
function cleanLinks(str) {
  if (!str) return "";
  let s = String(str);
  // 1) [texto](url) → 🔗 texto (si el texto parece dominio, queda como dominio)
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s\)]+)\)/g, (m, txt, url) => {
    const cleanTxt = txt.trim();
    return `🔗 ${cleanTxt}`;
  });
  // 2) URLs sueltas tipo (https://...) → quitarlas
  s = s.replace(/\(\s*https?:\/\/[^\s\)]+\s*\)/g, "");
  // 3) URLs sin paréntesis al final de oración
  s = s.replace(/https?:\/\/[^\s\)]+/g, "");
  // 4) Limpiar paréntesis vacíos sobrantes
  s = s.replace(/\(\s*\)/g, "");
  return s;
}

// Convierte texto con Markdown/emojis a texto plano para TTS (lectura por voz).
// Quita asteriscos, headers, emojis, links, símbolos raros.
function stripForVoice(str) {
  if (!str) return "";
  let s = String(str);
  // Primero limpiar links
  s = cleanLinks(s);
  // Quitar code blocks
  s = s.replace(/```[\s\S]*?```/g, "");
  // Quitar inline code (mantener el contenido)
  s = s.replace(/`([^`\n]+)`/g, "$1");
  // Quitar headers (mantener texto)
  s = s.replace(/^#{1,6}\s+/gm, "");
  // Quitar negritas e itálicas (mantener texto)
  s = s.replace(/\*\*([^\*\n]+)\*\*/g, "$1");
  s = s.replace(/\*([^\*\n]+)\*/g, "$1");
  // Quitar emojis y símbolos no básicos (rango unicode común de emojis)
  s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, "");
  // Quitar el símbolo 🔗 que queda de cleanLinks (por si el regex anterior no lo borra)
  s = s.replace(/🔗/g, "");
  // Espacios múltiples → 1 solo, líneas vacías múltiples → 1
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

// Markdown ligero — convierte la salida de la IA a HTML lindo (negritas, títulos, listas, código).
// No es un parser completo, pero cubre lo que la IA suele devolver.
function mdRender(str) {
  if (!str) return "";
  // Primero limpiar links largos (bug visual con web search)
  let html = cleanLinks(String(str));

  // 1) Escapar HTML primero
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 2) Code blocks ``` ```
  html = html.replace(/```([\s\S]*?)```/g, (m, code) =>
    `<pre style="background:rgba(0,0,0,.3);padding:10px;border-radius:8px;overflow-x:auto;font-size:12px;border:1px solid rgba(255,255,255,.1)"><code>${code.trim()}</code></pre>`
  );

  // 3) Inline code `code`
  html = html.replace(/`([^`\n]+)`/g, '<code style="background:rgba(168,85,247,.18);padding:2px 6px;border-radius:4px;font-size:.92em;color:#e9d5ff">$1</code>');

  // 4) Headers ### ## #
  html = html.replace(/^### (.+)$/gm, '<h4 style="margin:14px 0 6px;color:#facc15;font-family:\'Syne\',sans-serif;font-size:15px">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 style="margin:16px 0 8px;color:#facc15;font-family:\'Syne\',sans-serif;font-size:17px">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2 style="margin:18px 0 10px;color:#facc15;font-family:\'Syne\',sans-serif;font-size:19px">$1</h2>');

  // 5) Bold **texto**
  html = html.replace(/\*\*([^\*\n]+)\*\*/g, '<strong style="font-weight:700">$1</strong>');

  // 6) Italic *texto* (cuidando no chocar con el **)
  html = html.replace(/(^|[^\*])\*([^\*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

  // 7) Listas con guiones o asteriscos al inicio de línea
  html = html.replace(/^[\-\*] (.+)$/gm, '<li style="margin:3px 0">$1</li>');
  // Envolver grupos de <li> en <ul>
  html = html.replace(/(<li[^>]*>.*?<\/li>(?:\s*<li[^>]*>.*?<\/li>)*)/gs, '<ul style="padding-left:20px;margin:6px 0">$1</ul>');

  // 8) Listas numeradas: 1. 2. 3.
  html = html.replace(/^(\d+)\. (.+)$/gm, '<div style="margin:4px 0;padding-left:4px"><strong style="color:#facc15">$1.</strong> $2</div>');

  // 9) Saltos de línea simples (los que no son de elementos de bloque)
  html = html.replace(/\n{2,}/g, '<br><br>');
  html = html.replace(/(?<!>)\n(?!<)/g, '<br>');

  return html;
}
function autoResize(ta) {
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
}

function scrollBottom(el) {
  if (el) setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50);
}

function showSpinner(container) {
  const div = document.createElement("div");
  div.className = "msg-ai chat-msg";
  div.id = "typing-indicator";
  div.innerHTML = `<div class="chat-msg-header">
    <div class="chat-avatar" style="background:linear-gradient(135deg,#38bdf8,#6366f1)">⚡</div>
    <span class="chat-name" style="color:#38bdf8">AV MentorAI</span>
  </div>
  <div class="typing-indicator">
    <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
  </div>`;
  container.appendChild(div);
  scrollBottom(container);
  return div;
}

function removeSpinner() {
  const el = document.getElementById("typing-indicator");
  if (el) el.remove();
}

// ═══════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════
function navigateTo(tabId) {
  App.currentTab = tabId;
  document.querySelectorAll(".tab-content").forEach(t => {
    t.classList.remove("active");
    t.classList.add("hidden");
  });
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  const tabEl = document.getElementById("tab-" + tabId);
  if (tabEl) { tabEl.classList.add("active"); tabEl.classList.remove("hidden"); }
  const navEl = document.querySelector(`[data-tab="${tabId}"]`);
  if (navEl) navEl.classList.add("active");
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("overlay")?.classList.remove("show");
  if (tabId === "ranking") loadRanking();
  if (tabId === "progreso") renderProgreso();
  if (tabId === "desafios") renderDesafios();
  if (tabId === "english") { renderEnglishLecciones(); setSubnav("english","lecciones"); }
  if (tabId === "mate") { renderMateLecciones(); setSubnav("mate","lecciones"); }
  if (tabId === "herramientas") { renderHerramientas(); setSubnav("herr","competencia"); }
}

function setSubnav(section, value) {
  App.currentSubnav[section] = value;
  document.querySelectorAll(`[data-subnav="${section}"]`).forEach(b => {
    b.classList.toggle("active", b.dataset.value === value);
  });
  document.querySelectorAll(`[data-subpanel="${section}"]`).forEach(p => {
    p.classList.toggle("active", p.dataset.value === value);
    p.style.display = p.dataset.value === value ? "block" : "none";
  });
}

// ═══════════════════════════════════════════════
// CHAT ENGINE
// ═══════════════════════════════════════════════
const Chat = {
  async send({ container, messagesKey, type, inputEl, englishModo, mateModo, useWebSearch }) {
    const text = inputEl.value.trim();
    const pendingImage = this._pendingImage || null;
    if (!text && !pendingImage) return;
    inputEl.value = "";
    inputEl.style.height = "auto";

    // Auto-activar búsqueda web en modo "Conversación Libre"
    if (type === "negocio" && App.modo === "Conversación Libre" && !useWebSearch) {
      useWebSearch = true;
    }

    const msgClass = type === "english" ? "msg-english" : type === "mate" ? "msg-mate" : "msg-ai";
    const aiName = type === "english" ? "Alex — Profesor de Inglés" : type === "mate" ? "Bruno — Matemáticas" : "AV MentorAI";
    const aiIcon = type === "english" ? "🎓" : type === "mate" ? "🔢" : "⚡";
    const aiColor = type === "english" ? "#a855f7" : type === "mate" ? "#22c55e" : "#38bdf8";
    const avatarGrad = type === "english" ? "linear-gradient(135deg,#a855f7,#6366f1)" : type === "mate" ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#38bdf8,#6366f1)";

    // Add user message
    if (!App.chatMessages[messagesKey]) App.chatMessages[messagesKey] = [];
    const userMsg = text || "(imagen)";
    App.chatMessages[messagesKey].push({ role: "user", content: userMsg });
    this.appendMsg(container, userMsg, "user", null, null, null, null, pendingImage);
    // Limpiar imagen pendiente del UI y de memoria
    this._pendingImage = null;
    this._clearImagePreview();
    const spinner = showSpinner(container);

    try {
      const history = App.chatMessages[messagesKey].slice(-16).map(m => ({ role: m.role, content: m.content }));
      const data = await API.chat({ type: type === "englishRoleplay" ? "english" : type, messages: history, englishModo, mateModo, useWebSearch, image: pendingImage });
      removeSpinner();
      const reply = data.reply;
      App.chatMessages[messagesKey].push({ role: "assistant", content: reply });
      this.appendMsg(container, reply, msgClass, aiName, aiIcon, avatarGrad, aiColor);
      UserHelper.sumarXP(10);

      // Save messages to user object
      const userKey = messagesKey === "negocio" ? "messages" : messagesKey === "english" ? "english_messages" : messagesKey === "englishRoleplay" ? "english_roleplay_messages" : "mate_messages";
      if (!App.user[userKey]) App.user[userKey] = [];
      App.user[userKey] = App.chatMessages[messagesKey].slice(-40);
      Store.save();
      API.saveUser({ [userKey]: App.user[userKey] }).catch(() => {});
    } catch (err) {
      removeSpinner();
      Toast.error(err.message);
      this.appendMsg(container, "❌ " + err.message, msgClass, aiName, aiIcon, avatarGrad, aiColor);
    }
  },

  // Manejo de imágenes adjuntas (Premium)
  _pendingImage: null,
  _pendingImageInputId: null,

  attachImage(fileInputEl, previewContainerId) {
    const file = fileInputEl.files && fileInputEl.files[0];
    if (!file) return;
    // Validación de plan: solo Premium/Empresarial
    if (!App.user || App.user.plan === "Gratis") {
      Toast.error("Subir imágenes es una función Premium. Actualizá tu plan para usarla.");
      fileInputEl.value = "";
      return;
    }
    // Validación de tipo
    if (!file.type.startsWith("image/")) {
      Toast.error("Solo se aceptan archivos de imagen (.jpg, .png, .webp).");
      fileInputEl.value = "";
      return;
    }
    // Validación de tamaño máximo original (20 MB para evitar fotos extremas)
    if (file.size > 20 * 1024 * 1024) {
      Toast.error("La imagen es demasiado grande (máximo 20 MB).");
      fileInputEl.value = "";
      return;
    }

    // Procesar imagen: comprimir si es >2MB, sino mandar tal cual
    const needsCompression = file.size > 2 * 1024 * 1024;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (!needsCompression) {
        // Imagen chica, la usamos tal cual
        this._pendingImage = e.target.result;
        this._pendingImageInputId = previewContainerId;
        this._showImagePreview(previewContainerId, e.target.result);
        return;
      }
      // Imagen grande: comprimir con canvas
      this._compressImage(e.target.result, (compressedDataUrl) => {
        this._pendingImage = compressedDataUrl;
        this._pendingImageInputId = previewContainerId;
        this._showImagePreview(previewContainerId, compressedDataUrl);
        Toast.info("📸 Imagen optimizada");
      });
    };
    reader.readAsDataURL(file);
    fileInputEl.value = "";
  },

  _compressImage(dataUrl, callback) {
    const img = new Image();
    img.onload = () => {
      const MAX_SIDE = 1600;
      let { width, height } = img;
      if (width > MAX_SIDE || height > MAX_SIDE) {
        if (width >= height) {
          height = Math.round(height * (MAX_SIDE / width));
          width = MAX_SIDE;
        } else {
          width = Math.round(width * (MAX_SIDE / height));
          height = MAX_SIDE;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      // JPEG calidad 0.85 da buen balance tamaño/calidad
      const compressed = canvas.toDataURL("image/jpeg", 0.85);
      callback(compressed);
    };
    img.onerror = () => {
      Toast.error("No se pudo procesar la imagen. Probá con otra.");
    };
    img.src = dataUrl;
  },

  _showImagePreview(containerId, dataUrl) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(168,85,247,.15);border:1px solid rgba(168,85,247,.4);padding:6px 10px;border-radius:10px;margin-bottom:6px">
      <img src="${dataUrl}" style="width:40px;height:40px;object-fit:cover;border-radius:6px" />
      <span style="font-size:12px;color:#e9d5ff">📎 Imagen adjunta</span>
      <button onclick="Chat._removeImage()" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:14px;padding:0 4px" title="Quitar imagen">✕</button>
    </div>`;
    container.style.display = "block";
  },

  _clearImagePreview() {
    if (!this._pendingImageInputId) return;
    const container = document.getElementById(this._pendingImageInputId);
    if (container) { container.innerHTML = ""; container.style.display = "none"; }
    this._pendingImageInputId = null;
  },

  _removeImage() {
    this._pendingImage = null;
    this._clearImagePreview();
  },

  appendMsg(container, text, cls, name, icon, grad, color, imageDataUrl) {
    const div = document.createElement("div");
    div.className = `chat-msg ${cls}`;
    const imageHtml = imageDataUrl ? `<div style="margin-bottom:8px"><img src="${imageDataUrl}" style="max-width:280px;max-height:280px;border-radius:10px;border:1px solid rgba(255,255,255,.15);display:block" /></div>` : "";
    if (cls === "user") {
      div.innerHTML = `<div class="chat-msg-header">
        <div class="chat-avatar" style="background:linear-gradient(135deg,#facc15,#f97316)">😊</div>
        <span class="chat-name" style="color:#facc15">Vos</span>
      </div>${imageHtml}<div>${nl2br(text)}</div>`;
    } else {
      div.innerHTML = `<div class="chat-msg-header">
        <div class="chat-avatar" style="background:${grad}">${icon}</div>
        <span class="chat-name" style="color:${color}">${name}</span>
      </div><div>${mdRender(text)}</div>`;
    }
    container.appendChild(div);
    scrollBottom(container);
  },

  init(containerId, inputId, sendBtnId, messagesKey, type, opts = {}) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    const sendBtn = document.getElementById(sendBtnId);
    if (!container || !input || !sendBtn) return;

    // Load existing messages
    const userKey = messagesKey === "negocio" ? "messages" : messagesKey === "english" ? "english_messages" : messagesKey === "englishRoleplay" ? "english_roleplay_messages" : "mate_messages";
    App.chatMessages[messagesKey] = (App.user?.[userKey] || []);
    container.innerHTML = "";
    App.chatMessages[messagesKey].forEach(m => {
      const cls = m.role === "user" ? "user" : type === "english" || type === "englishRoleplay" ? "msg-english" : type === "mate" ? "msg-mate" : "msg-ai";
      const aiName = type === "english" || type === "englishRoleplay" ? "Alex — Profesor de Inglés" : type === "mate" ? "Bruno — Matemáticas" : "AV MentorAI";
      const aiIcon = type === "english" || type === "englishRoleplay" ? "🎓" : type === "mate" ? "🔢" : "⚡";
      const aiColor = type === "english" || type === "englishRoleplay" ? "#a855f7" : type === "mate" ? "#22c55e" : "#38bdf8";
      const grad = type === "english" || type === "englishRoleplay" ? "linear-gradient(135deg,#a855f7,#6366f1)" : type === "mate" ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#38bdf8,#6366f1)";
      this.appendMsg(container, m.content, cls, aiName, aiIcon, grad, aiColor);
    });
    if (container.children.length === 0) {
      this.appendWelcome(container, type);
    }
    scrollBottom(container);

    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.send({ container, messagesKey, type, inputEl: input, ...opts });
      }
    });
    input.addEventListener("input", () => autoResize(input));
    sendBtn.addEventListener("click", () => {
      this.send({ container, messagesKey, type, inputEl: input, ...opts });
    });
  },

  appendWelcome(container, type) {
    const u = App.user;
    const n = u?.nombre || "emprendedor";
    let msg, cls, name, icon, grad, color;
    if (type === "english") {
      msg = `¡Hola ${n}! 👋 Soy Alex. Estoy acá para enseñarte inglés de forma divertida. ¿Qué querés practicar hoy? Let's go! 🚀`;
      cls = "msg-english"; name = "Alex — Profesor de Inglés"; icon = "🎓"; color = "#a855f7"; grad = "linear-gradient(135deg,#a855f7,#6366f1)";
    } else if (type === "mate") {
      msg = `¡Hola ${n}! 💪 Soy Bruno, tu profesor de matemáticas. Con ejemplos de negocios, los números se vuelven simples. ¿Por dónde empezamos?`;
      cls = "msg-mate"; name = "Bruno — Matemáticas"; icon = "🔢"; color = "#22c55e"; grad = "linear-gradient(135deg,#22c55e,#16a34a)";
    } else {
      const obj = u?.objetivo ? ` Tu objetivo: ${u.objetivo}.` : "";
      const neg = u?.negocio ? ` sobre tu negocio de ${u.negocio}` : "";
      msg = `¡Hola ${n}! Soy AV MentorAI.${obj} Listo para ayudarte${neg}. ¿Por dónde empezamos?`;
      cls = "msg-ai"; name = "AV MentorAI"; icon = "⚡"; color = "#38bdf8"; grad = "linear-gradient(135deg,#38bdf8,#6366f1)";
    }
    this.appendMsg(container, msg, cls, name, icon, grad, color);
  },
};


// ═══════════════════════════════════════════════
// LOGO GENERATOR (gpt-image-1)
// ═══════════════════════════════════════════════
const Logo = {
  async generate({ nombre, descripcion, estilo, paleta }) {
    return API.req("/api/logo", "POST", { nombre, descripcion, estilo, paleta });
  },

  async download(dataUrl, filename) {
    try {
      // dataUrl viene como "data:image/png;base64,xxxx..."
      // fetch funciona perfecto con data URLs, sin problemas de CORS
      const resp = await fetch(dataUrl);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename || "logo.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      Toast.success("📥 Logo descargado");
    } catch (e) {
      // Fallback si algo raro pasa
      Toast.info("Abriendo el logo en una pestaña nueva (click derecho → Guardar imagen)");
      const w = window.open();
      if (w) {
        w.document.write(`<img src="${dataUrl}" style="max-width:100%" />`);
      }
    }
  },
};
