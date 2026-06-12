// js/realtime-voice.js — Modo VOZ EN VIVO de AVAI (Realtime API de OpenAI vía WebRTC)
// Independiente del voice.js viejo (por turnos). Este es conversación en tiempo real.
// Incluye la pantalla completa estilo ChatGPT (orbe con ondas).
(function () {
  "use strict";

  function getToken() {
    return localStorage.getItem("avai_token") || localStorage.getItem("av_token") || "";
  }
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem("avai_user") || localStorage.getItem("av_user") || "{}");
    } catch (e) { return {}; }
  }

  const RealtimeVoice = {
    pc: null,
    dc: null,
    micStream: null,
    audioEl: null,
    estado: "idle",
    onEstado: null,

    setEstado(nuevo) {
      this.estado = nuevo;
      this.pintarEstado(nuevo);
      if (typeof this.onEstado === "function") {
        try { this.onEstado(nuevo); } catch (e) {}
      }
    },

    construirInstrucciones() {
      const u = getUser();
      const nombre = u.nombre || "capo";
      const negocio = u.negocio || "";
      const tipoNegocio = u.tipo_negocio || "";
      const objetivo = u.objetivo || "";

      let ctx = `Te llamás AVAI. Sos un mentor argentino para emprendedores, hablando AHORA por voz en vivo con ${nombre}.`;
      if (negocio) ctx += ` Su negocio: ${negocio}${tipoNegocio ? " (" + tipoNegocio + ")" : ""}.`;
      if (objetivo) ctx += ` Su objetivo: ${objetivo}.`;

      return `${ctx}

CÓMO HABLÁS (es conversación por VOZ, en vivo):
- Sos argentino 100% rioplatense: "vos", "tenés", "podés", "dale", "mirá", "che". NUNCA uses "tú" ni "tío".
- Hablás natural y cercano, como un amigo que sabe del tema. Cálido, con onda, directo.
- Es una charla hablada: frases CORTAS y naturales. NO hagas monólogos largos ni listas numeradas (es voz, no texto). Una idea por vez, y dejá que la persona responda.
- Tratá a la persona por su nombre (${nombre}) y cada tanto un apodo argentino ("capo", "crack", "genio") — sin abusar.
- Si la persona se queda callada o duda, esperá. No la atropelles.
- Moderá las exclamaciones: tono tranquilo por defecto, entusiasmo real solo cuando lo amerita.
- NUNCA digas que sos una IA o un modelo. Sos AVAI, con onda.
- Si te piden algo serio (plata, una decisión importante), bajás la joda y bancás en serio.

Respondé siempre en español argentino.`;
    },

    // ────────────────────────────────────────────────
    // UI: pantalla completa estilo ChatGPT (orbe + ondas)
    // ────────────────────────────────────────────────
    inyectarEstilos() {
      if (document.getElementById("avai-voz-estilos")) return;
      const st = document.createElement("style");
      st.id = "avai-voz-estilos";
      st.textContent = `
        #avai-voz-overlay {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; pointer-events: none; transition: opacity .35s ease;
        }
        #avai-voz-overlay.abierto { opacity: 1; pointer-events: auto; }
        .avoz-bg {
          position: absolute; inset: 0;
          background: radial-gradient(circle at 50% 38%, #1a1a2e 0%, #0d0d16 55%, #060609 100%);
        }
        .avoz-content {
          position: relative; z-index: 2;
          display: flex; flex-direction: column; align-items: center;
          width: 100%; max-width: 480px; padding: 24px; text-align: center;
        }
        .avoz-orbe {
          position: relative; width: 220px; height: 220px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 48px;
        }
        .avoz-core {
          width: 120px; height: 120px; border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #fde68a, #f59e0b 60%, #b45309 100%);
          box-shadow: 0 0 60px rgba(245,158,11,.55), 0 0 120px rgba(245,158,11,.25);
          transition: transform .25s ease;
        }
        .avoz-ring {
          position: absolute; border-radius: 50%;
          border: 2px solid rgba(245,158,11,.35);
          opacity: 0;
        }
        .avoz-ring1 { width: 150px; height: 150px; }
        .avoz-ring2 { width: 185px; height: 185px; }
        .avoz-ring3 { width: 220px; height: 220px; }
        /* Estado: escuchando — ondas suaves expandiéndose */
        #avai-voz-overlay[data-estado="escuchando"] .avoz-ring {
          animation: avoz-pulse 2.4s ease-out infinite;
        }
        #avai-voz-overlay[data-estado="escuchando"] .avoz-ring2 { animation-delay: .5s; }
        #avai-voz-overlay[data-estado="escuchando"] .avoz-ring3 { animation-delay: 1s; }
        /* Estado: hablando — el core late más fuerte y rápido */
        #avai-voz-overlay[data-estado="hablando"] .avoz-core {
          animation: avoz-talk .55s ease-in-out infinite;
        }
        #avai-voz-overlay[data-estado="hablando"] .avoz-ring {
          animation: avoz-pulse 1.1s ease-out infinite;
        }
        #avai-voz-overlay[data-estado="hablando"] .avoz-ring2 { animation-delay: .25s; }
        #avai-voz-overlay[data-estado="hablando"] .avoz-ring3 { animation-delay: .5s; }
        /* Estado: conectando — el core respira lento */
        #avai-voz-overlay[data-estado="conectando"] .avoz-core {
          animation: avoz-breathe 1.8s ease-in-out infinite;
        }
        @keyframes avoz-pulse {
          0% { transform: scale(.7); opacity: .6; }
          100% { transform: scale(1.05); opacity: 0; }
        }
        @keyframes avoz-talk {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.18); }
        }
        @keyframes avoz-breathe {
          0%, 100% { transform: scale(1); opacity: .8; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        .avoz-estado {
          color: #fff; font-size: 22px; font-weight: 600;
          letter-spacing: -.01em; margin-bottom: 8px;
        }
        .avoz-sub {
          color: rgba(255,255,255,.5); font-size: 14px; margin-bottom: 40px;
          min-height: 20px;
        }
        .avoz-cerrar {
          width: 60px; height: 60px; border-radius: 50%;
          background: rgba(255,255,255,.1);
          border: 1px solid rgba(255,255,255,.2);
          color: #fff; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          transition: background .2s, transform .15s;
        }
        .avoz-cerrar:hover { background: rgba(239,68,68,.85); transform: scale(1.05); }
        .avoz-cerrar:active { transform: scale(.95); }
      `;
      document.head.appendChild(st);
    },

    crearUI() {
      if (document.getElementById("avai-voz-overlay")) return;
      this.inyectarEstilos();
      const overlay = document.createElement("div");
      overlay.id = "avai-voz-overlay";
      overlay.setAttribute("data-estado", "conectando");
      overlay.innerHTML = `
        <div class="avoz-bg"></div>
        <div class="avoz-content">
          <div class="avoz-orbe">
            <div class="avoz-ring avoz-ring1"></div>
            <div class="avoz-ring avoz-ring2"></div>
            <div class="avoz-ring avoz-ring3"></div>
            <div class="avoz-core"></div>
          </div>
          <div class="avoz-estado" id="avoz-estado-txt">Conectando…</div>
          <div class="avoz-sub" id="avoz-sub-txt">Esperá un toque</div>
          <button class="avoz-cerrar" id="avoz-cerrar-btn" title="Terminar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector("#avoz-cerrar-btn").addEventListener("click", () => this.cerrar());
      // forzar reflow y abrir con transición
      requestAnimationFrame(() => overlay.classList.add("abierto"));
    },

    pintarEstado(estado) {
      const overlay = document.getElementById("avai-voz-overlay");
      if (!overlay) return;
      overlay.setAttribute("data-estado", estado);
      const txt = document.getElementById("avoz-estado-txt");
      const sub = document.getElementById("avoz-sub-txt");
      const mapa = {
        conectando: ["Conectando…", "Dale un segundo"],
        escuchando: ["Te escucho", "Hablá tranquilo, te escucho"],
        hablando: ["AVAI hablando", ""],
        error: ["Hubo un problema", "Cerrá y probá de nuevo"],
        idle: ["", ""],
      };
      const [t, s] = mapa[estado] || ["", ""];
      if (txt) txt.textContent = t;
      if (sub) sub.textContent = s;
    },

    quitarUI() {
      const overlay = document.getElementById("avai-voz-overlay");
      if (!overlay) return;
      overlay.classList.remove("abierto");
      setTimeout(() => { try { overlay.remove(); } catch (e) {} }, 350);
    },

    // ────────────────────────────────────────────────
    // Iniciar la sesión de voz en vivo
    // ────────────────────────────────────────────────
    async iniciar() {
      if (this.estado !== "idle" && this.estado !== "error") {
        console.warn("[RealtimeVoice] ya hay una sesión activa");
        return;
      }
      this.crearUI();
      this.setEstado("conectando");

      try {
        const tokenResp = await fetch("/api/realtime-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + getToken(),
          },
          body: JSON.stringify({ voice: "marin" }),
        });
        const tokenData = await tokenResp.json().catch(() => ({}));
        if (!tokenResp.ok) {
          throw new Error(tokenData.error || "No se pudo iniciar la sesión de voz");
        }
        const EPHEMERAL = tokenData.client_secret;
        const MODEL = tokenData.model || "gpt-realtime";
        if (!EPHEMERAL) throw new Error("No se recibió el token de voz");

        const pc = new RTCPeerConnection();
        this.pc = pc;

        const audioEl = document.createElement("audio");
        audioEl.autoplay = true;
        this.audioEl = audioEl;
        pc.ontrack = (e) => { audioEl.srcObject = e.streams[0]; };

        const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.micStream = ms;
        ms.getTracks().forEach((t) => pc.addTrack(t, ms));

        const dc = pc.createDataChannel("oai-events");
        this.dc = dc;
        dc.onopen = () => {
          this.enviarEvento({
            type: "session.update",
            session: {
              type: "realtime",
              instructions: this.construirInstrucciones(),
              audio: {
                input: {
                  turn_detection: {
                    type: "server_vad",
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500,
                    create_response: true,
                    interrupt_response: true,
                  },
                },
              },
            },
          });
          this.setEstado("escuchando");
        };
        dc.onmessage = (e) => this.manejarEvento(e);

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            this.setEstado("error");
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls?model=" + encodeURIComponent(MODEL), {
          method: "POST",
          body: offer.sdp,
          headers: {
            "Authorization": "Bearer " + EPHEMERAL,
            "Content-Type": "application/sdp",
          },
        });

        if (!sdpResponse.ok) {
          const errTxt = await sdpResponse.text().catch(() => "");
          throw new Error("Error en el handshake de voz: " + sdpResponse.status + " " + errTxt.slice(0, 120));
        }

        const answerSdp = await sdpResponse.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      } catch (err) {
        console.error("[RealtimeVoice] error al iniciar:", err);
        this.setEstado("error");
        setTimeout(() => this.cerrar(), 1800);
        throw err;
      }
    },

    manejarEvento(e) {
      let ev;
      try { ev = JSON.parse(e.data); } catch (_) { return; }
      switch (ev.type) {
        case "input_audio_buffer.speech_started":
          this.setEstado("escuchando");
          break;
        case "response.output_audio.delta":
        case "response.audio.delta":
          if (this.estado !== "hablando") this.setEstado("hablando");
          break;
        case "response.done":
        case "response.output_audio.done":
        case "response.audio.done":
          this.setEstado("escuchando");
          break;
        case "error":
          console.error("[RealtimeVoice] evento error:", ev);
          break;
      }
    },

    enviarEvento(obj) {
      if (this.dc && this.dc.readyState === "open") {
        try { this.dc.send(JSON.stringify(obj)); } catch (e) {}
      }
    },

    cerrar() {
      try { if (this.micStream) this.micStream.getTracks().forEach((t) => t.stop()); } catch (e) {}
      try { if (this.dc) this.dc.close(); } catch (e) {}
      try { if (this.pc) this.pc.close(); } catch (e) {}
      try {
        if (this.audioEl) { this.audioEl.srcObject = null; this.audioEl.remove(); }
      } catch (e) {}
      this.micStream = null;
      this.dc = null;
      this.pc = null;
      this.audioEl = null;
      this.estado = "idle";
      if (typeof this.onEstado === "function") { try { this.onEstado("idle"); } catch (e) {} }
      this.quitarUI();
    },

    // Punto de entrada para el botón
    toggle() {
      if (this.estado === "idle" || this.estado === "error") {
        this.iniciar().catch(() => {});
      } else {
        this.cerrar();
      }
    },
  };

  window.RealtimeVoice = RealtimeVoice;
})();
