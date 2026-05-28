// ═══════════════════════════════════════════════════════════════
// chat-style.js v3 — Estilo ChatGPT puro + arreglos UX
//
// CAMBIOS v3:
// • Chat sin min-height → input pegado al teclado en iOS
// • Wrap del input transparente → un solo borde (no más doble encerrado)
// • Botones del input TODOS color gris uniforme (mic, paperclip, send)
// • Textarea sin apariencia nativa iOS (sin border-radius interno)
// + Lo de v2: AVAI sin bubble, vos a la derecha, typing solo ⚡
// ═══════════════════════════════════════════════════════════════
(function () {
  "use strict";

  // ── 1) CSS ─────────────────────────────────────────────────
  function injectStyles() {
    const existing = document.getElementById("av-chat-style-css");
    if (existing) existing.remove();

    const style = document.createElement("style");
    style.id = "av-chat-style-css";
    style.textContent = [
      "/* ═══ AVAI Chat estilo ChatGPT puro v3 ═══ */",
      "",
      "/* Chat: sin min-height para que se ajuste al contenido (fix iOS) */",
      "#chat-negocio {",
      "  min-height: auto !important;",
      "  max-height: 55vh !important;",
      "  max-height: 55dvh !important;",
      "}",
      "",
      "@media (max-width: 480px) {",
      "  #chat-negocio {",
      "    max-height: 50vh !important;",
      "    max-height: 50dvh !important;",
      "  }",
      "}",
      "",
      "/* Contenedor del chat como columna flex */",
      ".chat-wrap {",
      "  display: flex !important;",
      "  flex-direction: column !important;",
      "  gap: 14px !important;",
      "}",
      "",
      "/* Ocultar headers (avatar + 'VOS'/'AVAI') */",
      ".chat-msg .chat-msg-header { display: none !important; }",
      "",
      "/* ═══ MENSAJES DE AVAI ═══ */",
      ".chat-msg.msg-ai,",
      ".chat-msg.msg-english,",
      ".chat-msg.msg-mate {",
      "  background: transparent !important;",
      "  border: none !important;",
      "  border-left: none !important;",
      "  border-radius: 0 !important;",
      "  box-shadow: none !important;",
      "  padding: 6px 0 6px 44px !important;",
      "  margin: 0 !important;",
      "  max-width: 100% !important;",
      "  width: auto !important;",
      "  align-self: stretch !important;",
      "  position: relative !important;",
      "  line-height: 1.6 !important;",
      "  color: #f8fafc !important;",
      "}",
      "",
      ".chat-msg.msg-ai::before,",
      ".chat-msg.msg-english::before,",
      ".chat-msg.msg-mate::before {",
      "  content: \"\\26A1\";",
      "  position: absolute;",
      "  left: 0;",
      "  top: 2px;",
      "  width: 30px;",
      "  height: 30px;",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  font-size: 15px;",
      "  color: #facc15;",
      "  background: rgba(15,23,42,0.9);",
      "  border: 1px solid rgba(250,204,21,0.4);",
      "  border-radius: 50%;",
      "  line-height: 1;",
      "  box-shadow: 0 2px 8px rgba(0,0,0,0.25);",
      "}",
      "",
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
      ".chat-msg.msg-ai:has(.typing-indicator)::before,",
      ".chat-msg.msg-english:has(.typing-indicator)::before,",
      ".chat-msg.msg-mate:has(.typing-indicator)::before {",
      "  animation: avChatPulse 1.2s ease-in-out infinite;",
      "}",
      "",
      "@keyframes avChatPulse {",
      "  0%, 100% {",
      "    opacity: 0.5;",
      "    transform: scale(0.92);",
      "    box-shadow: 0 0 0 0 rgba(250,204,21,0.5);",
      "  }",
      "  50% {",
      "    opacity: 1;",
      "    transform: scale(1.08);",
      "    box-shadow: 0 0 16px 4px rgba(250,204,21,0.45);",
      "  }",
      "}",
      "",
      ".chat-msg.msg-ai:has(.typing-indicator) button,",
      ".chat-msg.msg-english:has(.typing-indicator) button,",
      ".chat-msg.msg-mate:has(.typing-indicator) button {",
      "  display: none !important;",
      "}",
      "",
      "/* ═══ INPUT WRAP — UN SOLO BORDE, SIN DOBLE ENCERRADO ═══ */",
      ".chat-input-wrap {",
      "  background: transparent !important;",
      "  box-shadow: none !important;",
      "  border: 1.5px solid rgba(250, 204, 21, 0.35) !important;",
      "  border-radius: 16px !important;",
      "}",
      "",
      ".chat-input-wrap:focus-within {",
      "  border-color: rgba(250, 204, 21, 0.6) !important;",
      "  box-shadow: none !important;",
      "  outline: none !important;",
      "}",
      "",
      "/* ═══ TEXTAREA — sin apariencia nativa iOS ═══ */",
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
      "/* ═══ BOTONES DEL INPUT — TODOS GRIS UNIFORME ═══ */",
      "/* Captura amplia: paperclip, send, mic (voice), cualquier botón del input row */",
      ".chat-input-row > button,",
      ".chat-input-row button,",
      ".chat-input-wrap button,",
      ".voice-btn,",
      "#voice-btn,",
      "#neg-voice-btn,",
      "button.voice-btn,",
      "[class*=\"voice-btn\"] {",
      "  background: rgba(2, 6, 23, 0.5) !important;",
      "  background-image: none !important;",
      "  background-color: rgba(2, 6, 23, 0.5) !important;",
      "  border: 1px solid rgba(148, 163, 184, 0.18) !important;",
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
      "/* Hover/focus para todos los botones del input */",
      ".chat-input-row > button:hover,",
      ".chat-input-row button:hover,",
      ".voice-btn:hover,",
      "#neg-voice-btn:hover,",
      ".chat-input-row > button:active {",
      "  background: rgba(2, 6, 23, 0.8) !important;",
      "  border-color: rgba(250, 204, 21, 0.3) !important;",
      "  color: #facc15 !important;",
      "}",
      "",
      "/* Sobrescribir SPECIFICAMENTE el send button con gradiente naranja */",
      ".chat-send-btn#neg-send,",
      "button#neg-send,",
      "#neg-send {",
      "  background: rgba(2, 6, 23, 0.5) !important;",
      "  background-image: none !important;",
      "  background-color: rgba(2, 6, 23, 0.5) !important;",
      "  border: 1px solid rgba(148, 163, 184, 0.18) !important;",
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
      "  border-color: rgba(250, 204, 21, 0.3) !important;",
      "  background: rgba(2, 6, 23, 0.8) !important;",
      "  transform: none !important;",
      "  box-shadow: none !important;",
      "}",
      "",
      "/* Responsive */",
      "@media (max-width: 480px) {",
      "  .chat-msg.msg-ai,",
      "  .chat-msg.msg-english,",
      "  .chat-msg.msg-mate {",
      "    padding-left: 38px !important;",
      "  }",
      "  .chat-msg.msg-ai::before,",
      "  .chat-msg.msg-english::before,",
      "  .chat-msg.msg-mate::before {",
      "    width: 26px;",
      "    height: 26px;",
      "    font-size: 13px;",
      "  }",
      "}"
    ].join("\n");
    document.head.appendChild(style);
  }

  // ── 2) Reemplazar 🎤 y 🔊 en cualquier botón ──
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

  // ── 3) Init + observer ────────────────────────────────────
  let scheduled = false;
  function scheduleProcess() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      processButtons();
    }, 200);
  }

  function init() {
    try {
      injectStyles();
      processButtons();

      if ("MutationObserver" in window && document.body) {
        const obs = new MutationObserver(scheduleProcess);
        obs.observe(document.body, { childList: true, subtree: true });
      }
    } catch (e) {
      console.warn("[chat-style v3] init falló:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
