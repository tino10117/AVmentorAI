// public/js/auth-extra.js — v4 (compatible con login v3)
//
// CAMBIOS IMPORTANTES vs v3:
// - NO inyecta botón "Olvidé contraseña" (ahora ya viene en index.html)
// - NO redefine setLoginTab (la del index.html maneja los 5 paneles)
// - Guarda tokens en AMBOS nombres (av_token + avai_token) para que ui.js y auth-extra trabajen juntos
// - Banner "Verificá tu email" sigue funcionando para usuarios ya logueados
// - Modal de verificación se puede abrir desde cualquier lugar

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // HELPERS DE TOKEN (lee de cualquiera de los dos nombres)
  // ═══════════════════════════════════════════════════════════════
  function getToken() {
    return localStorage.getItem('av_token') || localStorage.getItem('avai_token');
  }
  function getUser() {
    const a = localStorage.getItem('av_user');
    const b = localStorage.getItem('avai_user');
    try { return JSON.parse(a || b || 'null'); } catch { return null; }
  }
  function saveUserBoth(user) {
    const json = JSON.stringify(user);
    localStorage.setItem('av_user', json);
    localStorage.setItem('avai_user', json);
  }

  // ═══════════════════════════════════════════════════════════════
  // BANNER "VERIFICÁ TU EMAIL" — solo se muestra a usuarios logueados
  // ═══════════════════════════════════════════════════════════════
  function bannerVerif() {
    const user = getUser();
    if (!user || !user.email || user.email_verificado) return;
    if (document.getElementById('banner-verif')) return;

    const b = document.createElement('div');
    b.id = 'banner-verif';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:linear-gradient(135deg,#a855f7,#7c3aed);color:#fff;padding:10px 16px;text-align:center;z-index:998;font-size:14px;';
    b.innerHTML = `
      ✉️ Verificá tu email para mayor seguridad
      <button id="btn-vnow" style="margin-left:12px;background:#fff;color:#7c3aed;border:none;padding:6px 14px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:13px;">Verificar ahora</button>
      <button id="btn-vlater" style="margin-left:8px;background:transparent;color:#fff;border:1px solid #fff;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px;">Después</button>
    `;
    document.body.appendChild(b);
    document.getElementById('btn-vlater').onclick = () => { b.remove(); sessionStorage.setItem('verif_oculto','1'); };
    document.getElementById('btn-vnow').onclick = abrirModalVerif;
  }

  function abrirModalVerif() {
    if (document.getElementById('modal-verif')) return;
    const m = document.createElement('div');
    m.id = 'modal-verif';
    m.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;';
    m.innerHTML = `
      <div style="background:#0d0d0d;border:2px solid #a855f7;border-radius:16px;padding:30px;max-width:420px;width:100%;color:#fff;font-family:Inter,Arial,sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="margin:0;color:#a855f7;">✉️ Verificá tu email</h2>
          <button id="cerrar-verif" style="background:transparent;border:none;color:#fff;font-size:24px;cursor:pointer;">✕</button>
        </div>
        <p style="margin-bottom:16px;color:#ccc;font-size:14px;line-height:1.6">Te vamos a enviar un código de 6 dígitos a tu email.</p>
        <div id="aviso-dev-v" style="background:#1e1b4b;border-left:4px solid #a855f7;padding:10px;margin-bottom:12px;border-radius:4px;font-size:13px;display:none;"></div>
        <button id="enviar-v" style="width:100%;padding:14px;background:linear-gradient(135deg,#a855f7,#7c3aed);border:none;border-radius:8px;color:#fff;font-weight:bold;cursor:pointer;font-size:16px;margin-bottom:12px;">📧 Enviar código</button>
        <input type="text" id="cod-v" placeholder="Código 6 dígitos" maxlength="6" style="width:100%;padding:12px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#fff;margin-bottom:12px;box-sizing:border-box;font-size:22px;letter-spacing:8px;text-align:center;font-weight:800">
        <button id="validar-v" style="width:100%;padding:14px;background:linear-gradient(135deg,#fbbf24,#f59e0b);border:none;border-radius:8px;color:#000;font-weight:bold;cursor:pointer;font-size:16px;">✅ Verificar</button>
        <div id="v-err" style="color:#f87171;margin-top:12px;font-size:14px;text-align:center;"></div>
        <div id="v-ok" style="color:#34d399;margin-top:12px;font-size:14px;text-align:center;"></div>
      </div>
    `;
    document.body.appendChild(m);
    document.getElementById('cerrar-verif').onclick = () => m.remove();
    document.getElementById('enviar-v').onclick = enviarV;
    document.getElementById('validar-v').onclick = validarV;
  }

  async function enviarV() {
    const t = getToken();
    const err = document.getElementById('v-err');
    const ok = document.getElementById('v-ok');
    if (err) err.textContent = '';
    if (ok) ok.textContent = '';
    const btn = document.getElementById('enviar-v');
    btn.disabled = true; btn.textContent = '⏳ Enviando...';
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
        body: JSON.stringify({ action: 'enviar_codigo_verif' })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Error');
      if (data.codigo_dev) {
        const av = document.getElementById('aviso-dev-v');
        av.style.display = 'block';
        av.innerHTML = `🛠️ <strong>Modo dev:</strong> tu código es <strong style="color:#a855f7;">${data.codigo_dev}</strong>`;
      }
      if (ok) ok.textContent = data.mensaje || '📧 Código enviado a tu email';
    } catch (e) {
      if (err) err.textContent = e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '📧 Reenviar código';
    }
  }

  async function validarV() {
    const t = getToken();
    const codigo = document.getElementById('cod-v').value.trim();
    const err = document.getElementById('v-err');
    const ok = document.getElementById('v-ok');
    if (err) err.textContent = '';
    if (ok) ok.textContent = '';
    if (!codigo || codigo.length !== 6) { if (err) err.textContent = 'Código de 6 dígitos'; return; }
    const btn = document.getElementById('validar-v');
    btn.disabled = true; btn.textContent = '⏳ Verificando...';
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
        body: JSON.stringify({ action: 'verificar_email', codigo })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Error');

      // Actualizar user en localStorage (ambos nombres)
      const user = getUser();
      if (user) {
        user.email_verificado = true;
        saveUserBoth(user);
        // Si App existe, también actualizar la referencia en memoria
        if (typeof App !== 'undefined' && App.user) {
          App.user.email_verificado = true;
          if (typeof Store !== 'undefined' && Store.save) Store.save();
        }
      }

      if (ok) ok.textContent = '✅ Email verificado correctamente';
      setTimeout(() => {
        document.getElementById('modal-verif')?.remove();
        document.getElementById('banner-verif')?.remove();
      }, 1500);
    } catch (e) {
      if (err) err.textContent = e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '✅ Verificar';
    }
  }

  // Exponer abrirModalVerif para que el index.html pueda llamarlo
  window.abrirModalVerifEmail = abrirModalVerif;

  // ═══════════════════════════════════════════════════════════════
  // EDITAR PERFIL — usado en config/perfil
  // ═══════════════════════════════════════════════════════════════
  window.renderBloqueEditarPerfil = function() {
    const u = getUser();
    if (!u) return '';
    return `
      <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h3 style="font-family:'Syne',sans-serif;color:#fbbf24;margin-top:0;">👤 Editar perfil</h3>
        <div style="display:grid;gap:12px;">
          <div>
            <label style="font-size:13px;color:#888;display:block;margin-bottom:4px;">Nombre</label>
            <input type="text" id="perfil-nombre" value="${u.nombre || ''}" style="width:100%;padding:10px;border-radius:8px;border:1px solid #333;background:#0d0d0d;color:#fff;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:13px;color:#888;display:block;margin-bottom:4px;">📅 Fecha de nacimiento</label>
            <input type="date" id="perfil-fechanac" value="${u.fecha_nacimiento || ''}" style="width:100%;padding:10px;border-radius:8px;border:1px solid #333;background:#0d0d0d;color:#fff;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:13px;color:#888;display:block;margin-bottom:4px;">🏠 Ciudad</label>
            <input type="text" id="perfil-ciudad" value="${u.ciudad || ''}" placeholder="Formosa, Argentina" style="width:100%;padding:10px;border-radius:8px;border:1px solid #333;background:#0d0d0d;color:#fff;box-sizing:border-box;">
          </div>
          <button onclick="guardarPerfil()" style="padding:12px;background:linear-gradient(135deg,#fbbf24,#f59e0b);border:none;border-radius:8px;color:#000;font-weight:bold;cursor:pointer;">💾 Guardar cambios</button>
          <div id="perfil-msg" style="font-size:14px;text-align:center;"></div>
        </div>
      </div>
    `;
  };

  window.guardarPerfil = async function() {
    const t = getToken();
    const nombre = document.getElementById('perfil-nombre').value.trim();
    const fecha_nacimiento = document.getElementById('perfil-fechanac').value || null;
    const ciudad = document.getElementById('perfil-ciudad').value.trim();
    const msg = document.getElementById('perfil-msg');
    msg.textContent = ''; msg.style.color = '';
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
        body: JSON.stringify({ action: 'actualizar_perfil', nombre, fecha_nacimiento, ciudad })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Error');
      saveUserBoth(data.user);
      if (typeof App !== 'undefined' && App.user) {
        App.user = data.user;
        if (typeof Store !== 'undefined' && Store.save) Store.save();
      }
      msg.style.color = '#34d399';
      msg.textContent = '✅ Perfil actualizado';
    } catch (e) {
      msg.style.color = '#f87171';
      msg.textContent = e.message;
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // INIT — solo banner para usuarios logueados (NO inyecta botones)
  // ═══════════════════════════════════════════════════════════════
  function init() {
    // Si hay token y el banner no fue ocultado en esta sesión → mostrar
    if (getToken() && !sessionStorage.getItem('verif_oculto')) {
      setTimeout(bannerVerif, 2000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
