// ═══════════════════════════════════════════════════════════════
// chat-style.js v2 — Estilo ChatGPT PURO para el chat de AVAI
//
// CAMBIOS v2 (versión definitiva):
// • AVAI sin bubble (estilo ChatGPT puro): solo texto + ⚡ al lado
// • Tus mensajes a la DERECHA con bubble dorado
// • Detección robusta: cualquier mensaje no-AVAI se trata como user
// • Typing: solo ⚡ pulsando, sin los 3 puntitos
// • Botones 🎤 y 🔊 → íconos Lucide (selector amplio)
// 100% additivo. No toca HTML ni lógica de la app.
// ═══════════════════════════════════════════════════════════════
(function () {
  "use strict";

  // ── 1) CSS estilo ChatGPT puro ─────────────────────────────
  function injectStyles() {
    const existing = document.getElementById("av-chat-style-css");
    if (existing) existing.remove();

    const style = document.createElement("style");
    style.id = "av-chat-style-css";
    style.textContent = [
      "/* ═══ AVAI Chat estilo ChatGPT puro ═══ */",
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
      "/* Sin bubble, solo texto con ⚡ circular al lado */",
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
      "/* ⚡ circular dorado a la izquierda del mensaje AVAI */",
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
      "/* Detección amplia: captura cualquier .chat-msg que NO sea AVAI */",
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
      "/* Y también captura cualquier hijo del chat que NO sea .chat-msg ni typing */",
      "#chat-negocio > div:not(.chat-msg):not(.typing-indicator),",
      "#chat-negocio > p:not(.chat-msg) {",
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
      "}",
      "",
      "/* No mostrar ⚡ en mensajes user */",
      ".chat-msg.msg-user::before { display: none !important; }",
      "",
      "/* ═══ TYPING INDICATOR ═══ */",
      "/* Ocultar los 3 puntitos */",
      ".typing-indicator .typing-dot { display: none !important; }",
      "",
      "/* Typing sin bubble, transparente */",
      ".typing-indicator {",
      "  background: transparent !important;",
      "  border: none !important;",
      "  padding: 4px 0 !important;",
      "  margin: 0 !important;",
      "  min-height: 20px;",
      "}",
      "",
      "/* Cuando AVAI carga, el ⚡ del mensaje pulsa */",
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
      "/* Ocultar botón TTS mientras AVAI carga */",
      ".chat-msg.msg-ai:has(.typing-indicator) button,",
      ".chat-msg.msg-english:has(.typing-indicator) button,",
      ".chat-msg.msg-mate:has(.typing-indicator) button {",
      "  display: none !important;",
      "}",
      "",
      "/* Chat más alto */",
      "#chat-negocio {",
      "  min-height: 55vh !important;",
      "  max-height: 70vh !important;",
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
      console.warn("[chat-style v2] init falló:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
