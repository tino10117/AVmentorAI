// ═══════════════════════════════════════════════════════════════
// analytics.js — Custom events para Vercel Analytics
//
// Trackea automáticamente el funnel completo de AVAI:
// - Landing view, register, login, onboarding
// - Mensajes al chat, cambios de modo
// - Tabs (Premium, Inglés, Mate, Juegos, etc.)
// - PWA install, pagos
//
// 100% additivo. Hookea fetch + funciones globales.
// No requiere modificar otros archivos.
// ═══════════════════════════════════════════════════════════════
(function () {
  "use strict";

  // ── 1. Shim oficial Vercel (buffer si va aún no cargó) ──
  window.va = window.va || function () {
    (window.vaq = window.vaq || []).push(arguments);
  };

  // ── 2. Helper público de tracking ──
  function track(name, data) {
    try {
      if (data && typeof data === "object") {
        window.va("event", { name: name, data: data });
      } else {
        window.va("event", { name: name });
      }
      if (window.console && console.log) {
        console.log("[avTrack]", name, data || "");
      }
    } catch (e) {
      // Silencioso: nunca romper la app por analytics
    }
  }
  window.avTrack = track;

  // ── 3. Interceptar fetch para detectar APIs ──
  const origFetch = window.fetch;
  window.fetch = function () {
    const args = arguments;
    const url = typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || "";
    const options = args[1] || {};
    let body = null;

    try {
      if (options.body && typeof options.body === "string") {
        body = JSON.parse(options.body);
      }
    } catch (e) {}

    const fetchPromise = origFetch.apply(this, args);

    fetchPromise.then(function (response) {
      if (!response || !response.ok) return;
      try {
        // Auth: registro
        if (url.indexOf("/api/auth") !== -1 && body && body.action === "register") {
          track("register_completed");
          try { localStorage.setItem("av_user_first_seen", new Date().toISOString()); } catch (e) {}
        }
        // Auth: login
        else if (url.indexOf("/api/auth") !== -1 && body && body.action === "login") {
          track("login_completed");
        }
        // Auth: email verificado
        else if (url.indexOf("/api/auth") !== -1 && body && body.action === "verificar_email") {
          track("email_verified");
        }
        // Auth: reset password solicitado
        else if (url.indexOf("/api/auth") !== -1 && body && body.action === "solicitar_reset") {
          track("password_reset_requested");
        }
        // Auth: reset password confirmado
        else if (url.indexOf("/api/auth") !== -1 && body && body.action === "confirmar_reset") {
          track("password_reset_completed");
        }
        // Chat: mensaje enviado
        else if (url.indexOf("/api/chat") !== -1) {
          track("message_sent");
          try {
            if (!localStorage.getItem("av_first_msg_tracked")) {
              track("first_message_sent");
              localStorage.setItem("av_first_msg_tracked", "1");
            }
          } catch (e) {}
        }
        // Pago: cualquier API relacionada
        else if (
          url.indexOf("/api/mercadopago") !== -1 ||
          url.indexOf("/api/pago") !== -1 ||
          url.indexOf("/api/checkout") !== -1 ||
          url.indexOf("/api/subscription") !== -1
        ) {
          track("payment_api_called");
        }
      } catch (e) {}
    }).catch(function () {});

    return fetchPromise;
  };

  // ── 4. Click handlers UI ──
  document.addEventListener("click", function (e) {
    const target = e.target && e.target.closest && e.target.closest("button, [onclick], a");
    if (!target) return;

    try {
      const text = ((target.textContent || "") + "").trim().toLowerCase();
      const onclickStr = ((target.getAttribute("onclick") || "") + "").toLowerCase();

      // CTAs de registro
      if (
        onclickStr.indexOf("landingshowregister") !== -1 ||
        text === "probar gratis" ||
        text.indexOf("crear cuenta gratis") !== -1 ||
        text.indexOf("empezar gratis") !== -1 ||
        text.indexOf("probar gratis ahora") !== -1
      ) {
        track("register_clicked");
      }

      // CTAs de login
      if (onclickStr.indexOf("landingshowlogin") !== -1 || text === "iniciar sesión") {
        track("login_clicked");
      }

      // PWA Install
      if (text.indexOf("instalar avai") !== -1) {
        track("pwa_install_clicked");
      }

      // Pagar Premium
      if (
        text.indexOf("suscribirme") !== -1 ||
        text.indexOf("quiero premium") !== -1 ||
        text.indexOf("pagar premium") !== -1 ||
        text.indexOf("activar premium") !== -1 ||
        text.indexOf("hacerme premium") !== -1
      ) {
        track("premium_pay_clicked");
      }

      // Quick buttons del mentor (Idea, Vender, Marketing, etc.)
      if (target.classList && target.classList.contains("qbtn")) {
        const btnLabel = text.substring(0, 30);
        track("quick_button_clicked", { btn: btnLabel });
      }
    } catch (e) {}
  }, true);

  // ── 5. Wrap funciones globales (después de carga) ──
  function wrapFunctions() {
    try {
      // saveOnboarding
      if (typeof window.saveOnboarding === "function" && !window._avOnboardingWrapped) {
        const orig = window.saveOnboarding;
        window.saveOnboarding = function () {
          track("onboarding_completed");
          return orig.apply(this, arguments);
        };
        window._avOnboardingWrapped = true;
      }

      // navigateTo
      if (typeof window.navigateTo === "function" && !window._avNavWrapped) {
        const orig = window.navigateTo;
        window.navigateTo = function (tab) {
          try {
            const t = String(tab || "");
            track("tab_opened", { tab: t });
            if (t === "premium") track("premium_viewed");
            if (t === "english") track("english_opened");
            if (t === "mate") track("mate_opened");
            if (t === "juegos") track("game_opened");
            if (t === "herramientas") track("tools_opened");
            if (t === "viajes") track("travel_opened");
            if (t === "vidasana") track("health_opened");
            if (t === "ranking") track("ranking_opened");
            if (t === "desafios") track("challenges_opened");
          } catch (e) {}
          return orig.apply(this, arguments);
        };
        window._avNavWrapped = true;
      }

      // doLogout
      if (typeof window.doLogout === "function" && !window._avLogoutWrapped) {
        const orig = window.doLogout;
        window.doLogout = function () {
          track("logout");
          return orig.apply(this, arguments);
        };
        window._avLogoutWrapped = true;
      }
    } catch (e) {}
  }

  // ── 6. Hook al selector de modo del mentor ──
  function hookModoSelector() {
    try {
      const sel = document.getElementById("modo-selector");
      if (sel && !sel._avTracked) {
        sel.addEventListener("change", function () {
          track("mode_changed", { mode: String(this.value || "").substring(0, 30) });
        });
        sel._avTracked = true;
      }
    } catch (e) {}
  }

  // ── 7. Init ──
  function init() {
    try {
      if (!localStorage.getItem("av_token") && !localStorage.getItem("avai_token")) {
        track("landing_view");
      } else {
        track("app_opened");
      }
    } catch (e) {}

    wrapFunctions();
    hookModoSelector();

    // Reintentar por 10s en caso de que funciones carguen tarde
    let attempts = 0;
    const intervalId = setInterval(function () {
      attempts++;
      wrapFunctions();
      hookModoSelector();
      if (attempts >= 20) clearInterval(intervalId);
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
