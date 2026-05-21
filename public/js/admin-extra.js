// public/js/admin-extra.js — Panel Admin extendido AVAI
// Renderiza un panel completo con stats + tabla + acciones por usuario
// Solo se activa si el user es admin (valen810a@gmail.com)

(function() {
  'use strict';

  const ADMIN_EMAILS = ['valen810a@gmail.com'];
  let _usuariosCache = [];

  function esAdmin() {
    const us = localStorage.getItem('avai_user');
    if (!us) return false;
    try {
      const u = JSON.parse(us);
      return ADMIN_EMAILS.includes((u.email || '').toLowerCase().trim());
    } catch { return false; }
  }

  async function apiAdmin(action, extra = {}) {
    const t = localStorage.getItem('avai_token');
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
      body: JSON.stringify({ action, ...extra })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error');
    return data;
  }

  // ─── RENDER COMPLETO ───
  window.renderPanelAdminExtendido = async function() {
    const cont = document.getElementById('admin-content');
    if (!cont || !esAdmin()) return;
    cont.innerHTML = `<div style="text-align:center;padding:40px;color:#888;"><div class="spinner" style="display:inline-block;width:30px;height:30px;border:3px solid #333;border-top-color:#fbbf24;border-radius:50%;animation:spin 1s linear infinite;"></div><br>Cargando panel admin...</div>`;

    try {
      const [statsR, usersR] = await Promise.all([
        apiAdmin('stats'),
        apiAdmin('usuarios'),
      ]);
      _usuariosCache = usersR.usuarios || [];
      const s = statsR.stats || {};

      cont.innerHTML = `
        <!-- STATS ARRIBA -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px;">
          <div style="background:linear-gradient(135deg,#1e3a8a,#1e40af);padding:16px;border-radius:12px;">
            <div style="font-size:12px;color:#bfdbfe;text-transform:uppercase;">Total usuarios</div>
            <div style="font-size:32px;font-weight:bold;color:#fff;">${s.total || 0}</div>
          </div>
          <div style="background:linear-gradient(135deg,#7c2d12,#a855f7);padding:16px;border-radius:12px;">
            <div style="font-size:12px;color:#e9d5ff;text-transform:uppercase;">Premium activos</div>
            <div style="font-size:32px;font-weight:bold;color:#fff;">${s.plan?.premium || 0}</div>
          </div>
          <div style="background:linear-gradient(135deg,#064e3b,#10b981);padding:16px;border-radius:12px;">
            <div style="font-size:12px;color:#a7f3d0;text-transform:uppercase;">Ingresos mensual</div>
            <div style="font-size:24px;font-weight:bold;color:#fff;">$${(s.ingresos_estimados_mensual_ars||0).toLocaleString('es-AR')}</div>
          </div>
          <div style="background:linear-gradient(135deg,#7c2d12,#f59e0b);padding:16px;border-radius:12px;">
            <div style="font-size:12px;color:#fde68a;text-transform:uppercase;">Nuevos (7d)</div>
            <div style="font-size:32px;font-weight:bold;color:#fff;">${s.nuevos_7d || 0}</div>
          </div>
          <div style="background:linear-gradient(135deg,#1f2937,#374151);padding:16px;border-radius:12px;">
            <div style="font-size:12px;color:#d1d5db;text-transform:uppercase;">Activos (7d)</div>
            <div style="font-size:32px;font-weight:bold;color:#fff;">${s.actividad?.activos_7d || 0}</div>
          </div>
          <div style="background:linear-gradient(135deg,#7f1d1d,#dc2626);padding:16px;border-radius:12px;">
            <div style="font-size:12px;color:#fecaca;text-transform:uppercase;">Baneados</div>
            <div style="font-size:32px;font-weight:bold;color:#fff;">${s.baneados || 0}</div>
          </div>
        </div>

        <!-- BARRA DE ACCIONES -->
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
          <input id="admin-search" type="text" placeholder="🔍 Buscar por email o nombre..." style="flex:1;min-width:240px;padding:10px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#fff;">
          <select id="admin-filtro-plan" style="padding:10px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#fff;">
            <option value="">Todos los planes</option>
            <option value="Gratis">Gratis</option>
            <option value="Premium">Premium</option>
            <option value="Empresarial">Empresarial</option>
          </select>
          <button onclick="exportarCSVAdmin()" style="padding:10px 16px;background:linear-gradient(135deg,#10b981,#059669);border:none;border-radius:8px;color:#fff;font-weight:bold;cursor:pointer;">📥 Exportar CSV</button>
          <button onclick="renderPanelAdminExtendido()" style="padding:10px 16px;background:#374151;border:none;border-radius:8px;color:#fff;cursor:pointer;">🔄 Refrescar</button>
        </div>

        <!-- TABLA DE USUARIOS -->
        <div style="background:#0d0d0d;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;">
          <div style="padding:12px 16px;border-bottom:1px solid #2a2a2a;background:#1a1a1a;font-weight:bold;color:#fbbf24;">
            👥 Usuarios (${usersR.total || 0})
          </div>
          <div id="admin-tabla-usuarios" style="max-height:600px;overflow-y:auto;"></div>
        </div>

        <style>
          @keyframes spin{to{transform:rotate(360deg)}}
          .admin-fila:hover{background:#1a1a1a;}
        </style>
      `;

      document.getElementById('admin-search').addEventListener('input', filtrarUsuarios);
      document.getElementById('admin-filtro-plan').addEventListener('change', filtrarUsuarios);
      renderTablaUsuarios(_usuariosCache);

    } catch (e) {
      cont.innerHTML = `<div style="background:#7f1d1d;color:#fecaca;padding:20px;border-radius:12px;">❌ Error: ${e.message}</div>`;
    }
  };

  function filtrarUsuarios() {
    const q = document.getElementById('admin-search').value.toLowerCase().trim();
    const plan = document.getElementById('admin-filtro-plan').value;
    let lista = _usuariosCache;
    if (q) lista = lista.filter(u => (u.email||'').toLowerCase().includes(q) || (u.nombre||'').toLowerCase().includes(q));
    if (plan) lista = lista.filter(u => (u.plan||'Gratis') === plan);
    renderTablaUsuarios(lista);
  }

  function renderTablaUsuarios(lista) {
    const cont = document.getElementById('admin-tabla-usuarios');
    if (!cont) return;
    if (lista.length === 0) {
      cont.innerHTML = `<div style="text-align:center;padding:40px;color:#888;">No hay usuarios</div>`;
      return;
    }
    const filas = lista.map(u => {
      const planColor = u.plan === 'Premium' ? '#a855f7' : u.plan === 'Empresarial' ? '#fbbf24' : '#888';
      const baneadoTag = u.baneado ? '<span style="background:#7f1d1d;color:#fecaca;padding:2px 6px;border-radius:4px;font-size:11px;margin-left:6px;">🚫 BANEADO</span>' : '';
      const verifTag = u.email_verificado ? '<span style="color:#34d399;font-size:11px;">✓</span>' : '<span style="color:#888;font-size:11px;">○</span>';
      const subMp = u.tiene_suscripcion_mp ? '<span style="color:#fbbf24;font-size:11px;margin-left:4px;">💳MP</span>' : '';
      return `
        <div class="admin-fila" style="padding:12px 16px;border-bottom:1px solid #1a1a1a;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;">
          <div>
            <div style="font-weight:bold;color:#fff;">${u.nombre || '(sin nombre)'} ${baneadoTag}</div>
            <div style="font-size:13px;color:#888;">${u.email} ${verifTag} ${subMp}</div>
            <div style="font-size:12px;color:#666;margin-top:4px;">
              <span style="color:${planColor};font-weight:bold;">${u.plan || 'Gratis'}</span>
              · XP ${u.xp || 0}
              · 🔥${u.racha || 0}
              ${u.ciudad ? `· 🏠${u.ciudad}` : ''}
            </div>
          </div>
          <div>
            <button onclick="accionesUsuario('${u.email}')" style="padding:6px 12px;background:#374151;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px;">⚙️ Acciones</button>
          </div>
        </div>
      `;
    }).join('');
    cont.innerHTML = filas;
  }

  // ─── MODAL DE ACCIONES POR USUARIO ───
  window.accionesUsuario = async function(email) {
    const u = _usuariosCache.find(x => x.email === email);
    if (!u) return;
    const modal = document.createElement('div');
    modal.id = 'modal-acc';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
    modal.innerHTML = `
      <div style="background:#0d0d0d;border:2px solid #fbbf24;border-radius:16px;padding:30px;max-width:500px;width:100%;color:#fff;font-family:Inter,Arial,sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="margin:0;color:#fbbf24;">⚙️ ${u.nombre}</h2>
          <button id="cerrar-acc" style="background:transparent;border:none;color:#fff;font-size:24px;cursor:pointer;">✕</button>
        </div>
        <div style="background:#1a1a1a;padding:12px;border-radius:8px;margin-bottom:16px;font-size:13px;color:#ccc;">
          <div>📧 ${u.email} ${u.email_verificado ? '✅' : '⚠️ no verificado'}</div>
          <div>🎯 Plan: <strong style="color:${u.plan==='Premium'?'#a855f7':'#888'};">${u.plan}</strong></div>
          <div>⭐ ${u.xp || 0} XP · 🔥 ${u.racha || 0} días</div>
          ${u.ciudad ? `<div>🏠 ${u.ciudad}</div>` : ''}
          ${u.fecha_nacimiento ? `<div>📅 ${u.fecha_nacimiento}</div>` : ''}
          ${u.fecha_creacion ? `<div style="color:#666;margin-top:4px;">Creado: ${new Date(u.fecha_creacion).toLocaleString('es-AR')}</div>` : ''}
          ${u.tiene_suscripcion_mp ? `<div style="color:#fbbf24;margin-top:4px;">💳 Tiene suscripción Mercado Pago activa</div>` : ''}
        </div>

        <div style="display:grid;gap:8px;">
          <select id="acc-plan" style="padding:10px;border-radius:8px;border:1px solid #333;background:#1a1a1a;color:#fff;">
            <option value="">— Cambiar plan —</option>
            <option value="Gratis">Plan Gratis</option>
            <option value="Premium">Plan Premium</option>
            <option value="Empresarial">Plan Empresarial</option>
          </select>
          <button onclick="aplicarCambioPlan('${u.email}')" style="padding:10px;background:#1e40af;border:none;border-radius:8px;color:#fff;font-weight:bold;cursor:pointer;">💎 Aplicar cambio de plan</button>
          <button onclick="resetearPassUser('${u.email}')" style="padding:10px;background:#7c3aed;border:none;border-radius:8px;color:#fff;font-weight:bold;cursor:pointer;">🔑 Resetear contraseña</button>
          <button onclick="banearUser('${u.email}', ${!u.baneado})" style="padding:10px;background:${u.baneado?'#10b981':'#f59e0b'};border:none;border-radius:8px;color:#fff;font-weight:bold;cursor:pointer;">${u.baneado?'✅ Desbanear':'🚫 Banear'}</button>
          <button onclick="eliminarUser('${u.email}')" style="padding:10px;background:#dc2626;border:none;border-radius:8px;color:#fff;font-weight:bold;cursor:pointer;">🗑️ Eliminar usuario</button>
        </div>
        <div id="acc-msg" style="margin-top:12px;font-size:14px;text-align:center;"></div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('cerrar-acc').onclick = () => modal.remove();
  };

  function setMsg(txt, ok = true) {
    const el = document.getElementById('acc-msg');
    if (el) { el.style.color = ok ? '#34d399' : '#f87171'; el.textContent = txt; }
  }

  window.aplicarCambioPlan = async function(email) {
    const nuevo = document.getElementById('acc-plan').value;
    if (!nuevo) { setMsg('Elegí un plan', false); return; }
    try {
      const d = await apiAdmin('cambiar_plan', { email_objetivo: email, nuevo_plan: nuevo });
      setMsg(d.mensaje || 'OK', true);
      setTimeout(() => { document.getElementById('modal-acc')?.remove(); renderPanelAdminExtendido(); }, 1200);
    } catch (e) { setMsg(e.message, false); }
  };

  window.resetearPassUser = async function(email) {
    if (!confirm(`¿Resetear contraseña de ${email}?\nSe generará una password temporal.`)) return;
    try {
      const d = await apiAdmin('resetear_pass', { email_objetivo: email });
      alert(`Password temporal:\n\n${d.password_temporal}\n\nPasala al usuario.`);
      setMsg('Contraseña reseteada', true);
    } catch (e) { setMsg(e.message, false); }
  };

  window.banearUser = async function(email, estado) {
    const acc = estado ? 'banear' : 'desbanear';
    if (!confirm(`¿${acc} a ${email}?`)) return;
    try {
      const d = await apiAdmin('banear', { email_objetivo: email, estado });
      setMsg(d.mensaje, true);
      setTimeout(() => { document.getElementById('modal-acc')?.remove(); renderPanelAdminExtendido(); }, 1200);
    } catch (e) { setMsg(e.message, false); }
  };

  window.eliminarUser = async function(email) {
    if (!confirm(`⚠️ ¿ELIMINAR a ${email}?\n\nEsto es PERMANENTE.`)) return;
    if (!confirm(`Última confirmación: eliminar ${email}?`)) return;
    try {
      const d = await apiAdmin('eliminar_usuario', { email_objetivo: email, confirmar: 'SI_ELIMINAR' });
      setMsg(d.mensaje, true);
      setTimeout(() => { document.getElementById('modal-acc')?.remove(); renderPanelAdminExtendido(); }, 1200);
    } catch (e) { setMsg(e.message, false); }
  };

  window.exportarCSVAdmin = async function() {
    try {
      const d = await apiAdmin('exportar_csv');
      const blob = new Blob([d.csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `avai-usuarios-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (e) { alert('Error: ' + e.message); }
  };

  // ─── INTEGRACIÓN: override de renderAdmin si existe ───
  function init() {
    if (!esAdmin()) return;
    // Si existe la función renderAdmin del ui.js original, la wrappeamos
    const oldRender = window.renderAdmin;
    window.renderAdmin = function() {
      if (typeof oldRender === 'function') {
        try { oldRender.apply(this, arguments); } catch (e) { console.warn('oldRender error:', e); }
      }
      // Después del render original, mejoramos con nuestro panel
      setTimeout(() => {
        if (document.getElementById('admin-content')) {
          window.renderPanelAdminExtendido();
        }
      }, 100);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
