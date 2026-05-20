// public/js/mercadopago-ui.js
// ──────────────────────────────────────────────────────────────────
// MERCADO PAGO — Frontend UI
// Override de funciones existentes + funciones nuevas para suscripciones MP.
// Se carga DESPUÉS de ui.js (en index.html) y reemplaza:
//   - renderPremiumPlanes() → cambia $4.99 USD por $8.000 ARS + botón real
//   - setPlan() → mantiene el comportamiento original (es legacy)
//   - renderConfig() → wraps original para agregar bloque "Mi suscripción"
// Agrega 3 funciones nuevas globales:
//   - comprarPremium()
//   - verEstadoSuscripcion()
//   - cancelarSuscripcion()
// ──────────────────────────────────────────────────────────────────

(function(){
  "use strict";

  // ─── OVERRIDE: renderPremiumPlanes() ───────────────────────────
  // Cambiamos el precio de $4.99 USD a $8.000 ARS y conectamos el botón real.
  window.renderPremiumPlanes = function(){
    const c = document.getElementById("planes-content");
    if(!c) return;
    const u = (typeof App !== "undefined" && App.user) ? App.user : null;
    const esPremium = u?.plan && u.plan !== "Gratis";

    c.innerHTML = `
      <div class="plan-card">
        <h2>Gratis</h2>
        <p>✅ Mentor básico</p>
        <p>✅ Lecciones offline</p>
        <p>✅ Quiz interactivo</p>
        <p>⚠️ 10 preguntas/día con IA</p>
        <div class="plan-price">$0</div>
        <button class="btn btn-ghost btn-full" ${u?.plan === "Gratis" ? 'disabled' : ''}>
          Plan ${u?.plan === "Gratis" ? "actual" : "Gratis"}
        </button>
      </div>

      <div class="plan-card featured">
        <h2>Premium ⚡</h2>
        <p>🚀 Chat ilimitado con AVAI</p>
        <p>🎭 Roleplay y simulaciones</p>
        <p>📓 Diario con IA</p>
        <p>📜 Certificados PDF</p>
        <p>🌐 Búsqueda en internet</p>
        <p>🎨 Generación de imágenes</p>
        <p>🎤 Voz: hablás y AVAI te responde</p>
        <p>✈️ Planificador de viajes</p>
        <p>💪 Vida sana (alimentación + ejercicio)</p>
        <div class="plan-price">$8.000 <span style="font-size:14px;font-weight:600;opacity:.8">ARS/mes</span></div>
        ${esPremium
          ? `<button class="btn btn-ghost btn-full" disabled>✅ Ya sos Premium</button>`
          : `<button class="btn btn-primary btn-full" onclick="comprarPremium()" id="btn-comprar-premium">💳 Suscribirme con Mercado Pago</button>`
        }
        <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:8px">
          Cancelás cuando quieras · Sin permanencia
        </p>
      </div>

      <div class="plan-card">
        <h2>Empresarial 🔒</h2>
        <p>🏢 Para equipos</p>
        <p>📈 Métricas avanzadas</p>
        <p>🤖 IA personalizada</p>
        <div class="plan-price" style="font-size:20px">Consultar</div>
        <button class="btn btn-ghost btn-full" disabled>Próximamente</button>
      </div>
    `;
  };

  // ─── WRAPPER: renderConfig() — agregar "Mi suscripción" ──────────
  // Esperamos a que renderConfig original termine, después agregamos el bloque.
  const originalRenderConfig = window.renderConfig;
  if(typeof originalRenderConfig === "function"){
    window.renderConfig = function(){
      // Llamamos al original (que renderiza todo el formulario de config)
      originalRenderConfig.apply(this, arguments);

      // Ahora inyectamos el bloque "Mi suscripción" antes del bloque de Feedback
      const configContent = document.getElementById("config-content");
      if(!configContent) return;

      // Buscamos el bloque de Feedback y le agregamos arriba "Mi suscripción"
      const feedbackBlock = configContent.querySelector('h4');
      // Buscar el h4 que dice "Feedback"
      const allH4s = configContent.querySelectorAll('h4');
      let feedbackHeader = null;
      allH4s.forEach(h => {
        if(h.textContent.includes("Feedback")) feedbackHeader = h;
      });

      if(feedbackHeader){
        // Crear el bloque de suscripción
        const susBlock = document.createElement("div");
        susBlock.style.cssText = "margin-top:24px;padding-top:18px;border-top:1px solid var(--border)";
        susBlock.innerHTML = `
          <h4 style="margin-bottom:12px">💎 Mi suscripción</h4>
          <div id="suscripcion-content">
            <div class="loading-row"><div class="spinner"></div>Cargando estado…</div>
          </div>
        `;
        // Insertar antes del bloque de feedback (que es el padre del h4)
        const feedbackParent = feedbackHeader.parentElement;
        feedbackParent.parentElement.insertBefore(susBlock, feedbackParent);

        // Cargar el estado de la suscripción
        if(typeof verEstadoSuscripcion === "function"){
          verEstadoSuscripcion();
        }
      }
    };
  }

  // ─── FUNCIÓN: comprarPremium() ──────────────────────────────────
  window.comprarPremium = async function(){
    if(!App.user || !App.token){
      Toast.error("Iniciá sesión para suscribirte.");
      return;
    }
    if(App.user.plan && App.user.plan !== "Gratis"){
      Toast.info("Ya sos Premium, capo!");
      return;
    }

    const btn = document.getElementById("btn-comprar-premium");
    if(btn){
      btn.disabled = true;
      btn.textContent = "⏳ Procesando…";
    }

    try{
      const resp = await fetch("/api/mercadopago", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + App.token,
        },
        body: JSON.stringify({ action: "crear_suscripcion" }),
      });
      const data = await resp.json();
      if(!resp.ok || !data.ok){
        throw new Error(data.error || "Error al crear suscripción");
      }
      if(!data.init_point){
        throw new Error("No se recibió link de pago de Mercado Pago");
      }
      Toast.info("Te llevamos a Mercado Pago para completar el pago…");
      setTimeout(() => {
        window.location.href = data.init_point;
      }, 800);
    }catch(e){
      Toast.error(e.message || "Error al iniciar la suscripción");
      if(btn){
        btn.disabled = false;
        btn.textContent = "💳 Suscribirme con Mercado Pago";
      }
    }
  };

  // ─── FUNCIÓN: verEstadoSuscripcion() ────────────────────────────
  window.verEstadoSuscripcion = async function(){
    const c = document.getElementById("suscripcion-content");
    if(!c) return;

    if(!App.user || !App.token){
      c.innerHTML = `<p class="text-muted">Iniciá sesión para ver tu suscripción.</p>`;
      return;
    }

    try{
      const resp = await fetch("/api/mercadopago", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + App.token,
        },
        body: JSON.stringify({ action: "estado_suscripcion" }),
      });
      const data = await resp.json();

      if(!data.tiene_suscripcion){
        c.innerHTML = `
          <div class="card" style="padding:14px;background:rgba(100,116,139,.08);border:1px solid rgba(100,116,139,.2)">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <span style="font-size:24px">🆓</span>
              <strong>Plan Gratis</strong>
            </div>
            <p class="text-muted" style="font-size:13px;margin-bottom:10px">
              Estás usando AVAI gratis. Activá Premium para chat ilimitado, voz, imágenes y más.
            </p>
            <button class="btn btn-primary btn-sm" onclick="navigateTo('premium')">💎 Ver Premium</button>
          </div>`;
        return;
      }

      const statusLabels = {
        pending: { txt: "⏳ Pendiente de aprobación", color: "#fbbf24" },
        authorized: { txt: "✅ Activa", color: "#22c55e" },
        cancelled: { txt: "❌ Cancelada", color: "#ef4444" },
        paused: { txt: "⏸️ Pausada", color: "#94a3b8" },
      };
      const sl = statusLabels[data.status] || { txt: data.status || "—", color: "#94a3b8" };
      const fechaVence = data.next_payment_date
        ? new Date(data.next_payment_date).toLocaleDateString("es-AR")
        : "—";

      c.innerHTML = `
        <div class="card" style="padding:14px;background:linear-gradient(135deg,rgba(168,85,247,.08),rgba(99,102,241,.05));border:1.5px solid rgba(168,85,247,.3)">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-size:22px">💎</span>
                <strong style="font-size:15px">Plan Premium</strong>
              </div>
              <div style="font-size:12px;color:${sl.color};font-weight:700">${sl.txt}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:18px;font-weight:800;color:#facc15">$${(data.amount||0).toLocaleString("es-AR")}</div>
              <div style="font-size:11px;color:#94a3b8">${data.currency||"ARS"}/mes</div>
            </div>
          </div>

          ${data.status === "authorized" ? `
            <div style="font-size:12px;color:#cbd5e1;margin-bottom:12px">
              📅 Próximo cobro: <strong style="color:#fde68a">${fechaVence}</strong>
            </div>
          ` : ""}

          ${data.status === "cancelled" ? `
            <div style="background:rgba(239,68,68,.1);padding:10px;border-radius:8px;font-size:12px;color:#fca5a5;margin-bottom:10px">
              Tu suscripción fue cancelada. Mantenés Premium hasta el final del período pago.
            </div>
          ` : ""}

          ${data.status === "pending" ? `
            <div style="background:rgba(251,191,36,.1);padding:10px;border-radius:8px;font-size:12px;color:#fde68a;margin-bottom:10px">
              Tu pago está siendo procesado por Mercado Pago. Apenas se confirme, se activa Premium automáticamente.
            </div>
          ` : ""}

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
            <button class="btn btn-ghost btn-sm" onclick="verEstadoSuscripcion()">🔄 Refrescar</button>
            ${data.status === "authorized" || data.status === "pending"
              ? `<button class="btn btn-ghost btn-sm" onclick="cancelarSuscripcion()" style="color:#f87171">🗑️ Cancelar suscripción</button>`
              : ""}
          </div>
        </div>
      `;
    }catch(e){
      c.innerHTML = `<div class="alert alert-error" style="font-size:12px">${(e && e.message) ? e.message : "Error al cargar"}</div>`;
    }
  };

  // ─── FUNCIÓN: cancelarSuscripcion() ─────────────────────────────
  window.cancelarSuscripcion = async function(){
    if(!confirm("¿Cancelar tu suscripción Premium?\n\nMantenés todos los beneficios hasta el final del período actual pago. Podés reactivarla cuando quieras.")) return;

    try{
      const resp = await fetch("/api/mercadopago", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + App.token,
        },
        body: JSON.stringify({ action: "cancelar_suscripcion" }),
      });
      const data = await resp.json();
      if(!resp.ok || !data.ok){
        throw new Error(data.error || "Error al cancelar");
      }
      Toast.success("Suscripción cancelada. Mantenés Premium hasta el fin del período pago.");
      setTimeout(() => verEstadoSuscripcion(), 800);
    }catch(e){
      Toast.error(e.message || "Error al cancelar la suscripción");
    }
  };

  // ─── Re-ejecutar renderPremiumPlanes con el override ────────────
  // (por si ya se ejecutó antes con el viejo)
  if(typeof renderPremiumPlanes === "function" && document.getElementById("planes-content")){
    try { renderPremiumPlanes(); } catch(_){}
  }

})();
