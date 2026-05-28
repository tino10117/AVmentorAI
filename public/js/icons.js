// ═══════════════════════════════════════════════════════════════
// icons.js — Sistema de íconos de línea profesionales para AVAI
// Reemplaza automáticamente los emojis por íconos Lucide (gris neutro),
// en toda la app, incluso en el contenido generado dinámicamente.
// NO toca la lógica de la app: es 100% additivo y a prueba de fallos.
// ═══════════════════════════════════════════════════════════════
(function () {
  "use strict";

  // ── Mapa emoji → nombre de ícono Lucide ──
  // (Las claves se guardan SIN el selector de variación \uFE0F;
  //  el matcher lo maneja solo.)
  const RAW_MAP = {
    // Navegación / Sidebar
    "🧠": "brain",
    "📚": "book-open",
    "🔢": "calculator",
    "🛠": "wrench",
    "✈": "plane",
    "💪": "dumbbell",
    "🎮": "gamepad-2",
    "📈": "trending-up",
    "🔥": "flame",
    "🏆": "trophy",
    "💎": "gem",
    "⚙": "settings",
    "🛡": "shield",
    "🚪": "log-out",
    // Dashboard / métricas
    "👤": "user",
    "⭐": "star",
    "📓": "notebook",
    "🎯": "target",
    // Mentor / quick buttons
    "💡": "lightbulb",
    "📱": "smartphone",
    "🎭": "messages-square",
    "🌐": "globe",
    "🌎": "globe",
    "📊": "bar-chart-3",
    "🔍": "search",
    "💹": "trending-up",
    // Chat / avatares
    "😊": "smile",
    "🎓": "graduation-cap",
    "📎": "paperclip",
    "💬": "message-circle",
    // Inglés / Mate
    "📖": "book-open",
    "📝": "pencil",
    "✍": "pen-line",
    "🔤": "type",
    "🧮": "calculator",
    "📜": "scroll",
    // Herramientas
    "📋": "clipboard-list",
    "🎨": "palette",
    "💰": "wallet",
    "🖼": "image",
    "🤔": "help-circle",
    "💸": "piggy-bank",
    "💵": "banknote",
    "🏷": "tag",
    "🔗": "link",
    "🪄": "sparkles",
    "📢": "megaphone",
    "📦": "package",
    "🤝": "handshake",
    "🏦": "landmark",
    "🏢": "building-2",
    "⚖": "scale",
    "🤖": "bot",
    // Viajes / Vida Sana
    "🖨": "printer",
    "📍": "map-pin",
    "🧭": "compass",
    "🥗": "salad",
    "🏋": "dumbbell",
    "🍽": "utensils",
    "🧘": "flower-2",
    "🏖": "umbrella",
    "⛰": "mountain",
    "🏙": "building-2",
    "🌿": "leaf",
    "🍷": "wine",
    "🎉": "party-popper",
    "❄": "snowflake",
    "🏜": "sun",
    "🏝": "waves",
    "🌙": "moon",
    // Estados / alertas
    "⚠": "alert-triangle",
    "✅": "check-circle",
    "❌": "x-circle",
    "❤": "heart",
    "💗": "heart",
    "💔": "heart-crack",
    "ℹ": "info",
    "💜": "heart",
    "✨": "sparkles",
    "🔒": "lock",
    "🔓": "unlock",
    // Juegos
    "🎬": "clapperboard",
    "💼": "briefcase",
    "🔜": "clock",
    "🚀": "rocket",
    "👔": "briefcase",
    "🕵": "search",
    "📅": "calendar",
    "💀": "skull",
    "👥": "users",
    "🥊": "swords",
    "🔮": "sparkles",
    // Admin
    "📥": "download",
    "🔄": "refresh-cw",
    "🔑": "key",
    "🚫": "ban",
    "🗑": "trash-2",
    "💳": "credit-card",
    "📧": "mail",
    "📞": "phone",
    "🏠": "home",
    "🪙": "coins",
    "📲": "smartphone",
    // varios
    "🎟": "ticket",
    "🏅": "medal",
    "📌": "pin",
    "🔔": "bell",
    "👋": "hand",
  };
  // NOTA intencional: NO se mapean ⚡ (logo/marca AVAI), 🥇🥈🥉 (medallas
  // del ranking, mantienen su color) ni 🇦🇷 (bandera). Quedan como están.

  // ── Normalizar: quitar selector de variación \uFE0F ──
  function stripVS(s) {
    return s.replace(/\uFE0F/g, "");
  }

  // Construir mapa limpio (claves sin \uFE0F)
  const MAP = {};
  Object.keys(RAW_MAP).forEach(function (k) {
    MAP[stripVS(k)] = RAW_MAP[k];
  });

  // ── Construir regex (alternativas ordenadas por longitud desc) ──
  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  const keys = Object.keys(MAP).sort(function (a, b) {
    return b.length - a.length;
  });
  // cada alternativa permite un \uFE0F opcional al final
  const pattern = keys.map(function (k) {
    return escapeRe(k) + "\\uFE0F?";
  }).join("|");
  const EMOJI_RE = new RegExp("(" + pattern + ")", "gu");

  // ── Tokenizar un texto: devuelve [{type:'text'|'icon', value}] ──
  function tokenize(text) {
    const tokens = [];
    let last = 0;
    let m;
    EMOJI_RE.lastIndex = 0;
    while ((m = EMOJI_RE.exec(text)) !== null) {
      const matched = m[0];
      const name = MAP[stripVS(matched)];
      if (m.index > last) {
        tokens.push({ type: "text", value: text.slice(last, m.index) });
      }
      if (name) {
        tokens.push({ type: "icon", value: name });
      } else {
        tokens.push({ type: "text", value: matched });
      }
      last = m.index + matched.length;
    }
    if (last < text.length) {
      tokens.push({ type: "text", value: text.slice(last) });
    }
    return tokens;
  }

  // Exponer tokenize para testing (no molesta en producción)
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { tokenize: tokenize, MAP: MAP };
  }

  // A partir de acá, solo corre en el navegador
  if (typeof document === "undefined") return;

  const SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, NOSCRIPT: 1, CODE: 1, PRE: 1, SVG: 1 };

  function makeIconEl(name) {
    const i = document.createElement("i");
    i.setAttribute("data-lucide", name);
    i.className = "av-icon";
    return i;
  }

  // Reemplaza emojis en un nodo de texto
  function processTextNode(node) {
    const text = node.nodeValue;
    if (!text || text.length === 0) return;
    // chequeo rápido: ¿hay algún emoji mapeado?
    EMOJI_RE.lastIndex = 0;
    if (!EMOJI_RE.test(text)) return;

    const tokens = tokenize(text);
    if (tokens.length === 1 && tokens[0].type === "text") return;

    const frag = document.createDocumentFragment();
    tokens.forEach(function (t) {
      if (t.type === "text") {
        frag.appendChild(document.createTextNode(t.value));
      } else {
        frag.appendChild(makeIconEl(t.value));
      }
    });
    if (node.parentNode) node.parentNode.replaceChild(frag, node);
  }

  // Recorre un elemento y procesa sus nodos de texto
  function processElement(root) {
    if (!root) return;
    // Saltar elementos no deseados
    if (root.nodeType === 1) {
      const tag = root.tagName;
      if (SKIP_TAGS[tag]) return;
      if (root.closest && root.closest("svg")) return;
    }
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (n) {
          const p = n.parentNode;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS[p.tagName]) return NodeFilter.FILTER_REJECT;
          if (p.closest && p.closest("svg")) return NodeFilter.FILTER_REJECT;
          if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      },
      false
    );
    const nodes = [];
    let cur;
    while ((cur = walker.nextNode())) nodes.push(cur);
    nodes.forEach(processTextNode);
  }

  // Quitar emojis de los placeholders (no se puede meter SVG ahí)
  function processPlaceholders(root) {
    if (!root.querySelectorAll) return;
    const inputs = root.querySelectorAll("input[placeholder], textarea[placeholder]");
    inputs.forEach(function (el) {
      const ph = el.getAttribute("placeholder");
      if (!ph) return;
      EMOJI_RE.lastIndex = 0;
      if (!EMOJI_RE.test(ph)) return;
      // reemplazar emojis mapeados por "" y limpiar espacios sobrantes
      const cleaned = ph.replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();
      el.setAttribute("placeholder", cleaned);
    });
  }

  // ── Lucide listo ──
  function lucideReady() {
    return window.lucide && typeof window.lucide.createIcons === "function";
  }
  function renderLucide() {
    if (lucideReady()) {
      try {
        window.lucide.createIcons();
      } catch (e) {
        console.warn("[icons] createIcons falló:", e);
      }
    }
  }

  // ── Observer para contenido dinámico ──
  let observer = null;
  let scheduled = false;
  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      renderLucide();
    }, 120);
  }

  function handleMutations(mutations) {
    if (!observer) return;
    observer.disconnect();
    try {
      mutations.forEach(function (mut) {
        mut.addedNodes && mut.addedNodes.forEach(function (n) {
          if (n.nodeType === 3) {
            processTextNode(n);
          } else if (n.nodeType === 1) {
            processElement(n);
            processPlaceholders(n);
          }
        });
      });
    } catch (e) {
      console.warn("[icons] error procesando mutaciones:", e);
    }
    scheduleRender();
    if (observer && document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  function startObserver() {
    if (!("MutationObserver" in window) || !document.body) return;
    observer = new MutationObserver(handleMutations);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Inicialización ──
  function init() {
    try {
      processElement(document.body);
      processPlaceholders(document.body);
    } catch (e) {
      console.warn("[icons] error en pasada inicial:", e);
    }
    // Esperar a que Lucide esté disponible (CDN) y renderizar
    let tries = 0;
    const poll = setInterval(function () {
      tries++;
      if (lucideReady()) {
        clearInterval(poll);
        renderLucide();
        startObserver();
      } else if (tries > 50) {
        // ~5s sin Lucide: igual arrancamos el observer por si carga después
        clearInterval(poll);
        startObserver();
      }
    }, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
