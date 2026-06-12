// js/realtime-voice.js — Modo VOZ EN VIVO de AVAI (Realtime API de OpenAI vía WebRTC)
// Independiente del voice.js viejo (por turnos). Este es conversación en tiempo real.
// Flujo: pide token efímero a /api/realtime-token → WebRTC directo a OpenAI → audio en vivo.
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
    pc: null,            // RTCPeerConnection
    dc: null,            // data channel "oai-events"
    micStream: null,     // MediaStream del micrófono
    audioEl: null,       // <audio> donde suena AVAI
    estado: "idle",      // idle | conectando | escuchando | hablando | error
    onEstado: null,      // callback para que la UI reaccione a cambios de estado

    setEstado(nuevo) {
      this.estado = nuevo;
      if (typeof this.onEstado === "function") {
        try { this.onEstado(nuevo); } catch (e) {}
      }
    },

    // Construye las instrucciones de personalidad de AVAI para la voz
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

    // Inicia la sesión de voz en vivo
    async iniciar() {
      if (this.estado !== "idle" && this.estado !== "error") {
        console.warn("[RealtimeVoice] ya hay una sesión activa");
        return;
      }
      this.setEstado("conectando");

      try {
        // 1) Pedir el token efímero a nuestro backend
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

        // 2) Crear la conexión WebRTC
        const pc = new RTCPeerConnection();
        this.pc = pc;

        // 3) Reproducir el audio que manda AVAI
        const audioEl = document.createElement("audio");
        audioEl.autoplay = true;
        this.audioEl = audioEl;
        pc.ontrack = (e) => {
          audioEl.srcObject = e.streams[0];
        };

        // 4) Capturar el micrófono y mandarlo
        const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.micStream = ms;
        ms.getTracks().forEach((t) => pc.addTrack(t, ms));

        // 5) Data channel para eventos (configuración, estados)
        const dc = pc.createDataChannel("oai-events");
        this.dc = dc;
        dc.onopen = () => {
          // Apenas abre, inyectamos la personalidad de AVAI
          this.enviarEvento({
            type: "session.update",
            session: {
              type: "realtime",
              instructions: this.construirInstrucciones(),
            },
          });
          this.setEstado("escuchando");
        };
        dc.onmessage = (e) => this.manejarEvento(e);

        // 6) Esperar a que la conexión esté "connected" (evita bug de timing)
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            this.setEstado("error");
          }
        };

        // 7) Handshake SDP: crear oferta y mandarla a OpenAI
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

        // Listo: el dc.onopen va a pasar a "escuchando"
      } catch (err) {
        console.error("[RealtimeVoice] error al iniciar:", err);
        this.setEstado("error");
        this.cerrar();
        throw err;
      }
    },

    // Maneja eventos que llegan de OpenAI por el data channel
    manejarEvento(e) {
      let ev;
      try { ev = JSON.parse(e.data); } catch (_) { return; }

      switch (ev.type) {
        case "input_audio_buffer.speech_started":
          // El usuario empezó a hablar
          this.setEstado("escuchando");
          break;
        case "response.output_audio.delta":
        case "response.audio.delta":
          // AVAI está hablando
          if (this.estado !== "hablando") this.setEstado("hablando");
          break;
        case "response.done":
        case "response.output_audio.done":
        case "response.audio.done":
          // AVAI terminó de hablar, vuelve a escuchar
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

    // Corta la sesión y libera todo
    cerrar() {
      try { if (this.micStream) this.micStream.getTracks().forEach((t) => t.stop()); } catch (e) {}
      try { if (this.dc) this.dc.close(); } catch (e) {}
      try { if (this.pc) this.pc.close(); } catch (e) {}
      try {
        if (this.audioEl) {
          this.audioEl.srcObject = null;
          this.audioEl.remove();
        }
      } catch (e) {}
      this.micStream = null;
      this.dc = null;
      this.pc = null;
      this.audioEl = null;
      this.setEstado("idle");
    },
  };

  window.RealtimeVoice = RealtimeVoice;
})();
