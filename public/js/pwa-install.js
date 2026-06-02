// ═══════════════════════════════════════════════════════════════
// AVAI PWA Installer — v1.0
//
// Hace 3 cosas:
// 1. Registra el Service Worker (para que funcione offline + cache).
// 2. Muestra un botón "📱 Instalar AVAI" cuando el navegador lo permite.
// 3. En iOS (Safari) muestra un modal explicando cómo instalar manualmente.
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── REGISTRAR SERVICE WORKER ──────────────────────────────────
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[PWA] Service Worker registrado:", reg.scope);

          // Detectar actualización del SW
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                console.log("[PWA] Nueva versión disponible");
                // Activar al toque, sin pedir al usuario
                newWorker.postMessage({ action: "skipWaiting" });
              }
            });
          });
        })
        .catch((err) => console.warn("[PWA] Error registrando SW:", err));
    });

    // Recargar cuando hay nueva versión
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  // ── DETECTAR SI YA ESTÁ INSTALADA ─────────────────────────────
  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true ||
      document.referrer.includes("android-app://")
    );
  }

  // Si ya está instalada, no mostrar nada
  if (isStandalone()) {
    document.documentElement.classList.add("pwa-installed");
    return;
  }

  // ── DETECTAR iOS (Safari/Chrome en iOS) ───────────────────────
  function isIOS() {
    const ua = window.navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  }

  // ── DETECTAR SI ES MOBILE ─────────────────────────────────────
  function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // ── ANDROID: capturar el evento "beforeinstallprompt" ─────────
  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    // Prevenir el banner automático feo
    e.preventDefault();
    deferredPrompt = e;
    console.log("[PWA] App instalable detectada (Android)");
    // Mostrar nuestro botón propio después de 20s navegando
    setTimeout(mostrarBotonInstalar, 20000);
  });

  // Cuando el usuario instala la app
  window.addEventListener("appinstalled", () => {
    console.log("[PWA] AVAI instalada");
    ocultarBotonInstalar();
    deferredPrompt = null;
    // Opcional: trackear evento
    if (typeof gtag !== "undefined") {
      gtag("event", "pwa_install", { method: "android" });
    }
  });

  // ── iOS: mostrar instructivo (Safari no soporta beforeinstallprompt) ──
  if (isIOS() && isMobile()) {
    // Mostrar después de 30s de uso
    setTimeout(() => {
      if (!sessionStorage.getItem("pwa_ios_dismissed")) {
        mostrarBotonInstalar();
      }
    }, 30000);
  }

  // ── BOTÓN FLOTANTE "INSTALAR AVAI" ────────────────────────────
  function mostrarBotonInstalar() {
    if (document.getElementById("pwa-install-btn")) return;
    if (isStandalone()) return;

    const btn = document.createElement("button");
    btn.id = "pwa-install-btn";
    btn.innerHTML = "📱 Instalar AVAI";
    btn.setAttribute("aria-label", "Instalar AVAI en tu dispositivo");
    btn.style.cssText = `
      position: fixed;
      bottom: calc(env(safe-area-inset-bottom, 16px) + 16px);
      right: 16px;
      z-index: 9998;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      color: #fff;
      border: none;
      padding: 12px 20px;
      border-radius: 14px;
      font-size: 14px;
      font-weight: 700;
      font-family: 'Inter', -apple-system, sans-serif;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(99, 102, 241, 0.45), 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 8px;
      animation: pwaSlideUp 0.4s ease-out;
      transition: transform 0.15s ease;
    `;

    btn.onmouseover = () => btn.style.transform = "translateY(-2px)";
    btn.onmouseout = () => btn.style.transform = "translateY(0)";

    btn.onclick = () => {
      if (isIOS()) {
        mostrarInstructivoIOS();
      } else if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === "accepted") {
            console.log("[PWA] Usuario aceptó instalación");
          }
          deferredPrompt = null;
          ocultarBotonInstalar();
        });
      }
    };

    // Botón cerrar (X)
    const closeBtn = document.createElement("span");
    closeBtn.innerHTML = "&times;";
    closeBtn.style.cssText = `
      margin-left: 4px;
      font-size: 18px;
      opacity: 0.7;
      cursor: pointer;
      padding: 0 4px;
    `;
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      sessionStorage.setItem("pwa_ios_dismissed", "1");
      ocultarBotonInstalar();
    };
    btn.appendChild(closeBtn);

    // Animación de entrada
    const style = document.createElement("style");
    style.textContent = `
      @keyframes pwaSlideUp {
        from { transform: translateY(120px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(btn);
  }

  function ocultarBotonInstalar() {
    const btn = document.getElementById("pwa-install-btn");
    if (btn) btn.remove();
  }

  // ── MODAL DE INSTRUCCIONES PARA iOS ───────────────────────────
  function mostrarInstructivoIOS() {
    if (document.getElementById("pwa-ios-modal")) return;

    const modal = document.createElement("div");
    modal.id = "pwa-ios-modal";
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: pwaModalFade 0.25s ease-out;
    `;
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #0d0d2d 0%, #1e1b4b 100%);
        border: 1.5px solid rgba(168, 85, 247, 0.4);
        border-radius: 20px;
        max-width: 380px;
        width: 100%;
        padding: 28px 24px;
        color: #fff;
        font-family: 'Inter', -apple-system, sans-serif;
        box-shadow: 0 20px 60px rgba(168, 85, 247, 0.3);
      ">
        <div style="text-align: center; margin-bottom: 20px">
          <div style="font-size: 48px; margin-bottom: 8px">⚡</div>
          <h2 style="margin: 0; font-size: 20px; font-weight: 800; font-family: 'Syne', sans-serif">
            Instalá AVAI en tu iPhone
          </h2>
          <p style="margin: 8px 0 0; font-size: 13px; color: #cbd5e1; line-height: 1.5">
            En 2 pasos lo tenés en tu pantalla de inicio como app nativa
          </p>
        </div>

        <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 12px">
          <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 10px">
            <div style="background: linear-gradient(135deg, #6366f1, #a855f7); color: #fff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; flex-shrink: 0">1</div>
            <div style="font-size: 14px; line-height: 1.4">
              Tocá el botón <strong style="color: #a5b4fc">Compartir</strong>
              <svg width="16" height="20" viewBox="0 0 16 20" style="vertical-align: middle; margin-left: 4px" fill="#a5b4fc"><path d="M8 0L4 4l1.5 1.5L7 4v8h2V4l1.5 1.5L12 4 8 0zm6 8h-3v2h3v8H2v-8h3V8H2c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2z"/></svg>
              en la barra de Safari
            </div>
          </div>
        </div>

        <div style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 18px">
          <div style="display: flex; gap: 12px; align-items: center">
            <div style="background: linear-gradient(135deg, #a855f7, #ec4899); color: #fff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; flex-shrink: 0">2</div>
            <div style="font-size: 14px; line-height: 1.4">
              Tocá <strong style="color: #d8b4fe">"Agregar a pantalla de inicio"</strong>
              <span style="font-size: 18px; margin-left: 4px">➕</span>
            </div>
          </div>
        </div>

        <button id="pwa-ios-close" style="
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: #fff;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          font-family: 'Inter', -apple-system, sans-serif;
          cursor: pointer;
        ">
          ¡Listo, ya entendí! ✨
        </button>

        <p style="margin: 14px 0 0; font-size: 11px; color: #64748b; text-align: center">
          Si usás Chrome/Firefox en iPhone, abrí <strong>avai.ar</strong> en Safari primero
        </p>
      </div>
    `;

    const fadeStyle = document.createElement("style");
    fadeStyle.textContent = `
      @keyframes pwaModalFade {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(fadeStyle);

    document.body.appendChild(modal);

    document.getElementById("pwa-ios-close").onclick = () => {
      sessionStorage.setItem("pwa_ios_dismissed", "1");
      modal.remove();
      ocultarBotonInstalar();
    };
  }

  // ── EXPONER FUNCIÓN MANUAL (para botón en config) ─────────────
  window.AvaiPWA = {
    install: () => {
      if (isIOS()) {
        mostrarInstructivoIOS();
      } else if (deferredPrompt) {
        deferredPrompt.prompt();
      } else {
        alert("Tu navegador no soporta instalación automática. Probá usar Chrome (Android) o Safari (iPhone).");
      }
    },
    isInstalled: isStandalone,
    isIOS: isIOS,
  };
})();
