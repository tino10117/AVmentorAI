// js/voice.js — Modo voz: micrófono → Whisper → respuesta IA → TTS
// Auto-injecta botones 🎤 en todos los chats. No requiere modificar otros JS.

(function () {
  // Voces por contexto
  const VOICES = {
    english: "alloy",   // Alex: joven, energética, clean
    negocio: "onyx",    // Mentor: profesional, autoridad
    mate: "echo",       // Bruno: cálido, profe
    default: "alloy",
  };

  const Voice = {
    recording: false,
    mediaRecorder: null,
    chunks: [],
    activeBtn: null,
    contextType: "default",
    stream: null,

    async startRecording(btn, contextType) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.stream = stream;
        this.mediaRecorder = new MediaRecorder(stream);
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

      const blob = new Blob(this.chunks, { type: "audio/webm" });
      if (blob.size < 1000) return; // muy corto, ignorar

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
          // Preparar listener antes de enviar
          this.listenForReply(row);
          // Enviar
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
      const token = localStorage.getItem("av_token") || "";
      const language = contextType === "english" ? "en" : "es";
      const r = await fetch("/api/voice?action=transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ audio: dataUrl, language }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Error al transcribir");
      return data.text;
    },

    async speak(text, contextType) {
      if (!text || text.length < 2) return;
      const voice = VOICES[contextType] || VOICES.default;
      const token = localStorage.getItem("av_token") || "";
      try {
        const r = await fetch("/api/voice?action=speak", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify({ text, voice }),
        });
        if (!r.ok) return;
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play().catch(() => {});
        audio.onended = () => URL.revokeObjectURL(url);
      } catch (err) {
        console.error("TTS error:", err);
      }
    },

    listenForReply(row) {
      // Buscar el chat-wrap más cercano (el del mismo contexto)
      const container =
        row.closest(".tab-content") ||
        row.closest("[data-subpanel]") ||
        document.body;
      const wrap = container.querySelector(".chat-wrap");
      if (!wrap) return;

      const aiSelector = ".msg-ai, .msg-english, .msg-mate";
      const initialCount = wrap.querySelectorAll(aiSelector).length;
      let triggered = false;

      const observer = new MutationObserver(() => {
        const msgs = wrap.querySelectorAll(aiSelector);
        if (msgs.length > initialCount && !triggered) {
          const last = msgs[msgs.length - 1];
          // Esperar a que termine de renderizarse el typing
          setTimeout(() => {
            if (triggered) return;
            const text = (last.textContent || "").trim();
            // Evitar reproducir el "typing..."
            if (text && text.length > 5 && !/\.{3,}$/.test(text)) {
              triggered = true;
              this.speak(text, this.contextType);
              observer.disconnect();
            }
          }, 1200);
        }
      });
      observer.observe(wrap, { childList: true, subtree: true, characterData: true });
      // Timeout de seguridad: 60 seg
      setTimeout(() => observer.disconnect(), 60000);
    },

    detectContextType(btn) {
      const row = btn.parentElement;
      const inputEl = row?.querySelector("textarea");
      const inputId = inputEl?.id || "";
      if (inputId.startsWith("eng") || inputId === "rp-input") return "english";
      if (inputId.startsWith("mate")) return "mate";
      if (inputId.startsWith("neg")) return "negocio";
      return "default";
    },

    injectButtons() {
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

    init() {
      // Estilo del botón mic
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
      `;
      document.head.appendChild(style);

      // Inyectar al inicio
      this.injectButtons();

      // Re-inyectar cuando se generen chats dinámicamente
      const observer = new MutationObserver(() => this.injectButtons());
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
