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
    return this.chatStream(
      { type, messages, modo, desafio, leccion, englishModo, mateModo, useWebSearch, image },
      null
    );
  },

  async chatStream({ type, messages, modo, desafio, leccion, englishModo, mateModo, useWebSearch, image }, onDelta) {
    const resp = await fetch(this.base + "/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": App.token ? `Bearer ${App.token}` : "",
      },
      body: JSON.stringify({
        type, messages, user: App.user, modo: modo || App.modo,
        desafio: desafio || App.desafio, leccion, englishModo, mateModo, useWebSearch, image,
      }),
    });

    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      let errData;
      try { errData = await resp.json(); } catch { errData = { error: "Error desconocido" }; }
      if (!resp.ok) throw new Error(errData.error || "Error del servidor");
      return {
        reply: errData.reply || "",
        tipo: errData.tipo || "text",
        image_url: errData.image_url || null,
        modo: errData.modo || null,
        used: errData.used,
        limit: errData.limit,
      };
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullReply = "";
    let finalData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        if (!part.trim()) continue;
        const lines = part.split("\n");
        let eventName = "message";
        let dataStr = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) eventName = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataStr += line.slice(6);
        }
        if (!dataStr) continue;
        let parsed;
        try { parsed = JSON.parse(dataStr); } catch { continue; }

        if (eventName === "delta") {
          fullReply += parsed.text || "";
          if (onDelta) onDelta(parsed.text || "", fullReply);
        } else if (eventName === "done") {
          finalData = parsed;
        } else if (eventName === "error") {
          throw new Error(parsed.error || "Error del servidor");
        }
      }
    }

    if (!finalData) return { reply: fullReply };
    if (!finalData.reply) finalData.reply = fullReply;
    return finalData;
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
  sumarXP(n) {},

  async accion(tipo) {
    if (!App.user) return null;
    try {
      const data = await API.req("/api/accion", "POST", { tipo });
      if (data && data.user) {
        const oldPwd = App.user.password_hash;
        App.user = { ...App.user, ...data.user };
        if (oldPwd) App.user.password_hash = oldPwd;
        Store.save();
        refreshHeader();
      }
      return data;
    } catch (e) {
      const msg = (e.message || "").toLowerCase();
      if (msg.includes("máximo diario") || msg.includes("limit")) {
        return { limit_reached: true, error: e.message };
      }
      console.warn("Error en acción:", tipo, e);
      return null;
    }
  },

  desbloquearLogros() {},

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

function cleanLinks(str) {
  if (!str) return "";
  let s = String(str);
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s\)]+)\)/g, (m, txt, url) => {
    const cleanTxt = txt.trim();
    return `🔗 ${cleanTxt}`;
  });
  s = s.replace(/\(\s*https?:\/\/[^\s\)]+\s*\)/g, "");
  s = s.replace(/https?:\/\/[^\s\)]+/g, "");
  s = s.replace(/\(\s*\)/g, "");
  return s;
}

function stripForVoice(str) {
  if (!str) return "";
  let s = String(str);
  s = cleanLinks(s);
  s = s.replace(/```[\s\S]*?```/g, "");
  s = s.replace(/`([^`\n]+)`/g, "$1");
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/\*\*([^\*\n]+)\*\*/g, "$1");
  s = s.replace(/\*([^\*\n]+)\*/g, "$1");
  s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, "");
  s = s.replace(/🔗/g, "");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function mdRender(str) {
  if (!str) return "";
  let html = cleanLinks(String(str));
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/```([\s\S]*?)```/g, (m, code) =>
    `<pre style="background:rgba(0,0,0,.3);padding:10px;border-radius:8px;overflow-x:auto;font-size:12px;border:1px solid rgba(255,255,255,.1)"><code>${code.trim()}</code></pre>`
  );
  html = html.replace(/`([^`\n]+)`/g, '<code style="background:rgba(168,85,247,.18);padding:2px 6px;border-radius:4px;font-size:.92em;color:#e9d5ff">$1</code>');
  html = html.replace(/^### (.+)$/gm, '<h4 style="margin:14px 0 6px;color:#facc15;font-family:\'Syne\',sans-serif;font-size:15px">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 style="margin:16px 0 8px;color:#facc15;font-family:\'Syne\',sans-serif;font-size:17px">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2 style="margin:18px 0 10px;color:#facc15;font-family:\'Syne\',sans-serif;font-size:19px">$1</h2>');
  html = html.replace(/\*\*([^\*\n]+)\*\*/g, '<strong style="font-weight:700">$1</strong>');
  html = html.replace(/(^|[^\*])\*([^\*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  html = html.replace(/^[\-\*] (.+)$/gm, '<li style="margin:3px 0">$1</li>');
  html = html.replace(/(<li[^>]*>.*?<\/li>(?:\s*<li[^>]*>.*?<\/li>)*)/gs, '<ul style="padding-left:20px;margin:6px 0">$1</ul>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<div style="margin:4px 0;padding-left:4px"><strong style="color:#facc15">$1.</strong> $2</div>');
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
    <span class="chat-name" style="color:#38bdf8">AVAI</span>
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
  if (tabId === "viajes") { renderViajes(); setSubnav("viajes","itinerario"); }
  if (tabId === "vidasana") { renderVidaSana(); setSubnav("vidasana","alimentacion"); }
  if (tabId === "juegos") { renderJuegos(); setSubnav("juegos","historia"); }
  if (tabId === "admin") { renderAdminPanel(); }
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
// MENTOR CHATS — historial de conversaciones del Mentor
// (Paso 1: backend de datos. Sin UI todavía.)
// ═══════════════════════════════════════════════
const MentorChats = {
  MAX_CHATS: 40,
  MAX_MSGS: 40,

  _lista() {
    const u = App.user;
    if (!u) return [];
    if (!Array.isArray(u.mentor_chats)) {
      // Arranque limpio: ignoramos cualquier user.messages viejo.
      u.mentor_chats = [];
      u.mentor_chat_activo = null;
    }
    return u.mentor_chats;
  },

  _nuevoId() {
    return "mc_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
  },

  _tituloDesde(mensajes) {
    const primerUser = (mensajes || []).find(m => m.role === "user");
    if (!primerUser || !primerUser.content) return "Charla nueva";
    const palabras = String(primerUser.content).trim().split(/\s+/).slice(0, 6).join(" ");
    return palabras.length > 0 ? palabras : "Charla nueva";
  },

  getActivo() {
    const lista = this._lista();
    const u = App.user;
    let chat = lista.find(c => c.id === u.mentor_chat_activo);
    if (!chat) {
      chat = { id: this._nuevoId(), titulo: "Charla nueva", mensajes: [], actualizado: new Date().toISOString() };
      lista.unshift(chat);
      u.mentor_chat_activo = chat.id;
    }
    return chat;
  },

  mensajesActivos() {
    return this.getActivo().mensajes || [];
  },

  guardarActivo(mensajes) {
    const u = App.user;
    if (!u) return;
    const lista = this._lista();
    const chat = this.getActivo();
    chat.mensajes = (mensajes || []).slice(-this.MAX_MSGS);
    chat.actualizado = new Date().toISOString();
    if (!chat.titulo || chat.titulo === "Charla nueva") {
      chat.titulo = this._tituloDesde(chat.mensajes);
    }
    const idx = lista.indexOf(chat);
    if (idx > 0) { lista.splice(idx, 1); lista.unshift(chat); }
    if (lista.length > this.MAX_CHATS) lista.length = this.MAX_CHATS;
    Store.save();
    API.saveUser({ mentor_chats: u.mentor_chats, mentor_chat_activo: u.mentor_chat_activo }).catch(() => {});
  },

  vaciarActivo() {
    const chat = this.getActivo();
    chat.mensajes = [];
    chat.titulo = "Charla nueva";
    chat.actualizado = new Date().toISOString();
    Store.save();
    API.saveUser({ mentor_chats: App.user.mentor_chats, mentor_chat_activo: App.user.mentor_chat_activo }).catch(() => {});
  },

  listarTodos() {
    return this._lista().slice();
  },

  cambiarActivo(id) {
    const lista = this._lista();
    const existe = lista.find(c => c.id === id);
    if (!existe) return false;
    App.user.mentor_chat_activo = id;
    Store.save();
    API.saveUser({ mentor_chat_activo: id }).catch(() => {});
    return true;
  },

  crearNuevo() {
    const lista = this._lista();
    const activo = lista.find(c => c.id === App.user.mentor_chat_activo);
    if (activo && (!activo.mensajes || activo.mensajes.length === 0)) {
      return activo;
    }
    const chat = { id: this._nuevoId(), titulo: "Charla nueva", mensajes: [], actualizado: new Date().toISOString() };
    lista.unshift(chat);
    App.user.mentor_chat_activo = chat.id;
    if (lista.length > this.MAX_CHATS) lista.length = this.MAX_CHATS;
    Store.save();
    API.saveUser({ mentor_chats: App.user.mentor_chats, mentor_chat_activo: App.user.mentor_chat_activo }).catch(() => {});
    return chat;
  },
};
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

    if (type === "negocio" && App.modo === "Conversación Libre" && !useWebSearch) {
      useWebSearch = true;
    }

    const msgClass = type === "english" ? "msg-english" : type === "mate" ? "msg-mate" : "msg-ai";
    const aiName = type === "english" ? "Alex — Profesor de Inglés" : type === "mate" ? "Bruno — Matemáticas" : "AVAI";
    const aiIcon = type === "english" ? "🎓" : type === "mate" ? "🔢" : "⚡";
    const aiColor = type === "english" ? "#a855f7" : type === "mate" ? "#22c55e" : "#38bdf8";
    const avatarGrad = type === "english" ? "linear-gradient(135deg,#a855f7,#6366f1)" : type === "mate" ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#38bdf8,#6366f1)";

    if (!App.chatMessages[messagesKey]) App.chatMessages[messagesKey] = [];
    const userMsg = text || "(imagen)";
    App.chatMessages[messagesKey].push({ role: "user", content: userMsg });
    this.appendMsg(container, userMsg, "user", null, null, null, null, pendingImage);
    this._pendingImage = null;
    this._clearImagePreview();
    const spinner = showSpinner(container);

    let streamingDiv = null;
    let streamingTextEl = null;
    const showStreamingMsg = () => {
      removeSpinner();
      streamingDiv = document.createElement("div");
      streamingDiv.className = `chat-msg ${msgClass}`;
      streamingDiv.innerHTML = `<div class="chat-msg-header">
        <div class="chat-avatar" style="background:${avatarGrad}">${aiIcon}</div>
        <span class="chat-name" style="color:${aiColor}">${aiName}</span>
      </div><div class="chat-msg-body"></div>`;
      streamingTextEl = streamingDiv.querySelector(".chat-msg-body");
      container.appendChild(streamingDiv);
      scrollBottom(container);
    };

    try {
      const history = App.chatMessages[messagesKey].slice(-16).map(m => ({ role: m.role, content: m.content }));
      const data = await API.chatStream(
        { type: type === "englishRoleplay" ? "english" : type, messages: history, englishModo, mateModo, useWebSearch, image: pendingImage },
        (chunk, fullText) => {
          if (!streamingDiv) showStreamingMsg();
          if (streamingTextEl) {
            streamingTextEl.innerHTML = mdRender(fullText);
            scrollBottom(container);
          }
        }
      );
      if (!streamingDiv) {
        removeSpinner();
        if (data.tipo === "image" && data.image_url) {
          this.appendImageMsg(container, data.image_url, data.reply || "✨ Acá tenés tu imagen.", aiName, aiIcon, avatarGrad, aiColor);
        } else {
          this.appendMsg(container, data.reply, msgClass, aiName, aiIcon, avatarGrad, aiColor);
        }
      } else if (data.tipo === "image" && data.image_url) {
        streamingDiv.remove();
        this.appendImageMsg(container, data.image_url, data.reply || "✨ Acá tenés tu imagen.", aiName, aiIcon, avatarGrad, aiColor);
      }
      const reply = data.reply;
      App.chatMessages[messagesKey].push({ role: "assistant", content: reply });
      UserHelper.accion("chat_message");

      if (messagesKey === "negocio") {
        MentorChats.guardarActivo(App.chatMessages.negocio);
      } else {
        const userKey = messagesKey === "english" ? "english_messages" : messagesKey === "englishRoleplay" ? "english_roleplay_messages" : "mate_messages";
        if (!App.user[userKey]) App.user[userKey] = [];
        App.user[userKey] = App.chatMessages[messagesKey].slice(-40);
        Store.save();
        API.saveUser({ [userKey]: App.user[userKey] }).catch(() => {});
      }
    } catch (err) {
      removeSpinner();
      if (streamingDiv) streamingDiv.remove();
      Toast.error(err.message);
      this.appendMsg(container, "❌ " + err.message, msgClass, aiName, aiIcon, avatarGrad, aiColor);
    }
  },

  _pendingImage: null,
  _pendingImageInputId: null,

  attachImage(fileInputEl, previewContainerId) {
    const file = fileInputEl.files && fileInputEl.files[0];
    if (!file) return;
    if (!App.user || App.user.plan === "Gratis") {
      Toast.error("Subir imágenes es una función Premium. Actualizá tu plan para usarla.");
      fileInputEl.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      Toast.error("Solo se aceptan archivos de imagen (.jpg, .png, .webp).");
      fileInputEl.value = "";
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      Toast.error("La imagen es demasiado grande (máximo 20 MB).");
      fileInputEl.value = "";
      return;
    }

    const needsCompression = file.size > 2 * 1024 * 1024;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (!needsCompression) {
        this._pendingImage = e.target.result;
        this._pendingImageInputId = previewContainerId;
        this._showImagePreview(previewContainerId, e.target.result);
        return;
      }
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
    container.innerHTML = `<div style="position:relative;display:inline-block;margin-bottom:6px">
      <img src="${dataUrl}" style="width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid #e7e3da;display:block" />
      <button onclick="Chat._removeImage()" style="position:absolute;top:-7px;right:-7px;background:#2b2a27;border:2px solid #fff;color:#fff;cursor:pointer;font-size:11px;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;padding:0;line-height:1" title="Quitar imagen">✕</button>
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

  // Mensaje del USUARIO (puede tener imagen adjunta arriba del texto)
  appendMsg(container, text, cls, name, icon, grad, color, imageDataUrl) {
    const div = document.createElement("div");
    div.className = `chat-msg ${cls}`;
    const imageHtml = imageDataUrl ? `<img src="${imageDataUrl}" class="chat-user-img" alt="Imagen adjunta" />` : "";
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

  // ✨ FIX DEFINITIVO: imagen generada por la IA en el chat
  // Usa la clase .chat-img-wrap del CSS que resetea el white-space:pre-wrap
  // del .chat-msg padre. Esto es lo que arregla el corte de la imagen.
  appendImageMsg(container, imageUrl, captionText, name, icon, grad, color) {
    const div = document.createElement("div");
    div.className = `chat-msg msg-ai`;
    const id = "imggen_" + Date.now();
    div.innerHTML = `<div class="chat-msg-header">
        <div class="chat-avatar" style="background:${grad || 'linear-gradient(135deg,#facc15,#f97316)'}">${icon || '🎨'}</div>
        <span class="chat-name" style="color:${color || '#facc15'}">${name || 'AVAI'}</span>
      </div>
      <div>${mdRender(captionText || '✨ Acá tenés tu imagen.')}</div>
      <div class="chat-img-wrap">
        <img id="${id}" src="${imageUrl}" onclick="openImageLightbox('${id}')" alt="Imagen generada" />
      </div>
      <div class="chat-img-actions">
        <button class="btn btn-ghost btn-sm" onclick="downloadImage('${id}','imagen-avai.png')">📥 Descargar</button>
        <button class="btn btn-ghost btn-sm" onclick="openImageLightbox('${id}')">🔍 Ver grande</button>
      </div>`;
    container.appendChild(div);
    scrollBottom(container);
  },

  init(containerId, inputId, sendBtnId, messagesKey, type, opts = {}) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    const sendBtn = document.getElementById(sendBtnId);
    if (!container || !input || !sendBtn) return;

    let userKey = messagesKey === "negocio" ? "messages" : messagesKey === "english" ? "english_messages" : messagesKey === "englishRoleplay" ? "english_roleplay_messages" : "mate_messages";
    if (messagesKey === "negocio") {
      App.chatMessages.negocio = MentorChats.mensajesActivos();
    } else {
      App.chatMessages[messagesKey] = (App.user?.[userKey] || []);
    }
    container.innerHTML = "";
    App.chatMessages[messagesKey].forEach(m => {
      const cls = m.role === "user" ? "user" : type === "english" || type === "englishRoleplay" ? "msg-english" : type === "mate" ? "msg-mate" : "msg-ai";
      const aiName = type === "english" || type === "englishRoleplay" ? "Alex — Profesor de Inglés" : type === "mate" ? "Bruno — Matemáticas" : "AVAI";
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
      msg = `¡Hola ${n}! Soy AVAI.${obj} Listo para ayudarte${neg}. ¿Por dónde empezamos?`;
      cls = "msg-ai"; name = "AVAI"; icon = "⚡"; color = "#38bdf8"; grad = "linear-gradient(135deg,#38bdf8,#6366f1)";
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
      Toast.info("Abriendo el logo en una pestaña nueva (click derecho → Guardar imagen)");
      const w = window.open();
      if (w) {
        w.document.write(`<img src="${dataUrl}" style="max-width:100%" />`);
      }
    }
  },
};

// ═══════════════════════════════════════════════
// PLANIFICADOR DE VIAJES
// ═══════════════════════════════════════════════
const Viajes = {
  history: [],
  lastMode: null,

  async planificar({ mode, userMessage, formData, onDelta }) {
    this.history.push({ role: "user", content: userMessage });
    this.lastMode = mode;
    const data = await this._streamRequest({ mode, messages: this.history, formData }, onDelta);
    this.history.push({ role: "assistant", content: data.reply });
    return data;
  },

  async refinar(userMessage, onDelta) {
    this.history.push({ role: "user", content: userMessage });
    const data = await this._streamRequest({ mode: "refinar", messages: this.history }, onDelta);
    this.history.push({ role: "assistant", content: data.reply });
    return data;
  },

  async _streamRequest(body, onDelta) {
    const token = localStorage.getItem("av_token");
    const resp = await fetch("/api/viajes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify(body),
    });
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      let errData;
      try { errData = await resp.json(); } catch { errData = { error: "Error desconocido" }; }
      throw new Error(errData.error || "Error en la solicitud");
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullReply = "";
    let finalData = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        if (!part.trim()) continue;
        const lines = part.split("\n");
        let eventName = "message";
        let dataStr = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) eventName = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataStr += line.slice(6);
        }
        if (!dataStr) continue;
        let parsed;
        try { parsed = JSON.parse(dataStr); } catch { continue; }
        if (eventName === "delta") {
          fullReply += parsed.text || "";
          if (onDelta) onDelta(parsed.text || "", fullReply);
        } else if (eventName === "done") {
          finalData = parsed;
        } else if (eventName === "error") {
          throw new Error(parsed.error || "Error del servidor");
        }
      }
    }
    if (!finalData) return { reply: fullReply, used: 0, limit: 0 };
    return finalData;
  },

  reset() { this.history = []; this.lastMode = null; },

  imprimir() {
    if (this.history.length === 0) { Toast.error("No hay itinerario para imprimir."); return; }
    const lastAssistant = [...this.history].reverse().find(m => m.role === "assistant");
    if (!lastAssistant) { Toast.error("No hay itinerario para imprimir."); return; }
    const win = window.open("", "_blank");
    if (!win) { Toast.error("No se pudo abrir la ventana de impresión. Permití pop-ups."); return; }
    const html = mdRender(lastAssistant.content);
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Mi Viaje — AVAI</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1f2937; line-height: 1.7; }
  h1, h2, h3 { color: #0f172a; }
  h2 { border-bottom: 2px solid #facc15; padding-bottom: 8px; margin-top: 30px; }
  h3 { color: #f97316; margin-top: 24px; }
  hr { border: none; border-top: 1px dashed #d1d5db; margin: 24px 0; }
  strong { color: #0f172a; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; text-align: center; }
  @media print { body { margin: 20px; } }
</style></head><body>${html}
<div class="footer">Generado con ⚡ AVAI · ${new Date().toLocaleDateString("es-AR")}</div>
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  },

  copiar() {
    const lastAssistant = [...this.history].reverse().find(m => m.role === "assistant");
    if (!lastAssistant) { Toast.error("No hay itinerario para copiar."); return; }
    navigator.clipboard.writeText(lastAssistant.content)
      .then(() => Toast.success("📋 Itinerario copiado"))
      .catch(() => Toast.error("No se pudo copiar"));
  },
};

// ═══════════════════════════════════════════════
// VIDA SANA (Bienestar)
// ═══════════════════════════════════════════════
const Bienestar = {
  history: [],
  lastMode: null,

  async planificar({ mode, userMessage, formData, onDelta }) {
    this.history.push({ role: "user", content: userMessage });
    this.lastMode = mode;
    const data = await this._streamRequest({ mode, messages: this.history, formData }, onDelta);
    this.history.push({ role: "assistant", content: data.reply });
    return data;
  },

  async refinar(userMessage, onDelta) {
    this.history.push({ role: "user", content: userMessage });
    const refinarMode = this.lastMode === "alimentacion" ? "refinar-alim" : "refinar-ej";
    const data = await this._streamRequest({ mode: refinarMode, messages: this.history }, onDelta);
    this.history.push({ role: "assistant", content: data.reply });
    return data;
  },

  reset() { this.history = []; this.lastMode = null; },

  async _streamRequest(body, onDelta) {
    const token = localStorage.getItem("av_token");
    const resp = await fetch("/api/bienestar", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify(body),
    });
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      let errData;
      try { errData = await resp.json(); } catch { errData = { error: "Error desconocido" }; }
      throw new Error(errData.error || "Error en la solicitud");
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", fullReply = "", finalData = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        if (!part.trim()) continue;
        const lines = part.split("\n");
        let eventName = "message", dataStr = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) eventName = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataStr += line.slice(6);
        }
        if (!dataStr) continue;
        let parsed;
        try { parsed = JSON.parse(dataStr); } catch { continue; }
        if (eventName === "delta") {
          fullReply += parsed.text || "";
          if (onDelta) onDelta(parsed.text || "", fullReply);
        } else if (eventName === "done") finalData = parsed;
        else if (eventName === "error") throw new Error(parsed.error || "Error del servidor");
      }
    }
    if (!finalData) return { reply: fullReply };
    return finalData;
  },

  imprimir() {
    if (this.history.length === 0) { Toast.error("No hay plan para imprimir."); return; }
    const lastAssistant = [...this.history].reverse().find(m => m.role === "assistant");
    if (!lastAssistant) { Toast.error("No hay plan para imprimir."); return; }
    const win = window.open("", "_blank");
    if (!win) { Toast.error("No se pudo abrir la ventana de impresión. Permití pop-ups."); return; }
    const html = mdRender(lastAssistant.content);
    const titulo = this.lastMode === "alimentacion" ? "Mi Plan de Alimentación" : "Mi Rutina de Ejercicio";
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${titulo} — AVAI</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1f2937; line-height: 1.7; }
  h1, h2, h3 { color: #0f172a; }
  h2 { border-bottom: 2px solid #22c55e; padding-bottom: 8px; margin-top: 30px; }
  h3 { color: #16a34a; margin-top: 24px; }
  hr { border: none; border-top: 1px dashed #d1d5db; margin: 24px 0; }
  strong { color: #0f172a; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; text-align: center; }
  @media print { body { margin: 20px; } }
</style></head><body>${html}
<div class="footer">Generado con ⚡ AVAI · ${new Date().toLocaleDateString("es-AR")}</div>
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  },

  copiar() {
    const lastAssistant = [...this.history].reverse().find(m => m.role === "assistant");
    if (!lastAssistant) { Toast.error("No hay plan para copiar."); return; }
    navigator.clipboard.writeText(lastAssistant.content)
      .then(() => Toast.success("📋 Plan copiado"))
      .catch(() => Toast.error("No se pudo copiar"));
  },
};

// ═══════════════════════════════════════════════
// MODO HISTORIA
// ═══════════════════════════════════════════════
const Historia = {
  partidaActual: null,
  ultimasOpciones: [],
  cargandoTurno: false,

  async listar() {
    const token = localStorage.getItem("av_token");
    const resp = await fetch("/api/historia", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ action: "listar" }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Error" }));
      throw new Error(err.error || "Error listando partidas");
    }
    return await resp.json();
  },

  async borrar(partida_id) {
    const token = localStorage.getItem("av_token");
    const resp = await fetch("/api/historia", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ action: "borrar", partida_id }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Error" }));
      throw new Error(err.error || "Error borrando partida");
    }
    return await resp.json();
  },

  async iniciar({ escenario_id, escenario_libre, onDelta }) {
    return this._streamRequest({ action: "iniciar", escenario_id, escenario_libre }, onDelta);
  },

  async avanzar({ partida_id, decision, onDelta }) {
    return this._streamRequest({ action: "avanzar", partida_id, decision }, onDelta);
  },

  async retomar({ partida_id, onDelta }) {
    return this._streamRequest({ action: "retomar", partida_id }, onDelta);
  },

  async _streamRequest(body, onDelta) {
    const token = localStorage.getItem("av_token");
    const resp = await fetch("/api/historia", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify(body),
    });
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      let errData;
      try { errData = await resp.json(); } catch { errData = { error: "Error desconocido" }; }
      throw new Error(errData.error || "Error en la solicitud");
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", fullReply = "", finalData = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        if (!part.trim()) continue;
        const lines = part.split("\n");
        let eventName = "message", dataStr = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) eventName = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataStr += line.slice(6);
        }
        if (!dataStr) continue;
        let parsed;
        try { parsed = JSON.parse(dataStr); } catch { continue; }
        if (eventName === "delta") {
          fullReply += parsed.text || "";
          if (onDelta) onDelta(parsed.text || "", fullReply);
        } else if (eventName === "done") finalData = parsed;
        else if (eventName === "error") throw new Error(parsed.error || "Error del servidor");
      }
    }
    if (!finalData) return { reply: fullReply };
    return finalData;
  },

  limpiarNarrativa(texto) {
    return String(texto || "")
      .replace(/\[METRICAS\][\s\S]*?\[\/METRICAS\]/gi, "")
      .replace(/\[OPCIONES\][\s\S]*?\[\/OPCIONES\]/gi, "")
      .replace(/\[METRICAS\][\s\S]*$/gi, "")
      .replace(/\[OPCIONES\][\s\S]*$/gi, "")
      .replace(/(\n\s*[A-D]\s*\)[^\n]*)+\s*$/g, "")
      .trim();
  },
};

// ═══════════════════════════════════════════════
// BUSINESS EMPIRE IA
// ═══════════════════════════════════════════════
const Empire = {
  partidaActual: null,
  ultimasOpciones: [],
  cargandoTurno: false,
  detalleFinanciero: null,

  async listar() {
    const token = localStorage.getItem("av_token");
    const resp = await fetch("/api/empire", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ action: "listar" }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Error" }));
      throw new Error(err.error || "Error listando empresas");
    }
    return await resp.json();
  },

  async borrar(partida_id) {
    const token = localStorage.getItem("av_token");
    const resp = await fetch("/api/empire", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ action: "borrar", partida_id }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Error" }));
      throw new Error(err.error || "Error borrando partida");
    }
    return await resp.json();
  },

  async detalle(partida_id) {
    const token = localStorage.getItem("av_token");
    const resp = await fetch("/api/empire", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ action: "detalle", partida_id }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Error" }));
      throw new Error(err.error || "Error obteniendo detalle");
    }
    return await resp.json();
  },

  async iniciar({ negocio_id, onDelta }) {
    return this._streamRequest({ action: "iniciar", negocio_id }, onDelta);
  },

  async avanzar({ partida_id, decision, onDelta }) {
    return this._streamRequest({ action: "avanzar", partida_id, decision }, onDelta);
  },

  async gestionar({ partida_id, gestion_accion, onDelta }) {
    return this._streamRequest({ action: "gestionar", partida_id, gestion_accion }, onDelta);
  },

  async retomar({ partida_id, onDelta }) {
    return this._streamRequest({ action: "retomar", partida_id }, onDelta);
  },

  async _streamRequest(body, onDelta) {
    const token = localStorage.getItem("av_token");
    const resp = await fetch("/api/empire", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify(body),
    });
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      let errData;
      try { errData = await resp.json(); } catch { errData = { error: "Error desconocido" }; }
      throw new Error(errData.error || "Error en la solicitud");
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", fullReply = "", finalData = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        if (!part.trim()) continue;
        const lines = part.split("\n");
        let eventName = "message", dataStr = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) eventName = line.slice(7).trim();
          else if (line.startsWith("data: ")) dataStr += line.slice(6);
        }
        if (!dataStr) continue;
        let parsed;
        try { parsed = JSON.parse(dataStr); } catch { continue; }
        if (eventName === "delta") {
          fullReply += parsed.text || "";
          if (onDelta) onDelta(parsed.text || "", fullReply);
        } else if (eventName === "done") finalData = parsed;
        else if (eventName === "error") throw new Error(parsed.error || "Error del servidor");
      }
    }
    if (!finalData) return { reply: fullReply };
    return finalData;
  },

  limpiarNarrativa(texto) {
    return String(texto || "")
      .replace(/\[METRICAS\][\s\S]*?\[\/METRICAS\]/gi, "")
      .replace(/\[OPCIONES\][\s\S]*?\[\/OPCIONES\]/gi, "")
      .replace(/\[METRICAS\][\s\S]*$/gi, "")
      .replace(/\[OPCIONES\][\s\S]*$/gi, "")
      .replace(/(\n\s*[A-D]\s*\)[^\n]*)+\s*$/g, "")
      .trim();
  },
};

// ═══════════════════════════════════════════════
// ADMIN PANEL — Solo para Valentino
// ═══════════════════════════════════════════════
const Admin = {
  EMAIL_ADMIN: "valen810a@gmail.com",

  esAdmin() {
    const email = (App.user?.email || App.user?.username || "").toLowerCase().trim();
    return email === this.EMAIL_ADMIN;
  },

  async _request(action, extraBody = {}) {
    const token = localStorage.getItem("av_token");
    const resp = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ action, ...extraBody }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Error" }));
      throw new Error(err.error || `Error ${resp.status}`);
    }
    return await resp.json();
  },

  async listarUsuarios() { return this._request("usuarios"); },
  async stats() { return this._request("stats"); },
  async cambiarPlan(email_objetivo, nuevo_plan) { return this._request("cambiar_plan", { email_objetivo, nuevo_plan }); },
  async buscarUsuario(email_objetivo) { return this._request("buscar_usuario", { email_objetivo }); },
  async gasto() { return this._request("gasto"); },
  async setCap(cap) { return this._request("set_cap", { cap }); },
  async resetGasto() { return this._request("reset_gasto"); },
};

function updateAdminVisibility() {
  const section = document.getElementById("admin-section");
  if (!section) return;
  section.style.display = Admin.esAdmin() ? "block" : "none";
}
setInterval(updateAdminVisibility, 1500);
// ═══════════════════════════════════════════════
// AVISO DE TRIAL — días restantes de Premium de regalo
// Se muestra 1 vez por día mientras dura la prueba.
// ═══════════════════════════════════════════════
function avisoTrial() {
  const u = App.user;
  if (!u || !u.es_trial || u.plan !== "Premium" || !u.premium_vence) return;
  const ms = new Date(u.premium_vence).getTime() - Date.now();
  if (isNaN(ms) || ms <= 0) return;
  const dias = Math.ceil(ms / 86400000);
  const key = "avai_trial_aviso_" + today();
  if (localStorage.getItem(key)) return; // solo 1 vez por día
  localStorage.setItem(key, "1");
  const texto = dias >= 10
    ? `🎁 ¡Bienvenido! Te regalamos ${dias} días de Premium para que pruebes todo AVAI.`
    : `🎁 Te quedan ${dias} día${dias === 1 ? "" : "s"} de Premium de regalo. ¡Aprovechalo!`;
  Toast.show(texto, "info", 7000);
}
setInterval(avisoTrial, 4000);

// Helper global para descargar imágenes generadas
function downloadImage(imgId, filename) {
  const img = document.getElementById(imgId);
  if (!img) return;
  try {
    const a = document.createElement("a");
    a.href = img.src;
    a.download = filename || "imagen.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    window.open(img.src, "_blank");
  }
}

// ✨ FIX DEFINITIVO: lightbox usa clases CSS .av-lightbox
// Las clases tienen white-space:normal explícito y safe-area-inset
// Esto garantiza que la imagen se vea ENTERA en cualquier dispositivo
function openImageLightbox(imgId) {
  const img = document.getElementById(imgId);
  if (!img) return;

  const overlay = document.createElement("div");
  overlay.id = "img-lightbox-overlay";
  overlay.className = "av-lightbox";
  overlay.onclick = () => overlay.remove();

  const closeBtn = document.createElement("button");
  closeBtn.className = "av-lightbox-close";
  closeBtn.innerHTML = "✕";
  closeBtn.onclick = (e) => { e.stopPropagation(); overlay.remove(); };

  const bigImg = document.createElement("img");
  bigImg.src = img.src;
  bigImg.onclick = (e) => e.stopPropagation();

  const dlBtn = document.createElement("button");
  dlBtn.className = "av-lightbox-download";
  dlBtn.innerHTML = "📥 Descargar";
  dlBtn.onclick = (e) => {
    e.stopPropagation();
    const a = document.createElement("a");
    a.href = img.src;
    a.download = "imagen-avai.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  overlay.appendChild(bigImg);
  overlay.appendChild(closeBtn);
  overlay.appendChild(dlBtn);
  document.body.appendChild(overlay);

  const escHandler = (e) => {
    if (e.key === "Escape") {
      overlay.remove();
      document.removeEventListener("keydown", escHandler);
    }
  };
  document.addEventListener("keydown", escHandler);
}
