// ═══════════════════════════════════════════════════════════════
// chat-style.js v6 — Fix crítico: tab switching
//
// FIX v6:
// • #tab-mentor flex layout SOLO cuando .active (no siempre)
// • .tab-content.hidden se respeta → otras tabs funcionan bien
// + Todo lo bueno de v5: mensajes arriba, input bottom,
//   sin doble borde, quick buttons amarillos, ⚡ sin círculo
// ═══════════════════════════════════════════════════════════════
(function () {
  "use strict";

  function injectStyles() {
    const existing = document.getElementById("av-chat-style-css");
    if (existing) existing.remove();

    const style = document.createElement("style");
    style.id = "av-chat-style-css";
    style.textContent = [
      "/* ═══ AVAI Chat estilo ChatGPT puro v6 ═══ */",
      "",
      "/* ═══ LAYOUT: SOLO afecta tab-mentor cuando está ACTIVO ═══ */",
      "/* Esto es crítico: si aplicamos flex sin .active, el tab queda visible siempre */",
      "#tab-mentor.active {",
      "  display: flex !important;",
      "  flex-direction: column !important;",
      "  min-height: 75vh !important;",
      "  min-height: 75dvh !important;",
      "}",
      "",
      "/* Asegurar que las tabs ocultas QUEDEN ocultas */",
      ".tab-content.hidden {",
      "  display: none !important;",
      "}",
      "",
      "/* Chat ocupa el espacio sobrante, mensajes EMPIEZAN ARRIBA */",
      "#tab-mentor.active > #chat-negocio,",
      "#tab-mentor.active #chat-negocio {",
      "  flex: 1 !important;",
      "  min-height: 45vh !important;",
      "  min-height: 45dvh !important;",
      "  max-height: none !important;",
      "  display: flex !important;",
      "  flex-direction: column !important;",
      "  justify-content: flex-start !important;",
      "  gap: 14px !important;",
      "  overflow-y: auto !important;",
      "  padding-bottom: 8px !important;",
      "}",
      "",
      "#tab-mentor.active .chat-wrap {",
      "  display: flex !important;",
      "  flex-direction: column !important;",
      "  justify-content: flex-start !important;",
      "  gap: 14px !important;",
      "}",
      "",
      "/* Ocultar headers de cada mensaje */",
      ".chat-msg .chat-msg-header { display: none !important; }",
      "",
      "/* ═══ MENSAJES DE AVAI — solo texto, sin rayo al costado ═══ */",
      ".chat-msg.msg-ai,",
      ".chat-msg.msg-english,",
      ".chat-msg.msg-mate {",
      "  background: transparent !important;",
      "  border: none !important;",
      "  border-left: none !important;",
      "  border-radius: 0 !important;",
      "  box-shadow: none !important;",
      "  padding: 6px 0 !important;",
      "  margin: 0 !important;",
      "  max-width: 100% !important;",
      "  width: auto !important;",
      "  align-self: stretch !important;",
      "  position: relative !important;",
      "  line-height: 1.6 !important;",
      "  color: #f8fafc !important;",
      "}",
      "",
      "/* Rayo OCULTO en mensajes normales */",
      ".chat-msg.msg-ai::before,",
      ".chat-msg.msg-english::before,",
      ".chat-msg.msg-mate::before {",
      "  display: none !important;",
      "  content: \"\";",
      "}",
      "",
      "/* PERO el rayo VUELVE (latiendo) mientras la IA piensa */",
      ".chat-msg.msg-ai:has(.typing-indicator)::before,",
      ".chat-msg.msg-english:has(.typing-indicator)::before,",
      ".chat-msg.msg-mate:has(.typing-indicator)::before {",
      "  display: block !important;",
      "  content: \"\" !important;",
      "  position: absolute !important;",
      "  left: 0 !important;",
      "  top: 2px !important;",
      "  width: 22px !important;",
      "  height: 22px !important;",
      "  background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23c79a3a'%3E%3Cpath d='M13 2L3 14h7l-1 8 10-12h-7z'/%3E%3C/svg%3E\") !important;",
      "  background-repeat: no-repeat !important;",
      "  background-position: center !important;",
      "  background-size: 22px 22px !important;",
      "  animation: avChatPulse 1.2s ease-in-out infinite !important;",
      "}",
      "",
      "/* Mientras piensa, el mensaje recupera el espacio del rayo */",
      ".chat-msg.msg-ai:has(.typing-indicator),",
      ".chat-msg.msg-english:has(.typing-indicator),",
      ".chat-msg.msg-mate:has(.typing-indicator) {",
      "  padding-left: 30px !important;",
      "}",
      "",
      "@keyframes avChatPulse {",
      "  0%, 100% { opacity: 0.4; transform: scale(0.9); }",
      "  50% { opacity: 1; transform: scale(1.1); }",
      "}",      "",
      "/* ═══ MENSAJES DEL USUARIO ═══ */",
      ".chat-msg.msg-user,",
      ".chat-msg:not(.msg-ai):not(.msg-english):not(.msg-mate):not(.typing-indicator) {",
      "  align-self: flex-end !important;",
      "  margin-left: auto !important;",
      "  margin-right: 0 !important;",
      "  background: linear-gradient(135deg, rgba(250,204,21,0.18), rgba(249,115,22,0.10)) !important;",
      "  border: 1px solid rgba(250,204,21,0.30) !important;",
      "  border-radius: 18px !important;",
      "  border-bottom-right-radius: 4px !important;",
      "  padding: 12px 16px !important;",
      "  max-width: 85% !important;",
      "  width: fit-content !important;",
      "  color: #f8fafc !important;",
      "  line-height: 1.55 !important;",
      "  word-wrap: break-word !important;",
      "}",
      "",
      ".chat-msg.msg-user::before { display: none !important; }",
      "",
      "/* ═══ TYPING INDICATOR ═══ */",
      ".typing-indicator .typing-dot { display: none !important; }",
      "",
      ".typing-indicator {",
      "  background: transparent !important;",
      "  border: none !important;",
      "  padding: 4px 0 !important;",
      "  margin: 0 !important;",
      "  min-height: 20px;",
      "}",
      "",
      ".chat-msg.msg-ai:has(.typing-indicator) button,",
      ".chat-msg.msg-english:has(.typing-indicator) button,",
      ".chat-msg.msg-mate:has(.typing-indicator) button {",
      "  display: none !important;",
      "}",
      "",
      "/* ═══ BOTÓN DE SONIDO (TTS) — sin recuadro, ícono suelto ═══ */",
      ".chat-msg button,",
      ".chat-msg [class*=\"tts\"],",
      ".chat-msg [class*=\"speak\"],",
      ".chat-msg [onclick*=\"speak\"],",
      ".chat-msg [onclick*=\"tts\"],",
      ".chat-msg [onclick*=\"audio\"] {",
      "  background: transparent !important;",
      "  background-color: transparent !important;",
      "  background-image: none !important;",
      "  border: none !important;",
      "  box-shadow: none !important;",
      "  padding: 2px !important;",
      "  color: #94a3b8 !important;",
      "}",
      ".chat-msg button:hover {",
      "  background: transparent !important;",
      "  color: #c79a3a !important;",
      "}",
      "",
      "/* ═══ INPUT — WRAP TRANSPARENTE, ROW CON EL ÚNICO BORDE ═══ */",
      ".chat-input-wrap {",
      "  background: transparent !important;",
      "  background-color: transparent !important;",
      "  background-image: none !important;",
      "  border: none !important;",
      "  box-shadow: none !important;",
      "  outline: none !important;",
      "  padding: 0 !important;",
      "  margin-top: 12px !important;",
      "}",
      "",
      ".chat-input-wrap:focus-within {",
      "  background: transparent !important;",
      "  border: none !important;",
      "  box-shadow: none !important;",
      "  outline: none !important;",
      "}",
      "",
      ".chat-input-row {",
      "  background: rgba(15, 23, 42, 0.45) !important;",
      "  background-image: none !important;",
      "  border: 2px solid rgba(250, 204, 21, 0.45) !important;",
      "  border-radius: 18px !important;",
      "  padding: 6px 8px !important;",
      "  display: flex !important;",
      "  align-items: center !important;",
      "  gap: 6px !important;",
      "  box-shadow: none !important;",
      "  outline: none !important;",
      "  transition: border-color 0.2s ease !important;",
      "}",
      "",
      ".chat-input-row:focus-within {",
      "  border-color: rgba(250, 204, 21, 0.7) !important;",
      "}",
      "",
      "/* TEXTAREA */",
      ".chat-input-row textarea,",
      "#neg-input {",
      "  -webkit-appearance: none !important;",
      "  appearance: none !important;",
      "  border-radius: 0 !important;",
      "  border: 0 !important;",
      "  outline: none !important;",
      "  background: transparent !important;",
      "  background-color: transparent !important;",
      "  box-shadow: none !important;",
      "  -webkit-tap-highlight-color: transparent !important;",
      "}",
      "",
      "/* BOTONES DEL INPUT — transparentes, hover sutil */",
      ".chat-input-row > button,",
      ".chat-input-row button,",
      ".chat-input-wrap button,",
      ".voice-btn,",
      "#voice-btn,",
      "#neg-voice-btn,",
      "button.voice-btn,",
      "[class*=\"voice-btn\"] {",
      "  background: transparent !important;",
      "  background-image: none !important;",
      "  background-color: transparent !important;",
      "  border: none !important;",
      "  color: #94a3b8 !important;",
      "  width: 36px !important;",
      "  height: 36px !important;",
      "  min-width: 36px !important;",
      "  border-radius: 9px !important;",
      "  box-shadow: none !important;",
      "  font-weight: 600 !important;",
      "  transform: none !important;",
      "  display: flex !important;",
      "  align-items: center !important;",
      "  justify-content: center !important;",
      "  padding: 0 !important;",
      "}",
      "",
      ".chat-input-row > button:hover,",
      ".chat-input-row button:hover {",
      "  background: rgba(148, 163, 184, 0.15) !important;",
      "  color: #facc15 !important;",
      "}",
      "",
      ".chat-send-btn#neg-send,",
      "button#neg-send,",
      "#neg-send {",
      "  background: transparent !important;",
      "  background-image: none !important;",
      "  background-color: transparent !important;",
      "  border: none !important;",
      "  color: #94a3b8 !important;",
      "  font-weight: 600 !important;",
      "  font-size: 15px !important;",
      "  box-shadow: none !important;",
      "  transform: none !important;",
      "}",
      "",
      "#neg-send:hover,",
      "#neg-send:active {",
      "  color: #facc15 !important;",
      "  background: rgba(148, 163, 184, 0.15) !important;",
      "}",
      "",
      "/* ═══ QUICK BUTTONS — TODOS AMARILLOS ═══ */",
      ".qbtn,",
      ".qbtn-gold,",
      ".qbtn-green,",
      ".qbtn-indigo,",
      ".qbtn-red,",
      ".qbtn-purple,",
      ".qbtn-sky,",
      ".qbtn-blue,",
      "[class*=\"qbtn-\"] {",
      "  border: 1.5px solid rgba(250, 204, 21, 0.4) !important;",
      "  background: rgba(15, 23, 42, 0.5) !important;",
      "  background-image: none !important;",
      "  background-color: rgba(15, 23, 42, 0.5) !important;",
      "  color: #facc15 !important;",
      "  box-shadow: none !important;",
      "  transition: all 0.2s ease !important;",
      "}",
      "",
      ".qbtn:hover,",
      "[class*=\"qbtn-\"]:hover {",
      "  border-color: rgba(250, 204, 21, 0.75) !important;",
      "  background: rgba(250, 204, 21, 0.10) !important;",
      "  background-color: rgba(250, 204, 21, 0.10) !important;",
      "  color: #facc15 !important;",
      "  transform: translateY(-1px) !important;",
      "}",
      "",
      "/* ═══ BOTÓN CHAT-FOCUS (⚡ standalone) — SIN CÍRCULO ═══ */",
      ".av-focus-toggle,",
      ".av-chat-focus,",
      ".chat-focus-btn,",
      ".av-chat-focus-toggle,",
      "[data-focus-btn],",
      "#av-focus-toggle,",
      "#chat-focus-btn,",
      "button.av-focus,",
      "button[class*=\"focus-toggle\"],",
      "button[class*=\"chat-focus\"] {",
      "  background: transparent !important;",
      "  background-color: transparent !important;",
      "  background-image: none !important;",
      "  border: none !important;",
      "  border-radius: 0 !important;",
      "  box-shadow: none !important;",
      "  width: auto !important;",
      "  height: auto !important;",
      "  padding: 8px !important;",
      "  font-size: 32px !important;",
      "  color: #facc15 !important;",
      "  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));",
      "}",
      "",
      "/* Responsive */",
      "@media (max-width: 480px) {",
      "  .chat-msg.msg-ai,",
      "  .chat-msg.msg-english,",
      "  .chat-msg.msg-mate {",
      "    padding-left: 0 !important;",
      "  }",
      "}"
    ].join("\n");
    document.head.appendChild(style);
  }

  // ── Reemplazar 🎤 y 🔊 en botones ──
  function processButtons() {
    if (!window.lucide || typeof window.lucide.createIcons !== "function") {
      return;
    }

    const candidates = document.querySelectorAll(
      "button, [role=\"button\"], .chat-send-btn, .qbtn, " +
      "[class*=voice], [class*=audio], [class*=tts], [class*=mic], [class*=speak]"
    );

    let changed = 0;
    candidates.forEach(function (el) {
      if (el.hasAttribute("data-av-iconized-chat")) return;
      const txt = (el.textContent || "").trim().replace(/\uFE0F/g, "");
      if (txt === "\uD83C\uDFA4") {
        el.innerHTML = "<i data-lucide=\"mic\" style=\"width:20px;height:20px\"></i>";
        el.setAttribute("data-av-iconized-chat", "1");
        changed++;
      } else if (txt === "\uD83D\uDD0A") {
        el.innerHTML = "<i data-lucide=\"volume-2\" style=\"width:20px;height:20px\"></i>";
        el.setAttribute("data-av-iconized-chat", "1");
        changed++;
      } else if (txt === "\uD83C\uDF99") {
        el.innerHTML = "<i data-lucide=\"mic\" style=\"width:20px;height:20px\"></i>";
        el.setAttribute("data-av-iconized-chat", "1");
        changed++;
      }
    });

    if (changed > 0) {
      try { window.lucide.createIcons(); } catch (e) {}
    }
  }

  // ── Sacar círculo del botón ⚡ chat-focus (fallback JS) ──
  function fixFocusButton() {
    document.querySelectorAll("button, [role=\"button\"]").forEach(function (el) {
      if (el.hasAttribute("data-av-focus-fixed")) return;
      if (el.closest(".chat-msg")) return;
      if (el.closest("#chat-negocio")) return;
      if (el.closest(".sidebar-logo")) return;
      if (el.closest(".dash-hero")) return;
      if (el.closest("#sidebar")) return;

      const txt = (el.textContent || "").trim().replace(/\uFE0F/g, "");
      if (txt === "\u26A1") {
        el.style.cssText +=
          "background: transparent !important;" +
          "background-color: transparent !important;" +
          "background-image: none !important;" +
          "border: none !important;" +
          "border-radius: 0 !important;" +
          "box-shadow: none !important;" +
          "width: auto !important;" +
          "height: auto !important;" +
          "padding: 8px !important;" +
          "font-size: 32px !important;" +
          "color: #facc15 !important;";
        el.setAttribute("data-av-focus-fixed", "1");
      }
    });
  }

  // ── Init + observer ──
  let scheduled = false;
  function scheduleProcess() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      processButtons();
      fixFocusButton();
    }, 200);
  }

  function init() {
    try {
      injectStyles();
      processButtons();
      fixFocusButton();

      if ("MutationObserver" in window && document.body) {
        const obs = new MutationObserver(scheduleProcess);
        obs.observe(document.body, { childList: true, subtree: true });
      }
    } catch (e) {
      console.warn("[chat-style v6] init falló:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
