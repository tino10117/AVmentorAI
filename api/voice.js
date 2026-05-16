// ═══════════════════════════════════════════════════════════════
// voice.js — Sistema de Text-to-Speech con OpenAI (voz onyx)
// 
// Funciona observando los mensajes de AVAI y agregando un botón 🔊
// que reproduce el texto con voz argentina masculina.
// ═══════════════════════════════════════════════════════════════

const Voice = {
  // Audio actualmente reproduciéndose
  currentAudio: null,
  currentButton: null,

  // Reproducir texto via TTS
  async speak(text, button) {
    // Si hay algo reproduciéndose, parar
    if (Voice.currentAudio) {
      Voice.currentAudio.pause();
      Voice.currentAudio = null;
      if (Voice.currentButton) {
        Voice.currentButton.innerHTML = "🔊";
        Voice.currentButton.disabled = false;
      }
      // Si era el mismo botón, terminamos
      if (Voice.currentButton === button) {
        Voice.currentButton = null;
        return;
      }
      Voice.currentButton = null;
    }

    if (!text || !text.trim()) return;

    const token = localStorage.getItem("avai_token");
    if (!token) {
      alert("Necesitás estar logueado para usar voz.");
      return;
    }

    button.innerHTML = "⏳";
    button.disabled = true;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "tts",
          text: text.slice(0, 2000), // máx 2000 chars
        }),
      });

      if (!res.ok) {
        let errorMsg = "Error al generar voz";
        try {
          const errData = await res.json();
          errorMsg = errData.error || errorMsg;
        } catch (e) {}
        alert(errorMsg);
        button.innerHTML = "🔊";
        button.disabled = false;
        return;
      }

      // Obtener el blob de audio
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      Voice.currentAudio = audio;
      Voice.currentButton = button;
      button.innerHTML = "⏸️";
      button.disabled = false;

      audio.onended = () => {
        button.innerHTML = "🔊";
        Voice.currentAudio = null;
        Voice.currentButton = null;
        URL.revokeObjectURL(url);
      };

      audio.onerror = () => {
        button.innerHTML = "🔊";
        Voice.currentAudio = null;
        Voice.currentButton = null;
        URL.revokeObjectURL(url);
      };

      audio.play().catch(err => {
        console.error("Error reproduciendo audio:", err);
        button.innerHTML = "🔊";
        Voice.currentAudio = null;
        Voice.currentButton = null;
      });

    } catch (err) {
      console.error("Error en TTS:", err);
      alert("No se pudo generar la voz. Intentá de nuevo.");
      button.innerHTML = "🔊";
      button.disabled = false;
    }
  },

  // Extraer texto plano de un mensaje (sin markdown ni emojis raros)
  extractText(element) {
    if (!element) return "";
    // Clonar para no modificar el original
    const clone = element.cloneNode(true);
    // Remover elementos no leíbles (botones, imágenes, etc.)
    clone.querySelectorAll("button, img, .chat-msg-header, .voice-btn").forEach(el => el.remove());
    // Obtener texto plano
    let text = clone.innerText || clone.textContent || "";
    // Limpiar markdown básico
    text = text.replace(/\*\*/g, "").replace(/\*/g, "").replace(/`/g, "");
    text = text.replace(/\n\n+/g, ". ").replace(/\n/g, " ");
    return text.trim();
  },

  // Inyectar botón 🔊 en un mensaje de la IA
  attachToMessage(msgEl) {
    if (!msgEl) return;
    if (msgEl.querySelector(".voice-btn")) return; // Ya tiene botón

    // Solo agregar a mensajes de la IA (no del usuario)
    if (!msgEl.classList.contains("msg-ai")) return;

    const btn = document.createElement("button");
    btn.className = "voice-btn";
    btn.innerHTML = "🔊";
    btn.title = "Escuchar este mensaje";
    btn.style.cssText = "background:rgba(56,189,248,.15);border:1px solid rgba(56,189,248,.35);color:#38bdf8;padding:4px 10px;border-radius:8px;cursor:pointer;font-size:13px;margin-top:8px;display:inline-flex;align-items:center;gap:4px;transition:all .2s";

    btn.onmouseenter = () => btn.style.background = "rgba(56,189,248,.25)";
    btn.onmouseleave = () => btn.style.background = "rgba(56,189,248,.15)";

    btn.onclick = (e) => {
      e.stopPropagation();
      const text = Voice.extractText(msgEl);
      Voice.speak(text, btn);
    };

    msgEl.appendChild(btn);
  },

  // Inicializar observer para agregar el botón automáticamente
  init() {
    // Función para procesar mensajes existentes
    const processMessages = () => {
      document.querySelectorAll(".chat-msg.msg-ai").forEach(msg => {
        Voice.attachToMessage(msg);
      });
    };

    // Procesar mensajes al cargar
    processMessages();

    // Observer para nuevos mensajes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            if (node.classList && node.classList.contains("chat-msg") && node.classList.contains("msg-ai")) {
              Voice.attachToMessage(node);
            }
            // Buscar en hijos también
            node.querySelectorAll && node.querySelectorAll(".chat-msg.msg-ai").forEach(child => {
              Voice.attachToMessage(child);
            });
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  },
};

// Auto-init cuando el DOM esté listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => Voice.init());
} else {
  Voice.init();
}

// Exponer globalmente
window.Voice = Voice;
