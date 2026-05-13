// ui.js — All UI rendering and interactions

document.addEventListener("DOMContentLoaded", () => {
  // Mostrar login si no hay sesión
  if (!localStorage.getItem('av_token')) {
    document.getElementById('login-screen').style.display='flex';
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
function setLoginTab(tab) {
  document.querySelectorAll(".login-tab").forEach((t, i) =>
    t.classList.toggle("active", (i===0&&tab==="login")||(i===1&&tab==="register")));
  document.getElementById("panel-login").classList.toggle("hidden", tab!=="login");
  document.getElementById("panel-register").classList.toggle("hidden", tab!=="register");
}
async function doLogin() {
  const email=document.getElementById("login-email").value.trim();
  const pass=document.getElementById("login-pass").value;
  const err=document.getElementById("login-error"); err.classList.add("hidden");
  if(!email||!pass){err.textContent="Completá todos los campos.";err.classList.remove("hidden");return;}
  try{
    const d=await API.login(email,pass);
    App.token=d.token;App.user=d.user;Store.save();
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
    App.token=d.token;App.user=d.user;Store.save();showOnboarding();
  }catch(ex){err.textContent=ex.message;err.classList.remove("hidden");}
}
function doLogout(){
  App.user=null;App.token=null;Store.clear();
  document.getElementById("app").classList.add("hidden");
  document.getElementById("login-screen").classList.remove("hidden");
}

// ── ONBOARDING ──────────────────────────────────
function showOnboarding(){
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app").classList.add("hidden");
  document.getElementById("onboarding").classList.remove("hidden");
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
  API.saveUser({objetivo:u.objetivo,negocio:u.negocio,tipo_negocio:u.tipo_negocio,nivel_usuario:u.nivel_usuario,onboarding_completo:true}).catch(()=>{});
  document.getElementById("onboarding").classList.add("hidden");
  showApp();
}

// ── SHOW APP ────────────────────────────────────
function showApp(){
  document.getElementById("login-screen").classList.add("hidden");
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
      Chat.appendMsg(c,d.reply,"msg-ai","AV MentorAI","⚡","linear-gradient(135deg,#38bdf8,#6366f1)","#38bdf8");
      UserHelper.sumarXP(10);
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
function completeLesson(type,id,xp){
  const k=type==="english"?"english_lecciones_completadas":"mate_lecciones_completadas";
  if(!App.user[k])App.user[k]=[];
  if(!App.user[k].includes(id)){
    App.user[k].push(id);UserHelper.sumarXP(xp);
    if(type==="english")App.user.english_xp=(App.user.english_xp||0)+xp;
    UserHelper.desbloquearLogros();Store.save();
    API.saveUser({[k]:App.user[k]}).catch(()=>{});
    Toast.success(`¡Lección completada! +${xp} XP 🎉`);
    if(type==="english")renderEnglishLecciones();else renderMateLecciones();
  }
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
    UserHelper.sumarXP(15);
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
  <body><div class="c"><h1>⚡ AV MentorAI</h1>
  <div style="color:#38bdf8;margin-bottom:16px">Certificado de Nivel de Inglés</div>
  <div class="line"></div>
  <p style="color:#cbd5e1">Este certificado acredita que</p>
  <div class="nm">${nombre}</div>
  <p style="color:#cbd5e1">ha completado exitosamente el nivel</p>
  <div class="nv">${nivel}</div>
  <div style="color:#94a3b8;font-size:12px;margin-top:10px">Lecciones: ${lecciones} · Fecha: ${fecha}</div>
  <div class="line"></div><div style="font-size:40px;margin:12px 0">★</div>
  <div style="color:#64748b;font-size:11px">AV MentorAI — Tu mentor personal</div>
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
  </head><body><div class="c"><h1>⚡ AV MentorAI</h1>
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
    // Guardamos el contexto para usarlo si el usuario quiere seguir charlando
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
  // Cargar el contexto del cálculo como historial del chat de Bruno
  if(!App.user.mate_messages) App.user.mate_messages = [];
  App.user.mate_messages.push({role:"user", content:ctx.prompt});
  App.user.mate_messages.push({role:"assistant", content:ctx.reply});
  App.chatMessages.mate = App.user.mate_messages.slice(-40);
  Store.save();
  API.saveUser({mate_messages: App.user.mate_messages}).catch(()=>{});
  // Navegar al chat de Bruno
  navigateTo("mate");
  setSubnav("mate","chat");
  initMateChat();
  Toast.info("Seguí la conversación con Bruno acá.");
}

function seguirConMentor(ctxKey){
  const ctx = window[ctxKey];
  if(!ctx){Toast.error("No hay contexto previo.");return;}
  // Cargar el contexto como historial del chat del Mentor
  if(!App.user.messages) App.user.messages = [];
  App.user.messages.push({role:"user", content:ctx.prompt});
  App.user.messages.push({role:"assistant", content:ctx.reply});
  App.chatMessages.negocio = App.user.messages.slice(-40);
  Store.save();
  API.saveUser({messages: App.user.messages}).catch(()=>{});
  // Navegar al chat del Mentor
  navigateTo("mentor");
  initMentorTab();
  Toast.info("Seguí la conversación con el Mentor acá.");
}

function seguirConAlex(ctxKey){
  const ctx = window[ctxKey];
  if(!ctx){Toast.error("No hay contexto previo.");return;}
  // Cargar el contexto como historial del chat de Alex
  if(!App.user.english_messages) App.user.english_messages = [];
  App.user.english_messages.push({role:"user", content:ctx.prompt});
  App.user.english_messages.push({role:"assistant", content:ctx.reply});
  App.chatMessages.english = App.user.english_messages.slice(-40);
  Store.save();
  API.saveUser({english_messages: App.user.english_messages}).catch(()=>{});
  // Navegar al chat de Alex
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
    UserHelper.sumarXP(15);
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
    UserHelper.sumarXP(10);
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
    UserHelper.sumarXP(10);
  }catch(e){r.innerHTML=`<div class="alert alert-error">${esc(e.message)}</div>`;}
}
function renderMarca(){
  const userName = App.user?.nombre || "";
  const isPremium = App.user?.plan && App.user.plan !== "Gratis";
  document.getElementById("herr-marca").innerHTML=`
    <h3 style="margin-bottom:8px">🎨 Creador de marca personal</h3>
    <p class="text-muted mb-3">La IA te crea una identidad de marca completa, lista para publicar hoy.</p>

    <!-- ▼▼▼ NUEVO: Botón Generar Logo arriba de todo ▼▼▼ -->
    <div style="background:linear-gradient(135deg,rgba(168,85,247,.12),rgba(99,102,241,.08));border:1.5px solid rgba(168,85,247,.4);border-radius:14px;padding:14px 16px;margin-bottom:18px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="font-size:22px">🖼️</span>
        <strong style="font-size:14px;letter-spacing:.5px;color:#c4b5fd">GENERADOR DE LOGO CON IA</strong>
        ${!isPremium ? `<span style="margin-left:auto;font-size:11px;background:#facc15;color:#020617;padding:3px 8px;border-radius:6px;font-weight:800">PREMIUM</span>` : `<span style="margin-left:auto;font-size:11px;background:rgba(34,197,94,.2);color:#86efac;padding:3px 8px;border-radius:6px;font-weight:700">10/día</span>`}
      </div>
      <p style="font-size:12px;color:#94a3b8;margin-bottom:10px;line-height:1.5">Generá tu logo en segundos con IA. Listo para usar en tu marca. Tenés 10 generaciones diarias.</p>
      <button class="btn btn-purple" style="width:100%" onclick="openLogoModal()">🎨 Generar mi logo ahora</button>
    </div>
    <!-- ▲▲▲ FIN del bloque nuevo ▲▲▲ -->

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
  // Limitar a 3
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
    UserHelper.sumarXP(15);
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
    UserHelper.sumarXP(10);
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
function completarDesafio(){
  if(!App.user)return;App.user.desafios_completados=(App.user.desafios_completados||0)+1;
  UserHelper.sumarXP(40);UserHelper.desbloquearLogros();Store.save();
  API.saveUser({desafios_completados:App.user.desafios_completados}).catch(()=>{});
  Toast.success("+40 XP 🎉 ¡Desafío completado!");renderDesafios();refreshHeader();
}
function completarObjetivo(){
  if(!App.user)return;App.user.objetivos_completados=(App.user.objetivos_completados||0)+1;
  UserHelper.sumarXP(60);UserHelper.desbloquearLogros();Store.save();
  API.saveUser({objetivos_completados:App.user.objetivos_completados}).catch(()=>{});
  Toast.success("+60 XP 🏆 ¡Objetivo completado!");renderDesafios();refreshHeader();
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
      <button class="btn btn-red" onclick="doLogout()">🚪 Cerrar sesión</button>
    </div>
    <div style="margin-top:24px;padding-top:18px;border-top:1px solid var(--border)">
      <h4 style="margin-bottom:12px">💬 Feedback</h4>
      <div class="grid-2 mb-3">
        <div><label class="label">¿Qué tan útil es AV MentorAI? (1-10)</label>
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
  // Si tiene plan Gratis → toast y no abrir
  if(!App.user || App.user.plan === "Gratis"){
    Toast.error("Generar logos con IA es una función Premium. Activá Premium para usarla.");
    return;
  }

  // Pre-rellenar con datos del form si ya los completó
  const prefName = document.getElementById("mname")?.value?.trim() || App.user?.nombre || "";
  const prefRub  = document.getElementById("mrub")?.value?.trim() || "";
  const prefEst  = document.getElementById("mest")?.value || "Moderno y minimalista";

  // Mapear estilo del select al valor que entiende DALL-E
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
          <input class="input" id="logo-nombre" maxlength="60" placeholder="Bela Store, AV Mentor, Tino Tech…" value="${esc(prefName)}">
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

  // Inyectar modal en el body
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

    // Guardar las imágenes en una variable global para que los botones las referencien
    // (las imágenes son base64 muy largas, no se pueden meter en onclick directamente)
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
    UserHelper.sumarXP(20);
    Toast.success("¡Logos generados! +20 XP");
  } catch(e) {
    result.innerHTML = `<div class="alert alert-error" style="margin-top:10px">${esc(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "🚀 Generar mi logo";
  }
}

// Helpers para que los botones de descarga/abrir referencien por índice
// (no podemos meter el base64 largo dentro de onclick="")
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

  // Reset historial (nuevo viaje)
  Viajes.reset();

  const r = document.getElementById("viaje-result");
  r.innerHTML = `<div class="loading-row" style="padding:20px"><div class="spinner"></div><div style="margin-left:10px;font-size:13px;color:#94a3b8">Armando tu viaje a ${esc(destino)}…<br>Buscando precios reales, lugares, recomendaciones. Tarda ~30 segundos.</div></div>`;

  const formData = { destino, origen, dias, personas, fecha, presupuesto, intereses, especial };
  const userMsg = `Armame un itinerario de viaje a ${destino} de ${dias} días.`;

  try {
    const data = await Viajes.planificar({ mode: "itinerario", userMessage: userMsg, formData });
    showViajeResult(r, data, "viaje-result");
    UserHelper.sumarXP(20);
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
  r.innerHTML = `<div class="loading-row" style="padding:20px"><div class="spinner"></div><div style="margin-left:10px;font-size:13px;color:#94a3b8">Pensando destinos para vos…<br>Buscando opciones reales según tus gustos. Tarda ~30 segundos.</div></div>`;

  const formData = { origen, fecha, presupuesto, dias, vibe, especial: evitar };
  const userMsg = `No sé a dónde ir. Mostrame destinos que me puedan gustar.`;

  try {
    const data = await Viajes.planificar({ mode: "inspirame", userMessage: userMsg, formData });
    showViajeResult(r, data, "inspirame-result");
    UserHelper.sumarXP(15);
  } catch (e) {
    r.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
  }
}

function showViajeResult(container, data, resultId) {
  const remaining = (data.limit || 0) - (data.used || 0);
  container.innerHTML = `
    <div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3);border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#86efac">
      ✅ Listo. Te quedan <strong>${remaining}</strong> planificaciones hoy.
    </div>
    <div class="card card-blue">
      <div class="md-output" style="font-size:14px;line-height:1.7;margin-bottom:14px">${mdRender(data.reply)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <button class="btn btn-purple btn-sm" onclick="Viajes.imprimir()">🖨️ Imprimir / PDF</button>
        <button class="btn btn-ghost btn-sm" onclick="Viajes.copiar()">📋 Copiar todo</button>
      </div>
      <div style="border-top:1px solid rgba(168,85,247,.2);padding-top:14px;margin-top:14px">
        <strong style="font-size:13px;color:#c4b5fd;display:block;margin-bottom:8px">💬 ¿Querés ajustar algo?</strong>
        <textarea class="input" id="${resultId}-refine-input" rows="2" placeholder="Hacelo más barato / sumá un día más / sacá la excursión del día 3 / cambialo a destino con playa..."></textarea>
        <button class="btn btn-purple btn-sm mt-2" onclick="doRefinarViaje('${resultId}')">🔄 Ajustar viaje</button>
      </div>
    </div>`;
  container.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function doRefinarViaje(resultId) {
  const inputEl = document.getElementById(`${resultId}-refine-input`);
  const text = inputEl?.value?.trim();
  if (!text) { Toast.error("Decime qué querés ajustar."); return; }

  const container = document.getElementById(resultId);
  const cardOld = container.querySelector(".card");
  if (cardOld) cardOld.style.opacity = "0.4";

  const loadingDiv = document.createElement("div");
  loadingDiv.className = "loading-row";
  loadingDiv.style.cssText = "padding:14px;margin-top:10px";
  loadingDiv.innerHTML = `<div class="spinner"></div><div style="margin-left:10px;font-size:13px;color:#94a3b8">Ajustando tu viaje…</div>`;
  container.appendChild(loadingDiv);

  try {
    const data = await Viajes.refinar(text);
    loadingDiv.remove();
    showViajeResult(container, data, resultId);
    UserHelper.sumarXP(5);
  } catch (e) {
    loadingDiv.remove();
    if (cardOld) cardOld.style.opacity = "1";
    Toast.error(e.message || "Error ajustando el viaje");
  }
}
