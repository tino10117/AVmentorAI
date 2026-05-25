// ui.js — All UI rendering and interactions

document.addEventListener("DOMContentLoaded", () => {
  // Si no hay sesión, mostramos la LANDING (no el login directo)
  if (!localStorage.getItem('av_token')) {
    document.getElementById('landing-screen').style.display='block';
    document.getElementById('login-screen').style.display='none';
    document.getElementById('onboarding').style.display='none';
    document.getElementById('app').style.display='none';
    renderPremiumPlanes();
    return;
  }
  Store.load();
    if (App.user && App.token) {
    if (!App.user.onboarding_completo) showOnboarding();
    else showApp();
  } else {
    document.getElementById('login-screen').style.display='flex';
    document.getElementById('onboarding').style.display='none';
    document.getElementById('app').style.display='none';
  }
  renderPremiumPlanes();
});

// ── AUTH ────────────────────────────────────────
// NOTA: setLoginTab(tab) está definido en index.html y maneja
// los 5 paneles (register, login, reset-step1, reset-step2, verif-email).
// NO lo redefinimos acá para no romper el flujo de recuperar pass.

async function doLogin() {
  const email=document.getElementById("login-email").value.trim();
  const pass=document.getElementById("login-pass").value;
  const err=document.getElementById("login-error"); err.classList.add("hidden");
  if(!email||!pass){err.textContent="Completá todos los campos.";err.classList.remove("hidden");return;}
  try{
    const d=await API.login(email,pass);
    App.token=d.token;App.user=d.user;Store.save();
    // ✨ Guardar también en el namespace 'avai_*' para que auth-extra.js funcione
    localStorage.setItem('avai_token', d.token);
    localStorage.setItem('avai_user', JSON.stringify(d.user));
    if(!App.user.onboarding_completo)showOnboarding();else showApp();
  }catch(e){err.textContent=e.message;err.classList.remove("hidden");}
}

async function doRegister() {
  const n=document.getElementById("reg-nombre").value.trim();
  const e=document.getElementById("reg-email").value.trim();
  const p=document.getElementById("reg-pass").value;
  const err=document.getElementById("reg-error"); err.classList.add("hidden");
  if(!n||!e||!p){err.textContent="Completá todos los campos.";err.classList.remove("hidden");return;}
  if(!e.includes("@")){err.textContent="Usá un email válido.";err.classList.remove("hidden");return;}
  if(p.length<6){err.textContent="Mínimo 6 caracteres.";err.classList.remove("hidden");return;}
  try{
    const d=await API.register(n,e,p);
    App.token=d.token;App.user=d.user;Store.save();
    // ✨ Guardar también en namespace 'avai_*'
    localStorage.setItem('avai_token', d.token);
    localStorage.setItem('avai_user', JSON.stringify(d.user));

    // ✨ Si el backend mandó código de verificación, mostrar pantalla
    if (d.verificacion_email && d.verificacion_email.enviado && typeof window.mostrarPantallaVerificacion === 'function') {
      window.mostrarPantallaVerificacion(e);
      return;
    }

    // Si no, ir directo al onboarding
    showOnboarding();
  }catch(ex){err.textContent=ex.message;err.classList.remove("hidden");}
}

function doLogout(){
  App.user=null;App.token=null;Store.clear();
  // Limpiar ambos namespaces
  localStorage.removeItem('av_token');
  localStorage.removeItem('av_user');
  localStorage.removeItem('avai_token');
  localStorage.removeItem('avai_user');
  sessionStorage.removeItem('verif_oculto');
  // Recargar para limpiar el state
  window.location.reload();
}

// ── ONBOARDING ──────────────────────────────────
function showOnboarding(){
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("login-screen").style.display = 'none';
  document.getElementById("app").classList.add("hidden");
  document.getElementById("onboarding").classList.remove("hidden");
  document.getElementById("onboarding").style.display = 'block';
  const u=App.user;
  if(u.objetivo)document.getElementById("ob-objetivo").value=u.objetivo;
  if(u.negocio)document.getElementById("ob-negocio").value=u.negocio;
}
async function saveOnboarding(){
  const u=App.user;
  u.objetivo=document.getElementById("ob-objetivo").value.trim();
  u.negocio=document.getElementById("ob-negocio").value.trim();
  u.tipo_negocio=document.getElementById("ob-tipo").value;
  u.nivel_usuario=document.getElementById("ob-nivel").value;
  u.tiempo_diario=document.getElementById("ob-tiempo").value;
  u.principal_dificultad=document.getElementById("ob-dificultad").value.trim();
  u.onboarding_completo=true;
  Store.save();
  // Sync con avai_user
  localStorage.setItem('avai_user', JSON.stringify(u));
  API.saveUser({objetivo:u.objetivo,negocio:u.negocio,tipo_negocio:u.tipo_negocio,nivel_usuario:u.nivel_usuario,onboarding_completo:true}).catch(()=>{});
  document.getElementById("onboarding").classList.add("hidden");
  showApp();
}

// ── SHOW APP ────────────────────────────────────
function showApp(){
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("login-screen").style.display = 'none';
  document.getElementById("onboarding").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  refreshHeader();
  UserHelper.genDesafio();
  initMentorTab();
  renderEnglishLecciones();
  renderMateLecciones();
  renderHerramientas();
  renderDesafios();
  renderConfig();
}
function refreshHeader(){
  const u=App.user;if(!u)return;
  document.getElementById("m-nombre").textContent=u.nombre||"—";
  document.getElementById("m-xp").textContent=u.xp||0;
  document.getElementById("m-racha").textContent=`${u.racha||0} día${u.racha===1?"":"s"}`;
  document.getElementById("m-plan").textContent=u.plan||"Gratis";
  const nivel=UserHelper.calcNivel(u.xp||0);
  const pct=Math.round(UserHelper.calcProgress(u.xp||0)*100);
  document.getElementById("nivel-txt").textContent=nivel;
  document.getElementById("nivel-pct").textContent=pct+"%";
  document.getElementById("nivel-bar").style.width=pct+"%";
  const loks=(u.english_lecciones_completadas||[]).length;
  const diary=(u.english_diary||[]).length;
  document.getElementById("stat-lecciones").textContent=`📚 ${loks} lecciones`;
  document.getElementById("stat-diario").textContent=`📓 ${diary} entradas`;
  document.getElementById("stat-objetivos").textContent=`🎯 ${u.objetivos_completados||0} objetivos`;
}

// ── SIDEBAR ─────────────────────────────────────
function toggleSidebar(){
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("show");
}
function closeSidebar(){
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
}

// ── SUBNAV ──────────────────────────────────────
window.setSubnav=function(section,value){
  document.querySelectorAll(`[data-subnav="${section}"]`).forEach(b=>
    b.classList.toggle("active",b.dataset.value===value));
  document.querySelectorAll(`[data-subpanel="${section}"]`).forEach(p=>
    p.style.display=p.dataset.value===value?"block":"none");
  App.currentSubnav[section]=value;
  if(section==="english"){
    if(value==="roleplay")renderEnglishRoleplay();
    if(value==="traductor")renderEnglishTraductor();
    if(value==="diario")renderEnglishDiario();
    if(value==="certificado")renderEnglishCertificado();
    if(value==="chat")initEnglishChat();
  }
  if(section==="mate"){
    if(value==="calculadora")renderMateCalculadora();
    if(value==="chat")initMateChat();
  }
};

// ── MENTOR TAB ──────────────────────────────────
function initMentorTab(){
  Chat.init("chat-negocio","neg-input","neg-send","negocio","negocio");
  document.getElementById("btn-desafio").onclick=()=>
    sendQuickNeg(`Quiero hacer este desafío: ${App.desafio}. Guiame paso a paso.`);
}
function sendQuickNeg(text){
  const i=document.getElementById("neg-input");i.value=text;
  document.getElementById("neg-send").click();
}
function sendWebSearch(tipo){
  const u=App.user;
  const rubro=u?.tipo_negocio||"negocios";
  const neg=u?.negocio||"mi negocio";
  const q={
    tendencias:`Buscá las tendencias actuales del mercado de ${rubro} en Argentina para 2026. ¿Qué está creciendo?`,
    competencia:`Buscá información actualizada sobre la competencia en el rubro de ${rubro} en Argentina.`,
    precios:`Buscá los precios actuales del mercado para ${neg} en Argentina hoy.`,
  };
  const text=q[tipo];if(!text)return;
  const c=document.getElementById("chat-negocio");
  if(!App.chatMessages.negocio)App.chatMessages.negocio=[];
  App.chatMessages.negocio.push({role:"user",content:text});
  Chat.appendMsg(c,text,"user");
  const spin=showSpinner(c);
  API.chat({type:"negocio",messages:App.chatMessages.negocio.slice(-16),useWebSearch:true})
    .then(d=>{
      removeSpinner();
      App.chatMessages.negocio.push({role:"assistant",content:d.reply});
      Chat.appendMsg(c,d.reply,"msg-ai","AVAI","⚡","linear-gradient(135deg,#38bdf8,#6366f1)","#38bdf8");
      UserHelper.accion("chat_message");
      if(!App.user.messages)App.user.messages=[];
      App.user.messages=App.chatMessages.negocio.slice(-40);
      Store.save();API.saveUser({messages:App.user.messages}).catch(()=>{});
    }).catch(e=>{removeSpinner();Toast.error(e.message);});
}

// ── INGLÉS: LECCIONES ───────────────────────────
function renderEnglishLecciones(){
  const c=document.getElementById("english-lecciones");
  const niv=App.user?.english_nivel||"Principiante";
  const done=App.user?.english_lecciones_completadas||[];
  const lecs=LECCIONES[niv]||[];
  const comp=lecs.filter(l=>done.includes(l.id)).length;
  c.innerHTML=`<div class="mb-3">
    <label class="label">Tu nivel de inglés</label>
    <select class="select" style="max-width:200px" onchange="changeEnglishNivel(this.value)">
      ${["Principiante","Intermedio","Avanzado"].map(n=>`<option${n===niv?" selected":""}>${n}</option>`).join("")}
    </select></div>
    <div class="mb-3"><div class="progress-bar"><div class="progress-fill" style="width:${lecs.length?comp/lecs.length*100:0}%"></div></div>
    <p class="text-muted mt-2">${comp}/${lecs.length} lecciones completadas en ${niv}</p></div>
    ${lecs.map(l=>{const d=done.includes(l.id);return`<div class="lesson-card${d?" done":""}">
      <div><div class="lesson-title">${d?"✅":"📖"} ${esc(l.titulo)}</div>
      <div class="lesson-desc">${esc(l.descripcion)} <span style="color:var(--gold);font-weight:700">+${l.xp} XP</span></div></div>
      <button class="btn btn-sm ${d?"btn-ghost":"btn-sky"}" onclick="openLesson('english','${l.id}')">${d?"Repasar":"Ver"}</button>
    </div>`;}).join("")}
    <div id="lesson-panel-english"></div>`;
}
function changeEnglishNivel(n){
  App.user.english_nivel=n;Store.save();
  API.saveUser({english_nivel:n}).catch(()=>{});renderEnglishLecciones();
}
function openLesson(type,id){
  const all=Object.values(type==="english"?LECCIONES:LECCIONES_MATE).flat();
  const l=all.find(x=>x.id===id);if(!l)return;
  const panel=document.getElementById(`lesson-panel-${type}`);if(!panel)return;
  const qk=`quiz_${type}_${id}`;
  if(!App.quizState[qk])App.quizState[qk]={};
  panel.innerHTML=`<div class="card mt-3">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="font-family:'Syne',sans-serif">📖 ${esc(l.titulo)}</h3>
      <button class="btn btn-ghost btn-sm" onclick="closeLesson('${type}')">✕ Cerrar</button>
    </div>
    <div class="lesson-content-box">${esc(l.contenido)}</div>
    <h4 style="margin-bottom:10px">🧠 Quiz</h4>
    <p class="text-muted mb-3">Respondé las ${l.quiz.length} preguntas (necesitás 80%).</p>
    ${l.quiz.map((q,i)=>`<div class="quiz-card">
      <div style="font-weight:700;margin-bottom:8px">Pregunta ${i+1}: ${esc(q.p)}</div>
      ${q.o.map((o,oi)=>`<label class="quiz-option">
        <input type="radio" name="${qk}_${i}" value="${oi}" onchange="App.quizState['${qk}'][${i}]=${oi}">
        ${esc(o)}</label>`).join("")}
    </div>`).join("")}
    <div id="quiz-result-${id}"></div>
    <button class="btn btn-primary mt-3" onclick="checkQuiz('${type}','${id}')">✅ Verificar</button>
  </div>`;
  panel.scrollIntoView({behavior:"smooth",block:"start"});
}
function checkQuiz(type,id){
  const all=Object.values(type==="english"?LECCIONES:LECCIONES_MATE).flat();
  const l=all.find(x=>x.id===id);if(!l)return;
  const qk=`quiz_${type}_${id}`;
  const ans=App.quizState[qk]||{};
  if(Object.keys(ans).length<l.quiz.length){Toast.error(`Respondé todas las ${l.quiz.length} preguntas.`);return;}
  const ok=l.quiz.filter((q,i)=>ans[i]===q.c).length;
  const pct=Math.round(ok/l.quiz.length*100);
  const res=document.getElementById(`quiz-result-${id}`);
  const ck=type==="english"?"english_lecciones_completadas":"mate_lecciones_completadas";
  const already=(App.user[ck]||[]).includes(id);
  res.innerHTML=pct>=80
    ?`<div class="alert alert-success mt-3">✅ ${ok}/${l.quiz.length} correctas (${pct}%). ¡Excelente!${!already
      ?`<br><button class="btn btn-primary btn-sm mt-2" onclick="completeLesson('${type}','${id}',${l.xp})">🏆 Completar (+${l.xp} XP)</button>`
      :"<br>✅ Ya completaste esta lección."}</div>`
    :`<div class="alert alert-warning mt-3">⚠️ ${ok}/${l.quiz.length} correctas (${pct}%). Necesitás 80%. Repasá y volvé a intentarlo.</div>`;
}
async function completeLesson(type,id,xp){
  const k=type==="english"?"english_lecciones_completadas":"mate_lecciones_completadas";
  if(!App.user[k])App.user[k]=[];
  if(App.user[k].includes(id)){
    Toast.info("Ya completaste esta lección.");
    return;
  }
  App.user[k].push(id);
  Store.save();
  const data = await UserHelper.accion(type==="english"?"leccion_ingles":"leccion_mate");
  if(data && data.ok){
    Toast.success(`¡Lección completada! +${xp} XP 🎉`);
  } else if(data && data.limit_reached){
    Toast.info("Lección guardada. Llegaste al límite diario de XP por lecciones.");
  } else {
    Toast.success(`¡Lección completada!`);
  }
  API.saveUser({[k]:App.user[k]}).catch(()=>{});
  if(type==="english")renderEnglishLecciones();else renderMateLecciones();
}
function closeLesson(type){const e=document.getElementById(`lesson-panel-${type}`);if(e)e.innerHTML="";}

// ── INGLÉS: ROLEPLAY ─────────────────────────────
function renderEnglishRoleplay(){
  const c=document.getElementById("english-roleplay");
  const sit=App.user?.english_roleplay_situacion;
  if(!sit){
    c.innerHTML=`<h3 style="margin-bottom:14px">🎭 Roleplay de situaciones reales</h3>
      <p class="text-muted mb-3">Elegí una situación y practicá inglés como si estuvieras ahí.</p>
      <div class="grid-2">${ROLEPLAY_SITUACIONES.map(s=>`
        <div class="card card-purple">
          <div style="font-size:28px;margin-bottom:6px">${s.emoji}</div>
          <div style="font-weight:700;margin-bottom:4px">${esc(s.titulo)}</div>
          <div class="text-muted mb-3">${esc(s.desc)}</div>
          <button class="btn btn-purple btn-sm" onclick="startRoleplay('${esc(s.emoji+' '+s.titulo+': '+s.desc)}')">Empezar →</button>
        </div>`).join("")}</div>`;
  }else{
    c.innerHTML=`<div class="alert alert-info mb-3"><b>Situación:</b> ${esc(sit)}</div>
      <p class="text-muted mb-3">Hablá en inglés. Alex actúa el personaje y te corrige al final.</p>
      <div id="chat-roleplay" class="chat-wrap" style="min-height:200px;max-height:55vh;overflow-y:auto"></div>
      <div class="chat-input-wrap"><div class="chat-input-row">
        <textarea id="rp-input" placeholder="✍️ Escribí en inglés acá..." rows="1"></textarea>
        <button class="chat-send-btn" id="rp-send">➤</button>
      </div></div>
      <button class="btn btn-ghost btn-sm mt-2" onclick="resetRoleplay()">🔄 Cambiar situación</button>`;
    Chat.init("chat-roleplay","rp-input","rp-send","englishRoleplay","english",{englishModo:"roleplay"});
  }
}
function startRoleplay(sit){
  App.user.english_roleplay_situacion=sit;App.user.english_roleplay_messages=[];
  App.chatMessages.englishRoleplay=[];Store.save();
  API.saveUser({english_roleplay_situacion:sit,english_roleplay_messages:[]}).catch(()=>{});
  renderEnglishRoleplay();
}
function resetRoleplay(){
  App.user.english_roleplay_situacion=null;App.user.english_roleplay_messages=[];
  App.chatMessages.englishRoleplay=[];Store.save();renderEnglishRoleplay();
}

// ── INGLÉS: TRADUCTOR ────────────────────────────
function renderEnglishTraductor(){
  document.getElementById("english-traductor").innerHTML=`
    <h3 style="margin-bottom:8px">📖 Traductor inteligente</h3>
    <p class="text-muted mb-3">Pegá cualquier texto en inglés y Alex lo traduce y explica palabra por palabra.</p>
    <div class="mb-3"><label class="label">Texto en inglés</label>
      <textarea class="textarea" id="trad-input" placeholder="The quarterly results exceeded our expectations." style="min-height:110px"></textarea></div>
    <button class="btn btn-purple" onclick="doTraducir()">🔍 Traducir y explicar</button>
    <div id="trad-result" class="mt-3"></div>`;
}
async function doTraducir(){
  const t=document.getElementById("trad-input").value.trim();
  if(!t){Toast.error("Pegá un texto primero.");return;}
  const r=document.getElementById("trad-result");
  r.innerHTML=`<div class="loading-row"><div class="spinner"></div>Alex está traduciendo…</div>`;
  try{
    const tradPrompt = `Traducí y explicá este texto: "${t}"`;
    const d=await API.chat({type:"english",messages:[{role:"user",content:tradPrompt}],englishModo:"traductor"});
    window._lastTraductorContext = { prompt: tradPrompt, reply: d.reply };
    r.innerHTML=`<div class="msg-english chat-msg">
      <div class="chat-msg-header"><div class="chat-avatar" style="background:linear-gradient(135deg,#a855f7,#6366f1)">🎓</div>
      <span class="chat-name" style="color:#a855f7">Alex — Traductor</span></div>
      <div>${mdRender(d.reply)}</div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(168,85,247,.25)">
        <button class="btn btn-purple btn-sm" onclick="seguirConAlex('_lastTraductorContext')">💬 Seguir charlando con Alex →</button>
      </div>
    </div>`;
  }catch(e){r.innerHTML=`<div class="alert alert-error">${esc(e.message)}</div>`;}
}

// ── INGLÉS: DIARIO ───────────────────────────────
function renderEnglishDiario(){
  const c=document.getElementById("english-diario");
  const diary=App.user?.english_diary||[];
  const hoy=today();
  const hoyEntry=diary.find(e=>e.fecha===hoy);
  let html=`<h3 style="margin-bottom:8px">📓 Diario en inglés</h3>
    <p class="text-muted mb-3">Escribí todos los días aunque sea 3 oraciones. Alex las corrige.</p>`;
  if(!hoyEntry){
    html+=`<div class="card mb-3">
      <div class="mb-2" style="font-weight:700">Entrada de hoy — ${hoy}</div>
      <textarea class="textarea" id="diary-input" placeholder="Today I worked on my business. I talked to 3 clients and sold 2 products." style="min-height:130px"></textarea>
      <button class="btn btn-purple mt-2" onclick="submitDiario()">✍️ Enviar y corregir</button>
    </div><div id="diary-result"></div>`;
  }else{
    html+=`<div class="alert alert-success mb-3">✅ Ya escribiste tu entrada de hoy — ${hoy}</div>
      <div class="card card-purple mb-3"><b>Tu entrada:</b><br><br>${esc(hoyEntry.texto)}</div>
      <div id="diary-result"></div>`;
  }
  if(diary.length>1){
    html+=`<h4 style="margin:16px 0 8px">Historial (${diary.length} entradas)</h4>`;
    [...diary].reverse().slice(0,10).forEach(e=>{
      if(e.fecha!==hoy)html+=`<details class="card mb-2" style="padding:12px 14px">
        <summary style="cursor:pointer;font-weight:700">📅 ${e.fecha}</summary>
        <p style="margin-top:8px;font-size:13px;color:var(--text2)">${esc(e.texto)}</p></details>`;
    });
  }
  c.innerHTML=html;
}
async function submitDiario(){
  const t=document.getElementById("diary-input")?.value.trim();
  if(!t){Toast.error("Escribí algo primero.");return;}
  const r=document.getElementById("diary-result");
  r.innerHTML=`<div class="loading-row"><div class="spinner"></div>Alex está corrigiendo…</div>`;
  if(!App.user.english_diary)App.user.english_diary=[];
  App.user.english_diary.push({fecha:today(),texto:t});Store.save();
  try{
    const diaryPrompt = `Mi entrada de diario en inglés de hoy: "${t}"`;
    const d=await API.chat({type:"english",messages:[{role:"user",content:diaryPrompt}],englishModo:"diario"});
    window._lastDiarioContext = { prompt: diaryPrompt, reply: d.reply };
    r.innerHTML=`<div class="msg-english chat-msg">
      <div class="chat-msg-header"><div class="chat-avatar" style="background:linear-gradient(135deg,#a855f7,#6366f1)">🎓</div>
      <span class="chat-name" style="color:#a855f7">Alex — Corrección</span></div>
      <div>${mdRender(d.reply)}</div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(168,85,247,.25)">
        <button class="btn btn-purple btn-sm" onclick="seguirConAlex('_lastDiarioContext')">💬 Seguir charlando con Alex →</button>
      </div>
    </div>`;
    UserHelper.accion("diario_ingles");
    API.saveUser({english_diary:App.user.english_diary}).catch(()=>{});
    renderEnglishDiario();
  }catch(e){r.innerHTML=`<div class="alert alert-error">${esc(e.message)}</div>`;}
}

// ── INGLÉS: CERTIFICADO ──────────────────────────
function renderEnglishCertificado(){
  const done=App.user?.english_lecciones_completadas||[];
  const colors={Principiante:"#22c55e",Intermedio:"#facc15",Avanzado:"#ef4444"};
  let html=`<h3 style="margin-bottom:14px">🏆 Certificados de nivel</h3>`;
  Object.entries(LECCIONES).forEach(([niv,lecs])=>{
    const total=lecs.length,comp=lecs.filter(l=>done.includes(l.id)).length;
    const pct=total?Math.round(comp/total*100):0;
    html+=`<div class="card mb-3">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="font-weight:700;font-size:16px;color:${colors[niv]||"#facc15"}">${niv}</span>
        <span class="text-muted">${comp}/${total} (${pct}%)</span></div>
      <div class="progress-bar mb-3"><div class="progress-fill" style="width:${pct}%;background:${colors[niv]}"></div></div>
      ${comp===total
        ?`<div class="alert alert-success mb-2">✅ ¡Completaste el nivel ${niv}!</div>
          <button class="btn btn-primary" onclick="downloadCertificado('${niv}',${comp})">📜 Descargar certificado ${niv}</button>`
        :`<p class="text-muted">Te faltan ${total-comp} lección${total-comp!==1?"es":""} para el certificado.</p>`}
    </div>`;
  });
  document.getElementById("english-certificado").innerHTML=html;
}
function downloadCertificado(nivel,lecciones){
  const nombre=App.user?.nombre||"Estudiante",fecha=today();
  const cm={Principiante:"#22c55e",Intermedio:"#facc15",Avanzado:"#ef4444"};
  const w=window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Certificado ${nivel}</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;900&family=Inter&display=swap" rel="stylesheet">
  <style>body{margin:0;background:#020617;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'Inter',sans-serif}
  .c{width:680px;border:3px solid #facc15;box-shadow:0 0 0 1px #38bdf8 inset;padding:48px;text-align:center;color:white}
  h1{font-family:'Syne',sans-serif;font-size:36px;background:linear-gradient(90deg,#facc15,#f97316);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .nm{font-family:'Syne',sans-serif;font-size:30px;color:#facc15;margin:12px 0}
  .nv{font-size:26px;font-weight:800;color:${cm[nivel]||"#facc15"};margin:8px 0}
  .line{height:2px;background:linear-gradient(90deg,transparent,#facc15,transparent);margin:18px 0}
  @media print{body{background:white}}</style></head>
  <body><div class="c"><h1>⚡ AVAI</h1>
  <div style="color:#38bdf8;margin-bottom:16px">Certificado de Nivel de Inglés</div>
  <div class="line"></div>
  <p style="color:#cbd5e1">Este certificado acredita que</p>
  <div class="nm">${nombre}</div>
  <p style="color:#cbd5e1">ha completado exitosamente el nivel</p>
  <div class="nv">${nivel}</div>
  <div style="color:#94a3b8;font-size:12px;margin-top:10px">Lecciones: ${lecciones} · Fecha: ${fecha}</div>
  <div class="line"></div><div style="font-size:40px;margin:12px 0">★</div>
  <div style="color:#64748b;font-size:11px">AVAI — Tu mentor personal</div>
  <button onclick="window.print()" style="margin-top:18px;padding:10px 24px;background:linear-gradient(90deg,#facc15,#f97316);border:none;border-radius:10px;font-weight:800;cursor:pointer;font-size:14px">🖨️ Guardar como PDF</button>
  </div></body></html>`);
}

// ── INGLÉS: CHAT CON ALEX ────────────────────────
function initEnglishChat(){
  const c=document.getElementById("english-chat");if(c.innerHTML.trim())return;
  c.innerHTML=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
    <button class="btn btn-purple btn-sm" onclick="quickAlexMsg('Explicame el verbo To Be desde cero.')">🔤 To Be</button>
    <button class="btn btn-purple btn-sm" onclick="quickAlexMsg('Quiero practicar conversación. Empezá vos.')">💬 Practicar</button>
    <button class="btn btn-purple btn-sm" onclick="quickAlexMsg('Enseñame a escribir emails profesionales en inglés.')">📧 Emails</button>
    <button class="btn btn-purple btn-sm" onclick="quickAlexMsg('Dame un ejercicio para mi nivel.')">🎯 Ejercicio</button>
    <button class="btn btn-purple btn-sm" onclick="quickAlexMsg('Enseñame frases cotidianas en inglés.')">🗣️ Frases</button>
  </div>
  <div id="chat-english" class="chat-wrap" style="min-height:200px;max-height:55vh;overflow-y:auto"></div>
  <div id="eng-image-preview" style="display:none"></div>
  <div class="chat-input-wrap"><div class="chat-input-row">
    <textarea id="eng-input" placeholder="✍️ Escribile a Alex acá..." rows="1"></textarea>
    <input type="file" id="eng-image-input" accept="image/*" style="display:none" onchange="Chat.attachImage(this, 'eng-image-preview')" />
    <button class="chat-send-btn" id="eng-attach" style="background:linear-gradient(135deg,#a855f7,#6366f1)" onclick="document.getElementById('eng-image-input').click()" title="Adjuntar imagen (Premium)">📎</button>
    <button class="chat-send-btn" id="eng-send">➤</button>
  </div></div>
  <button class="btn btn-ghost btn-sm mt-2" onclick="clearEnglishChat()">🗑️ Borrar chat de Alex</button>`;
  Chat.init("chat-english","eng-input","eng-send","english","english",{englishModo:"chat"});
}
function quickAlexMsg(t){const i=document.getElementById("eng-input");if(!i)return;i.value=t;document.getElementById("eng-send").click();}
function clearEnglishChat(){
  App.user.english_messages=[];App.chatMessages.english=[];Store.save();
  API.saveUser({english_messages:[]}).catch(()=>{});
  document.getElementById("english-chat").innerHTML="";initEnglishChat();
}

// ── MATE: LECCIONES ──────────────────────────────
function renderMateLecciones(){
  const c=document.getElementById("mate-lecciones");
  const niv=App.user?.mate_nivel||"Básico";
  const done=App.user?.mate_lecciones_completadas||[];
  const lecs=LECCIONES_MATE[niv]||[];
  const comp=lecs.filter(l=>done.includes(l.id)).length;
  c.innerHTML=`<div class="mb-3">
    <label class="label">Tu nivel de matemáticas</label>
    <select class="select" style="max-width:200px" onchange="changeMateNivel(this.value)">
      ${["Básico","Intermedio","Negocios"].map(n=>`<option${n===niv?" selected":""}>${n}</option>`).join("")}
    </select></div>
    <div class="mb-3"><div class="progress-bar"><div class="progress-fill" style="width:${lecs.length?comp/lecs.length*100:0}%;background:var(--green)"></div></div>
    <p class="text-muted mt-2">${comp}/${lecs.length} lecciones — Nivel ${niv}</p></div>
    ${lecs.map(l=>{const d=done.includes(l.id);return`<div class="lesson-card${d?" done":""}">
      <div><div class="lesson-title">${d?"✅":"📖"} ${esc(l.titulo)}</div>
      <div class="lesson-desc">${esc(l.descripcion)} <span style="color:var(--gold);font-weight:700">+${l.xp} XP</span></div></div>
      <button class="btn btn-sm ${d?"btn-ghost":"btn-green"}" onclick="openLesson('mate','${l.id}')">${d?"Repasar":"Ver"}</button>
    </div>`;}).join("")}
    <div id="lesson-panel-mate"></div>
    <div style="margin-top:24px"><h4 style="margin-bottom:12px">🏆 Certificados de Matemáticas</h4>
    ${Object.entries(LECCIONES_MATE).map(([nv,ls])=>{
      const t=ls.length,d=ls.filter(l=>done.includes(l.id)).length,p=t?Math.round(d/t*100):0;
      return`<div class="card mb-2" style="padding:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-weight:700">${nv}</span><span class="text-muted">${d}/${t}</span></div>
        <div class="progress-bar mb-2"><div class="progress-fill" style="width:${p}%;background:var(--green)"></div></div>
        ${d===t?`<button class="btn btn-green btn-sm" onclick="downloadCertMate('${nv}',${d})">📜 Certificado ${nv}</button>`
          :`<p class="text-muted" style="font-size:12px">Faltan ${t-d} lección${t-d!==1?"es":""}</p>`}
      </div>`;}).join("")}
    </div>`;
}
function changeMateNivel(n){
  App.user.mate_nivel=n;Store.save();API.saveUser({mate_nivel:n}).catch(()=>{});renderMateLecciones();
}
function downloadCertMate(nivel,lecciones){
  const nombre=App.user?.nombre||"Estudiante",fecha=today();
  const w=window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@900&family=Inter&display=swap" rel="stylesheet">
  <style>body{margin:0;background:#020617;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'Inter',sans-serif}
  .c{width:680px;border:3px solid #22c55e;padding:48px;text-align:center;color:white}
  h1{font-family:'Syne',sans-serif;font-size:34px;background:linear-gradient(90deg,#22c55e,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .nm{font-family:'Syne',sans-serif;font-size:28px;color:#22c55e;margin:12px 0}
  .nv{font-size:24px;font-weight:800;color:#facc15}.line{height:2px;background:linear-gradient(90deg,transparent,#22c55e,transparent);margin:16px 0}</style>
  </head><body><div class="c"><h1>⚡ AVAI</h1>
  <div style="color:#38bdf8;margin-bottom:16px">Certificado de Matemáticas</div>
  <div class="line"></div><p style="color:#cbd5e1">Certifica que</p>
  <div class="nm">${nombre}</div><p style="color:#cbd5e1">completó el nivel</p>
  <div class="nv">${nivel}</div>
  <div style="color:#94a3b8;font-size:12px;margin-top:10px">Lecciones: ${lecciones} · Fecha: ${fecha}</div>
  <div class="line"></div>
  <button onclick="window.print()" style="margin-top:14px;padding:10px 24px;background:linear-gradient(90deg,#22c55e,#16a34a);border:none;border-radius:10px;font-weight:800;cursor:pointer">🖨️ Guardar como PDF</button>
  </div></body></html>`);
}

// ── MATE: CALCULADORA ────────────────────────────
function renderMateCalculadora(){
  document.getElementById("mate-calculadora").innerHTML=`
    <h3 style="margin-bottom:8px">🧮 Calculadora de negocios</h3>
    <p class="text-muted mb-3">Ingresá tus números y Bruno te explica el resultado paso a paso.</p>
    <div class="mb-3"><label class="label">¿Qué querés calcular?</label>
      <select class="select" id="calc-tipo" onchange="renderCalcPanel()" style="max-width:280px">
        <option value="margen">💰 Margen de ganancia</option>
        <option value="pe">⚖️ Punto de equilibrio</option>
        <option value="roi">📈 ROI de una inversión</option>
        <option value="precio">🏷️ Precio de venta ideal</option>
        <option value="proyeccion">📊 Proyección de ventas</option>
        <option value="custom">🔢 Problema personalizado</option>
      </select></div>
    <div id="calc-panel"></div>
    <div id="calc-bruno-result" class="mt-3"></div>`;
  renderCalcPanel();
}
function renderCalcPanel(){
  const tipo=document.getElementById("calc-tipo")?.value;
  const p=document.getElementById("calc-panel");if(!p)return;
  const panels={
    margen:`<div class="grid-2 mb-3">
      <div><label class="label">Costo ($)</label><input class="input" id="cc" type="number" min="0" step="100" placeholder="1500"></div>
      <div><label class="label">Precio de venta ($)</label><input class="input" id="cpv" type="number" min="0" step="100" placeholder="3000"></div>
    </div><button class="btn btn-green" onclick="calcMargen()">🔢 Calcular</button>`,
    pe:`<div class="grid-3 mb-3">
      <div><label class="label">Costos fijos/mes ($)</label><input class="input" id="ccf" type="number" min="0" step="1000" placeholder="50000"></div>
      <div><label class="label">Precio de venta ($)</label><input class="input" id="cpv2" type="number" min="0" step="100" placeholder="5000"></div>
      <div><label class="label">Costo variable ($)</label><input class="input" id="ccv" type="number" min="0" step="100" placeholder="3000"></div>
    </div><button class="btn btn-green" onclick="calcPE()">🔢 Calcular</button>`,
    roi:`<div class="grid-2 mb-3">
      <div><label class="label">Inversión ($)</label><input class="input" id="cinv" type="number" min="0" step="1000" placeholder="50000"></div>
      <div><label class="label">Retorno obtenido ($)</label><input class="input" id="cret" type="number" min="0" step="1000" placeholder="80000"></div>
    </div><button class="btn btn-green" onclick="calcROI()">🔢 Calcular</button>`,
    precio:`<div class="grid-2 mb-3">
      <div><label class="label">Costo ($)</label><input class="input" id="ccp" type="number" min="0" step="100" placeholder="2000"></div>
      <div><label class="label">Margen deseado (%)</label><input class="input" id="cmd" type="number" min="1" max="90" step="1" placeholder="40"></div>
    </div><button class="btn btn-green" onclick="calcPrecio()">🔢 Calcular</button>`,
    proyeccion:`<div class="grid-3 mb-3">
      <div><label class="label">Ventas actuales/mes ($)</label><input class="input" id="cva" type="number" min="0" step="1000" placeholder="100000"></div>
      <div><label class="label">Crecimiento mensual (%)</label><input class="input" id="cgr" type="number" min="1" max="100" step="1" placeholder="10"></div>
      <div><label class="label">Meses a proyectar</label><input class="input" id="cms" type="number" min="1" max="24" step="1" placeholder="6"></div>
    </div><button class="btn btn-green" onclick="calcProyeccion()">📊 Proyectar</button><div id="proy-table" class="mt-3"></div>`,
    custom:`<div class="mb-3"><label class="label">Describí tu problema</label>
      <textarea class="textarea" id="ccustom" placeholder="Ej: Compré 50 remeras a $1.500, las quiero vender con 45% de margen. ¿A qué precio?" style="min-height:100px"></textarea>
    </div><button class="btn btn-green" onclick="calcCustom()">🔢 Resolver con Bruno</button>`,
  };
  p.innerHTML=panels[tipo]||"";
}
async function showBrunoResult(prompt){
  const r=document.getElementById("calc-bruno-result");
  r.innerHTML=`<div class="loading-row"><div class="spinner"></div>Bruno está calculando…</div>`;
  try{
    const d=await API.chat({type:"mate",messages:[{role:"user",content:prompt}],mateModo:"calculadora",leccion:"Calculadora"});
    window._lastBrunoContext = { prompt, reply: d.reply };
    r.innerHTML=`<div class="msg-mate chat-msg" style="border-left-color:#22c55e">
      <div class="chat-msg-header"><div class="chat-avatar" style="background:linear-gradient(135deg,#22c55e,#16a34a)">🔢</div>
      <span class="chat-name" style="color:#22c55e">Bruno</span></div>
      <div>${mdRender(d.reply)}</div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(34,197,94,.25)">
        <button class="btn btn-green btn-sm" onclick="seguirConBruno()">💬 Seguir charlando con Bruno →</button>
      </div>
    </div>`;
  }catch(e){r.innerHTML=`<div class="alert alert-error">${esc(e.message)}</div>`;}
}

function seguirConBruno(){
  const ctx = window._lastBrunoContext;
  if(!ctx){Toast.error("No hay contexto previo.");return;}
  if(!App.user.mate_messages) App.user.mate_messages = [];
  App.user.mate_messages.push({role:"user", content:ctx.prompt});
  App.user.mate_messages.push({role:"assistant", content:ctx.reply});
  App.chatMessages.mate = App.user.mate_messages.slice(-40);
  Store.save();
  API.saveUser({mate_messages: App.user.mate_messages}).catch(()=>{});
  navigateTo("mate");
  setSubnav("mate","chat");
  initMateChat();
  Toast.info("Seguí la conversación con Bruno acá.");
}

function seguirConMentor(ctxKey){
  const ctx = window[ctxKey];
  if(!ctx){Toast.error("No hay contexto previo.");return;}
  if(!App.user.messages) App.user.messages = [];
  App.user.messages.push({role:"user", content:ctx.prompt});
  App.user.messages.push({role:"assistant", content:ctx.reply});
  App.chatMessages.negocio = App.user.messages.slice(-40);
  Store.save();
  API.saveUser({messages: App.user.messages}).catch(()=>{});
  navigateTo("mentor");
  initMentorTab();
  Toast.info("Seguí la conversación con el Mentor acá.");
}

function seguirConAlex(ctxKey){
  const ctx = window[ctxKey];
  if(!ctx){Toast.error("No hay contexto previo.");return;}
  if(!App.user.english_messages) App.user.english_messages = [];
  App.user.english_messages.push({role:"user", content:ctx.prompt});
  App.user.english_messages.push({role:"assistant", content:ctx.reply});
  App.chatMessages.english = App.user.english_messages.slice(-40);
  Store.save();
  API.saveUser({english_messages: App.user.english_messages}).catch(()=>{});
  navigateTo("english");
  setSubnav("english","chat");
  initEnglishChat();
  Toast.info("Seguí la conversación con Alex acá.");
}
function calcMargen(){
  const c=parseFloat(document.getElementById("cc")?.value)||0;
  const pv=parseFloat(document.getElementById("cpv")?.value)||0;
  if(!pv){Toast.error("Ingresá el precio.");return;}
  const g=pv-c,m=(g/pv*100).toFixed(1),mk=c?(g/c*100).toFixed(1):0;
  Toast.success(`Ganancia: $${g.toLocaleString()} | Margen: ${m}% | Markup: ${mk}%`);
  showBrunoResult(`Compré a $${c} y vendo a $${pv}. Ganancia $${g}, margen ${m}%, markup ${mk}%. ¿Está bien para mi negocio?`);
}
function calcPE(){
  const cf=parseFloat(document.getElementById("ccf")?.value)||0;
  const pv=parseFloat(document.getElementById("cpv2")?.value)||0;
  const cv=parseFloat(document.getElementById("ccv")?.value)||0;
  if(pv<=cv){Toast.error("Precio debe ser mayor al costo variable.");return;}
  const mc=pv-cv,pe=(cf/mc).toFixed(0),pp=(pe*pv).toLocaleString();
  Toast.success(`PE: ${pe} unidades/mes ($${pp})`);
  showBrunoResult(`CF $${cf}, precio $${pv}, CV $${cv}. PE: ${pe} unidades ($${pp}/mes). ¿Qué significa para mi negocio?`);
}
function calcROI(){
  const inv=parseFloat(document.getElementById("cinv")?.value)||0;
  const ret=parseFloat(document.getElementById("cret")?.value)||0;
  if(!inv){Toast.error("Ingresá la inversión.");return;}
  const g=ret-inv,roi=(g/inv*100).toFixed(1);
  Toast.success(`ROI: ${roi}% | Ganancia: $${g.toLocaleString()}`);
  showBrunoResult(`Invertí $${inv} y obtuve $${ret}. ROI ${roi}%, ganancia $${g}. ¿Es buen ROI para mi negocio?`);
}
function calcPrecio(){
  const c=parseFloat(document.getElementById("ccp")?.value)||0;
  const m=parseFloat(document.getElementById("cmd")?.value)||40;
  if(!c){Toast.error("Ingresá el costo.");return;}
  const pv=(c/(1-m/100)).toFixed(0),g=(pv-c).toFixed(0);
  Toast.success(`Precio ideal: $${parseInt(pv).toLocaleString()} | Ganancia: $${parseInt(g).toLocaleString()}`);
  showBrunoResult(`Costo $${c}, quiero ${m}% de margen. Precio ideal $${pv}, ganancia $${g}. ¿Consejos?`);
}
function calcProyeccion(){
  const va=parseFloat(document.getElementById("cva")?.value)||0;
  const gr=parseFloat(document.getElementById("cgr")?.value)||10;
  const ms=parseInt(document.getElementById("cms")?.value)||6;
  if(!va){Toast.error("Ingresá las ventas.");return;}
  let v=va,total=0,rows="";
  for(let i=1;i<=ms;i++){v=v*(1+gr/100);total+=v;
    rows+=`<tr><td style="color:#94a3b8">Mes ${i}</td><td style="color:#facc15;font-weight:700">$${v.toLocaleString("es-AR",{maximumFractionDigits:0})}</td></tr>`;}
  document.getElementById("proy-table").innerHTML=`<table class="rank-table">
    <thead><tr><th>Mes</th><th>Ventas proyectadas</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td style="font-weight:700;color:#22c55e">Total ${ms} meses</td>
    <td style="font-weight:800;color:#22c55e">$${total.toLocaleString("es-AR",{maximumFractionDigits:0})}</td></tr></tfoot></table>`;
}
async function calcCustom(){
  const t=document.getElementById("ccustom")?.value.trim();
  if(!t){Toast.error("Describí el problema.");return;}showBrunoResult(t);
}

// ── MATE: CHAT ───────────────────────────────────
function initMateChat(){
  const c=document.getElementById("mate-chat");if(c.innerHTML.trim())return;
  c.innerHTML=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
    <button class="btn btn-green btn-sm" onclick="quickBrunoMsg('Explicame cómo calcular porcentajes con ejemplos de precios.')">% Porcentajes</button>
    <button class="btn btn-green btn-sm" onclick="quickBrunoMsg('¿Cómo calculo el margen de ganancia de un producto?')">📊 Margen</button>
    <button class="btn btn-green btn-sm" onclick="quickBrunoMsg('Explicame el punto de equilibrio para mi negocio.')">⚖️ PE</button>
    <button class="btn btn-green btn-sm" onclick="quickBrunoMsg('¿Qué es el ROI y cómo sé si una inversión vale la pena?')">📈 ROI</button>
    <button class="btn btn-green btn-sm" onclick="quickBrunoMsg('Dame un ejercicio de matemáticas de negocios.')">🎯 Ejercicio</button>
  </div>
  <div id="chat-mate" class="chat-wrap" style="min-height:200px;max-height:55vh;overflow-y:auto"></div>
  <div id="mate-image-preview" style="display:none"></div>
  <div class="chat-input-wrap"><div class="chat-input-row">
    <textarea id="mate-input" placeholder="✍️ Preguntale a Bruno acá..." rows="1"></textarea>
    <input type="file" id="mate-image-input" accept="image/*" style="display:none" onchange="Chat.attachImage(this, 'mate-image-preview')" />
    <button class="chat-send-btn" id="mate-attach" style="background:linear-gradient(135deg,#a855f7,#6366f1)" onclick="document.getElementById('mate-image-input').click()" title="Adjuntar imagen (Premium)">📎</button>
    <button class="chat-send-btn" id="mate-send">➤</button>
  </div></div>
  <button class="btn btn-ghost btn-sm mt-2" onclick="clearMateChat()">🗑️ Borrar chat</button>`;
  Chat.init("chat-mate","mate-input","mate-send","mate","mate",{mateModo:"chat"});
}
function quickBrunoMsg(t){const i=document.getElementById("mate-input");if(!i)return;i.value=t;document.getElementById("mate-send").click();}
function clearMateChat(){
  App.user.mate_messages=[];App.chatMessages.mate=[];Store.save();
  API.saveUser({mate_messages:[]}).catch(()=>{});
  document.getElementById("mate-chat").innerHTML="";initMateChat();
}

// ── HERRAMIENTAS ─────────────────────────────────
function renderHerramientas(){
  renderCompetencia();renderContenido();renderPlantillas();renderMarca();renderFinanzas();
  App.currentSubnav.herr="competencia";
}
function renderCompetencia(){
  document.getElementById("herr-competencia").innerHTML=`
    <h3 style="margin-bottom:8px">🔍 Análisis de competencia</h3>
    <p class="text-muted mb-3">Describí a tu competidor y el mentor te dice cómo superarlo.</p>
    <div class="grid-2 mb-3">
      <div><label class="label">Nombre del competidor</label><input class="input" id="cnom" placeholder="Tienda El Barrio"></div>
      <div><label class="label">Rubro</label><input class="input" id="crub" placeholder="ropa, comida, ecommerce…"></div>
    </div>
    <div class="mb-3"><label class="label">Instagram o web (opcional)</label><input class="input" id="cig" placeholder="@tiendaropa"></div>
    <div class="mb-3"><label class="label">¿Qué sabés de este competidor?</label>
      <textarea class="textarea" id="cdesc" placeholder="Tiene mucha clientela, precios bajos, publica mucho en Instagram…"></textarea></div>
    <div class="mb-3"><label class="label">¿Cómo es tu negocio en comparación?</label>
      <textarea class="textarea" id="cmi" placeholder="Yo vendo online, tengo mejor calidad…"></textarea></div>
    <button class="btn btn-primary" onclick="doCompetencia()">🔍 Analizar y crear plan</button>
    <div id="comp-result" class="mt-3"></div>`;
}
async function doCompetencia(){
  const nom=document.getElementById("cnom").value.trim();
  const desc=document.getElementById("cdesc").value.trim();
  if(!nom||!desc){Toast.error("Completá nombre y descripción.");return;}
  const r=document.getElementById("comp-result");
  r.innerHTML=`<div class="loading-row"><div class="spinner"></div>Analizando competidor…</div>`;
  const rub=document.getElementById("crub").value.trim();
  const ig=document.getElementById("cig").value.trim();
  const mi=document.getElementById("cmi").value.trim();
  const prompt=`Analizá este competidor y dame un plan para superarlo:\nNombre: ${nom}\nRubro: ${rub}\nInstagram: ${ig||"N/A"}\nDescripción: ${desc}\nMi negocio: ${mi||"N/A"}\n\nDame: 1) Fortalezas 2) Debilidades 3) Mis ventajas competitivas 4) Plan de 5 acciones para superarlo 5) Estrategia de diferenciación.`;
  try{
    const d=await API.chat({type:"competitor",messages:[{role:"user",content:prompt}]});
    window._lastCompetenciaContext = { prompt, reply: d.reply };
    r.innerHTML=`<div class="card card-blue">
      <div style="white-space:pre-wrap;font-size:14px;line-height:1.7;margin-bottom:12px">${mdRender(d.reply)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText(this.parentElement.previousElementSibling.textContent).then(()=>Toast.success('Copiado'))">📋 Copiar</button>
        <button class="btn btn-sky btn-sm" onclick="seguirConMentor('_lastCompetenciaContext')">💬 Seguir charlando con el Mentor →</button>
      </div>
    </div>`;
    UserHelper.accion("herramienta_usada");
  }catch(e){r.innerHTML=`<div class="alert alert-error">${esc(e.message)}</div>`;}
}
function renderContenido(){
  document.getElementById("herr-contenido").innerHTML=`
    <h3 style="margin-bottom:8px">✍️ Generador de contenido</h3>
    <p class="text-muted mb-3">Describí tu producto y generamos el texto listo para publicar.</p>
    <div class="grid-2 mb-3">
      <div><label class="label">¿Dónde vas a publicar?</label>
        <select class="select" id="gen-tipo"><option>Post de Instagram</option><option>Mensaje de WhatsApp para vender</option>
        <option>Descripción para Mercado Libre</option><option>Historia de Instagram (Story)</option>
        <option>Caption para TikTok</option><option>Email de venta a clientes</option></select></div>
      <div><label class="label">Tono</label>
        <select class="select" id="gen-tono"><option>Divertido y casual</option><option>Profesional y serio</option>
        <option>Urgente (oferta limitada)</option><option>Cercano y amigable</option><option>Aspiracional y premium</option></select></div>
    </div>
    <div class="mb-3"><label class="label">¿Qué producto o servicio?</label><input class="input" id="gen-prod" placeholder="remeras de algodón, servicio de limpieza…"></div>
    <div class="mb-3"><label class="label">Precio (opcional)</label><input class="input" id="gen-prec" placeholder="$5.000 o 3x$10.000"></div>
    <div class="mb-3"><label class="label">¿Qué lo hace especial?</label><textarea class="textarea" id="gen-bene" placeholder="100% nacional, entrega en el día…"></textarea></div>
    <button class="btn btn-primary" onclick="doGenerarContenido()">✍️ Generar contenido</button>
    <div id="gen-result" class="mt-3"></div>`;
}
async function doGenerarContenido(){
  const tipo=document.getElementById("gen-tipo").value;
  const prod=document.getElementById("gen-prod").value.trim();
  if(!prod){Toast.error("Describí el producto.");return;}
  const prec=document.getElementById("gen-prec").value.trim();
  const bene=document.getElementById("gen-bene").value.trim();
  const tono=document.getElementById("gen-tono").value;
  const r=document.getElementById("gen-result");
  r.innerHTML=`<div class="loading-row"><div class="spinner"></div>Generando contenido…</div>`;
  const prompt=`Generá 2 versiones de contenido para ${tipo}.\nProducto: ${prod}\nPrecio: ${prec||"N/A"}\nEspecial: ${bene||"N/A"}\nTono: ${tono}\nReglas: español latino argentino, emojis estratégicos, CTA claro. Separá con "--- VERSIÓN 1 ---" y "--- VERSIÓN 2 ---". Cada versión con enfoque diferente.`;
  try{
    const d=await API.chat({type:"content",messages:[{role:"user",content:prompt}]});
    window._lastContenidoContext = { prompt, reply: d.reply };
    const parts=d.reply.split(/---\s*VERSIÓN\s*\d+\s*---/).filter(p=>p.trim());
    const versionsHtml = (parts.length>1?parts:[d.reply]).map((p,i)=>`
      <div class="card card-purple mb-3">
        <div style="font-size:11px;color:var(--purple);font-weight:700;margin-bottom:8px">VERSIÓN ${i+1}</div>
        <div style="white-space:pre-wrap;font-size:14px;line-height:1.7;margin-bottom:10px">${mdRender(p.trim())}</div>
        <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent).then(()=>Toast.success('Copiado'))">📋 Copiar</button>
      </div>`).join("");
    r.innerHTML = versionsHtml + `
      <div style="margin-top:6px">
        <button class="btn btn-sky btn-sm" onclick="seguirConMentor('_lastContenidoContext')">💬 Pedir otra versión o ajustar con el Mentor →</button>
      </div>`;
    UserHelper.accion("herramienta_usada");
  }catch(e){r.innerHTML=`<div class="alert alert-error">${esc(e.message)}</div>`;}
}
function renderPlantillas(){
  const names=Object.keys(PLANTILLAS);
  document.getElementById("herr-plantillas").innerHTML=`
    <h3 style="margin-bottom:8px">📋 Plantillas descargables</h3>
    <p class="text-muted mb-3">Copiá y usá estas plantillas hoy mismo.</p>
    <div class="mb-3"><label class="label">Elegí una plantilla</label>
      <select class="select" id="plant-sel" onchange="showPlantilla()" style="max-width:280px">
        ${names.map(n=>`<option>${esc(n)}</option>`).join("")}</select></div>
    <div id="plant-content"></div>
    <div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px">
      <h4 class="mb-2">✍️ Personalizar con IA</h4>
      <div class="mb-3"><label class="label">Describí tu negocio</label>
        <input class="input" id="plant-neg" placeholder="vendo ropa de mujer por Instagram"></div>
      <button class="btn btn-ghost" onclick="personalizarPlantilla()">🪄 Personalizar</button>
      <div id="plant-ai-result" class="mt-3"></div>
    </div>`;
  showPlantilla();
}
function showPlantilla(){
  const sel=document.getElementById("plant-sel")?.value;
  const content=PLANTILLAS[sel]||"";
  document.getElementById("plant-content").innerHTML=`
    <div style="background:rgba(15,23,42,.95);border:1px solid rgba(250,204,21,.3);border-radius:14px;padding:18px;white-space:pre-wrap;font-size:13px;color:#f1f5f9;line-height:1.7;margin-bottom:10px">${esc(content)}</div>
    <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText(PLANTILLAS[document.getElementById('plant-sel').value]||'').then(()=>Toast.success('Copiado'))">📋 Copiar plantilla</button>`;
}
async function personalizarPlantilla(){
  const sel=document.getElementById("plant-sel")?.value;
  const neg=document.getElementById("plant-neg")?.value.trim();
  if(!neg){Toast.error("Describí tu negocio.");return;}
  const r=document.getElementById("plant-ai-result");
  r.innerHTML=`<div class="loading-row"><div class="spinner"></div>Personalizando…</div>`;
  try{
    const prompt=`Adaptá esta plantilla para el negocio: "${neg}". Plantilla:\n${PLANTILLAS[sel]}\nAdaptá todos los campos con información realista.`;
    const d=await API.chat({type:"content",messages:[{role:"user",content:prompt}]});
    window._lastPlantillaContext = { prompt, reply: d.reply };
    r.innerHTML=`<div class="card card-gold">
      <div style="white-space:pre-wrap;font-size:13px;line-height:1.7;margin-bottom:10px">${mdRender(d.reply)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText(this.parentElement.previousElementSibling.textContent).then(()=>Toast.success('Copiado'))">📋 Copiar personalizada</button>
        <button class="btn btn-sky btn-sm" onclick="seguirConMentor('_lastPlantillaContext')">💬 Ajustar con el Mentor →</button>
      </div>
    </div>`;
    UserHelper.accion("herramienta_usada");
  }catch(e){r.innerHTML=`<div class="alert alert-error">${esc(e.message)}</div>`;}
}
function renderMarca(){
  const userName = App.user?.nombre || "";
  const isPremium = App.user?.plan && App.user.plan !== "Gratis";
  document.getElementById("herr-marca").innerHTML=`
    <h3 style="margin-bottom:8px">🎨 Creador de marca personal</h3>
    <p class="text-muted mb-3">La IA te crea una identidad de marca completa, lista para publicar hoy.</p>

    <div style="background:linear-gradient(135deg,rgba(168,85,247,.12),rgba(99,102,241,.08));border:1.5px solid rgba(168,85,247,.4);border-radius:14px;padding:14px 16px;margin-bottom:18px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="font-size:22px">🖼️</span>
        <strong style="font-size:14px;letter-spacing:.5px;color:#c4b5fd">GENERADOR DE LOGO CON IA</strong>
        ${!isPremium ? `<span style="margin-left:auto;font-size:11px;background:#facc15;color:#020617;padding:3px 8px;border-radius:6px;font-weight:800">PREMIUM</span>` : `<span style="margin-left:auto;font-size:11px;background:rgba(34,197,94,.2);color:#86efac;padding:3px 8px;border-radius:6px;font-weight:700">10/día</span>`}
      </div>
      <p style="font-size:12px;color:#94a3b8;margin-bottom:10px;line-height:1.5">Generá tu logo en segundos con IA. Listo para usar en tu marca. Tenés 10 generaciones diarias.</p>
      <button class="btn btn-purple" style="width:100%" onclick="openLogoModal()">🎨 Generar mi logo ahora</button>
    </div>

    <div class="grid-2 mb-3">
      <div><label class="label">Tu nombre o apodo</label>
        <input class="input" id="mname" placeholder="Valentino, Vale, Tino…" value="${esc(userName)}"></div>
      <div><label class="label">Tipo de marca</label>
        <select class="select" id="mtype">
          <option value="comercial">Nombre comercial (negocio)</option>
          <option value="personal">Marca personal (con tu nombre)</option>
          <option value="hibrida">Las dos opciones</option>
        </select></div>
    </div>

    <div class="mb-3">
      <label class="label">¿Qué vendés? (sé específico)</label>
      <input class="input" id="mrub" placeholder="máquinas de afeitar premium importadas, bafles bluetooth…">
    </div>

    <div class="grid-2 mb-3">
      <div><label class="label">¿A quién le vendés?</label>
        <input class="input" id="mpub" placeholder="hombres 25-40 que cuidan su look, oficinistas…"></div>
      <div><label class="label">Rango de precios</label>
        <select class="select" id="mprice">
          <option value="economico">Económico (accesible)</option>
          <option value="medio" selected>Medio (calidad/precio)</option>
          <option value="premium">Premium (exclusivo)</option>
        </select></div>
    </div>

    <div class="grid-2 mb-3">
      <div><label class="label">Estilo de tu marca</label>
        <select class="select" id="mest">
          <option>Moderno y minimalista</option>
          <option>Divertido y colorido</option>
          <option>Elegante y premium</option>
          <option>Cercano y familiar</option>
          <option>Joven y urbano</option>
          <option>Disruptivo y rebelde</option>
          <option>Profesional y confiable</option>
        </select></div>
      <div><label class="label">¿De dónde sos?</label>
        <input class="input" id="mciu" placeholder="Buenos Aires, Córdoba, Formosa…"></div>
    </div>

    <div class="mb-3">
      <label class="label">Tu diferencial (¿por qué te eligen y no a la competencia?)</label>
      <textarea class="input" id="mdiff" rows="2" placeholder="entrego en el día, todo importado original, atención por WhatsApp 24/7…"></textarea>
    </div>

    <div class="mb-3">
      <label class="label">Personalidad de la marca (elegí 1 a 3)</label>
      <div id="mpersonality" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
        ${["Divertido","Profesional","Disruptivo","Cálido","Premium","Joven","Confiable","Auténtico","Sofisticado","Energético"].map(p=>
          `<button type="button" class="btn btn-ghost btn-sm" data-pers="${p}" onclick="toggleMarcaPers(this)">${p}</button>`
        ).join("")}
      </div>
    </div>

    <button class="btn btn-purple" onclick="doMarca()">🎨 Crear mi marca</button>
    <div id="marca-result" class="mt-3"></div>`;
}
function toggleMarcaPers(btn){
  const active = btn.classList.toggle("btn-purple");
  btn.classList.toggle("btn-ghost", !active);
  const selected = document.querySelectorAll('#mpersonality .btn-purple');
  if(selected.length > 3){
    btn.classList.remove("btn-purple");
    btn.classList.add("btn-ghost");
    Toast.error("Máximo 3 personalidades");
  }
}

async function doMarca(){
  const rub=document.getElementById("mrub").value.trim();
  if(!rub){Toast.error("Contame qué vendés.");return;}
  const name=document.getElementById("mname").value.trim();
  const type=document.getElementById("mtype").value;
  const pub=document.getElementById("mpub").value.trim();
  const price=document.getElementById("mprice").value;
  const est=document.getElementById("mest").value;
  const ciu=document.getElementById("mciu").value.trim();
  const diff=document.getElementById("mdiff").value.trim();
  const personalities=Array.from(document.querySelectorAll('#mpersonality .btn-purple')).map(b=>b.dataset.pers).join(", ");

  const r=document.getElementById("marca-result");
  r.innerHTML=`<div class="loading-row"><div class="spinner"></div>Creando tu marca…</div>`;

  const typeLabels = { comercial: "nombre comercial (no marca personal)", personal: `marca personal usando el nombre "${name||'el del usuario'}"`, hibrida: "una marca comercial y también una opción de marca personal" };
  const priceLabels = { economico: "rango económico/accesible", medio: "rango medio (buena relación calidad/precio)", premium: "rango premium/exclusivo" };

  const userPrompt = `Creá una identidad de marca completa siguiendo la estructura indicada.

DATOS DEL USUARIO:
- Nombre del fundador: ${name || "no proporcionado"}
- Tipo de marca a crear: ${typeLabels[type]}
- Qué vende: ${rub}
- Público objetivo: ${pub || "no especificado, deducí del rubro"}
- Rango de precio: ${priceLabels[price]}
- Estilo deseado: ${est}
- Ubicación: ${ciu || "Argentina"}
- Diferencial: ${diff || "no especificado"}
- Personalidad: ${personalities || "deducí del estilo y rubro"}

Generá la identidad completa AHORA, en formato Markdown, siguiendo todas las secciones obligatorias.`;

  try{
    const d=await API.chat({type:"brand",messages:[{role:"user",content:userPrompt}]});
    window._lastMarcaContext = { prompt: userPrompt, reply: d.reply };
    r.innerHTML=`<div class="card card-purple">
      <div class="md-output" style="font-size:14px;line-height:1.7;margin-bottom:12px">${mdRender(d.reply)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="copyMarcaText(this)">📋 Copiar todo</button>
        <button class="btn btn-purple btn-sm" onclick="doMarca()">🔄 Generar otra versión</button>
        <button class="btn btn-sky btn-sm" onclick="seguirConMentor('_lastMarcaContext')">💬 Seguir con el Mentor →</button>
      </div>
    </div>`;
    UserHelper.accion("herramienta_usada");
  }catch(e){r.innerHTML=`<div class="alert alert-error">${esc(e.message)}</div>`;}
}

function copyMarcaText(btn){
  const card = btn.closest('.card');
  const txt = card.querySelector('.md-output').innerText;
  navigator.clipboard.writeText(txt).then(()=>Toast.success('Copiado al portapapeles'));
}
function renderFinanzas(){
  document.getElementById("herr-finanzas").innerHTML=`
    <h3 style="margin-bottom:8px">💰 Finanzas personales con IA</h3>
    <p class="text-muted mb-3">Controlá tu plata y tomá mejores decisiones financieras.</p>
    <div class="subnav mb-3">
      <button class="subnav-btn active" data-subnav="fin" data-value="presupuesto" onclick="setSubnav('fin','presupuesto')">📊 Presupuesto</button>
      <button class="subnav-btn" data-subnav="fin" data-value="decision" onclick="setSubnav('fin','decision')">🤔 Decisiones</button>
      <button class="subnav-btn" data-subnav="fin" data-value="ahorro" onclick="setSubnav('fin','ahorro')">💸 Ahorro</button>
    </div>
    <div id="fin-presupuesto" data-subpanel="fin" data-value="presupuesto">
      <div class="grid-2 mb-3">
        <div><label class="label">💵 Ingreso mensual ($)</label><input class="input" id="fi" type="number" min="0" step="1000" placeholder="150000"></div>
        <div><label class="label">🏠 Alquiler ($)</label><input class="input" id="fa" type="number" min="0" step="1000" placeholder="40000"></div>
      </div>
      <div class="grid-3 mb-3">
        <div><label class="label">🍕 Comida</label><input class="input" id="fc" type="number" min="0" step="1000" placeholder="30000"></div>
        <div><label class="label">🚌 Transporte</label><input class="input" id="ft" type="number" min="0" step="1000" placeholder="10000"></div>
        <div><label class="label">💡 Servicios</label><input class="input" id="fs" type="number" min="0" step="1000" placeholder="15000"></div>
      </div>
      <div class="grid-2 mb-3">
        <div><label class="label">🎬 Entretenimiento</label><input class="input" id="fe" type="number" min="0" step="1000" placeholder="10000"></div>
        <div><label class="label">📦 Otros</label><input class="input" id="fo" type="number" min="0" step="1000" placeholder="5000"></div>
      </div>
      <button class="btn btn-primary" onclick="calcPresupuesto()">📊 Analizar mis finanzas</button>
      <div id="fin-result" class="mt-3"></div>
    </div>
    <div id="fin-decision" data-subpanel="fin" data-value="decision" style="display:none">
      <div class="mb-3"><label class="label">¿Qué decisión tenés que tomar?</label>
        <textarea class="textarea" id="fdil" placeholder="¿Me conviene comprar un auto en cuotas o invertir en mi negocio?"></textarea></div>
      <div class="mb-3"><label class="label">Tu situación actual (opcional)</label>
        <input class="input" id="fctx" placeholder="gano $150.000/mes, tengo $80.000 ahorrados"></div>
      <button class="btn btn-primary" onclick="calcDecision()">🤔 Analizar decisión</button>
      <div id="fin-dec-result" class="mt-3"></div>
    </div>
    <div id="fin-ahorro" data-subpanel="fin" data-value="ahorro" style="display:none">
      <div class="mb-3"><label class="label">Meta de ahorro</label><input class="input" id="fmn" placeholder="viaje, auto, negocio propio"></div>
      <div class="grid-2 mb-3">
        <div><label class="label">¿Cuánto necesitás? ($)</label><input class="input" id="fmm" type="number" min="0" step="1000" placeholder="500000"></div>
        <div><label class="label">¿Cuánto ahorrás/mes? ($)</label><input class="input" id="fam" type="number" min="0" step="1000" placeholder="20000"></div>
      </div>
      <button class="btn btn-primary" onclick="calcAhorro()">💸 Calcular</button>
      <div id="fin-aho-result" class="mt-3"></div>
    </div>`;
  App.currentSubnav.fin="presupuesto";
}
async function calcPresupuesto(){
  const ing=parseFloat(document.getElementById("fi").value)||0;
  const vals=[document.getElementById("fa"),document.getElementById("fc"),document.getElementById("ft"),
    document.getElementById("fs"),document.getElementById("fe"),document.getElementById("fo")].map(x=>parseFloat(x?.value)||0);
  const total=vals.reduce((a,b)=>a+b,0);
  const saldo=ing-total,pct=ing>0?(saldo/ing*100).toFixed(1):0;
  const color=saldo<0?"var(--red)":parseFloat(pct)<10?"var(--gold)":"var(--green)";
  const r=document.getElementById("fin-result");
  r.innerHTML=`<div class="grid-3 mb-3">
    <div class="metric-chip"><div class="metric-val text-sky">$${ing.toLocaleString()}</div><div class="metric-lbl">Ingresos</div></div>
    <div class="metric-chip"><div class="metric-val" style="color:var(--red)">$${total.toLocaleString()}</div><div class="metric-lbl">Gastos</div></div>
    <div class="metric-chip"><div class="metric-val" style="color:${color}">$${saldo.toLocaleString()}</div><div class="metric-lbl">Saldo (${pct}%)</div></div>
  </div><div id="fin-ia"><div class="loading-row"><div class="spinner"></div>Analizando…</div></div>`;
  try{
    const finPrompt = `Ingresos $${ing}. Gastos totales $${total}. Saldo $${saldo} (${pct}%). Dame diagnóstico, dónde recortar y cómo llegar al 20% de ahorro.`;
    const d=await API.chat({type:"finance",messages:[{role:"user",content:finPrompt}]});
    window._lastFinanzasPresContext = { prompt: finPrompt, reply: d.reply };
    document.getElementById("fin-ia").innerHTML=`<div class="card card-green">
      <div style="white-space:pre-wrap;font-size:14px;line-height:1.7;margin-bottom:12px">${mdRender(d.reply)}</div>
      <button class="btn btn-sky btn-sm" onclick="seguirConMentor('_lastFinanzasPresContext')">💬 Seguir charlando con el Mentor →</button>
    </div>`;
  }catch(e){document.getElementById("fin-ia").innerHTML=`<div class="alert alert-error">${esc(e.message)}</div>`;}
}
async function calcDecision(){
  const dil=document.getElementById("fdil").value.trim();
  if(!dil){Toast.error("Describí la decisión.");return;}
  const r=document.getElementById("fin-dec-result");
  r.innerHTML=`<div class="loading-row"><div class="spinner"></div>Analizando decisión…</div>`;
  const ctx=document.getElementById("fctx").value.trim();
  try{
    const decPrompt = `Analizá: ${dil}. Situación: ${ctx||"no especificada"}. Dame pros/contras, qué pasa en 3/6/12 meses, recomendación y acción para HOY.`;
    const d=await API.chat({type:"finance",messages:[{role:"user",content:decPrompt}]});
    window._lastFinanzasDecContext = { prompt: decPrompt, reply: d.reply };
    r.innerHTML=`<div class="card card-gold">
      <div style="white-space:pre-wrap;font-size:14px;line-height:1.7;margin-bottom:12px">${mdRender(d.reply)}</div>
      <button class="btn btn-sky btn-sm" onclick="seguirConMentor('_lastFinanzasDecContext')">💬 Seguir charlando con el Mentor →</button>
    </div>`;
    UserHelper.accion("herramienta_usada");
  }catch(e){r.innerHTML=`<div class="alert alert-error">${esc(e.message)}</div>`;}
}
function calcAhorro(){
  const mont=parseFloat(document.getElementById("fmm").value)||0;
  const aho=parseFloat(document.getElementById("fam").value)||0;
  const meta=document.getElementById("fmn").value.trim();
  if(!mont||!aho){Toast.error("Completá los campos.");return;}
  const meses=(mont/aho).toFixed(0),anos=(meses/12).toFixed(1);
  document.getElementById("fin-aho-result").innerHTML=`<div class="card card-green">
    <p>Para ahorrar <b>$${mont.toLocaleString()}</b>${meta?" para "+esc(meta):""} ahorrando <b>$${aho.toLocaleString()}/mes</b>:</p>
    <div style="font-size:32px;font-weight:900;color:var(--gold);margin:14px 0;font-family:'Syne',sans-serif">${meses} meses</div>
    <p style="color:var(--text3)">≈ ${anos} años</p>
    ${meses>24?`<p class="text-muted mt-2">Para lograrlo en 1 año necesitarías <b style="color:var(--gold)">$${Math.ceil(mont/12).toLocaleString()}/mes</b>.</p>`:""}
  </div>`;
}

// ── PROGRESO ─────────────────────────────────────
function renderProgreso(){
  const u=App.user;if(!u)return;
  const loks=(u.english_lecciones_completadas||[]).length;
  const diary=(u.english_diary||[]).length;
  document.getElementById("progreso-content").innerHTML=`
    <div class="grid-4 mb-4">
      <div class="metric-chip" style="border-color:rgba(250,204,21,.35)"><div class="metric-val text-gold">${u.xp||0}</div><div class="metric-lbl">⭐ XP Total</div></div>
      <div class="metric-chip" style="border-color:rgba(239,68,68,.35)"><div class="metric-val" style="color:var(--red)">${u.racha||0}</div><div class="metric-lbl">🔥 Racha (días)</div></div>
      <div class="metric-chip" style="border-color:rgba(168,85,247,.35)"><div class="metric-val text-purple">${loks}</div><div class="metric-lbl">📚 Lecciones inglés</div></div>
      <div class="metric-chip" style="border-color:rgba(34,197,94,.35)"><div class="metric-val text-green">${diary}</div><div class="metric-lbl">📓 Entradas diario</div></div>
    </div>
    <div class="card mb-3">
      <h4 style="margin-bottom:12px">📊 Panel empresario</h4>
      <div class="grid-2" style="font-size:14px;line-height:2.2">
        <p><b>Meta mensual:</b> ${u.meta_mensual||"Sin definir"}</p>
        <p><b>Ingresos objetivo:</b> $${(u.ingresos_objetivo||0).toLocaleString()}</p>
        <p><b>Hábito clave:</b> ${u.habito_clave||"Sin definir"}</p>
        <p><b>Tipo de negocio:</b> ${u.tipo_negocio||"Sin definir"}</p>
        <p><b>Desafíos completados:</b> ${u.desafios_completados||0}</p>
        <p><b>Objetivos completados:</b> ${u.objetivos_completados||0}</p>
      </div>
    </div>
    ${(u.logros||[]).length?`<div class="card mb-3">
      <h4 style="margin-bottom:10px">🏆 Logros</h4>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${u.logros.map(l=>`<span class="badge badge-gold">🏆 ${esc(l)}</span>`).join("")}</div>
    </div>`:""}
    ${(u.xp_history||[]).length>2?`<div class="card">
      <h4 style="margin-bottom:12px">📈 Evolución de XP</h4>
      <div style="height:80px;display:flex;align-items:flex-end;gap:3px;padding:0 4px">${renderMiniChart(u.xp_history)}</div>
    </div>`:""}`;
}
function renderMiniChart(h){
  if(!h||h.length<2)return"";
  const vals=h.slice(-20).map(x=>x.xp),max=Math.max(...vals);
  return vals.map(v=>`<div style="flex:1;height:${max>0?Math.max(6,Math.round(v/max*72)):6}px;background:linear-gradient(to top,#facc15,#f97316);border-radius:2px 2px 0 0;min-width:5px"></div>`).join("");
}

// ── DESAFÍOS ─────────────────────────────────────
function renderDesafios(){
  const u=App.user;
  document.getElementById("desafios-content").innerHTML=`
    <div class="challenge-card mb-4">
      <p style="font-size:12px;color:var(--gold);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Tu misión de hoy</p>
      <h3 style="font-size:17px;font-weight:600;line-height:1.6;margin-bottom:10px">${esc(App.desafio||"Generando desafío…")}</h3>
      <p class="text-muted">Completarlo suma XP y mejora tu racha.</p>
    </div>
    <div class="grid-2 mb-4">
      <button class="btn btn-primary btn-lg" onclick="completarDesafio()">✅ Completé el desafío (+40 XP)</button>
      <button class="btn btn-sky btn-lg" onclick="completarObjetivo()">🎯 Objetivo completado (+60 XP)</button>
    </div>
    <div class="card"><div style="font-size:14px;line-height:2.2">
      <p>🔥 <b>Desafíos:</b> ${u?.desafios_completados||0}</p>
      <p>🎯 <b>Objetivos:</b> ${u?.objetivos_completados||0}</p>
      <p>📅 <b>Racha:</b> ${u?.racha||0} día${u?.racha===1?"":"s"}</p>
      <p>⭐ <b>XP total:</b> ${u?.xp||0}</p>
    </div></div>`;
}
async function completarDesafio(){
  if(!App.user)return;
  const data = await UserHelper.accion("desafio_completado");
  if(data && data.ok){
    Toast.success("+40 XP 🎉 ¡Desafío completado!");
  } else if(data && data.limit_reached){
    Toast.error("Ya completaste el desafío de hoy. Mañana hay uno nuevo.");
  } else {
    Toast.error("No se pudo completar el desafío. Probá de nuevo.");
  }
  renderDesafios();refreshHeader();
}
async function completarObjetivo(){
  if(!App.user)return;
  const data = await UserHelper.accion("objetivo_completado");
  if(data && data.ok){
    Toast.success("+60 XP 🏆 ¡Objetivo completado!");
  } else if(data && data.limit_reached){
    Toast.error("Ya completaste un objetivo hoy. Mañana se reinicia.");
  } else {
    Toast.error("No se pudo completar el objetivo. Probá de nuevo.");
  }
  renderDesafios();refreshHeader();
}

// ── RANKING ──────────────────────────────────────
async function loadRanking(){
  const c=document.getElementById("ranking-content");
  try{
    const d=await API.getRanking();const r=d.ranking||[];
    if(!r.length){c.innerHTML=`<div class="alert alert-info">Todavía no hay usuarios en el ranking.</div>`;return;}
    c.innerHTML=`<div class="card"><table class="rank-table"><thead><tr>
      <th>#</th><th>Usuario</th><th>XP</th><th>Racha</th><th>Lecciones</th><th>Plan</th>
    </tr></thead><tbody>
      ${r.map((u,i)=>`<tr>
        <td class="rank-num">${i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</td>
        <td style="font-weight:600">${esc(u.nombre)}${u.nombre===App.user?.nombre?' <span class="badge badge-gold" style="font-size:10px;padding:2px 6px">Vos</span>':""}</td>
        <td style="color:var(--gold);font-weight:700">${(u.xp||0).toLocaleString()}</td>
        <td>🔥 ${u.racha||0}</td><td>📚 ${u.lecciones||0}</td>
        <td><span class="badge ${u.plan==="Gratis"?"badge-sky":"badge-gold"}">${u.plan}</span></td>
      </tr>`).join("")}
    </tbody></table></div>`;
  }catch(e){c.innerHTML=`<div class="alert alert-warning">No se pudo cargar el ranking: ${esc(e.message)}</div>`;}
}

// ── PREMIUM ──────────────────────────────────────
function renderPremiumPlanes(){
  const c=document.getElementById("planes-content");if(!c)return;
  c.innerHTML=`
    <div class="plan-card">
      <h2>Gratis</h2>
      <p>✅ Mentor básico</p><p>✅ Lecciones offline</p><p>✅ Quiz interactivo</p><p>⚠️ 10 preguntas/día con IA</p>
      <div class="plan-price">$0</div>
      <button class="btn btn-ghost btn-full" onclick="setPlan('Gratis')">Plan actual</button>
    </div>
    <div class="plan-card featured">
      <h2>Pro ⚡</h2>
      <p>🚀 Mentor ilimitado</p><p>🎭 Roleplay completo</p><p>📓 Diario con IA</p><p>📜 Certificados</p><p>🌐 Búsqueda en internet</p>
      <div class="plan-price">$4.99 USD</div>
      <button class="btn btn-primary btn-full" onclick="setPlan('Premium')">💳 Activar Pro (demo)</button>
    </div>
    <div class="plan-card">
      <h2>Empresarial 🔒</h2>
      <p>🏢 Para equipos</p><p>📈 Métricas avanzadas</p><p>🤖 IA personalizada</p>
      <div class="plan-price" style="font-size:20px">Consultar</div>
      <button class="btn btn-ghost btn-full" disabled>Próximamente</button>
    </div>`;
}
function setPlan(plan){
  if(!App.user)return;App.user.plan=plan;Store.save();
  API.saveUser({plan}).catch(()=>{});refreshHeader();Toast.success(`Plan ${plan} activado.`);
}

// ── CONFIG ───────────────────────────────────────
function renderConfig(){
  const u=App.user;if(!u)return;
  document.getElementById("config-content").innerHTML=`
    <div class="grid-2 gap-4">
      <div class="card">
        <h4 style="margin-bottom:14px">👤 Perfil</h4>
        <div class="mb-3"><label class="label">Nombre</label><input class="input" id="cfg-nombre" value="${esc(u.nombre||"")}"></div>
        <div class="mb-3"><label class="label">Objetivo principal</label><textarea class="textarea" id="cfg-obj">${esc(u.objetivo||"")}</textarea></div>
        <div class="mb-3"><label class="label">Negocio</label><input class="input" id="cfg-neg" value="${esc(u.negocio||"")}"></div>
        <div class="mb-3"><label class="label">Tipo de negocio</label><input class="input" id="cfg-tipo" value="${esc(u.tipo_negocio||"")}"></div>
      </div>
      <div class="card">
        <h4 style="margin-bottom:14px">📊 Panel empresario</h4>
        <div class="mb-3"><label class="label">Meta mensual</label><input class="input" id="cfg-meta" value="${esc(u.meta_mensual||"")}"></div>
        <div class="mb-3"><label class="label">Ingresos objetivo ($)</label><input class="input" id="cfg-ing" type="number" value="${u.ingresos_objetivo||0}"></div>
        <div class="mb-3"><label class="label">Hábito clave</label><input class="input" id="cfg-hab" value="${esc(u.habito_clave||"")}"></div>
        <div class="mb-3"><label class="label">Principal dificultad</label><textarea class="textarea" id="cfg-dif">${esc(u.principal_dificultad||"")}</textarea></div>
      </div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
      <button class="btn btn-primary" onclick="saveConfig()">💾 Guardar cambios</button>
      <button class="btn btn-ghost" onclick="if(confirm('¿Borrar conversación del mentor?')){clearMentorChat()}">🗑️ Borrar conversación</button>
      <button class="btn btn-ghost" onclick="if(confirm('¿Rehacer onboarding?')){App.user.onboarding_completo=false;Store.save();showOnboarding()}">🔁 Rehacer onboarding</button>
      ${!u.email_verificado ? `<button class="btn btn-purple" onclick="if(typeof abrirModalVerifEmail==='function')abrirModalVerifEmail()">✉️ Verificar mi email</button>` : ''}
      <button class="btn btn-red" onclick="doLogout()">🚪 Cerrar sesión</button>
    </div>
    <div style="margin-top:24px;padding-top:18px;border-top:1px solid var(--border)">
      <h4 style="margin-bottom:12px">💬 Feedback</h4>
      <div class="grid-2 mb-3">
        <div><label class="label">¿Qué tan útil es AVAI? (1-10)</label>
          <input class="input" id="fb-cal" type="number" min="1" max="10" value="8" style="max-width:80px"></div>
        <div><label class="label">¿Pagarías por esta app?</label>
          <select class="select" id="fb-pag"><option>No sé</option><option>Sí</option><option>No</option></select></div>
      </div>
      <div class="mb-3"><label class="label">Comentario</label>
        <textarea class="textarea" id="fb-com" placeholder="Qué te gustó, qué mejorarías…"></textarea></div>
      <button class="btn btn-ghost" onclick="sendFeedback()">Enviar feedback</button>
      <div id="fb-result"></div>
    </div>`;
}
function saveConfig(){
  const u=App.user;
  u.nombre=document.getElementById("cfg-nombre").value.trim()||u.nombre;
  u.objetivo=document.getElementById("cfg-obj").value.trim();
  u.negocio=document.getElementById("cfg-neg").value.trim();
  u.tipo_negocio=document.getElementById("cfg-tipo").value.trim();
  u.meta_mensual=document.getElementById("cfg-meta").value.trim();
  u.ingresos_objetivo=parseFloat(document.getElementById("cfg-ing").value)||0;
  u.habito_clave=document.getElementById("cfg-hab").value.trim();
  u.principal_dificultad=document.getElementById("cfg-dif").value.trim();
  Store.save();
  localStorage.setItem('avai_user', JSON.stringify(u));
  API.saveUser({nombre:u.nombre,objetivo:u.objetivo,negocio:u.negocio,tipo_negocio:u.tipo_negocio,
    meta_mensual:u.meta_mensual,ingresos_objetivo:u.ingresos_objetivo,habito_clave:u.habito_clave,
    principal_dificultad:u.principal_dificultad}).catch(()=>{});
  refreshHeader();Toast.success("Cambios guardados. ✅");
}
function clearMentorChat(){
  App.user.messages=[];App.chatMessages.negocio=[];Store.save();
  API.saveUser({messages:[]}).catch(()=>{});
  const c=document.getElementById("chat-negocio");c.innerHTML="";Chat.appendWelcome(c,"negocio");
  Toast.info("Conversación borrada.");
}
function sendFeedback(){
  const cal=document.getElementById("fb-cal").value;
  const com=document.getElementById("fb-com").value.trim();
  const pag=document.getElementById("fb-pag").value;
  if(!App.user.feedback)App.user.feedback=[];
  App.user.feedback.push({fecha:today(),calificacion:cal,comentario:com,pagaria:pag});
  Store.save();API.saveUser({feedback:App.user.feedback}).catch(()=>{});
  document.getElementById("fb-result").innerHTML=`<div class="alert alert-success mt-2">Feedback guardado. ¡Gracias! ✅</div>`;
}

function openLogoModal(){
  if(!App.user || App.user.plan === "Gratis"){
    Toast.error("Generar logos con IA es una función Premium. Activá Premium para usarla.");
    return;
  }
  const prefName = document.getElementById("mname")?.value?.trim() || App.user?.nombre || "";
  const prefRub  = document.getElementById("mrub")?.value?.trim() || "";
  const prefEst  = document.getElementById("mest")?.value || "Moderno y minimalista";
  const estiloMap = {
    "Moderno y minimalista": "minimalista",
    "Divertido y colorido": "divertido",
    "Elegante y premium": "elegante",
    "Cercano y familiar": "moderno",
    "Joven y urbano": "joven",
    "Disruptivo y rebelde": "disruptivo",
    "Profesional y confiable": "profesional",
  };
  const prefEstValue = estiloMap[prefEst] || "moderno";
  const modalHtml = `
    <div id="logo-modal-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)closeLogoModal()">
      <div style="background:#0f172a;border:1.5px solid rgba(168,85,247,.4);border-radius:16px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;padding:24px;box-shadow:0 20px 60px rgba(168,85,247,.3)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h3 style="margin:0;font-size:18px">🎨 Generar logo con IA</h3>
          <button onclick="closeLogoModal()" style="background:none;border:none;color:#f87171;font-size:22px;cursor:pointer;padding:0 4px" title="Cerrar">✕</button>
        </div>
        <p class="text-muted" style="font-size:13px;margin-bottom:14px">La IA va a crear tu logo en alta calidad (1024×1024). Tarda ~15 segundos.</p>
        <div class="mb-3">
          <label class="label">Nombre de tu marca <span style="color:#f87171">*</span></label>
          <input class="input" id="logo-nombre" maxlength="60" placeholder="Bela Store, AVAI, Tino Tech…" value="${esc(prefName)}">
        </div>
        <div class="mb-3">
          <label class="label">¿Qué vende tu marca? <span style="color:#f87171">*</span></label>
          <textarea class="input" id="logo-desc" rows="2" maxlength="300" placeholder="Ropa femenina urbana para mujeres 18-30 años">${esc(prefRub)}</textarea>
        </div>
        <div class="grid-2 mb-3">
          <div>
            <label class="label">Estilo del logo</label>
            <select class="select" id="logo-estilo">
              <option value="minimalista" ${prefEstValue==='minimalista'?'selected':''}>Minimalista</option>
              <option value="moderno" ${prefEstValue==='moderno'?'selected':''}>Moderno</option>
              <option value="elegante" ${prefEstValue==='elegante'?'selected':''}>Elegante / Premium</option>
              <option value="divertido" ${prefEstValue==='divertido'?'selected':''}>Divertido / Colorido</option>
              <option value="joven" ${prefEstValue==='joven'?'selected':''}>Joven / Urbano</option>
              <option value="profesional" ${prefEstValue==='profesional'?'selected':''}>Profesional</option>
              <option value="disruptivo" ${prefEstValue==='disruptivo'?'selected':''}>Disruptivo</option>
            </select>
          </div>
          <div>
            <label class="label">Paleta de colores (opcional)</label>
            <input class="input" id="logo-paleta" placeholder="negro y dorado, pastel, blanco y rojo…">
          </div>
        </div>
        <button class="btn btn-purple" style="width:100%" id="logo-generate-btn" onclick="doGenerateLogo()">🚀 Generar mi logo</button>
        <div id="logo-modal-result" style="margin-top:18px"></div>
      </div>
    </div>
  `;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = modalHtml;
  document.body.appendChild(wrapper.firstElementChild);
}

function closeLogoModal(){
  const m = document.getElementById("logo-modal-backdrop");
  if (m) m.remove();
}

async function doGenerateLogo(){
  const nombre = document.getElementById("logo-nombre").value.trim();
  const desc   = document.getElementById("logo-desc").value.trim();
  const estilo = document.getElementById("logo-estilo").value;
  const paleta = document.getElementById("logo-paleta").value.trim();
  if(!nombre){ Toast.error("Poné el nombre de tu marca."); return; }
  if(!desc){ Toast.error("Contame qué vende tu marca."); return; }
  if(desc.length > 300){ Toast.error("La descripción es muy larga (máx 300 caracteres)."); return; }
  const btn = document.getElementById("logo-generate-btn");
  const result = document.getElementById("logo-modal-result");
  btn.disabled = true;
  btn.textContent = "⏳ Generando… (~30 seg)";
  result.innerHTML = `
    <div class="loading-row" style="padding:20px;text-align:center">
      <div class="spinner" style="margin:0 auto 10px"></div>
      <div style="font-size:13px;color:#94a3b8">La IA está creando tu logo…<br>Esto tarda unos 15 segundos. No cierres la ventana.</div>
    </div>`;
  try {
    const data = await Logo.generate({ nombre, descripcion: desc, estilo, paleta });
    if(!data.images || data.images.length === 0){
      throw new Error("No se generó ninguna imagen. Probá de nuevo.");
    }
    window._lastLogoImages = data.images;
    window._lastLogoName = nombre;
    const remaining = (data.limit || 0) - (data.used || 0);
    result.innerHTML = `
      <div style="background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#86efac">
        ✅ ${data.images.length} logo${data.images.length>1?'s':''} generado${data.images.length>1?'s':''}. Te quedan <strong>${remaining}</strong> generaciones hoy.
        ${data.partial ? '<br>⚠️ Algunas variaciones fallaron, igualmente te mostramos las que sí salieron.' : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr;gap:14px">
        ${data.images.map((img, i) => `
          <div style="background:#fff;border-radius:12px;padding:12px;border:1px solid rgba(168,85,247,.2)">
            <img src="${img.url}" alt="Logo propuesta ${i+1}" style="width:100%;border-radius:8px;display:block;margin-bottom:10px" />
            <div style="display:flex;gap:8px">
              <button class="btn btn-purple btn-sm" style="flex:1" onclick="downloadLogoByIndex(${i})">⬇️ Descargar #${i+1}</button>
              <button class="btn btn-ghost btn-sm" onclick="openLogoByIndex(${i})" title="Abrir en pestaña nueva">🔗</button>
            </div>
          </div>
        `).join("")}
      </div>
      <div style="margin-top:14px;display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="doGenerateLogo()">🔄 Generar otro</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="closeLogoModal()">Cerrar</button>
      </div>
    `;
    UserHelper.accion("logo_generado");
    Toast.success("¡Logos generados! +20 XP");
  } catch(e) {
    result.innerHTML = `<div class="alert alert-error" style="margin-top:10px">${esc(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "🚀 Generar mi logo";
  }
}

function downloadLogoByIndex(i){
  const imgs = window._lastLogoImages || [];
  const img = imgs[i];
  if(!img) return;
  const safeName = String(window._lastLogoName || "logo").toLowerCase().replace(/\s+/g,"-");
  Logo.download(img.url, `logo-${safeName}-${i+1}.png`);
}

function openLogoByIndex(i){
  const imgs = window._lastLogoImages || [];
  const img = imgs[i];
  if(!img) return;
  const w = window.open();
  if(w){
    w.document.write(`<title>Logo ${i+1}</title><img src="${img.url}" style="max-width:100%;display:block;margin:0 auto" />`);
  }
}


// ═══════════════════════════════════════════════════════════════
// PLANIFICADOR DE VIAJES
// ═══════════════════════════════════════════════════════════════

function renderViajes() {
  renderViajesItinerario();
  renderViajesInspirame();
}

function renderViajesItinerario() {
  const isPremium = App.user?.plan && App.user.plan !== "Gratis";
  const userOrigen = App.user?.ciudad || "";

  document.getElementById("viajes-itinerario").innerHTML = `
    ${!isPremium ? `
      <div style="background:linear-gradient(135deg,rgba(56,189,248,.12),rgba(99,102,241,.08));border:1.5px solid rgba(56,189,248,.4);border-radius:14px;padding:14px 16px;margin-bottom:18px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">💎</span>
          <div>
            <strong style="color:#7dd3fc;font-size:14px">El Planificador de Viajes es Premium</strong>
            <p style="font-size:12px;color:#94a3b8;margin:4px 0 0">Activá Premium para armar itinerarios con IA y precios reales actualizados.</p>
          </div>
        </div>
      </div>` : ''}

    <h3 style="margin-bottom:8px">🎯 Tengo destino — Armame el itinerario</h3>
    <p class="text-muted mb-3">La IA arma tu viaje día por día con datos reales (alojamiento, comida, excursiones, precios).</p>

    <div class="grid-2 mb-3">
      <div><label class="label">¿A dónde vas? <span style="color:#f87171">*</span></label>
        <input class="input" id="v-destino" placeholder="Bariloche, Argentina"></div>
      <div><label class="label">¿Desde dónde salís?</label>
        <input class="input" id="v-origen" value="${esc(userOrigen)}" placeholder="Buenos Aires, Formosa..."></div>
    </div>

    <div class="grid-3 mb-3">
      <div><label class="label">¿Cuántos días? <span style="color:#f87171">*</span></label>
        <select class="select" id="v-dias">
          <option value="2">2 días (escapada corta)</option>
          <option value="3">3 días (fin de semana largo)</option>
          <option value="5" selected>5 días</option>
          <option value="7">7 días (1 semana)</option>
          <option value="10">10 días</option>
          <option value="14">14 días (2 semanas)</option>
          <option value="21">21 días o más</option>
        </select></div>
      <div><label class="label">¿Cuántos van?</label>
        <select class="select" id="v-personas">
          <option>Solo yo</option>
          <option selected>Pareja (2)</option>
          <option>Familia con niños chicos</option>
          <option>Familia con adolescentes</option>
          <option>Grupo de amigos (3-5)</option>
          <option>Grupo grande (6+)</option>
        </select></div>
      <div><label class="label">¿Cuándo?</label>
        <input class="input" id="v-fecha" placeholder="Marzo 2026 / verano"></div>
    </div>

    <div class="mb-3">
      <label class="label">Presupuesto total (todo el grupo, sin contar vuelos)</label>
      <select class="select" id="v-presupuesto">
        <option>Económico / mochilero (lo más barato posible)</option>
        <option selected>Medio (buen balance precio/calidad)</option>
        <option>Cómodo (sin escatimar pero sin lujos)</option>
        <option>Premium / lujo (todo top)</option>
      </select>
    </div>

    <div class="mb-3">
      <label class="label">¿Qué les gusta hacer? (elegí 1 a 4)</label>
      <div id="v-intereses" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
        ${["🌿 Naturaleza","🍽️ Gastronomía","🎉 Fiesta y vida nocturna","🏛️ Cultura e historia","⛰️ Aventura y deporte","🧖 Relax y spa","🛍️ Compras","📸 Fotos icónicas","👨‍👩‍👧 Familiar","🐶 Pet-friendly"].map(p=>
          `<button type="button" class="btn btn-ghost btn-sm" data-int="${p}" onclick="toggleViajeInt(this)">${p}</button>`
        ).join("")}
      </div>
    </div>

    <div class="mb-3">
      <label class="label">¿Algo especial? (opcional)</label>
      <textarea class="input" id="v-especial" rows="2" placeholder="Vamos con bebé, soy vegetariano, luna de miel, problemas de movilidad, queremos algo tranquilo..."></textarea>
    </div>

    <button class="btn btn-primary" onclick="doPlanificarViaje()" ${!isPremium ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}>✈️ Armar mi viaje</button>
    <div id="viaje-result" class="mt-3"></div>`;
}

function renderViajesInspirame() {
  const isPremium = App.user?.plan && App.user.plan !== "Gratis";
  const userOrigen = App.user?.ciudad || "";

  document.getElementById("viajes-inspirame").innerHTML = `
    ${!isPremium ? `
      <div style="background:linear-gradient(135deg,rgba(56,189,248,.12),rgba(99,102,241,.08));border:1.5px solid rgba(56,189,248,.4);border-radius:14px;padding:14px 16px;margin-bottom:18px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">💎</span>
          <div>
            <strong style="color:#7dd3fc;font-size:14px">El Planificador de Viajes es Premium</strong>
            <p style="font-size:12px;color:#94a3b8;margin:4px 0 0">Activá Premium para que la IA te sugiera destinos según tus gustos y presupuesto.</p>
          </div>
        </div>
      </div>` : ''}

    <h3 style="margin-bottom:8px">🤔 No sé a dónde ir — Inspirame</h3>
    <p class="text-muted mb-3">Decime qué te gusta, cuánto querés gastar y la IA te tira 4-5 destinos pensados para vos.</p>

    <div class="grid-2 mb-3">
      <div><label class="label">¿Desde dónde salís?</label>
        <input class="input" id="vi-origen" value="${esc(userOrigen)}" placeholder="Buenos Aires, Formosa..."></div>
      <div><label class="label">¿Cuándo querés viajar?</label>
        <input class="input" id="vi-fecha" placeholder="Verano 2026, en 3 meses, etc"></div>
    </div>

    <div class="grid-2 mb-3">
      <div><label class="label">Presupuesto por persona (sin vuelos)</label>
        <select class="select" id="vi-presupuesto">
          <option>$200-500 USD (mochilero)</option>
          <option selected>$500-1500 USD (medio)</option>
          <option>$1500-3000 USD (cómodo)</option>
          <option>$3000+ USD (premium)</option>
        </select></div>
      <div><label class="label">¿Cuántos días podés?</label>
        <select class="select" id="vi-dias">
          <option>2-3 días (escapada)</option>
          <option selected>4-7 días (semana)</option>
          <option>8-14 días (vacaciones)</option>
          <option>15+ días (gran viaje)</option>
        </select></div>
    </div>

    <div class="mb-3">
      <label class="label">¿Qué te tira más? (elegí 1 a 4)</label>
      <div id="vi-vibe" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
        ${["🏖️ Playa","⛰️ Montaña","🏙️ Ciudades grandes","🌿 Naturaleza salvaje","🍷 Gastronomía y vino","🎉 Fiesta","🏛️ Historia y cultura","🏝️ Islas paradisíacas","❄️ Nieve y frío","🏜️ Aventura extrema","🧘 Bienestar y relax","💑 Romántico"].map(p=>
          `<button type="button" class="btn btn-ghost btn-sm" data-vibe="${p}" onclick="toggleViajeVibe(this)">${p}</button>`
        ).join("")}
      </div>
    </div>

    <div class="mb-3">
      <label class="label">¿Algo que NO querés? (opcional)</label>
      <input class="input" id="vi-evitar" placeholder="No quiero lugares muy turísticos, ni demasiado calor...">
    </div>

    <button class="btn btn-primary" onclick="doInspirameViaje()" ${!isPremium ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}>🌎 Mostrame opciones</button>
    <div id="inspirame-result" class="mt-3"></div>`;
}

function toggleViajeInt(btn) {
  const active = btn.classList.toggle("btn-primary");
  btn.classList.toggle("btn-ghost", !active);
  const selected = document.querySelectorAll('#v-intereses .btn-primary');
  if (selected.length > 4) {
    btn.classList.remove("btn-primary");
    btn.classList.add("btn-ghost");
    Toast.error("Máximo 4 intereses");
  }
}

function toggleViajeVibe(btn) {
  const active = btn.classList.toggle("btn-primary");
  btn.classList.toggle("btn-ghost", !active);
  const selected = document.querySelectorAll('#vi-vibe .btn-primary');
  if (selected.length > 4) {
    btn.classList.remove("btn-primary");
    btn.classList.add("btn-ghost");
    Toast.error("Máximo 4 vibes");
  }
}

async function doPlanificarViaje() {
  if (!App.user || App.user.plan === "Gratis") {
    Toast.error("Activá Premium para usar el Planificador de Viajes.");
    return;
  }

  const destino = document.getElementById("v-destino").value.trim();
  if (!destino) { Toast.error("¿A dónde querés ir?"); return; }

  const origen = document.getElementById("v-origen").value.trim();
  const dias = document.getElementById("v-dias").value;
  const personas = document.getElementById("v-personas").value;
  const fecha = document.getElementById("v-fecha").value.trim();
  const presupuesto = document.getElementById("v-presupuesto").value;
  const intereses = Array.from(document.querySelectorAll('#v-intereses .btn-primary')).map(b => b.dataset.int).join(", ");
  const especial = document.getElementById("v-especial").value.trim();

  Viajes.reset();

  const r = document.getElementById("viaje-result");
  r.innerHTML = `
    <div id="viaje-result-stream-status" class="loading-row" style="padding:12px 16px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.25);border-radius:10px;margin-bottom:12px">
      <div class="spinner"></div>
      <div style="margin-left:10px;font-size:13px;color:#7dd3fc">Armando tu viaje a ${esc(destino)}… <span id="viaje-result-typing">esperando primera respuesta</span></div>
    </div>
    <div class="card card-blue" id="viaje-result-card">
      <div class="md-output" id="viaje-result-text" style="font-size:14px;line-height:1.7;min-height:60px"></div>
    </div>`;

  const formData = { destino, origen, dias, personas, fecha, presupuesto, intereses, especial };
  const userMsg = `Armame un itinerario de viaje a ${destino} de ${dias} días.`;

  const textEl = document.getElementById("viaje-result-text");
  const typingEl = document.getElementById("viaje-result-typing");
  let firstChunkReceived = false;

  try {
    const data = await Viajes.planificar({
      mode: "itinerario",
      userMessage: userMsg,
      formData,
      onDelta: (chunk, fullText) => {
        if (!firstChunkReceived) {
          firstChunkReceived = true;
          if (typingEl) typingEl.textContent = "escribiendo en vivo…";
        }
        if (textEl) textEl.innerHTML = mdRender(fullText);
      },
    });
    finishViajeStream("viaje-result", data);
    UserHelper.accion("viaje_generado");
  } catch (e) {
    r.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
  }
}

async function doInspirameViaje() {
  if (!App.user || App.user.plan === "Gratis") {
    Toast.error("Activá Premium para usar el Planificador de Viajes.");
    return;
  }

  const origen = document.getElementById("vi-origen").value.trim();
  const fecha = document.getElementById("vi-fecha").value.trim();
  const presupuesto = document.getElementById("vi-presupuesto").value;
  const dias = document.getElementById("vi-dias").value;
  const vibe = Array.from(document.querySelectorAll('#vi-vibe .btn-primary')).map(b => b.dataset.vibe).join(", ");
  const evitar = document.getElementById("vi-evitar").value.trim();

  if (!vibe) {
    Toast.error("Elegí al menos un vibe de viaje para que la IA sepa qué te gusta.");
    return;
  }

  Viajes.reset();

  const r = document.getElementById("inspirame-result");
  r.innerHTML = `
    <div id="inspirame-result-stream-status" class="loading-row" style="padding:12px 16px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.25);border-radius:10px;margin-bottom:12px">
      <div class="spinner"></div>
      <div style="margin-left:10px;font-size:13px;color:#7dd3fc">Pensando destinos para vos… <span id="inspirame-result-typing">esperando primera respuesta</span></div>
    </div>
    <div class="card card-blue" id="inspirame-result-card">
      <div class="md-output" id="inspirame-result-text" style="font-size:14px;line-height:1.7;min-height:60px"></div>
    </div>`;

  const formData = { origen, fecha, presupuesto, dias, vibe, especial: evitar };
  const userMsg = `No sé a dónde ir. Mostrame destinos que me puedan gustar.`;

  const textEl = document.getElementById("inspirame-result-text");
  const typingEl = document.getElementById("inspirame-result-typing");
  let firstChunkReceived = false;

  try {
    const data = await Viajes.planificar({
      mode: "inspirame",
      userMessage: userMsg,
      formData,
      onDelta: (chunk, fullText) => {
        if (!firstChunkReceived) {
          firstChunkReceived = true;
          if (typingEl) typingEl.textContent = "escribiendo en vivo…";
        }
        if (textEl) textEl.innerHTML = mdRender(fullText);
      },
    });
    finishViajeStream("inspirame-result", data);
    UserHelper.accion("viaje_generado");
  } catch (e) {
    r.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
  }
}

function finishViajeStream(resultId, data) {
  const container = document.getElementById(resultId);
  if (!container) return;
  const remaining = (data.limit || 0) - (data.used || 0);

  const statusBox = document.getElementById(`${resultId}-stream-status`);
  if (statusBox) {
    statusBox.outerHTML = `
      <div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3);border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#86efac">
        ✅ Listo. Te quedan <strong>${remaining}</strong> planificaciones hoy.
      </div>`;
  }

  const card = document.getElementById(`${resultId}-card`);
  if (card) {
    const actionsHtml = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0">
        <button class="btn btn-purple btn-sm" onclick="Viajes.imprimir()">🖨️ Imprimir / PDF</button>
        <button class="btn btn-ghost btn-sm" onclick="Viajes.copiar()">📋 Copiar todo</button>
      </div>
      <div style="border-top:1px solid rgba(168,85,247,.2);padding-top:14px;margin-top:6px">
        <strong style="font-size:13px;color:#c4b5fd;display:block;margin-bottom:8px">💬 ¿Querés ajustar algo?</strong>
        <textarea class="input" id="${resultId}-refine-input" rows="2" placeholder="Hacelo más barato / sumá un día más / sacá la excursión del día 3 / cambialo a destino con playa..."></textarea>
        <button class="btn btn-purple btn-sm mt-2" onclick="doRefinarViaje('${resultId}')">🔄 Ajustar viaje</button>
      </div>`;
    card.insertAdjacentHTML("beforeend", actionsHtml);
  }
  container.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function doRefinarViaje(resultId) {
  const inputEl = document.getElementById(`${resultId}-refine-input`);
  const text = inputEl?.value?.trim();
  if (!text) { Toast.error("Decime qué querés ajustar."); return; }

  const container = document.getElementById(resultId);
  container.innerHTML = `
    <div id="${resultId}-stream-status" class="loading-row" style="padding:12px 16px;background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.25);border-radius:10px;margin-bottom:12px">
      <div class="spinner"></div>
      <div style="margin-left:10px;font-size:13px;color:#c4b5fd">Ajustando tu viaje… <span id="${resultId}-typing">esperando primera respuesta</span></div>
    </div>
    <div class="card card-blue" id="${resultId}-card">
      <div class="md-output" id="${resultId}-text" style="font-size:14px;line-height:1.7;min-height:60px"></div>
    </div>`;

  const textEl = document.getElementById(`${resultId}-text`);
  const typingEl = document.getElementById(`${resultId}-typing`);
  let firstChunkReceived = false;

  try {
    const data = await Viajes.refinar(text, (chunk, fullText) => {
      if (!firstChunkReceived) {
        firstChunkReceived = true;
        if (typingEl) typingEl.textContent = "escribiendo en vivo…";
      }
      if (textEl) textEl.innerHTML = mdRender(fullText);
    });
    finishViajeStream(resultId, data);
    UserHelper.accion("viaje_refinado");
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
  }
}


// ═══════════════════════════════════════════════════════════════
// VIDA SANA (Alimentación + Ejercicio)
// ═══════════════════════════════════════════════════════════════

function renderVidaSana() {
  renderVidaSanaAlimentacion();
  renderVidaSanaEjercicio();
}

function renderVidaSanaAlimentacion() {
  const isPremium = App.user?.plan && App.user.plan !== "Gratis";

  document.getElementById("vidasana-alimentacion").innerHTML = `
    ${!isPremium ? `
      <div style="background:linear-gradient(135deg,rgba(56,189,248,.12),rgba(99,102,241,.08));border:1.5px solid rgba(56,189,248,.4);border-radius:14px;padding:14px 16px;margin-bottom:18px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">💎</span>
          <div>
            <strong style="color:#7dd3fc;font-size:14px">Vida Sana es Premium</strong>
            <p style="font-size:12px;color:#94a3b8;margin:4px 0 0">Activá Premium para tu plan de alimentación con IA.</p>
          </div>
        </div>
      </div>` : ''}

    <div style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#fcd34d">
      ⚠️ <strong>Importante:</strong> Esto NO reemplaza a un nutricionista o médico. Es orientativo. Si tenés diabetes, embarazo, alergias o dudas, consultá a un profesional.
    </div>

    <h3 style="margin-bottom:8px">🥗 Tu Plan de Alimentación</h3>
    <p class="text-muted mb-3">Completá los datos y la IA te arma un plan de 7 días con lista de compras y precios de Argentina.</p>

    <div class="grid-3 mb-3">
      <div><label class="label">Edad <span style="color:#f87171">*</span></label>
        <input class="input" id="vs-a-edad" type="number" placeholder="25" min="14" max="100"></div>
      <div><label class="label">Sexo</label>
        <select class="select" id="vs-a-sexo">
          <option>Femenino</option>
          <option>Masculino</option>
          <option>Otro / Prefiero no decir</option>
        </select></div>
      <div><label class="label">Altura (cm)</label>
        <input class="input" id="vs-a-altura" type="number" placeholder="170" min="100" max="230"></div>
    </div>

    <div class="grid-3 mb-3">
      <div><label class="label">Peso actual (kg) <span style="color:#f87171">*</span></label>
        <input class="input" id="vs-a-peso" type="number" step="0.5" placeholder="70" min="30" max="250"></div>
      <div><label class="label">Peso objetivo (kg)</label>
        <input class="input" id="vs-a-objetivo-peso" type="number" step="0.5" placeholder="65"></div>
      <div><label class="label">Objetivo</label>
        <select class="select" id="vs-a-objetivo">
          <option>Bajar de peso</option>
          <option>Mantener peso</option>
          <option>Subir de peso (masa muscular)</option>
          <option>Comer más saludable</option>
          <option>Más energía</option>
        </select></div>
    </div>

    <div class="grid-2 mb-3">
      <div><label class="label">Nivel de actividad física</label>
        <select class="select" id="vs-a-actividad">
          <option>Sedentario (poco o nada de ejercicio)</option>
          <option selected>Ligero (1-2 días/semana)</option>
          <option>Moderado (3-4 días/semana)</option>
          <option>Intenso (5-6 días/semana)</option>
          <option>Muy intenso (deportista)</option>
        </select></div>
      <div><label class="label">Presupuesto semanal (ARS)</label>
        <input class="input" id="vs-a-presupuesto" placeholder="30000"></div>
    </div>

    <div class="mb-3">
      <label class="label">Restricciones / preferencias (elegí las que aplican)</label>
      <div id="vs-a-restricciones" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
        ${["🥬 Vegetariano","🌱 Vegano","🚫 Sin gluten","🥛 Sin lactosa","🐟 Sin pescado","🥜 Sin frutos secos","🍳 Sin huevo","☪️ Halal","✡️ Kosher","🍖 Bajo en grasas","🍞 Bajo en carbohidratos","🧂 Bajo en sodio"].map(p=>
          `<button type="button" class="btn btn-ghost btn-sm" data-rest="${p}" onclick="toggleVsRest(this)">${p}</button>`
        ).join("")}
      </div>
    </div>

    <div class="mb-3">
      <label class="label">Gustos y aversiones (opcional)</label>
      <textarea class="input" id="vs-a-gustos" rows="2" placeholder="Me gusta el pollo y las pastas. No me gusta el pescado ni los hongos. Tomo mate todo el día."></textarea>
    </div>

    <button class="btn btn-primary" onclick="doPlanAlimentacion()" ${!isPremium ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}>🥗 Armar mi plan de alimentación</button>
    <div id="vsa-result" class="mt-3"></div>`;
}

function renderVidaSanaEjercicio() {
  const isPremium = App.user?.plan && App.user.plan !== "Gratis";

  document.getElementById("vidasana-ejercicio").innerHTML = `
    ${!isPremium ? `
      <div style="background:linear-gradient(135deg,rgba(56,189,248,.12),rgba(99,102,241,.08));border:1.5px solid rgba(56,189,248,.4);border-radius:14px;padding:14px 16px;margin-bottom:18px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">💎</span>
          <div>
            <strong style="color:#7dd3fc;font-size:14px">Vida Sana es Premium</strong>
            <p style="font-size:12px;color:#94a3b8;margin:4px 0 0">Activá Premium para tu rutina de ejercicio con IA.</p>
          </div>
        </div>
      </div>` : ''}

    <div style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#fcd34d">
      ⚠️ <strong>Importante:</strong> Esto NO reemplaza a un entrenador o kinesiólogo. Si tenés lesiones serias o sos principiante absoluto, consultá a un profesional antes.
    </div>

    <h3 style="margin-bottom:8px">🏋️ Tu Rutina de Ejercicio</h3>
    <p class="text-muted mb-3">La IA te arma la rutina perfecta según tu objetivo, lugar de entrenamiento y experiencia.</p>

    <div class="grid-2 mb-3">
      <div><label class="label">Edad <span style="color:#f87171">*</span></label>
        <input class="input" id="vs-e-edad" type="number" placeholder="25" min="14" max="100"></div>
      <div><label class="label">Sexo</label>
        <select class="select" id="vs-e-sexo">
          <option>Femenino</option>
          <option>Masculino</option>
          <option>Otro / Prefiero no decir</option>
        </select></div>
    </div>

    <div class="mb-3">
      <label class="label">Objetivo principal <span style="color:#f87171">*</span></label>
      <select class="select" id="vs-e-objetivo">
        <option>Perder grasa / definición</option>
        <option>Ganar masa muscular</option>
        <option>Mantener forma física</option>
        <option>Mejorar flexibilidad y movilidad</option>
        <option>Más cardio / resistencia</option>
        <option>Fuerza máxima</option>
      </select>
    </div>

    <div class="mb-3">
      <label class="label">¿Dónde entrenás? <span style="color:#f87171">*</span></label>
      <select class="select" id="vs-e-lugar">
        <option>Gimnasio (equipamiento completo)</option>
        <option>Casa con equipo (mancuernas, banco, bandas)</option>
        <option>Casa sin equipo (solo peso corporal)</option>
        <option>Aire libre (parque, plaza)</option>
        <option>Mix: gym + casa</option>
      </select>
    </div>

    <div class="grid-3 mb-3">
      <div><label class="label">Días por semana</label>
        <select class="select" id="vs-e-dias">
          <option>2 días</option>
          <option selected>3 días</option>
          <option>4 días</option>
          <option>5 días</option>
          <option>6 días</option>
        </select></div>
      <div><label class="label">Tiempo por sesión</label>
        <select class="select" id="vs-e-tiempo">
          <option>15-20 min</option>
          <option>30 min</option>
          <option selected>45 min</option>
          <option>60 min (1 hora)</option>
          <option>90 min o más</option>
        </select></div>
      <div><label class="label">Experiencia</label>
        <select class="select" id="vs-e-experiencia">
          <option selected>Principiante (poco/nada de gym)</option>
          <option>Intermedio (6+ meses entrenando)</option>
          <option>Avanzado (años entrenando)</option>
        </select></div>
    </div>

    <div class="mb-3">
      <label class="label">¿Tenés lesiones o limitaciones? (opcional)</label>
      <textarea class="input" id="vs-e-limitaciones" rows="2" placeholder="Dolor de espalda baja, rodilla operada, no puedo correr, sobrepeso considerable..."></textarea>
    </div>

    <button class="btn btn-primary" onclick="doPlanEjercicio()" ${!isPremium ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}>🏋️ Armar mi rutina</button>
    <div id="vse-result" class="mt-3"></div>`;
}

function toggleVsRest(btn) {
  btn.classList.toggle("btn-primary");
  btn.classList.toggle("btn-ghost");
}

async function doPlanAlimentacion() {
  if (!App.user || App.user.plan === "Gratis") {
    Toast.error("Activá Premium para usar Vida Sana.");
    return;
  }

  const edad = document.getElementById("vs-a-edad").value.trim();
  const peso = document.getElementById("vs-a-peso").value.trim();

  if (!edad) { Toast.error("Decime tu edad."); return; }
  if (!peso) { Toast.error("Decime tu peso actual."); return; }

  const formData = {
    edad,
    sexo: document.getElementById("vs-a-sexo").value,
    altura: document.getElementById("vs-a-altura").value.trim(),
    peso_actual: peso,
    peso_objetivo: document.getElementById("vs-a-objetivo-peso").value.trim(),
    objetivo: document.getElementById("vs-a-objetivo").value,
    actividad: document.getElementById("vs-a-actividad").value,
    presupuesto: document.getElementById("vs-a-presupuesto").value.trim(),
    restricciones: Array.from(document.querySelectorAll('#vs-a-restricciones .btn-primary')).map(b => b.dataset.rest).join(", "),
    gustos: document.getElementById("vs-a-gustos").value.trim(),
  };

  Bienestar.reset();

  const r = document.getElementById("vsa-result");
  r.innerHTML = `
    <div id="vsa-result-stream-status" class="loading-row" style="padding:12px 16px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);border-radius:10px;margin-bottom:12px">
      <div class="spinner"></div>
      <div style="margin-left:10px;font-size:13px;color:#86efac">Armando tu plan de alimentación… <span id="vsa-result-typing">esperando primera respuesta</span></div>
    </div>
    <div class="card card-blue" id="vsa-result-card">
      <div class="md-output" id="vsa-result-text" style="font-size:14px;line-height:1.7;min-height:60px"></div>
    </div>`;

  const userMsg = `Armame un plan de alimentación de 7 días con lista de compras.`;
  const textEl = document.getElementById("vsa-result-text");
  const typingEl = document.getElementById("vsa-result-typing");
  let firstChunkReceived = false;

  try {
    const data = await Bienestar.planificar({
      mode: "alimentacion",
      userMessage: userMsg,
      formData,
      onDelta: (chunk, fullText) => {
        if (!firstChunkReceived) {
          firstChunkReceived = true;
          if (typingEl) typingEl.textContent = "escribiendo en vivo…";
        }
        if (textEl) textEl.innerHTML = mdRender(fullText);
      },
    });
    finishBienestarStream("vsa-result", data);
    UserHelper.accion("bienestar_generado");
  } catch (e) {
    r.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
  }
}

async function doPlanEjercicio() {
  if (!App.user || App.user.plan === "Gratis") {
    Toast.error("Activá Premium para usar Vida Sana.");
    return;
  }

  const edad = document.getElementById("vs-e-edad").value.trim();
  if (!edad) { Toast.error("Decime tu edad."); return; }

  const formData = {
    edad,
    sexo: document.getElementById("vs-e-sexo").value,
    objetivo: document.getElementById("vs-e-objetivo").value,
    lugar: document.getElementById("vs-e-lugar").value,
    dias: document.getElementById("vs-e-dias").value,
    tiempo: document.getElementById("vs-e-tiempo").value,
    experiencia: document.getElementById("vs-e-experiencia").value,
    limitaciones: document.getElementById("vs-e-limitaciones").value.trim(),
  };

  Bienestar.reset();

  const r = document.getElementById("vse-result");
  r.innerHTML = `
    <div id="vse-result-stream-status" class="loading-row" style="padding:12px 16px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);border-radius:10px;margin-bottom:12px">
      <div class="spinner"></div>
      <div style="margin-left:10px;font-size:13px;color:#86efac">Armando tu rutina… <span id="vse-result-typing">esperando primera respuesta</span></div>
    </div>
    <div class="card card-blue" id="vse-result-card">
      <div class="md-output" id="vse-result-text" style="font-size:14px;line-height:1.7;min-height:60px"></div>
    </div>`;

  const userMsg = `Armame una rutina de ejercicio adaptada a mis datos.`;
  const textEl = document.getElementById("vse-result-text");
  const typingEl = document.getElementById("vse-result-typing");
  let firstChunkReceived = false;

  try {
    const data = await Bienestar.planificar({
      mode: "ejercicio",
      userMessage: userMsg,
      formData,
      onDelta: (chunk, fullText) => {
        if (!firstChunkReceived) {
          firstChunkReceived = true;
          if (typingEl) typingEl.textContent = "escribiendo en vivo…";
        }
        if (textEl) textEl.innerHTML = mdRender(fullText);
      },
    });
    finishBienestarStream("vse-result", data);
    UserHelper.accion("bienestar_generado");
  } catch (e) {
    r.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
  }
}

function finishBienestarStream(resultId, data) {
  const container = document.getElementById(resultId);
  if (!container) return;
  const remaining = (data.limit || 0) - (data.used || 0);

  const statusBox = document.getElementById(`${resultId}-stream-status`);
  if (statusBox) {
    if (data.riesgo_detectado) {
      statusBox.outerHTML = `
        <div style="background:rgba(244,114,182,.08);border:1px solid rgba(244,114,182,.3);border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#f9a8d4">
          💗 Mensaje importante de seguridad
        </div>`;
    } else {
      statusBox.outerHTML = `
        <div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3);border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#86efac">
          ✅ Listo. Te quedan <strong>${remaining}</strong> planes hoy.
        </div>`;
    }
  }

  if (!data.riesgo_detectado) {
    const card = document.getElementById(`${resultId}-card`);
    if (card) {
      const actionsHtml = `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0">
          <button class="btn btn-purple btn-sm" onclick="Bienestar.imprimir()">🖨️ Imprimir / PDF</button>
          <button class="btn btn-ghost btn-sm" onclick="Bienestar.copiar()">📋 Copiar todo</button>
        </div>
        <div style="border-top:1px solid rgba(168,85,247,.2);padding-top:14px;margin-top:6px">
          <strong style="font-size:13px;color:#c4b5fd;display:block;margin-bottom:8px">💬 ¿Querés ajustar algo?</strong>
          <textarea class="input" id="${resultId}-refine-input" rows="2" placeholder="Más vegetariano / menos carbohidratos / agregar día de descanso / más cardio / más económico..."></textarea>
          <button class="btn btn-purple btn-sm mt-2" onclick="doRefinarBienestar('${resultId}')">🔄 Ajustar plan</button>
        </div>`;
      card.insertAdjacentHTML("beforeend", actionsHtml);
    }
  }
  container.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function doRefinarBienestar(resultId) {
  const inputEl = document.getElementById(`${resultId}-refine-input`);
  const text = inputEl?.value?.trim();
  if (!text) { Toast.error("Decime qué querés ajustar."); return; }

  const container = document.getElementById(resultId);
  container.innerHTML = `
    <div id="${resultId}-stream-status" class="loading-row" style="padding:12px 16px;background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.25);border-radius:10px;margin-bottom:12px">
      <div class="spinner"></div>
      <div style="margin-left:10px;font-size:13px;color:#c4b5fd">Ajustando tu plan… <span id="${resultId}-typing">esperando primera respuesta</span></div>
    </div>
    <div class="card card-blue" id="${resultId}-card">
      <div class="md-output" id="${resultId}-text" style="font-size:14px;line-height:1.7;min-height:60px"></div>
    </div>`;

  const textEl = document.getElementById(`${resultId}-text`);
  const typingEl = document.getElementById(`${resultId}-typing`);
  let firstChunkReceived = false;

  try {
    const data = await Bienestar.refinar(text, (chunk, fullText) => {
      if (!firstChunkReceived) {
        firstChunkReceived = true;
        if (typingEl) typingEl.textContent = "escribiendo en vivo…";
      }
      if (textEl) textEl.innerHTML = mdRender(fullText);
    });
    finishBienestarStream(resultId, data);
    UserHelper.accion("bienestar_refinado");
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
  }
}


// ═══════════════════════════════════════════════════════════════
// JUEGOS — MODO HISTORIA (juego narrativo con IA)
// ═══════════════════════════════════════════════════════════════

const ESCENARIOS_HISTORIA = [
  {
    id: "startup",
    emoji: "🚀",
    titulo: "Lanzá tu startup",
    desc: "Tenés 25 años, $50.000 USD y una idea. Hoy renunciaste a tu trabajo. ¿Qué construís?",
    color: "#38bdf8",
    dificultad: "Media",
  },
  {
    id: "herencia",
    emoji: "👔",
    titulo: "Heredás un negocio familiar",
    desc: "Tu viejo te dejó una distribuidora con 12 empleados que no te tienen confianza. Está en pérdida.",
    color: "#f97316",
    dificultad: "Difícil",
  },
  {
    id: "separado",
    emoji: "💔",
    titulo: "Recién separado, con un hijo",
    desc: "$0 en la cuenta, un hijo de 6 años a cargo, $200K/mes de cuota alimentaria. Empezás de cero.",
    color: "#ef4444",
    dificultad: "Muy difícil",
  },
  {
    id: "ny",
    emoji: "🌎",
    titulo: "Nueva York con $500",
    desc: "Llegaste a NYC con $500, una mochila, visa de turista y 90 días para conseguir trabajo legal.",
    color: "#a855f7",
    dificultad: "Difícil",
  },
  {
    id: "detective",
    emoji: "🕵️",
    titulo: "Detective privado",
    desc: "Una mujer entró con $50K en efectivo. Su marido desapareció hace 3 días. La policía no le cree.",
    color: "#22c55e",
    dificultad: "Media",
  },
  {
    id: "influencer",
    emoji: "🎬",
    titulo: "Influencer caído",
    desc: "Eras viral, hoy estás caído. 120K seguidores, $5K USD ahorrados, alquiler vence en 15 días.",
    color: "#facc15",
    dificultad: "Media",
  },
  {
    id: "isla",
    emoji: "🏝️",
    titulo: "Naufragio en isla desierta",
    desc: "Cuatro sobrevivientes, un encendedor, una botella de agua. Tenés que sobrevivir y volver.",
    color: "#06b6d4",
    dificultad: "Muy difícil",
  },
  {
    id: "libre",
    emoji: "🎮",
    titulo: "Modo libre",
    desc: "Escribí tu propia historia. La IA arranca desde donde vos quieras.",
    color: "#ec4899",
    dificultad: "Vos elegís",
  },
];

function renderJuegos() {
  renderJuegosHistoria();
  renderJuegosEmpire();
  renderJuegosProximamente();
}

function renderJuegosProximamente() {
  document.getElementById("juegos-proximamente").innerHTML = `
    <h3 style="margin-bottom:8px">🔜 Próximamente</h3>
    <p class="text-muted mb-3">Estos juegos están en desarrollo. ¡Pronto los vas a poder jugar!</p>
    <div class="grid-2">
      ${[
        { e: "🥊", t: "Debate Extremo", d: "La IA te pone una postura contraria. Convencé. Después analiza tu lógica y persuasión." },
        { e: "🤖", t: "IA vs Humano", d: "Acertijos, creatividad, lógica. ¿Ganás vos o gana la IA? Compartí el resultado." },
        { e: "🎯", t: "Trivia Emprendedora", d: "Tipo Preguntados pero con 8 categorías para emprendedores LATAM." },
        { e: "🔮", t: "Adivinanza Inversa", d: "La IA te hace preguntas y adivina lo que pensaste. O al revés." },
      ].map(j => `
        <div class="card" style="opacity:.6">
          <div style="font-size:32px;margin-bottom:6px">${j.e}</div>
          <div style="font-weight:700;font-size:16px;margin-bottom:6px">${j.t}</div>
          <div class="text-muted" style="font-size:13px">${j.d}</div>
          <button class="btn btn-ghost btn-sm mt-3" disabled style="opacity:.5">🔒 Próximamente</button>
        </div>
      `).join("")}
    </div>
  `;
}

async function renderJuegosHistoria() {
  const c = document.getElementById("juegos-historia");
  c.innerHTML = `
    <div class="loading-row" style="padding:20px"><div class="spinner"></div>
      <span style="margin-left:10px;color:#94a3b8">Cargando tus historias…</span></div>
  `;

  try {
    const data = await Historia.listar();
    const partidas = data.partidas || [];
    const isPremium = App.user?.plan && App.user.plan !== "Gratis";
    const limiteDiario = isPremium ? 30 : 5;

    let partidasHtml = "";
    if (partidas.length > 0) {
      partidasHtml = `
        <h3 style="margin-bottom:12px">📂 Tus historias activas (${partidas.length}/3)</h3>
        ${partidas.map(p => `
          <div class="card mb-3" style="border-left:3px solid #ec4899">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px">
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:15px;margin-bottom:4px">${esc(p.titulo)}</div>
                <div class="text-muted" style="font-size:12px;margin-bottom:8px">Día ${p.dia} · Última jugada: ${fechaCorta(p.fecha_ultima)}</div>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;font-size:12px">
              <span style="background:rgba(34,197,94,.15);color:#86efac;padding:3px 8px;border-radius:6px">💰 $${(p.metricas.plata||0).toLocaleString("es-AR")}</span>
              <span style="background:rgba(239,68,68,.15);color:#fca5a5;padding:3px 8px;border-radius:6px">❤️ ${p.metricas.salud}</span>
              <span style="background:rgba(250,204,21,.15);color:#fde68a;padding:3px 8px;border-radius:6px">⭐ ${p.metricas.reputacion}</span>
              <span style="background:rgba(168,85,247,.15);color:#d8b4fe;padding:3px 8px;border-radius:6px">🧠 ${p.metricas.energia}</span>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" onclick="retomarHistoria('${esc(p.id)}')">▶️ Continuar</button>
              <button class="btn btn-ghost btn-sm" onclick="borrarHistoria('${esc(p.id)}','${esc(p.titulo)}')" style="color:#f87171">🗑️ Borrar</button>
            </div>
          </div>
        `).join("")}
      `;
    }

    const planNote = !isPremium
      ? `<div style="background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.25);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#7dd3fc">
          💎 <strong>Gratis:</strong> 5 turnos/día. <strong>Premium:</strong> 30 turnos/día. Cada decisión = 1 turno.
        </div>`
      : `<div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#86efac">
          ✅ Tenés 30 turnos por día para jugar.
        </div>`;

    c.innerHTML = `
      ${partidas.length > 0 ? partidasHtml : ""}

      ${partidas.length < 3 ? `
        <h3 style="margin-bottom:8px">🎬 Empezá una nueva historia</h3>
        <p class="text-muted mb-3">Elegí un escenario o creá uno propio. La IA arma una aventura única que evoluciona con cada decisión tuya.</p>

        ${planNote}

        <div class="grid-2 mb-4">
          ${ESCENARIOS_HISTORIA.map(s => `
            <div class="card" style="cursor:pointer;border:1px solid rgba(255,255,255,.08);transition:transform .15s,border-color .15s" onmouseover="this.style.borderColor='${s.color}80'" onmouseout="this.style.borderColor='rgba(255,255,255,.08)'" onclick="elegirEscenarioHistoria('${s.id}')">
              <div style="font-size:32px;margin-bottom:6px">${s.emoji}</div>
              <div style="font-weight:700;font-size:15px;margin-bottom:6px;color:${s.color}">${esc(s.titulo)}</div>
              <div class="text-muted" style="font-size:12px;margin-bottom:10px;line-height:1.5">${esc(s.desc)}</div>
              <div style="font-size:11px;color:#64748b">⚙️ Dificultad: ${esc(s.dificultad)}</div>
            </div>
          `).join("")}
        </div>
      ` : `
        <div class="alert alert-info">
          ℹ️ Ya tenés 3 partidas activas (máximo permitido). Borrá una para empezar otra.
        </div>
      `}
    `;
  } catch (e) {
    c.innerHTML = `<div class="alert alert-error">❌ ${esc(e.message)}</div>`;
  }
}

function fechaCorta(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const ahora = new Date();
    const diffMs = ahora - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHs = Math.floor(diffMin / 60);
    const diffDias = Math.floor(diffHs / 24);
    if (diffMin < 1) return "Ahora";
    if (diffMin < 60) return `Hace ${diffMin}m`;
    if (diffHs < 24) return `Hace ${diffHs}h`;
    if (diffDias < 7) return `Hace ${diffDias}d`;
    return d.toLocaleDateString("es-AR");
  } catch { return "—"; }
}

function elegirEscenarioHistoria(id) {
  if (id === "libre") {
    abrirModalLibre();
    return;
  }
  iniciarHistoria(id, null);
}

function abrirModalLibre() {
  const modalHtml = `
    <div id="historia-libre-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)cerrarModalLibre()">
      <div style="background:#0f172a;border:1.5px solid rgba(236,72,153,.4);border-radius:16px;max-width:520px;width:100%;padding:24px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <h3 style="margin:0;font-size:18px">🎮 Modo libre — Escribí tu historia</h3>
          <button onclick="cerrarModalLibre()" style="background:none;border:none;color:#f87171;font-size:22px;cursor:pointer">✕</button>
        </div>
        <p class="text-muted" style="font-size:13px;margin-bottom:14px">Describí cómo querés que arranque la historia. Sé específico: lugar, situación, personajes, conflicto inicial.</p>
        <textarea class="input" id="historia-libre-input" rows="5" maxlength="500" placeholder="Ej: Soy un emprendedor en Tokio que se queda sin plata y tiene 24 horas para conseguir $10.000 USD antes de que su empresa quiebre. Mi mejor amigo me debe plata pero no me la quiere pagar..."></textarea>
        <div style="font-size:11px;color:#64748b;margin-top:6px;margin-bottom:14px">Mínimo 10 caracteres, máximo 500.</div>
        <button class="btn btn-primary" style="width:100%" onclick="iniciarHistoriaLibre()">🚀 Empezar mi historia</button>
      </div>
    </div>
  `;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = modalHtml;
  document.body.appendChild(wrapper.firstElementChild);
}

function cerrarModalLibre() {
  document.getElementById("historia-libre-modal")?.remove();
}

function iniciarHistoriaLibre() {
  const txt = document.getElementById("historia-libre-input")?.value?.trim() || "";
  if (txt.length < 10) {
    Toast.error("Escribí al menos 10 caracteres para tu historia.");
    return;
  }
  cerrarModalLibre();
  iniciarHistoria(null, txt);
}

async function iniciarHistoria(escenario_id, escenario_libre) {
  mostrarPantallaJuego(null);

  const narrativaEl = document.getElementById("hist-narrativa");
  const statusEl = document.getElementById("hist-status-stream");
  if (statusEl) statusEl.textContent = "Creando tu historia…";

  try {
    const data = await Historia.iniciar({
      escenario_id,
      escenario_libre,
      onDelta: (chunk, fullText) => {
        if (narrativaEl) {
          const limpio = Historia.limpiarNarrativa(fullText);
          narrativaEl.innerHTML = mdRender(limpio);
        }
      },
    });
    Historia.partidaActual = data.partida;
    Historia.ultimasOpciones = data.opciones || [];
    UserHelper.accion("chat_message");
    finalizarPantallaJuego(data);
  } catch (e) {
    Toast.error(e.message);
    renderJuegosHistoria();
  }
}

async function retomarHistoria(partida_id) {
  mostrarPantallaJuego(null);
  const narrativaEl = document.getElementById("hist-narrativa");
  const statusEl = document.getElementById("hist-status-stream");
  if (statusEl) statusEl.textContent = "Recordando dónde quedaste…";

  try {
    const data = await Historia.retomar({
      partida_id,
      onDelta: (chunk, fullText) => {
        if (narrativaEl) {
          const limpio = Historia.limpiarNarrativa(fullText);
          narrativaEl.innerHTML = mdRender(limpio);
        }
      },
    });
    Historia.partidaActual = data.partida;
    Historia.ultimasOpciones = data.opciones || [];
    finalizarPantallaJuego(data);
  } catch (e) {
    Toast.error(e.message);
    renderJuegosHistoria();
  }
}

async function borrarHistoria(partida_id, titulo) {
  if (!confirm(`¿Borrar la historia "${titulo}"? Esta acción no se puede deshacer.`)) return;
  try {
    await Historia.borrar(partida_id);
    Toast.success("Historia borrada.");
    renderJuegosHistoria();
  } catch (e) {
    Toast.error(e.message);
  }
}

function mostrarPantallaJuego(partida) {
  const c = document.getElementById("juegos-historia");
  const titulo = partida?.titulo || "Cargando…";
  const dia = partida?.dia || 1;
  const m = partida?.metricas || { plata: 0, salud: 100, reputacion: 50, energia: 100 };

  c.innerHTML = `
    <div style="margin-bottom:12px">
      <button class="btn btn-ghost btn-sm" onclick="volverAlMenuHistoria()">← Volver al menú</button>
    </div>

    <div id="hist-status-box" style="background:linear-gradient(135deg,rgba(236,72,153,.12),rgba(168,85,247,.08));border:1.5px solid rgba(236,72,153,.3);border-radius:14px;padding:14px 16px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;flex-wrap:wrap">
        <strong style="font-size:14px;color:#f9a8d4" id="hist-titulo">${esc(titulo)}</strong>
        <span style="font-size:12px;background:rgba(0,0,0,.3);padding:4px 10px;border-radius:8px;color:#fde68a">📅 Día <span id="hist-dia">${dia}</span></span>
      </div>
      <div id="hist-metricas" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        ${renderMetricaChip("plata", m.plata)}
        ${renderMetricaChip("salud", m.salud)}
        ${renderMetricaChip("reputacion", m.reputacion)}
        ${renderMetricaChip("energia", m.energia)}
      </div>
    </div>

    <div id="hist-stream-status" class="loading-row" style="padding:10px 14px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.25);border-radius:10px;margin-bottom:12px;display:flex;align-items:center">
      <div class="spinner"></div>
      <span style="margin-left:10px;font-size:13px;color:#7dd3fc" id="hist-status-stream">Esperando…</span>
    </div>

    <div class="card" style="border-left:3px solid #ec4899;margin-bottom:14px">
      <div id="hist-narrativa" class="md-output" style="font-size:14px;line-height:1.7;min-height:60px"></div>
    </div>

    <div id="hist-opciones" style="display:none"></div>
    <div id="hist-libre" style="display:none">
      <div style="border-top:1px solid rgba(168,85,247,.2);padding-top:12px;margin-top:6px">
        <strong style="font-size:13px;color:#c4b5fd;display:block;margin-bottom:8px">✍️ O escribí tu propia jugada:</strong>
        <textarea class="input" id="hist-decision-libre" rows="2" placeholder="¿Qué hacés? Sé creativo, la IA reacciona a lo que escribas..."></textarea>
        <button class="btn btn-purple btn-sm mt-2" onclick="enviarDecisionLibre()">🎯 Hacer esa jugada</button>
      </div>
    </div>
  `;
}

function renderMetricaChip(tipo, valor) {
  const cfg = {
    plata: { emoji: "💰", label: "Plata", color: "#22c55e", bg: "rgba(34,197,94,.15)", fmt: v => "$" + (v||0).toLocaleString("es-AR") },
    salud: { emoji: "❤️", label: "Salud", color: "#ef4444", bg: "rgba(239,68,68,.15)", fmt: v => v + "/100" },
    reputacion: { emoji: "⭐", label: "Reput.", color: "#facc15", bg: "rgba(250,204,21,.15)", fmt: v => v + "/100" },
    energia: { emoji: "🧠", label: "Energía", color: "#a855f7", bg: "rgba(168,85,247,.15)", fmt: v => v + "/100" },
  }[tipo];
  if (!cfg) return "";
  return `<div style="background:${cfg.bg};padding:8px 10px;border-radius:8px;text-align:center">
    <div style="font-size:18px">${cfg.emoji}</div>
    <div style="font-size:14px;font-weight:700;color:${cfg.color};margin-top:2px" data-metrica="${tipo}">${cfg.fmt(valor)}</div>
    <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">${cfg.label}</div>
  </div>`;
}

function actualizarMetricasUI(metricas, dia) {
  const m = document.getElementById("hist-metricas");
  if (m) {
    m.innerHTML = `
      ${renderMetricaChip("plata", metricas.plata)}
      ${renderMetricaChip("salud", metricas.salud)}
      ${renderMetricaChip("reputacion", metricas.reputacion)}
      ${renderMetricaChip("energia", metricas.energia)}
    `;
  }
  const diaEl = document.getElementById("hist-dia");
  if (diaEl) diaEl.textContent = dia;
}

function finalizarPantallaJuego(data) {
  const statusBox = document.getElementById("hist-stream-status");
  if (statusBox) {
    const remaining = (data.limit || 0) - (data.used || 0);
    statusBox.outerHTML = `
      <div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3);border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#86efac">
        ✅ Te quedan <strong>${remaining}</strong> turnos hoy.
      </div>`;
  }

  if (data.partida) {
    const tEl = document.getElementById("hist-titulo");
    if (tEl) tEl.textContent = data.partida.titulo;
    actualizarMetricasUI(data.partida.metricas, data.partida.dia);
  }

  if (data.game_over) {
    const opc = document.getElementById("hist-opciones");
    const libre = document.getElementById("hist-libre");
    if (opc) {
      opc.style.display = "block";
      opc.innerHTML = `
        <div class="card" style="border:2px solid #ef4444;background:rgba(239,68,68,.08);text-align:center;padding:20px">
          <div style="font-size:48px;margin-bottom:10px">💀</div>
          <h3 style="color:#fca5a5;margin-bottom:10px">${esc(data.mensaje_fin || "Game Over")}</h3>
          <p class="text-muted" style="margin-bottom:14px">Esta historia llegó a su fin. ¿Empezás otra?</p>
          <button class="btn btn-primary" onclick="volverAlMenuHistoria()">📋 Volver al menú</button>
        </div>
      `;
    }
    if (libre) libre.style.display = "none";
    return;
  }

  const opciones = data.opciones || Historia.ultimasOpciones || [];
  const opcDiv = document.getElementById("hist-opciones");
  if (opcDiv) {
    opcDiv.style.display = "block";
    if (opciones.length > 0) {
      opcDiv.innerHTML = `
        <strong style="font-size:13px;color:#fde68a;display:block;margin-bottom:10px">¿Qué hacés?</strong>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${opciones.map((o, i) => `
            <button class="btn btn-ghost" style="text-align:left;justify-content:flex-start;padding:12px 14px;border:1.5px solid rgba(236,72,153,.3);white-space:normal;word-break:break-word;line-height:1.5;height:auto;min-height:48px" onclick="elegirOpcion('${esc(o.letra)}', this)" data-decision="${esc(o.texto)}">
              <strong style="color:#ec4899;margin-right:8px">${esc(o.letra)})</strong> ${esc(o.texto)}
            </button>
          `).join("")}
        </div>
      `;
    } else {
      opcDiv.innerHTML = `<p class="text-muted" style="font-size:13px">La IA no propuso opciones. Escribí tu jugada abajo ⬇️</p>`;
    }
  }

  const libre = document.getElementById("hist-libre");
  if (libre) {
    libre.style.display = "block";
    const ta = document.getElementById("hist-decision-libre");
    if (ta) ta.value = "";
  }
}

async function elegirOpcion(letra, btn) {
  const decision = btn.dataset.decision;
  if (!decision) return;
  await avanzarHistoria(`Elijo opción ${letra}: ${decision}`);
}

async function enviarDecisionLibre() {
  const ta = document.getElementById("hist-decision-libre");
  const txt = ta?.value?.trim() || "";
  if (!txt) {
    Toast.error("Escribí qué querés hacer.");
    return;
  }
  if (txt.length > 400) {
    Toast.error("Máximo 400 caracteres por jugada.");
    return;
  }
  await avanzarHistoria(txt);
}

async function avanzarHistoria(decision) {
  if (Historia.cargandoTurno) return;
  if (!Historia.partidaActual) {
    Toast.error("No hay partida activa.");
    return;
  }
  Historia.cargandoTurno = true;

  const narrativaEl = document.getElementById("hist-narrativa");
  const opcEl = document.getElementById("hist-opciones");
  const libreEl = document.getElementById("hist-libre");
  if (narrativaEl) narrativaEl.innerHTML = "";
  if (opcEl) opcEl.style.display = "none";
  if (libreEl) libreEl.style.display = "none";

  const c = document.getElementById("juegos-historia");
  const oldStatus = document.getElementById("hist-stream-status");
  if (!oldStatus) {
    const statusGreen = c.querySelector("[style*='Te quedan']");
    if (statusGreen) {
      const newStatusEl = document.createElement("div");
      newStatusEl.id = "hist-stream-status";
      newStatusEl.className = "loading-row";
      newStatusEl.style.cssText = "padding:10px 14px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.25);border-radius:10px;margin-bottom:12px;display:flex;align-items:center";
      newStatusEl.innerHTML = `<div class="spinner"></div><span style="margin-left:10px;font-size:13px;color:#7dd3fc" id="hist-status-stream">La IA está pensando…</span>`;
      statusGreen.replaceWith(newStatusEl);
    }
  }

  try {
    const data = await Historia.avanzar({
      partida_id: Historia.partidaActual.id,
      decision,
      onDelta: (chunk, fullText) => {
        if (narrativaEl) {
          const limpio = Historia.limpiarNarrativa(fullText);
          narrativaEl.innerHTML = mdRender(limpio);
        }
      },
    });
    Historia.partidaActual = data.partida;
    Historia.ultimasOpciones = data.opciones || [];
    UserHelper.accion("chat_message");
    finalizarPantallaJuego(data);
  } catch (e) {
    Toast.error(e.message);
  } finally {
    Historia.cargandoTurno = false;
  }
}

function volverAlMenuHistoria() {
  Historia.partidaActual = null;
  Historia.ultimasOpciones = [];
  renderJuegosHistoria();
}


// ═══════════════════════════════════════════════════════════════
// BUSINESS EMPIRE IA — Simulador de empresa
// ═══════════════════════════════════════════════════════════════

async function renderJuegosEmpire() {
  const c = document.getElementById("juegos-empire");
  if (!c) return;
  c.innerHTML = `
    <div class="loading-row" style="padding:20px"><div class="spinner"></div>
      <span style="margin-left:10px;color:#94a3b8">Cargando tus empresas…</span></div>
  `;

  try {
    const data = await Empire.listar();
    const partidas = data.partidas || [];
    const negocios = data.negocios_disponibles || [];
    const isPremium = App.user?.plan && App.user.plan !== "Gratis";

    let partidasHtml = "";
    if (partidas.length > 0) {
      partidasHtml = `
        <h3 style="margin-bottom:12px">📂 Tus empresas activas (${partidas.length}/3)</h3>
        ${partidas.map(p => {
          const quebrada = p.plata < 0;
          return `
          <div class="card mb-3" style="border-left:3px solid #f59e0b">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px">
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:15px;margin-bottom:4px">
                  ${p.emoji} ${esc(p.nombre_empresa)}
                  ${quebrada ? '<span style="color:#f87171;font-size:11px;margin-left:6px">💸 QUEBRÓ</span>' : ''}
                </div>
                <div class="text-muted" style="font-size:12px;margin-bottom:8px">
                  Nivel <strong style="color:#fbbf24">${esc(p.nivel?.nombre || "Micro")}</strong> · Día ${p.dia} · Última jugada: ${fechaCorta(p.fecha_ultima)}
                </div>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;font-size:12px">
              <span style="background:rgba(34,197,94,.15);color:#86efac;padding:3px 8px;border-radius:6px">💰 $${(p.plata||0).toLocaleString("es-AR")}</span>
              <span style="background:rgba(56,189,248,.15);color:#7dd3fc;padding:3px 8px;border-radius:6px">📈 $${(p.facturacion_mensual||0).toLocaleString("es-AR")}/mes</span>
              <span style="background:rgba(168,85,247,.15);color:#d8b4fe;padding:3px 8px;border-radius:6px">👥 ${p.empleados} emp.</span>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${!quebrada ? `<button class="btn btn-primary btn-sm" onclick="retomarEmpire('${esc(p.id)}')">▶️ Continuar</button>` : ''}
              <button class="btn btn-ghost btn-sm" onclick="borrarEmpire('${esc(p.id)}','${esc(p.nombre_empresa)}')" style="color:#f87171">🗑️ ${quebrada ? 'Borrar' : 'Cerrar empresa'}</button>
            </div>
          </div>`;
        }).join("")}
      `;
    }

    const planNote = !isPremium
      ? `<div style="background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.25);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#7dd3fc">
          💎 <strong>Gratis:</strong> 5 turnos/día. <strong>Premium:</strong> 30 turnos/día. Cada decisión = 1 turno.
        </div>`
      : `<div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#86efac">
          ✅ Tenés 30 turnos por día para gestionar tus empresas.
        </div>`;

    const colorsByNeg = {
      kiosco: "#22c55e", cafeteria: "#a855f7", peluqueria: "#ec4899",
      foodtruck: "#f59e0b", ropa: "#ef4444", ecommerce: "#3b82f6"
    };

    c.innerHTML = `
      ${partidas.length > 0 ? partidasHtml : ""}

      ${partidas.length < 3 ? `
        <h3 style="margin-bottom:8px">💼 Empezá una nueva empresa</h3>
        <p class="text-muted mb-3">Elegí el rubro de tu negocio. Cada uno tiene capital inicial diferente y desafíos únicos.</p>

        ${planNote}

        <div class="grid-2 mb-4">
          ${negocios.map(n => `
            <div class="card" style="cursor:pointer;border:1px solid rgba(255,255,255,.08);transition:transform .15s,border-color .15s" onmouseover="this.style.borderColor='${colorsByNeg[n.id]||'#fbbf24'}80'" onmouseout="this.style.borderColor='rgba(255,255,255,.08)'" onclick="iniciarEmpire('${esc(n.id)}')">
              <div style="font-size:32px;margin-bottom:6px">${n.emoji}</div>
              <div style="font-weight:700;font-size:15px;margin-bottom:6px;color:${colorsByNeg[n.id]||'#fbbf24'}">${esc(n.nombre)}</div>
              <div class="text-muted" style="font-size:12px;margin-bottom:10px;line-height:1.5">${esc(n.descripcion)}</div>
              <div style="font-size:11px;color:#64748b">💰 Capital: $${n.capital_inicial.toLocaleString("es-AR")}</div>
            </div>
          `).join("")}
        </div>
      ` : `
        <div class="alert alert-info">
          ℹ️ Ya tenés 3 empresas activas (máximo permitido). Borrá una para empezar otra.
        </div>
      `}
    `;
  } catch (e) {
    c.innerHTML = `<div class="alert alert-error">❌ ${esc(e.message)}</div>`;
  }
}

async function iniciarEmpire(negocio_id) {
  mostrarPantallaEmpire(null);
  const narrEl = document.getElementById("emp-narrativa");
  const statusEl = document.getElementById("emp-status-stream");
  if (statusEl) statusEl.textContent = "Creando tu empresa…";

  try {
    const data = await Empire.iniciar({
      negocio_id,
      onDelta: (chunk, full) => {
        if (narrEl) {
          const limpio = Empire.limpiarNarrativa(full);
          narrEl.innerHTML = mdRender(limpio);
        }
      },
    });
    Empire.partidaActual = data.partida;
    Empire.ultimasOpciones = data.opciones || [];
    UserHelper.accion("chat_message");
    finalizarPantallaEmpire(data);
  } catch (e) {
    Toast.error(e.message);
    renderJuegosEmpire();
  }
}

async function retomarEmpire(partida_id) {
  mostrarPantallaEmpire(null);
  const narrEl = document.getElementById("emp-narrativa");
  const statusEl = document.getElementById("emp-status-stream");
  if (statusEl) statusEl.textContent = "Recordando dónde quedaste…";

  try {
    const data = await Empire.retomar({
      partida_id,
      onDelta: (chunk, full) => {
        if (narrEl) {
          const limpio = Empire.limpiarNarrativa(full);
          narrEl.innerHTML = mdRender(limpio);
        }
      },
    });
    Empire.partidaActual = data.partida;
    Empire.ultimasOpciones = data.opciones || [];
    finalizarPantallaEmpire(data);
  } catch (e) {
    Toast.error(e.message);
    renderJuegosEmpire();
  }
}

async function borrarEmpire(partida_id, nombre) {
  if (!confirm(`¿Cerrar la empresa "${nombre}"? Esta acción no se puede deshacer.`)) return;
  try {
    await Empire.borrar(partida_id);
    Toast.success("Empresa cerrada.");
    renderJuegosEmpire();
  } catch (e) { Toast.error(e.message); }
}

function mostrarPantallaEmpire(partida) {
  const c = document.getElementById("juegos-empire");
  const titulo = partida?.nombre_empresa || "Cargando…";
  const emoji = partida?.emoji || "💼";
  const nivel = partida?.nivel?.nombre || "Micro";
  const sig = partida?.siguiente_nivel;
  const dia = partida?.dia || 1;
  const plata = partida?.plata ?? 0;
  const facturacion = partida?.facturacion_mensual ?? 0;
  const empleados = partida?.empleados_total ?? 1;
  const reputacion = partida?.reputacion ?? 50;
  const estres = partida?.estres ?? 0;

  c.innerHTML = `
    <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between">
      <button class="btn btn-ghost btn-sm" onclick="volverAlMenuEmpire()">← Volver al menú</button>
      <button class="btn btn-ghost btn-sm" onclick="abrirDetalleFinanciero()">📊 Ver detalle financiero</button>
    </div>

    <div id="emp-status-box" style="background:linear-gradient(135deg,rgba(245,158,11,.12),rgba(168,85,247,.08));border:1.5px solid rgba(245,158,11,.3);border-radius:14px;padding:14px 16px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;flex-wrap:wrap">
        <strong style="font-size:14px;color:#fbbf24" id="emp-titulo">${emoji} ${esc(titulo)}</strong>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <span style="font-size:11px;background:rgba(168,85,247,.2);color:#d8b4fe;padding:4px 10px;border-radius:8px" id="emp-nivel">📈 ${esc(nivel)}</span>
          <span style="font-size:11px;background:rgba(0,0,0,.3);padding:4px 10px;border-radius:8px;color:#fde68a" id="emp-dia">📅 Día ${dia}</span>
        </div>
      </div>
      <div id="emp-metricas" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px">
        ${renderMetricaEmpire("plata", plata)}
        ${renderMetricaEmpire("facturacion", facturacion)}
        ${renderMetricaEmpire("empleados", empleados)}
        ${renderMetricaEmpire("reputacion", reputacion)}
        ${renderMetricaEmpire("estres", estres)}
      </div>
      ${sig ? `<div style="margin-top:10px;font-size:11px;color:#fde68a">🎯 Siguiente nivel <strong>${esc(sig.nombre)}</strong>: facturá $${sig.facturacion_min.toLocaleString("es-AR")}/mes y tené ${sig.sucursales_min} sucursales</div>` : ''}
    </div>

    <div id="emp-stream-status" class="loading-row" style="padding:10px 14px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.25);border-radius:10px;margin-bottom:12px;display:flex;align-items:center">
      <div class="spinner"></div>
      <span style="margin-left:10px;font-size:13px;color:#7dd3fc" id="emp-status-stream">Esperando…</span>
    </div>

    <div class="card" style="border-left:3px solid #f59e0b;margin-bottom:14px">
      <div id="emp-narrativa" class="md-output" style="font-size:14px;line-height:1.7;min-height:60px"></div>
    </div>

    <div id="emp-opciones" style="display:none"></div>
    <div id="emp-libre" style="display:none">
      <div style="border-top:1px solid rgba(245,158,11,.2);padding-top:12px;margin-top:6px">
        <strong style="font-size:13px;color:#fde68a;display:block;margin-bottom:8px">✍️ O escribí tu propia jugada:</strong>
        <textarea class="input" id="emp-decision-libre" rows="2" placeholder="¿Qué hacés? La IA reacciona a lo que escribas..."></textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <button class="btn btn-primary btn-sm" onclick="enviarDecisionEmpireLibre()">🎯 Hacer esa jugada</button>
          <button class="btn btn-ghost btn-sm" onclick="abrirGestionarEmpresa()" style="background:rgba(168,85,247,.2);color:#d8b4fe">📋 Gestionar empresa</button>
        </div>
      </div>
    </div>
  `;
}

function renderMetricaEmpire(tipo, valor) {
  const cfg = {
    plata: { emoji: "💰", label: "Plata", color: "#22c55e", bg: "rgba(34,197,94,.15)", fmt: v => "$" + (v||0).toLocaleString("es-AR") },
    facturacion: { emoji: "📈", label: "Fact./mes", color: "#7dd3fc", bg: "rgba(56,189,248,.15)", fmt: v => "$" + (v||0).toLocaleString("es-AR") },
    empleados: { emoji: "👥", label: "Empleados", color: "#d8b4fe", bg: "rgba(168,85,247,.15)", fmt: v => String(v) },
    reputacion: { emoji: "⭐", label: "Reput.", color: "#facc15", bg: "rgba(250,204,21,.15)", fmt: v => v + "/100" },
    estres: { emoji: "🧠", label: "Estrés", color: "#fca5a5", bg: "rgba(239,68,68,.15)", fmt: v => v + "/100" },
  }[tipo];
  if (!cfg) return "";
  return `<div style="background:${cfg.bg};padding:8px 10px;border-radius:8px;text-align:center">
    <div style="font-size:18px">${cfg.emoji}</div>
    <div style="font-size:13px;font-weight:700;color:${cfg.color};margin-top:2px">${cfg.fmt(valor)}</div>
    <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">${cfg.label}</div>
  </div>`;
}

function actualizarMetricasEmpireUI(p) {
  const m = document.getElementById("emp-metricas");
  if (m) {
    m.innerHTML = `
      ${renderMetricaEmpire("plata", p.plata)}
      ${renderMetricaEmpire("facturacion", p.facturacion_mensual)}
      ${renderMetricaEmpire("empleados", p.empleados_total)}
      ${renderMetricaEmpire("reputacion", p.reputacion)}
      ${renderMetricaEmpire("estres", p.estres)}
    `;
  }
  const diaEl = document.getElementById("emp-dia");
  if (diaEl) diaEl.textContent = `📅 Día ${p.dia}`;
  const nivelEl = document.getElementById("emp-nivel");
  if (nivelEl) nivelEl.textContent = `📈 ${p.nivel?.nombre || "Micro"}`;
}

function finalizarPantallaEmpire(data) {
  const statusBox = document.getElementById("emp-stream-status");
  if (statusBox) {
    const remaining = (data.limit || 0) - (data.used || 0);
    let mensaje = `✅ Te quedan <strong>${remaining}</strong> turnos hoy.`;
    if (data.subio_de_nivel && data.nuevo_nivel) {
      mensaje = `🎉 <strong>¡Subiste a Nivel ${data.nuevo_nivel.nombre}!</strong> · Te quedan ${remaining} turnos hoy.`;
    }
    statusBox.outerHTML = `
      <div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3);border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#86efac">
        ${mensaje}
      </div>`;
  }

  if (data.partida) {
    const tEl = document.getElementById("emp-titulo");
    if (tEl) tEl.textContent = (data.partida.emoji || "💼") + " " + data.partida.nombre_empresa;
    actualizarMetricasEmpireUI(data.partida);
  }

  if (data.game_over) {
    const opc = document.getElementById("emp-opciones");
    const libre = document.getElementById("emp-libre");
    if (opc) {
      opc.style.display = "block";
      opc.innerHTML = `
        <div class="card" style="border:2px solid #ef4444;background:rgba(239,68,68,.08);text-align:center;padding:20px">
          <div style="font-size:48px;margin-bottom:10px">💸</div>
          <h3 style="color:#fca5a5;margin-bottom:10px">${esc(data.mensaje_fin || "Tu empresa cerró")}</h3>
          <p class="text-muted" style="margin-bottom:14px">Esta empresa llegó a su fin. ¿Empezás otra?</p>
          <button class="btn btn-primary" onclick="volverAlMenuEmpire()">📋 Volver al menú</button>
        </div>
      `;
    }
    if (libre) libre.style.display = "none";
    return;
  }

  const opciones = data.opciones || Empire.ultimasOpciones || [];
  const opcDiv = document.getElementById("emp-opciones");
  if (opcDiv) {
    opcDiv.style.display = "block";
    if (opciones.length > 0) {
      opcDiv.innerHTML = `
        <strong style="font-size:13px;color:#fde68a;display:block;margin-bottom:10px">¿Qué hacés?</strong>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${opciones.map((o) => `
            <button class="btn btn-ghost" style="text-align:left;justify-content:flex-start;padding:12px 14px;border:1.5px solid rgba(245,158,11,.3);white-space:normal;word-break:break-word;line-height:1.5;height:auto;min-height:48px" onclick="elegirOpcionEmpire('${esc(o.letra)}', this)" data-decision="${esc(o.texto)}">
              <strong style="color:#fbbf24;margin-right:8px">${esc(o.letra)})</strong> ${esc(o.texto)}
            </button>
          `).join("")}
        </div>
      `;
    } else {
      opcDiv.innerHTML = `<p class="text-muted" style="font-size:13px">La IA no propuso opciones. Escribí tu jugada abajo ⬇️</p>`;
    }
  }

  const libre = document.getElementById("emp-libre");
  if (libre) {
    libre.style.display = "block";
    const ta = document.getElementById("emp-decision-libre");
    if (ta) ta.value = "";
  }
}

async function elegirOpcionEmpire(letra, btn) {
  const decision = btn.dataset.decision;
  if (!decision) return;
  await avanzarEmpire(`Elijo opción ${letra}: ${decision}`);
}

async function enviarDecisionEmpireLibre() {
  const ta = document.getElementById("emp-decision-libre");
  const txt = ta?.value?.trim() || "";
  if (!txt) { Toast.error("Escribí qué querés hacer."); return; }
  if (txt.length > 400) { Toast.error("Máximo 400 caracteres."); return; }
  await avanzarEmpire(txt);
}

async function avanzarEmpire(decision) {
  if (Empire.cargandoTurno) return;
  if (!Empire.partidaActual) { Toast.error("No hay partida activa."); return; }
  Empire.cargandoTurno = true;

  const narrEl = document.getElementById("emp-narrativa");
  const opcEl = document.getElementById("emp-opciones");
  const libreEl = document.getElementById("emp-libre");
  if (narrEl) narrEl.innerHTML = "";
  if (opcEl) opcEl.style.display = "none";
  if (libreEl) libreEl.style.display = "none";

  const c = document.getElementById("juegos-empire");
  const statusGreen = c.querySelector("[style*='Te quedan']");
  if (statusGreen) {
    const newStatus = document.createElement("div");
    newStatus.id = "emp-stream-status";
    newStatus.className = "loading-row";
    newStatus.style.cssText = "padding:10px 14px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.25);border-radius:10px;margin-bottom:12px;display:flex;align-items:center";
    newStatus.innerHTML = `<div class="spinner"></div><span style="margin-left:10px;font-size:13px;color:#7dd3fc" id="emp-status-stream">La IA está pensando…</span>`;
    statusGreen.replaceWith(newStatus);
  }

  try {
    const data = await Empire.avanzar({
      partida_id: Empire.partidaActual.id,
      decision,
      onDelta: (chunk, full) => {
        if (narrEl) {
          const limpio = Empire.limpiarNarrativa(full);
          narrEl.innerHTML = mdRender(limpio);
        }
      },
    });
    Empire.partidaActual = data.partida;
    Empire.ultimasOpciones = data.opciones || [];
    UserHelper.accion("chat_message");
    finalizarPantallaEmpire(data);
  } catch (e) {
    Toast.error(e.message);
  } finally {
    Empire.cargandoTurno = false;
  }
}

function abrirGestionarEmpresa() {
  if (!Empire.partidaActual) return;
  const p = Empire.partidaActual;
  const personajes = p.personajes || [];

  const modalHtml = `
    <div id="empire-gestion-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)cerrarGestionEmpresa()">
      <div style="background:#0f172a;border:1.5px solid rgba(245,158,11,.4);border-radius:16px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto;padding:24px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h3 style="margin:0;font-size:18px">📋 Gestionar Mi Empresa</h3>
          <button onclick="cerrarGestionEmpresa()" style="background:none;border:none;color:#f87171;font-size:22px;cursor:pointer">✕</button>
        </div>
        <p class="text-muted" style="font-size:12px;margin-bottom:14px">⚡ Cada acción que elijas consume 1 turno.</p>

        <div style="background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.25);border-radius:10px;padding:12px;margin-bottom:14px">
          <strong style="font-size:13px;color:#d8b4fe;display:block;margin-bottom:8px">👥 Empleados clave</strong>
          ${personajes.length > 0 ? personajes.map(per => `
            <div style="font-size:12px;margin-bottom:6px">
              <strong>${esc(per.nombre)}</strong> (${esc(per.rol)})
              ${per.sueldo ? `· $${per.sueldo}/mes` : ''}
              ${per.performance ? ` · ⚡ ${per.performance}/100` : ''}
              ${per.lealtad ? ` · 🤝 ${per.lealtad}/100` : ''}
            </div>
          `).join("") : '<div style="font-size:12px;color:#64748b">Sin empleados clave aún</div>'}
        </div>

        <strong style="font-size:13px;color:#fde68a;display:block;margin-bottom:10px">Acciones operativas</strong>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${[
            "📦 Comprar más stock / mercadería para reponer",
            "📢 Lanzar campaña de marketing en Instagram",
            "💵 Subir precios un 10% para mejorar margen",
            "💸 Bajar precios un 10% para atraer clientes",
            "👤 Contratar un empleado nuevo",
            "🤝 Reunirme con mi socio para planear la estrategia",
            "📈 Analizar las ventas del último mes y ajustar",
            "🏢 Buscar local para abrir 2da sucursal (necesitás capital)",
            "💼 Hablar con el banco sobre un préstamo",
          ].map(act => `
            <button class="btn btn-ghost" style="text-align:left;justify-content:flex-start;padding:10px 12px;font-size:13px;border:1px solid rgba(245,158,11,.2);white-space:normal;word-break:break-word;line-height:1.5;height:auto;min-height:42px" onclick="ejecutarGestion('${esc(act)}')">
              ${act}
            </button>
          `).join("")}
        </div>
      </div>
    </div>
  `;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = modalHtml;
  document.body.appendChild(wrapper.firstElementChild);
}

function cerrarGestionEmpresa() {
  document.getElementById("empire-gestion-modal")?.remove();
}

async function ejecutarGestion(accion) {
  cerrarGestionEmpresa();
  if (Empire.cargandoTurno) return;
  if (!Empire.partidaActual) return;
  Empire.cargandoTurno = true;

  const narrEl = document.getElementById("emp-narrativa");
  const opcEl = document.getElementById("emp-opciones");
  const libreEl = document.getElementById("emp-libre");
  if (narrEl) narrEl.innerHTML = "";
  if (opcEl) opcEl.style.display = "none";
  if (libreEl) libreEl.style.display = "none";

  const c = document.getElementById("juegos-empire");
  const statusGreen = c.querySelector("[style*='Te quedan']");
  if (statusGreen) {
    const newStatus = document.createElement("div");
    newStatus.id = "emp-stream-status";
    newStatus.className = "loading-row";
    newStatus.style.cssText = "padding:10px 14px;background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.25);border-radius:10px;margin-bottom:12px;display:flex;align-items:center";
    newStatus.innerHTML = `<div class="spinner"></div><span style="margin-left:10px;font-size:13px;color:#d8b4fe">Ejecutando: ${esc(accion).slice(0, 50)}…</span>`;
    statusGreen.replaceWith(newStatus);
  }

  try {
    const data = await Empire.gestionar({
      partida_id: Empire.partidaActual.id,
      gestion_accion: accion,
      onDelta: (chunk, full) => {
        if (narrEl) {
          const limpio = Empire.limpiarNarrativa(full);
          narrEl.innerHTML = mdRender(limpio);
        }
      },
    });
    Empire.partidaActual = data.partida;
    Empire.ultimasOpciones = data.opciones || [];
    UserHelper.accion("chat_message");
    finalizarPantallaEmpire(data);
  } catch (e) {
    Toast.error(e.message);
  } finally {
    Empire.cargandoTurno = false;
  }
}

async function abrirDetalleFinanciero() {
  if (!Empire.partidaActual) return;

  const modalHtml = `
    <div id="empire-detalle-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)cerrarDetalleFinanciero()">
      <div style="background:#0f172a;border:1.5px solid rgba(56,189,248,.4);border-radius:16px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;padding:24px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <h3 style="margin:0;font-size:18px">📊 Detalle Financiero</h3>
          <button onclick="cerrarDetalleFinanciero()" style="background:none;border:none;color:#f87171;font-size:22px;cursor:pointer">✕</button>
        </div>
        <div id="detalle-content">
          <div class="loading-row" style="padding:20px"><div class="spinner"></div>
            <span style="margin-left:10px;color:#94a3b8">Calculando números…</span></div>
        </div>
      </div>
    </div>
  `;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = modalHtml;
  document.body.appendChild(wrapper.firstElementChild);

  try {
    const data = await Empire.detalle(Empire.partidaActual.id);
    const d = data.detalle;
    const fmt = v => "$" + (v||0).toLocaleString("es-AR");
    const ganColor = d.ganancia_neta >= 0 ? "#22c55e" : "#ef4444";

    document.getElementById("detalle-content").innerHTML = `
      <div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);border-radius:10px;padding:12px;margin-bottom:12px">
        <strong style="font-size:13px;color:#86efac;display:block;margin-bottom:8px">📈 INGRESOS (mes actual)</strong>
        <div style="display:flex;justify-content:space-between;font-size:13px"><span>Ventas</span><span>${fmt(d.ingresos.ventas)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;margin-top:6px;padding-top:6px;border-top:1px solid rgba(34,197,94,.2);color:#86efac"><span>TOTAL</span><span>${fmt(d.ingresos.total)}</span></div>
      </div>

      <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:10px;padding:12px;margin-bottom:12px">
        <strong style="font-size:13px;color:#fca5a5;display:block;margin-bottom:8px">📉 COSTOS (mes)</strong>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>Mercadería/insumos</span><span>${fmt(d.costos.mercaderia)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>Sueldos</span><span>${fmt(d.costos.sueldos)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>Alquiler + Servicios</span><span>${fmt(d.costos.fijos)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>Marketing</span><span>${fmt(d.costos.marketing)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;margin-top:6px;padding-top:6px;border-top:1px solid rgba(239,68,68,.2);color:#fca5a5"><span>TOTAL</span><span>${fmt(d.costos.total)}</span></div>
      </div>

      <div style="background:rgba(${d.ganancia_neta >= 0 ? '34,197,94' : '239,68,68'},.12);border:1.5px solid rgba(${d.ganancia_neta >= 0 ? '34,197,94' : '239,68,68'},.4);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">${d.ganancia_neta >= 0 ? '✅ GANANCIA NETA' : '⚠️ PÉRDIDA NETA'}</div>
        <div style="font-size:22px;font-weight:800;color:${ganColor};margin-bottom:4px">${fmt(d.ganancia_neta)}</div>
        <div style="font-size:12px;color:#94a3b8">Margen: ${d.margen}%</div>
      </div>

      ${d.ganancia_neta < 0 ? `<div style="margin-top:12px;padding:10px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:8px;font-size:12px;color:#fbbf24">💡 <strong>Estás perdiendo plata.</strong> Necesitás aumentar ventas o bajar costos para no quebrar.</div>` : ''}
    `;
  } catch (e) {
    document.getElementById("detalle-content").innerHTML = `<div class="alert alert-error">❌ ${esc(e.message)}</div>`;
  }
}

function cerrarDetalleFinanciero() {
  document.getElementById("empire-detalle-modal")?.remove();
}

function volverAlMenuEmpire() {
  Empire.partidaActual = null;
  Empire.ultimasOpciones = [];
  renderJuegosEmpire();
}


// ═══════════════════════════════════════════════════════════════
// ADMIN PANEL — Panel completo con eliminar, banear, resetear, CSV
// ═══════════════════════════════════════════════════════════════

async function renderAdminPanel() {
  const c = document.getElementById("admin-content");
  if (!c) return;

  if (!Admin.esAdmin()) {
    c.innerHTML = `
      <div class="alert alert-error">
        🚫 No tenés permisos para ver este panel. Esta sección es solo para el admin de la app.
      </div>
    `;
    return;
  }

  c.innerHTML = `
    <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:12px;padding:14px 16px;margin-bottom:18px">
      <strong style="color:#fbbf24">🛡️ Modo Admin activo</strong>
      <p class="text-muted" style="font-size:12px;margin-top:6px;margin-bottom:0">
        Desde acá podés gestionar usuarios, planes, suscripciones MP y el gasto de la app.
      </p>
    </div>

    <div class="card mb-4" style="border-left:3px solid #ef4444">
      <h3 style="font-size:16px;margin-bottom:12px">💰 Gasto del día y Hard Cap</h3>
      <div id="admin-gasto">
        <div class="loading-row" style="padding:14px"><div class="spinner"></div>
          <span style="margin-left:10px;color:#94a3b8">Cargando gasto…</span></div>
      </div>
    </div>

    <div class="card mb-4" style="border-left:3px solid #38bdf8">
      <h3 style="font-size:16px;margin-bottom:12px">📊 Estadísticas de la app</h3>
      <div id="admin-stats">
        <div class="loading-row" style="padding:14px"><div class="spinner"></div>
          <span style="margin-left:10px;color:#94a3b8">Calculando…</span></div>
      </div>
    </div>

    <div class="card mb-4" style="border-left:3px solid #fbbf24">
      <h3 style="font-size:16px;margin-bottom:12px">⚡ Cambiar plan de un usuario</h3>
      <p class="text-muted" style="font-size:12px;margin-bottom:12px">
        Pegá el email del usuario y elegí el plan. Cambio inmediato.
      </p>

      <div style="display:grid;gap:10px">
        <input type="email" id="admin-email" class="input" placeholder="ejemplo: hermano@gmail.com" autocomplete="off">
        <select id="admin-plan" class="input">
          <option value="Premium">💎 Premium</option>
          <option value="Empresarial">🏢 Empresarial</option>
          <option value="Gratis">🆓 Gratis (downgrade)</option>
        </select>
        <button class="btn btn-primary" onclick="adminCambiarPlan()">
          ✅ Activar plan
        </button>
      </div>

      <div id="admin-result" style="margin-top:12px"></div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <h3 style="font-size:16px;margin:0">👥 Usuarios registrados</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="adminExportarCSV()" style="background:rgba(34,197,94,.15);color:#86efac">📥 Exportar CSV</button>
          <button class="btn btn-ghost btn-sm" onclick="renderAdminPanel()">🔄 Refrescar</button>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
        <input type="text" id="admin-search" class="input" placeholder="🔍 Buscar por email o nombre..." style="flex:1;min-width:200px" oninput="filtrarUsuariosAdmin()">
        <select id="admin-filtro-plan" class="input" style="max-width:160px" onchange="filtrarUsuariosAdmin()">
          <option value="">Todos los planes</option>
          <option value="Gratis">Solo Gratis</option>
          <option value="Premium">Solo Premium</option>
          <option value="Empresarial">Solo Empresarial</option>
        </select>
      </div>

      <div id="admin-users-list">
        <div class="loading-row" style="padding:20px"><div class="spinner"></div>
          <span style="margin-left:10px;color:#94a3b8">Cargando usuarios…</span></div>
      </div>
    </div>
  `;

  Admin.gasto().then(data => {
    const gastoEl = document.getElementById("admin-gasto");
    if (!gastoEl) return;
    const pct = Math.min(data.porcentaje_usado || 0, 100);
    const color = pct >= 80 ? "#ef4444" : pct >= 50 ? "#f59e0b" : "#22c55e";
    const barLabel = data.bloqueado
      ? `<span style="color:#ef4444;font-weight:700">🚨 SISTEMA BLOQUEADO (cap superado)</span>`
      : `<span style="color:${color}">${pct.toFixed(1)}% usado</span>`;

    gastoEl.innerHTML = `
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
          <strong style="font-size:18px">$${(data.gasto_hoy || 0).toFixed(2)}</strong>
          <span style="color:#94a3b8;font-size:13px">de $${(data.cap_actual || 0).toFixed(2)} USD</span>
        </div>
        <div style="background:rgba(255,255,255,.08);height:10px;border-radius:5px;overflow:hidden">
          <div style="background:${color};height:100%;width:${pct}%;transition:width .3s"></div>
        </div>
        <div style="margin-top:6px;font-size:12px">${barLabel}</div>
      </div>

      <div style="display:grid;gap:6px;margin-bottom:14px">
        <strong style="font-size:13px;color:#cbd5e1">Últimos 7 días:</strong>
        ${(data.dias_recientes || []).map(d => `
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#94a3b8">
            <span>${d.fecha}</span>
            <span style="color:#cbd5e1">$${(d.gasto || 0).toFixed(3)}</span>
          </div>
        `).join("")}
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input type="number" id="admin-new-cap" class="input" style="max-width:120px" placeholder="${data.cap_actual}" min="1" max="1000" step="1">
        <button class="btn btn-primary btn-sm" onclick="adminCambiarCap()">💾 Cambiar cap</button>
        <button class="btn btn-ghost btn-sm" onclick="adminResetGasto()">🔄 Resetear gasto hoy</button>
      </div>
      <div id="admin-cap-result" style="margin-top:8px"></div>
    `;
  }).catch(e => {
    const gastoEl = document.getElementById("admin-gasto");
    if (gastoEl) gastoEl.innerHTML = `<div class="alert alert-error">❌ ${esc(e.message)}</div>`;
  });

  Admin.stats().then(data => {
    const s = data.stats;
    const statsEl = document.getElementById("admin-stats");
    if (statsEl) {
      const ingresos = (s.ingresos_estimados_mensual_ars || 0).toLocaleString("es-AR");
      statsEl.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:12px">
          <div style="background:rgba(34,197,94,.1);padding:12px;border-radius:10px;text-align:center">
            <div style="font-size:24px;font-weight:700;color:#86efac">${s.total}</div>
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Total usuarios</div>
          </div>
          <div style="background:rgba(168,85,247,.1);padding:12px;border-radius:10px;text-align:center">
            <div style="font-size:24px;font-weight:700;color:#d8b4fe">${s.plan.premium}</div>
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Premium</div>
          </div>
          <div style="background:rgba(250,204,21,.1);padding:12px;border-radius:10px;text-align:center">
            <div style="font-size:18px;font-weight:700;color:#fde68a">$${ingresos}</div>
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Ingresos/mes</div>
          </div>
          <div style="background:rgba(56,189,248,.1);padding:12px;border-radius:10px;text-align:center">
            <div style="font-size:24px;font-weight:700;color:#7dd3fc">${s.nuevos_7d || 0}</div>
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Nuevos 7d</div>
          </div>
          <div style="background:rgba(100,116,139,.1);padding:12px;border-radius:10px;text-align:center">
            <div style="font-size:24px;font-weight:700;color:#cbd5e1">${s.plan.gratis}</div>
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Gratis</div>
          </div>
          <div style="background:rgba(239,68,68,.1);padding:12px;border-radius:10px;text-align:center">
            <div style="font-size:24px;font-weight:700;color:#fca5a5">${s.baneados || 0}</div>
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Baneados</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;font-size:12px;color:#94a3b8;flex-wrap:wrap">
          <span>🔥 Activos 7d: <strong style="color:#86efac">${s.actividad.activos_7d}</strong></span>
          <span>📅 Activos 30d: <strong style="color:#86efac">${s.actividad.activos_30d}</strong></span>
          <span>✉️ Verificados: <strong style="color:#86efac">${s.email_verificados || 0}</strong></span>
          <span>💎 Conversión: <strong style="color:#86efac">${s.conversion_premium}%</strong></span>
        </div>
      `;
    }
  }).catch(e => {
    const statsEl = document.getElementById("admin-stats");
    if (statsEl) statsEl.innerHTML = `<div class="alert alert-error">❌ ${esc(e.message)}</div>`;
  });

  try {
    const data = await Admin.listarUsuarios();
    window._adminUsuarios = data.usuarios || [];
    renderListaUsuariosAdmin(window._adminUsuarios);
  } catch (e) {
    document.getElementById("admin-users-list").innerHTML = `
      <div class="alert alert-error">❌ ${esc(e.message)}</div>
    `;
  }
}

function renderListaUsuariosAdmin(users) {
  const listEl = document.getElementById("admin-users-list");
  if (!listEl) return;

  if (users.length === 0) {
    listEl.innerHTML = `<p class="text-muted" style="text-align:center;padding:20px">No hay usuarios que coincidan con el filtro.</p>`;
    return;
  }

  listEl.innerHTML = `
    <p class="text-muted" style="font-size:12px;margin-bottom:12px">Mostrando: ${users.length} usuarios</p>
    ${users.map(u => {
      const planColors = {
        'Premium': 'background:rgba(168,85,247,.2);color:#d8b4fe',
        'Empresarial': 'background:rgba(245,158,11,.2);color:#fbbf24',
        'Gratis': 'background:rgba(100,116,139,.2);color:#94a3b8',
      };
      const planStyle = planColors[u.plan] || planColors['Gratis'];
      const baneadoTag = u.baneado ? '<span style="font-size:10px;background:rgba(239,68,68,.2);color:#fca5a5;padding:2px 6px;border-radius:4px;margin-left:4px">🚫 BAN</span>' : '';
      const verifTag = u.email_verificado ? '<span title="Email verificado" style="color:#86efac">✓</span>' : '<span title="Email NO verificado" style="color:#64748b">○</span>';
      const subMpTag = u.tiene_suscripcion_mp ? '<span style="font-size:10px;background:rgba(34,197,94,.2);color:#86efac;padding:2px 6px;border-radius:4px;margin-left:4px">💳 MP</span>' : '';
      const ciudadTag = u.ciudad ? `· 🏠 ${esc(u.ciudad)}` : '';

      return `
        <div class="card mb-2" style="padding:12px 14px;border:1px solid rgba(255,255,255,.06)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
            <div style="flex:1;min-width:200px">
              <div style="font-weight:600;font-size:14px">${esc(u.nombre)} ${baneadoTag}${subMpTag}</div>
              <div style="font-size:11px;color:#94a3b8">${verifTag} ${esc(u.email)}</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px">
                ⭐ ${u.xp || 0} XP · 🔥 ${u.racha || 0} días ${ciudadTag}
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
              <span style="font-size:11px;padding:3px 8px;border-radius:6px;${planStyle}">${u.plan}</span>
              <button class="btn btn-ghost btn-sm" onclick="abrirAccionesUsuario('${esc(u.email)}')" style="background:rgba(56,189,248,.15);color:#7dd3fc">⚙️ Acciones</button>
            </div>
          </div>
        </div>
      `;
    }).join("")}
  `;
}

function filtrarUsuariosAdmin() {
  const q = (document.getElementById("admin-search")?.value || "").toLowerCase().trim();
  const plan = document.getElementById("admin-filtro-plan")?.value || "";
  let lista = window._adminUsuarios || [];

  if (q) {
    lista = lista.filter(u =>
      (u.email || "").toLowerCase().includes(q) ||
      (u.nombre || "").toLowerCase().includes(q)
    );
  }
  if (plan) {
    lista = lista.filter(u => (u.plan || "Gratis") === plan);
  }
  renderListaUsuariosAdmin(lista);
}

function abrirAccionesUsuario(email) {
  const u = (window._adminUsuarios || []).find(x => x.email === email);
  if (!u) return;

  const modalHtml = `
    <div id="admin-acciones-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)cerrarAccionesUsuario()">
      <div style="background:#0f172a;border:1.5px solid rgba(56,189,248,.4);border-radius:16px;max-width:500px;width:100%;max-height:90vh;overflow-y:auto;padding:24px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h3 style="margin:0;font-size:18px">⚙️ ${esc(u.nombre)}</h3>
          <button onclick="cerrarAccionesUsuario()" style="background:none;border:none;color:#f87171;font-size:22px;cursor:pointer">✕</button>
        </div>

        <div style="background:rgba(255,255,255,.04);padding:12px;border-radius:10px;margin-bottom:16px;font-size:12px;color:#cbd5e1">
          <div style="margin-bottom:4px">📧 ${esc(u.email)} ${u.email_verificado ? '✅' : '⚠️ no verificado'}</div>
          <div style="margin-bottom:4px">🎯 Plan: <strong style="color:#fbbf24">${u.plan}</strong></div>
          <div style="margin-bottom:4px">⭐ ${u.xp || 0} XP · 🔥 ${u.racha || 0} días</div>
          ${u.ciudad ? `<div style="margin-bottom:4px">🏠 ${esc(u.ciudad)}</div>` : ''}
          ${u.fecha_nacimiento ? `<div style="margin-bottom:4px">📅 ${esc(u.fecha_nacimiento)}</div>` : ''}
          ${u.fecha_creacion ? `<div style="color:#64748b;font-size:11px;margin-top:6px">Creado: ${new Date(u.fecha_creacion).toLocaleString("es-AR")}</div>` : ''}
          ${u.tiene_suscripcion_mp ? `<div style="color:#86efac;margin-top:6px;font-size:11px">💳 Suscripción Mercado Pago activa</div>` : ''}
        </div>

        <div style="display:grid;gap:8px">
          <div>
            <label class="label" style="font-size:12px">Cambiar plan</label>
            <div style="display:flex;gap:6px">
              <select class="input" id="acc-plan" style="flex:1">
                <option value="">— Elegí —</option>
                <option value="Gratis">🆓 Gratis</option>
                <option value="Premium">💎 Premium</option>
                <option value="Empresarial">🏢 Empresarial</option>
              </select>
              <button class="btn btn-primary btn-sm" onclick="adminAplicarCambioPlan('${esc(u.email)}')">Aplicar</button>
            </div>
          </div>

          <button class="btn btn-ghost" style="background:rgba(168,85,247,.15);color:#d8b4fe;text-align:left;padding:10px 12px" onclick="adminResetearPass('${esc(u.email)}')">
            🔑 Resetear contraseña (genera pass temporal)
          </button>

          <button class="btn btn-ghost" style="background:rgba(${u.baneado ? '34,197,94' : '245,158,11'},.15);color:${u.baneado ? '#86efac' : '#fbbf24'};text-align:left;padding:10px 12px" onclick="adminBanear('${esc(u.email)}', ${!u.baneado})">
            ${u.baneado ? '✅ Desbanear usuario' : '🚫 Banear usuario'}
          </button>

          <button class="btn btn-ghost" style="background:rgba(239,68,68,.15);color:#fca5a5;text-align:left;padding:10px 12px" onclick="adminEliminarUsuario('${esc(u.email)}')">
            🗑️ ELIMINAR usuario (permanente)
          </button>
        </div>

        <div id="acc-msg" style="margin-top:14px;font-size:13px;text-align:center"></div>
      </div>
    </div>
  `;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = modalHtml;
  document.body.appendChild(wrapper.firstElementChild);
}

function cerrarAccionesUsuario() {
  document.getElementById("admin-acciones-modal")?.remove();
}

function setAccMsg(txt, ok = true) {
  const el = document.getElementById("acc-msg");
  if (el) {
    el.style.color = ok ? "#86efac" : "#fca5a5";
    el.innerHTML = (ok ? "✅ " : "❌ ") + esc(txt);
  }
}

async function adminAplicarCambioPlan(email) {
  const nuevo = document.getElementById("acc-plan").value;
  if (!nuevo) { setAccMsg("Elegí un plan primero", false); return; }
  try {
    const data = await Admin.cambiarPlan(email, nuevo);
    setAccMsg(data.mensaje || "Plan cambiado");
    setTimeout(() => { cerrarAccionesUsuario(); renderAdminPanel(); }, 1200);
  } catch (e) { setAccMsg(e.message, false); }
}

async function adminResetearPass(email) {
  if (!confirm(`¿Resetear contraseña de ${email}?\n\nSe generará una pass temporal que vas a poder copiar.`)) return;
  try {
    const t = localStorage.getItem('avai_token') || localStorage.getItem('av_token');
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
      body: JSON.stringify({ action: 'resetear_pass', email_objetivo: email })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error');
    alert(`✅ Contraseña reseteada\n\nPASSWORD TEMPORAL:\n${data.password_temporal}\n\nPasásela al usuario. Que la cambie cuando entre.`);
    setAccMsg("Contraseña reseteada");
  } catch (e) { setAccMsg(e.message, false); }
}

async function adminBanear(email, banear) {
  const acc = banear ? 'banear' : 'desbanear';
  if (!confirm(`¿${acc.charAt(0).toUpperCase() + acc.slice(1)} a ${email}?`)) return;
  try {
    const t = localStorage.getItem('avai_token') || localStorage.getItem('av_token');
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
      body: JSON.stringify({ action: 'banear', email_objetivo: email, estado: banear })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error');
    setAccMsg(data.mensaje);
    setTimeout(() => { cerrarAccionesUsuario(); renderAdminPanel(); }, 1200);
  } catch (e) { setAccMsg(e.message, false); }
}

async function adminEliminarUsuario(email) {
  if (!confirm(`⚠️ ¿ELIMINAR a ${email}?\n\nEsto es PERMANENTE. No se puede deshacer.`)) return;
  if (!confirm(`ÚLTIMA CONFIRMACIÓN:\n\n¿Estás 100% seguro de eliminar ${email}?`)) return;
  try {
    const t = localStorage.getItem('avai_token') || localStorage.getItem('av_token');
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
      body: JSON.stringify({ action: 'eliminar_usuario', email_objetivo: email, confirmar: 'SI_ELIMINAR' })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error');
    setAccMsg(data.mensaje);
    setTimeout(() => { cerrarAccionesUsuario(); renderAdminPanel(); }, 1200);
  } catch (e) { setAccMsg(e.message, false); }
}

async function adminExportarCSV() {
  try {
    const t = localStorage.getItem('avai_token') || localStorage.getItem('av_token');
    const r = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
      body: JSON.stringify({ action: 'exportar_csv' })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error');
    const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `avai-usuarios-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    Toast.success(`✅ CSV descargado (${data.total} usuarios)`);
  } catch (e) { Toast.error(e.message); }
}

async function adminCambiarCap() {
  const input = document.getElementById("admin-new-cap");
  const resultEl = document.getElementById("admin-cap-result");
  const nuevoCap = parseFloat(input.value || "0");

  if (isNaN(nuevoCap) || nuevoCap < 1 || nuevoCap > 1000) {
    resultEl.innerHTML = `<div class="alert alert-error">❌ El cap debe estar entre $1 y $1000 USD.</div>`;
    return;
  }

  if (!confirm(`¿Cambiar el cap diario a $${nuevoCap} USD?`)) return;

  resultEl.innerHTML = `<div class="loading-row" style="padding:8px"><div class="spinner"></div><span style="margin-left:10px;color:#94a3b8">Actualizando…</span></div>`;
  try {
    const data = await Admin.setCap(nuevoCap);
    resultEl.innerHTML = `<div class="alert alert-success">✅ ${esc(data.message)}</div>`;
    setTimeout(() => renderAdminPanel(), 1500);
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-error">❌ ${esc(e.message)}</div>`;
  }
}

async function adminResetGasto() {
  if (!confirm("¿Resetear el contador de gasto del día a $0? Esto se hace cuando ves un valor anómalo y querés empezar de cero.")) return;
  const resultEl = document.getElementById("admin-cap-result");
  resultEl.innerHTML = `<div class="loading-row" style="padding:8px"><div class="spinner"></div><span style="margin-left:10px;color:#94a3b8">Reseteando…</span></div>`;
  try {
    const data = await Admin.resetGasto();
    resultEl.innerHTML = `<div class="alert alert-success">✅ ${esc(data.message)}</div>`;
    setTimeout(() => renderAdminPanel(), 1500);
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-error">❌ ${esc(e.message)}</div>`;
  }
}

async function adminCambiarPlan() {
  const email = document.getElementById("admin-email").value.trim().toLowerCase();
  const plan = document.getElementById("admin-plan").value;
  const resultEl = document.getElementById("admin-result");

  if (!email) {
    resultEl.innerHTML = `<div class="alert alert-error">❌ Pegá un email primero.</div>`;
    return;
  }

  resultEl.innerHTML = `<div class="loading-row" style="padding:12px"><div class="spinner"></div><span style="margin-left:10px;color:#94a3b8">Aplicando cambio…</span></div>`;

  try {
    const data = await Admin.cambiarPlan(email, plan);
    resultEl.innerHTML = `
      <div class="alert alert-success">
        ✅ ${esc(data.mensaje)}
        <br><small style="opacity:.7">El usuario debe cerrar sesión y volver a entrar para ver el cambio.</small>
      </div>
    `;
    document.getElementById("admin-email").value = "";
    setTimeout(() => renderAdminPanel(), 1500);
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-error">❌ ${esc(e.message)}</div>`;
  }
}

async function adminActivarRapido(email, plan) {
  if (!confirm(`¿Cambiar el plan de ${email} a ${plan}?`)) return;
  try {
    await Admin.cambiarPlan(email, plan);
    Toast.success(`✅ ${email} ahora es ${plan}`);
    setTimeout(() => renderAdminPanel(), 800);
  } catch (e) {
    Toast.error(e.message);
  }
}
