// js/voice.js — v3: Modo voz con micrófono + botón 🔊 manual por mensaje
// Adaptado para llamar a /api/chat (TTS + transcribe integrados ahí, no a /api/voice)
// Cambios v3:
//   - Token: avai_token (compatibilidad con av_token viejo)
//   - Endpoints: /api/chat con action="tts" / action="transcribe"
//   - Nombre IA en regex: AVAI (no AV MentorAI)
(function () {
  // Voces por contexto
  const VOICES = {
    english: "alloy",   // Alex: joven, energética
    negocio: "onyx",    // AVAI Mentor: profesional, autoridad
    mate: "echo",       // Bruno: cálido, profe
    default: "alloy",
  };

  // Helper: leer token sin importar si está como avai_token o av_token
  function getToken() {
    return localStorage.getItem("avai_token") || localStorage.getItem("av_token") || "";
  }

  const Voice = {
    recording: false,
    mediaRecorder: null,
    chunks: [],
    activeBtn: null,
    contextType: "default",
    stream: null,
    currentAudio: null,

    // ────────────────────────────────────────────────
    // GRABACIÓN (micrófono → Whisper → input → enviar)
    // ────────────────────────────────────────────────
    async startRecording(btn, contextType) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.stream = stream;
        // Detectar el mejor formato soportado por el navegador
        const candidates = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4;codecs=mp4a.40.2",
          "audio/mp4",
          "audio/ogg;codecs=opus",
          "audio/ogg",
        ];
        let mimeType = "";
        for (const candidate of candidates) {
          if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(candidate)) {
            mimeType = candidate;
            break;
          }
        }
        this.mimeType = mimeType || "audio/webm";
        try {
          this.mediaRecorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);
        } catch (e) {
          this.mediaRecorder = new MediaRecorder(stream);
        }
        this.chunks = [];
        this.activeBtn = btn;
        this.contextType = contextType;

        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) this.chunks.push(e.data);
        };
        this.mediaRecorder.onstop = () => this.handleAudio();

        this.mediaRecorder.start();
        this.recording = true;
        btn.textContent = "⏹";
        btn.classList.add("recording");
        btn.title = "Tocá para parar";
      } catch (err) {
        console.error("Mic error:", err);
        alert("⚠️ No se pudo acceder al micrófono. Permitilo desde la barra de direcciones del navegador.");
      }
    },

    stopRecording() {
      if (!this.recording || !this.mediaRecorder) return;
      try { this.mediaRecorder.stop(); } catch (e) {}
      this.recording = false;
      if (this.stream) {
        this.stream.getTracks().forEach((t) => t.stop());
        this.stream = null;
      }
      if (this.activeBtn) {
        this.activeBtn.textContent = "🎤";
        this.activeBtn.classList.remove("recording");
        this.activeBtn.title = "Hablar (5 gratis/día)";
      }
    },

    async handleAudio() {
      if (!this.activeBtn) return;
      const row = this.activeBtn.parentElement;
      const inputEl = row.querySelector("textarea");
      const sendBtn = row.querySelector(".chat-send-btn");
      if (!inputEl || !sendBtn) return;

      const realMime = this.mimeType || "audio/webm";
      const blob = new Blob(this.chunks, { type: realMime });
      if (blob.size < 1000) return;

      const originalPlaceholder = inputEl.placeholder;
      inputEl.placeholder = "🎤 Transcribiendo...";
      inputEl.disabled = true;
      this.activeBtn.disabled = true;

      try {
        const text = await this.transcribe(blob, this.contextType);
        inputEl.disabled = false;
        this.activeBtn.disabled = false;
        inputEl.placeholder = originalPlaceholder;

        if (text && text.trim()) {
          inputEl.value = text.trim();
          sendBtn.click();
        }
      } catch (err) {
        inputEl.disabled = false;
        this.activeBtn.disabled = false;
        inputEl.placeholder = originalPlaceholder;
        alert(err.message || "Error al transcribir");
      }
    },

    blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    },

    async transcribe(blob, contextType) {
      const dataUrl = await this.blobToBase64(blob);
      const token = getToken();
      const language = contextType === "english" ? "en" : "es";
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ action: "transcribe", audio: dataUrl, language }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Error al transcribir");
      return data.text;
    },

    // ────────────────────────────────────────────────
    // REPRODUCCIÓN (botón 🔊 manual por mensaje)
    // ────────────────────────────────────────────────
    async speakMessage(btn, text, contextType) {
      if (this.currentAudio) {
        try { this.currentAudio.pause(); } catch (e) {}
        this.currentAudio = null;
      }

      const cleanText = (typeof stripForVoice === "function")
        ? stripForVoice(text)
        : String(text || "").replace(/[\*#`_]/g, "").replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");

      if (!cleanText || cleanText.trim().length < 3) {
        btn.textContent = "🔊";
        btn.disabled = false;
        return;
      }

      const finalText = cleanText.slice(0, 4000);
      const originalText = btn.textContent;
      btn.textContent = "⏳";
      btn.disabled = true;

      const voice = VOICES[contextType] || VOICES.default;
      const token = getToken();

      try {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({ action: "tts", text: finalText, voice }),
        });
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || "Error al generar audio");
        }
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        this.currentAudio = audio;

        btn.textContent = "🔊";
        btn.classList.add("playing");
        btn.disabled = false;

        audio.play().catch(() => {});
        audio.onended = () => {
          URL.revokeObjectURL(url);
          btn.textContent = originalText;
          btn.classList.remove("playing");
          if (this.currentAudio === audio) this.currentAudio = null;
        };
      } catch (err) {
        btn.textContent = originalText;
        btn.disabled = false;
        alert(err.message || "Error al reproducir");
      }
    },

    detectContextType(btn) {
      const wrap = btn.closest(".chat-wrap");
      if (wrap) {
        const id = wrap.id || "";
        if (id.includes("english") || id.includes("roleplay")) return "english";
        if (id.includes("mate")) return "mate";
        if (id.includes("negocio")) return "negocio";
      }
      const row = btn.parentElement;
      const inputEl = row?.querySelector?.("textarea");
      const inputId = inputEl?.id || "";
      if (inputId.startsWith("eng") || inputId === "rp-input") return "english";
      if (inputId.startsWith("mate")) return "mate";
      if (inputId.startsWith("neg")) return "negocio";
      return "default";
    },

    extractMessageText(msgEl) {
      const clone = msgEl.cloneNode(true);
      clone.querySelectorAll(".chat-tts-btn, button, .msg-avatar, .msg-name").forEach((el) => el.remove());
      let text = (clone.textContent || "").trim();
      // FIX: AVAI (en vez de AV MentorAI)
      text = text.replace(/^(AVAI|AV MentorAI|Alex — Profesor de Inglés|Bruno — Matemáticas)\s*/i, "");
      return text;
    },

    // ────────────────────────────────────────────────
    // INYECCIÓN DE BOTONES
    // ────────────────────────────────────────────────
    injectMicButtons() {
      document.querySelectorAll(".chat-input-row").forEach((row) => {
        if (row.querySelector(".chat-mic-btn")) return;
        const sendBtn = row.querySelector(".chat-send-btn");
        if (!sendBtn) return;

        const mic = document.createElement("button");
        mic.className = "chat-mic-btn";
        mic.textContent = "🎤";
        mic.type = "button";
        mic.title = "Hablar (5 gratis/día)";

        mic.addEventListener("click", (e) => {
          e.preventDefault();
          if (this.recording) {
            this.stopRecording();
          } else {
            const ctx = this.detectContextType(mic);
            this.startRecording(mic, ctx);
          }
        });

        sendBtn.parentElement.insertBefore(mic, sendBtn);
      });
    },

    injectSpeakButtons() {
      // 🔇 Desactivado: ahora el audio se maneja con el Modo Voz en vivo (botón "Voz").
      return;
    },
    injectAll() {
      this.injectMicButtons();
      this.injectSpeakButtons();  // desactivado
    },

    init() {
      const style = document.createElement("style");
      style.textContent = `
        .chat-mic-btn {
          background: linear-gradient(90deg, #a855f7, #6366f1);
          border: none;
          border-radius: 10px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 16px;
          flex-shrink: 0;
          margin-right: 6px;
          color: white;
          transition: transform .15s, opacity .2s;
        }
        .chat-mic-btn:hover { opacity: .9; }
        .chat-mic-btn:disabled { opacity: .5; cursor: wait; }
        .chat-mic-btn.recording {
          background: linear-gradient(90deg, #ef4444, #dc2626) !important;
          animation: avmic-pulse 1.2s ease-in-out infinite;
        }
        @keyframes avmic-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,.5); }
          50% { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(239,68,68,0); }
        }
        .chat-wrap .has-tts { position: relative; }
        .chat-tts-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-top: 8px;
          margin-left: 0;
          background: rgba(168, 85, 247, .15);
          border: 1px solid rgba(168, 85, 247, .4);
          border-radius: 8px;
          padding: 4px 10px;
          cursor: pointer;
          font-size: 13px;
          color: #c4b5fd;
          transition: all .2s;
        }
        .chat-tts-btn:hover { background: rgba(168, 85, 247, .3); color: white; }
        .chat-tts-btn:disabled { opacity: .6; cursor: wait; }
        .chat-tts-btn.playing {
          background: rgba(34, 197, 94, .25);
          border-color: rgba(34, 197, 94, .5);
          color: #86efac;
          animation: avtts-pulse 1.5s ease-in-out infinite;
        }
        @keyframes avtts-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,.4); }
          50% { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
        }
      `;
      document.head.appendChild(style);

      this.injectAll();

      const observer = new MutationObserver(() => this.injectAll());
      observer.observe(document.body, { childList: true, subtree: true });
    },
  };

  window.Voice = Voice;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Voice.init());
  } else {
    Voice.init();
  }
})();
