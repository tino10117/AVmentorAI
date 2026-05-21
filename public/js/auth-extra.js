// public/js/auth-extra.js — v2 (con MutationObserver)
// - Recuperar contraseña ("¿Olvidaste tu contraseña?")
// - Verificación de email
// - Editar perfil (fecha nac, ciudad)

(function() {
  'use strict';

  // ─── Detector inteligente del botón "Entrar" ───
  function buscarBotonEntrar() {
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
      const txt = (b.textContent || '').toLowerCase().trim();
      // Coincide con "Entrar", "⚡ Entrar", "Iniciar sesión", etc.
      if (txt === 'entrar' || txt.endsWith('entrar') || txt.includes('iniciar sesi')) {
        return b;
      }
    }
    return null;
  }

  function agregarBotonOlvide() {
    if (document.getElementById('btn-olvide-pass')) return true;
    const entrarBtn = buscarBotonEntrar();
    if (!entrarBtn) return false;

    const link = document.createElement('button');
    link.id = 'btn-olvide-pass';
    link.type = 'button';
    link.textContent = '¿Olvidaste tu contraseña?';
    link.style.cssText = 'background:transparent;border:none;color:#a855f7;cursor:pointer;font-size:13px;margin-top:10px;text-decoration:underline;padding:6px;display:block;width:100%;text-align:center;';
    link.onclick = abrirRecuperar;
    entrarBtn.parentNode.insertBefore(link, entrarBtn.nextSibling);
    console.log('[auth-extra] Botón "Olvidé contraseña" agregado');
    return true;
  }

  // ─── MutationObserver: detecta cuando aparece el form de login ───
  function observarYAgregar() {
    if (agregarBotonOlvide()) return; // ya está

    const obs = new MutationObserver(() => {
      if (agregarBotonOlvide()) {
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // Por si el observer no detecta cambios, reintentar cada 1s por 10 seg
    let intentos = 0;
    const iv = setInterval(() => {
      intentos++;
      if (agregarBotonOlvide() || intentos > 10) {
        clearInterval(iv);
        obs.disconnect();
      }
    }, 1000);
  }

  // ─── Modal Recuperar contraseña ───
  function abrirRecuperar() {
    const modal = document.createElement('div');
    modal.id = 'modal-rec';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;';
    modal.innerHTML = `
      <div style="background:#0d0d0d;border:2px solid #fbbf24;border-radius:16px;padding:30px;max-width:420px;width:100%;color:#fff;font-family:Inter,Arial,sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="margin:0;color:#fbbf24;">🔑 Recuperar contraseña</h2>
          <button id="cerrar-rec" style="background:transparent;border:none;color:#fff;font-size:24px;cursor:pointer;">✕</button>
        </div>
        <div id="paso-1-rec">
          <p style="margin-bottom:16px;color:#ccc;">Ingresá tu email y te enviaremos un código.</p>
          <input type="email" id="rec-email" placeholder="tu@email.com" style="width:100%;padding:12px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#fff;margin-bottom:12px;box-sizing:border-box;">
          <button id="rec-solicitar" style="width:100%;padding:14px;background:linear-gradient(135deg,#fbbf24,#f59e0b);border:none;border-radius:8px;color:#000;font-weight:bold;cursor:pointer;font-size:16px;">📧 Enviar código</button>
        </div>
        <div id="paso-2-rec" style="display:none;">
          <p style="margin-bottom:8px;color:#ccc;">Ingresá el código y tu nueva contraseña.</p>
          <div id="aviso-dev" style="background:#451a03;border-left:4px solid #fbbf24;padding:10px;margin-bottom:12px;border-radius:4px;font-size:13px;display:none;"></div>
          <input type="text" id="rec-codigo" placeholder="Código 6 dígitos" maxlength="6" style="width:100%;padding:12px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#fff;margin-bottom:8px;box-sizing:border-box;font-size:18px;letter-spacing:4px;text-align:center;">
          <input type="password" id="rec-pass1" placeholder="Nueva contraseña" style="width:100%;padding:12px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#fff;margin-bottom:8px;box-sizing:border-box;">
          <input type="password" id="rec-pass2" placeholder="Repetir contraseña" style="width:100%;padding:12px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#fff;margin-bottom:12px;box-sizing:border-box;">
          <button id="rec-confirmar" style="width:100%;padding:14px;background:linear-gradient(135deg,#fbbf24,#f59e0b);border:none;border-radius:8px;color:#000;font-weight:bold;cursor:pointer;font-size:16px;">✅ Cambiar contraseña</button>
        </div>
        <div id="rec-error" style="color:#f87171;margin-top:12px;font-size:14px;text-align:center;"></div>
        <div id="rec-ok" style="color:#34d399;margin-top:12px;font-size:14px;text-align:center;"></div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('cerrar-rec').onclick = () => modal.remove();
    document.getElementById('rec-solicitar').onclick = solicitar;
    document.getElementById('rec-confirmar').onclick = confirmar;
  }

  async function solicitar() {
    const email = document.getElementById('rec-email').value.trim();
    const err = document.getElementById('rec-error');
    const ok = document.getElementById('rec-ok');
    err.textContent = ''; ok.textContent = '';
    if (!email) { err.textContent = 'Ingresá tu email'; return; }
    const btn = document.getElementById('rec-solicitar');
    btn.disabled = true; btn.textContent = '⏳ Enviando...';
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'solicitar_reset', email })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Error');
      window._recEmail = email;
      document.getElementById('paso-1-rec').style.display = 'none';
      document.getElementById('paso-2-rec').style.display = 'block';
      if (data.codigo_dev) {
        const av = document.getElementById('aviso-dev');
        av.style.display = 'block';
        av.innerHTML = `🛠️ <strong>Modo dev:</strong> tu código es <strong style="color:#fbbf24;">${data.codigo_dev}</strong>`;
      }
      ok.textContent = data.mensaje || 'Código enviado';
    } catch (e) {
      err.textContent = e.message;
    } finally {
      btn.disabled = false; btn.textContent = '📧 Enviar código';
    }
  }

  async function confirmar() {
    const codigo = document.getElementById('rec-codigo').value.trim();
    const p1 = document.getElementById('rec-pass1').value;
    const p2 = document.getElementById('rec-pass2').value;
    const err = document.getElementById('rec-error');
    const ok = document.getElementById('rec-ok');
    err.textContent = ''; ok.textContent = '';
    if (!codigo || codigo.length !== 6) { err.textContent = 'Código de 6 dígitos'; return; }
    if (p1.length < 6) { err.textContent = 'Contraseña mínimo 6 caracteres'; return; }
    if (p1 !== p2) { err.textContent = 'Las contraseñas no coinciden'; return; }
    const btn = document.getElementById('rec-confirmar');
    btn.disabled = true; btn.textContent = '⏳ Cambiando...';
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirmar_reset', email: window._recEmail, codigo, nueva_password: p1 })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Error');
      ok.textContent = '✅ Contraseña actualizada. Iniciando sesión...';
      setTimeout(() => {
        if (data.token) localStorage.setItem('avai_token', data.token);
        if (data.user) localStorage.setItem('avai_user', JSON.stringify(data.user));
        location.reload();
      }, 1500);
    } catch (e) {
      err.textContent = e.message;
    } finally {
      btn.disabled = false; btn.textContent = '✅ Cambiar contraseña';
    }
  }

  // ─── Banner verificá email ───
  function bannerVerif() {
    const userStr = localStorage.getItem('avai_user');
    if (!userStr) return;
    let user;
    try { user = JSON.parse(userStr); } catch { return; }
    if (!user.email || user.email_verificado) return;
    if (document.getElementById('banner-verif')) return;

    const b = document.createElement('div');
    b.id = 'banner-verif';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:linear-gradient(135deg,#a855f7,#7c3aed);color:#fff;padding:10px 16px;text-align:center;z-index:998;font-size:14px;';
    b.innerHTML = `
      ✉️ Verificá tu email para protegerla
      <button id="btn-vnow" style="margin-left:12px;background:#fff;color:#7c3aed;border:none;padding:6px 14px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:13px;">Verificar ahora</button>
      <button id="btn-vlater" style="margin-left:8px;background:transparent;color:#fff;border:1px solid #fff;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px;">Después</button>
    `;
    document.body.appendChild(b);
    document.getElementById('btn-vlater').onclick = () => { b.remove(); sessionStorage.setItem('verif_oculto','1'); };
    document.getElementById('btn-vnow').onclick = abrirVerif;
  }

  function abrirVerif() {
    const m = document.createElement('div');
    m.id = 'modal-verif';
    m.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;';
    m.innerHTML = `
      <div style="background:#0d0d0d;border:2px solid #a855f7;border-radius:16px;padding:30px;max-width:420px;width:100%;color:#fff;font-family:Inter,Arial,sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="margin:0;color:#a855f7;">✉️ Verificá tu email</h2>
          <button id="cerrar-verif" style="background:transparent;border:none;color:#fff;font-size:24px;cursor:pointer;">✕</button>
        </div>
        <p style="margin-bottom:16px;color:#ccc;">Te vamos a enviar un código de 6 dígitos.</p>
        <div id="aviso-dev-v" style="background:#1e1b4b;border-left:4px solid #a855f7;padding:10px;margin-bottom:12px;border-radius:4px;font-size:13px;display:none;"></div>
        <button id="enviar-v" style="width:100%;padding:14px;background:linear-gradient(135deg,#a855f7,#7c3aed);border:none;border-radius:8px;color:#fff;font-weight:bold;cursor:pointer;font-size:16px;margin-bottom:12px;">📧 Enviar código</button>
        <input type="text" id="cod-v" placeholder="Código 6 dígitos" maxlength="6" style="width:100%;padding:12px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#fff;margin-bottom:12px;box-sizing:border-box;font-size:18px;letter-spacing:4px;text-align:center;">
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
    const t = localStorage.getItem('avai_token');
    const err = document.getElementById('v-err'); const ok = document.getElementById('v-ok');
    err.textContent = ''; ok.textContent = '';
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
      ok.textContent = data.mensaje || 'Código enviado';
    } catch (e) { err.textContent = e.message; }
    finally { btn.disabled = false; btn.textContent = '📧 Reenviar código'; }
  }

  async function validarV() {
    const t = localStorage.getItem('avai_token');
    const codigo = document.getElementById('cod-v').value.trim();
    const err = document.getElementById('v-err'); const ok = document.getElementById('v-ok');
    err.textContent = ''; ok.textContent = '';
    if (!codigo || codigo.length !== 6) { err.textContent = 'Código de 6 dígitos'; return; }
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
      const us = localStorage.getItem('avai_user');
      if (us) { const u = JSON.parse(us); u.email_verificado = true; localStorage.setItem('avai_user', JSON.stringify(u)); }
      ok.textContent = '✅ Email verificado';
      setTimeout(() => {
        document.getElementById('modal-verif')?.remove();
        document.getElementById('banner-verif')?.remove();
      }, 1500);
    } catch (e) { err.textContent = e.message; }
    finally { btn.disabled = false; btn.textContent = '✅ Verificar'; }
  }

  // ─── Editar perfil (global) ───
  window.renderBloqueEditarPerfil = function() {
    const us = localStorage.getItem('avai_user');
    if (!us) return '';
    let u;
    try { u = JSON.parse(us); } catch { return ''; }
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
    const t = localStorage.getItem('avai_token');
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
      localStorage.setItem('avai_user', JSON.stringify(data.user));
      msg.style.color = '#34d399'; msg.textContent = '✅ Perfil actualizado';
    } catch (e) { msg.style.color = '#f87171'; msg.textContent = e.message; }
  };

  // ─── INIT ───
  function init() {
    // Si no hay token, observar y agregar botón "olvidé"
    if (!localStorage.getItem('avai_token')) {
      observarYAgregar();
    } else {
      if (!sessionStorage.getItem('verif_oculto')) {
        setTimeout(bannerVerif, 2000);
      }
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
