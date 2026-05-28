// ═══════════════════════════════════════════════════════════════
// chat-style.js — Estilo ChatGPT puro para el chat de AVAI
//
// • Oculta los headers (avatar "😊 VOS" / "⚡ AVAI")
// • Saca la línea de color lateral de los mensajes
// • Alinea los mensajes del usuario a la DERECHA (bubble dorada)
// • Alinea los mensajes de AVAI a la IZQUIERDA con un ⚡ al lado
// • Muestra el ⚡ también en el typing indicator (mientras AVAI escribe)
// • Reemplaza emojis 🎤 (micrófono) y 🔊 (audio) por íconos Lucide
// 100% additivo: no toca HTML ni lógica de la app.
// ═══════════════════════════════════════════════════════════════
(function () {
  "use strict";

  // ── 1) CSS: estilo bubble tipo ChatGPT ─────────────────────
  function injectStyles() {
    if (document.getElementById("av-chat-style-css")) return;
    const style = document.createElement("style");
    style.id = "av-chat-style-css";
    style.textContent = [
      "/* Más aire entre mensajes */",
      ".chat-wrap { gap: 14px !important; }",
      "",
      "/* Ocultar headers (avatares + 'VOS'/'AVAI') */",
      ".chat-msg .chat-msg-header { display: none !important; }",
      "",
      "/* Reset: sin bordes laterales de color, bubble compacta */",
      ".chat-msg {",
      "  border-left: none !important;",
      "  padding: 12px 16px !important;",
      "  max-width: 85%;",
      "  width: fit-content;",
      "  border-radius: 18px !important;",
      "  position: relative;",
      "  line-height: 1.55;",
      "}",
      "",
      "/* MENSAJE DEL USUARIO → DERECHA (bubble dorada) */",
      ".chat-msg.msg-user {",
      "  margin-left: auto !important;",
      "  margin-right: 0 !important;",
      "  background: linear-gradient(135deg, rgba(250,204,21,.14), rgba(249,115,22,.08)) !important;",
      "  border: 1px solid rgba(250,204,21,.22) !important;",
      "  border-bottom-right-radius: 4px !important;",
      "}",
      "",
      "/* MENSAJE DE AVAI → IZQUIERDA con ⚡ chiquito al lado */",
      ".chat-msg.msg-ai,",
      ".chat-msg.msg-english,",
      ".chat-msg.msg-mate {",
      "  margin-left: 40px !important;",
      "  margin-right: auto !important;",
      "  background: rgba(15,23,42,.7) !important;",
      "  border: 1px solid rgba(148,163,184,.14) !important;",
      "  border-bottom-left-radius: 4px !important;",
      "}",
      "",
      ".chat-msg.msg-ai::before,",
      ".chat-msg.msg-english::before,",
      ".chat-msg.msg-mate::before {",
      "  content: \"⚡\";",
      "  position: absolute;",
      "  left: -38px;",
      "  top: 6px;",
      "  width: 28px;",
      "  height: 28px;",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  font-size: 15px;",
      "  color: #facc15;",
      "  background: rgba(15,23,42,.9);",
      "  border: 1px solid rgba(250,204,21,.4);",
      "  border-radius: 50%;",
      "  line-height: 1;",
      "  box-shadow: 0 2px 8px rgba(0,0,0,.25);",
      "}",
      "",
      "/* TYPING INDICATOR (mientras AVAI escribe) con ⚡ */",
      ".typing-indicator {",
      "  margin-left: 40px !important;",
      "  position: relative;",
      "  background: rgba(15,23,42,.7);",
      "  border: 1px solid rgba(148,163,184,.14);",
      "  border-radius: 18px;",
      "  border-bottom-left-radius: 4px;",
      "  width: fit-content;",
      "  padding: 14px 18px !important;",
      "}",
      ".typing-indicator::before {",
      "  content: \"⚡\";",
      "  position: absolute;",
      "  left: -38px;",
      "  top: 50%;",
      "  transform: translateY(-50%);",
      "  width: 28px;",
      "  height: 28px;",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  font-size: 15px;",
      "  color: #facc15;",
      "  background: rgba(15,23,42,.9);",
      "  border: 1px solid rgba(250,204,21,.4);",
      "  border-radius: 50%;",
      "  line-height: 1;",
      "  box-shadow: 0 2px 8px rgba(0,0,0,.25);",
      "}",
      "",
      "/* Chat un toque más alto ahora que el dashboard está colapsado */",
      "#chat-negocio {",
      "  min-height: 55vh !important;",
      "  max-height: 70vh !important;",
      "}",
      "",
      "/* Responsive: en pantallas chicas reducimos el avatar ⚡ */",
      "@media (max-width: 480px) {",
      "  .chat-msg { max-width: 88%; }",
      "  .chat-msg.msg-ai,",
      "  .chat-msg.msg-english,",
      "  .chat-msg.msg-mate { margin-left: 34px !important; }",
      "  .chat-msg.msg-ai::before,",
      "  .chat-msg.msg-english::before,",
      "  .chat-msg.msg-mate::before {",
      "    left: -32px; width: 24px; height: 24px; font-size: 13px;",
      "  }",
      "  .typing-indicator { margin-left: 34px !important; }",
      "  .typing-indicator::before {",
      "    left: -32px; width: 24px; height: 24px; font-size: 13px;",
      "  }",
      "}"
    ].join("\n");
    document.head.appendChild(style);
  }

  // ── 2) Reemplazar 🎤 y 🔊 en botones por íconos Lucide ─────
  const MIC_EMOJIS = ["🎤", "🎙", "🎙\uFE0F"];
  const VOLUME_EMOJIS = ["🔊", "🔈", "🔉"];

  function tryReplace(btn, candidates, lucideName) {
    if (!btn || btn.hasAttribute("data-av-iconized")) return false;
    const html = btn.innerHTML.trim();
    for (let i = 0; i < candidates.length; i++) {
      const e = candidates[i];
      if (html === e || html === e + "\uFE0F") {
        btn.innerHTML = '<i data-lucide="' + lucideName + '" class="av-icon"></i>';
        btn.setAttribute("data-av-iconized", "1");
        return true;
      }
    }
    return false;
  }

  function processButtons() {
    let changed = 0;
    // Apuntar a botones probables: tipo button, .qbtn, .chat-send-btn, voice/audio
    const selector = "button, .qbtn, .chat-send-btn, [class*=voice], [class*=audio], [class*=tts], [class*=mic]";
    document.querySelectorAll(selector).forEach(function (btn) {
      if (tryReplace(btn, MIC_EMOJIS, "mic")) changed++;
      if (tryReplace(btn, VOLUME_EMOJIS, "volume-2")) changed++;
    });
    if (changed > 0 && window.lucide && typeof window.lucide.createIcons === "function") {
      try { window.lucide.createIcons(); } catch (e) {}
    }
  }

  // ── 3) Init + observer para contenido dinámico ─────────────
  let scheduled = false;
  function scheduleProcess() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      processButtons();
    }, 180);
  }

  function init() {
    try {
      injectStyles();
      processButtons();
      // Re-procesar cuando aparezcan nuevos botones (chats nuevos, etc.)
      if ("MutationObserver" in window && document.body) {
        const obs = new MutationObserver(scheduleProcess);
        obs.observe(document.body, { childList: true, subtree: true });
      }
    } catch (e) {
      console.warn("[chat-style] init falló:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
