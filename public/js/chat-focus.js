// ═══════════════════════════════════════════════════════════════
// chat-focus.js — Modo "foco en el chat"
//
// Al cargar, oculta el dashboard (stats, nivel, modo selector, quick btns)
// dejando visible solo el header "⚡ AVAI · Tu mentor personal de IA" + el chat.
// Un botón ⚡ debajo del header permite desplegar/colapsar todo el dashboard.
// 100% additivo: no toca el HTML existente ni la lógica de la app.
// ═══════════════════════════════════════════════════════════════
(function () {
  "use strict";

  const STORAGE_KEY = "avai_chat_focus_expanded";

  // Selectores de los elementos a colapsar. Si alguno no existe, se ignora.
  const COLLAPSE_SELECTORS = [
    "#header-metrics",       // dash-stats (XP, racha, plan...)
    ".dash-nivel",           // barra de nivel y stat-lecciones / diario / objetivos
    "#tab-mentor > .modo-card",
    "#tab-mentor > .quick-btns",     // ambos blocks de quick buttons
    "#tab-mentor > p"                 // el "🌐 Con búsqueda en internet:"
  ];

  let isExpanded = false;
  let toggleBtn = null;
  let initialized = false;

  // ── Estado persistido ─────────────────────────────────────
  function readState() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch (e) { return false; }
  }
  function writeState(val) {
    try {
      localStorage.setItem(STORAGE_KEY, val ? "1" : "0");
    } catch (e) {}
  }

  // ── Recolectar elementos a colapsar ───────────────────────
  function findCollapsibles() {
    const out = [];
    COLLAPSE_SELECTORS.forEach(function (sel) {
      try {
        const nodes = document.querySelectorAll(sel);
        nodes.forEach(function (n) {
          if (n && !out.includes(n)) {
            // Guardar el display original la primera vez
            if (!n.hasAttribute("data-av-orig-display")) {
              const computed = getComputedStyle(n).display;
              n.setAttribute("data-av-orig-display", computed && computed !== "none" ? computed : "");
            }
            out.push(n);
          }
        });
      } catch (e) {}
    });
    return out;
  }

  // ── Aplicar estado expandido/colapsado ────────────────────
  function applyState(expanded) {
    isExpanded = !!expanded;
    const els = findCollapsibles();
    els.forEach(function (n) {
      if (isExpanded) {
        const orig = n.getAttribute("data-av-orig-display") || "";
        n.style.display = orig;
      } else {
        n.style.display = "none";
      }
    });
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-expanded", isExpanded ? "true" : "false");
      toggleBtn.classList.toggle("av-focus-toggle--open", isExpanded);
      toggleBtn.title = isExpanded ? "Ocultar stats y herramientas" : "Mostrar stats y herramientas";
    }
  }

  // ── Crear el botón ⚡ y los estilos ────────────────────────
  function injectStyles() {
    if (document.getElementById("av-focus-styles")) return;
    const style = document.createElement("style");
    style.id = "av-focus-styles";
    style.textContent = [
      ".av-focus-toggle{",
      "  display:flex;align-items:center;justify-content:center;",
      "  margin:6px auto 14px;",
      "  width:48px;height:48px;",
      "  border-radius:50%;",
      "  background:rgba(15,23,42,.6);",
      "  border:1px solid rgba(250,204,21,.35);",
      "  color:#facc15;font-size:22px;line-height:1;",
      "  cursor:pointer;",
      "  transition:all .25s ease;",
      "  font-family:inherit;",
      "  padding:0;",
      "  box-shadow:0 4px 14px rgba(0,0,0,.25);",
      "}",
      ".av-focus-toggle:hover{",
      "  background:rgba(250,204,21,.12);",
      "  border-color:rgba(250,204,21,.6);",
      "  transform:translateY(-1px);",
      "  box-shadow:0 6px 18px rgba(250,204,21,.2);",
      "}",
      ".av-focus-toggle:active{transform:scale(.95)}",
      ".av-focus-toggle .av-focus-bolt{",
      "  display:inline-block;",
      "  transition:transform .3s ease;",
      "}",
      ".av-focus-toggle--open .av-focus-bolt{",
      "  transform:rotate(180deg);",
      "}",
      ".av-focus-toggle--open{",
      "  background:linear-gradient(135deg, rgba(250,204,21,.18), rgba(249,115,22,.10));",
      "  border-color:#facc15;",
      "  box-shadow:0 4px 18px rgba(250,204,21,.3);",
      "}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function createToggle() {
    if (toggleBtn) return toggleBtn;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "av-focus-toggle";
    btn.setAttribute("aria-expanded", "false");
    btn.title = "Mostrar stats y herramientas";
    // ⚡ se mantiene literal: el sistema de íconos no lo reemplaza (marca AVAI)
    btn.innerHTML = '<span class="av-focus-bolt">⚡</span>';
    btn.addEventListener("click", function () {
      const next = !isExpanded;
      applyState(next);
      writeState(next);
    });
    toggleBtn = btn;
    return btn;
  }

  // ── Insertar el botón después del dash-hero ──────────────
  function insertToggle() {
    const hero = document.querySelector(".dash-hero");
    if (!hero || !hero.parentNode) return false;
    // Evitar duplicados
    if (hero.nextElementSibling && hero.nextElementSibling.classList && hero.nextElementSibling.classList.contains("av-focus-toggle")) {
      toggleBtn = hero.nextElementSibling;
      return true;
    }
    const btn = createToggle();
    hero.parentNode.insertBefore(btn, hero.nextSibling);
    return true;
  }

  // ── Init (idempotente) ────────────────────────────────────
  function init() {
    try {
      injectStyles();
      const ok = insertToggle();
      if (!ok) {
        // El #app puede estar oculto al inicio; reintentamos pronto.
        return false;
      }
      // Estado inicial: por defecto COLAPSADO. Si el usuario lo dejó abierto, lo recordamos.
      const saved = readState();
      applyState(saved);
      initialized = true;
      return true;
    } catch (e) {
      console.warn("[chat-focus] init falló:", e);
      return false;
    }
  }

  // Primer intento + reintentos cortos por si el DOM tarda
  function bootstrap() {
    if (init()) return;
    let tries = 0;
    const poll = setInterval(function () {
      tries++;
      if (init() || tries > 20) clearInterval(poll);
    }, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }

  // Re-aplicar al hacer login (cuando #app pasa de hidden a visible)
  // Observa cambios en la clase de #app para reaplicar el estado.
  function watchApp() {
    const app = document.getElementById("app");
    if (!app || !("MutationObserver" in window)) return;
    const obs = new MutationObserver(function () {
      if (!app.classList.contains("hidden") && app.style.display !== "none") {
        // App visible: asegurar que el botón existe y el estado se aplica
        setTimeout(function () {
          if (!initialized) bootstrap();
          else applyState(isExpanded);
        }, 100);
      }
    });
    obs.observe(app, { attributes: true, attributeFilter: ["class", "style"] });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchApp);
  } else {
    watchApp();
  }
})();
