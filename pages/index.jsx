// EduCorrect — Application pédagogique complète — Programme sénégalais
import { useState, useRef, useCallback, useEffect } from "react";
import {
  LEVELS, SERIES_BY_LEVEL, hasSeriesChoice,
  getLevelGroup, getSubjectsForStudent, getTopicsForStudent, SUBJECTS
} from "../lib/curriculum";
import {
  getCurrentUser, loginUser, registerUser, logoutUser, updateUser,
  addExerciseResult, getStats, getAllUsersForAdmin, isAdminEmail, getProgress
} from "../lib/store";
import { RESOURCES } from "../lib/resources";

// ── API ───────────────────────────────────────────────────────────────────────
const API_URL   = "/api/claude";
const MODEL     = "claude-sonnet-4-20250514";
// max_tokens réduit à 1200 pour éviter les timeouts Netlify (26s max)
// Assez large pour une correction complète ou un cours détaillé
const MAX_TOK   = 1200;

async function apiPost(body) {
  let r;
  try {
    r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOK, ...body }),
    });
  } catch (netErr) {
    throw new Error(
      netErr.message === "Failed to fetch"
        ? "Impossible de joindre le serveur. Vérifie ta connexion internet."
        : `Erreur réseau : ${netErr.message}`
    );
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error?.message || `Erreur serveur (${r.status})`);
  return data;
}

async function callClaude(messages) {
  const d = await apiPost({
    messages: Array.isArray(messages) ? messages : [{ role:"user", content: messages }],
  });
  return d.content.filter(b=>b.type==="text").map(b=>b.text).join("");
}

async function callClaudeVision(b64, mt, prompt) {
  const d = await apiPost({
    messages: [{
      role: "user",
      content: [
        { type:"image", source:{ type:"base64", media_type:mt, data:b64 } },
        { type:"text",  text: prompt },
      ],
    }],
  });
  return d.content.filter(b=>b.type==="text").map(b=>b.text).join("");
}

async function callClaudePDF(b64, prompt) {
  const d = await apiPost({
    messages: [{
      role: "user",
      content: [
        { type:"document", source:{ type:"base64", media_type:"application/pdf", data:b64 } },
        { type:"text",     text: prompt },
      ],
    }],
  });
  return d.content.filter(b=>b.type==="text").map(b=>b.text).join("");
}
function parseJSON(raw) {
  const c=raw.replace(/^```(?:json)?\n?/m,"").replace(/\n?```$/m,"").trim();
  try{return JSON.parse(c);}catch{const m=c.match(/\{[\s\S]+\}/);if(m)return JSON.parse(m[0]);throw new Error("JSON invalide");}
}
const toB64=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(f);});

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
*,*::before,*::after{box-sizing:border-box;}
body{margin:0;}
input,textarea,select{font-family:inherit;-webkit-appearance:none;}
input:focus,textarea:focus,select:focus{outline:none;box-shadow:0 0 0 3px rgba(79,70,229,.18);}
button:not([disabled]):active{transform:scale(.97);}
-webkit-tap-highlight-color:transparent;

.page{max-width:600px;margin:0 auto;padding:2rem 1.25rem 5rem;}
.page-w{max-width:740px;margin:0 auto;padding:1.5rem 1.25rem 5rem;}
.card{background:white;border-radius:16px;padding:1.5rem;box-shadow:0 1px 6px rgba(0,0,0,.07);}
.g2{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.row{display:flex;gap:10px;}
.anim{animation:fadeIn .3s ease;}
.bnav{display:none;}

/* Chat bubbles */
.bubble-user{background:#4f46e5;color:white;border-radius:18px 18px 4px 18px;padding:.75rem 1rem;font-size:14px;line-height:1.6;max-width:80%;margin-left:auto;animation:slideUp .2s ease;}
.bubble-ai{background:white;color:#1f2937;border-radius:18px 18px 18px 4px;padding:.75rem 1rem;font-size:14px;line-height:1.6;max-width:85%;box-shadow:0 1px 4px rgba(0,0,0,.08);animation:slideUp .2s ease;}
.bubble-ai pre{background:#f8fafc;border-radius:8px;padding:.75rem;overflow-x:auto;font-size:12px;margin:.5rem 0;border:1px solid #e2e8f0;}
.typing-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#9ca3af;animation:spin 1.2s linear infinite;}

/* Admin */
.admin-stat{background:white;border-radius:14px;padding:1.25rem;box-shadow:0 1px 6px rgba(0,0,0,.07);text-align:center;}
.admin-row{display:flex;align-items:center;padding:.75rem 1rem;border-bottom:1px solid #f3f4f6;gap:12px;}
.admin-row:last-child{border-bottom:none;}

/* Resource card */
.res-card{display:block;text-decoration:none;padding:1.1rem;border-radius:14px;border:1px solid #e5e7eb;background:white;margin-bottom:8px;transition:all .15s;cursor:pointer;}
.res-card:hover{border-color:#4f46e5;box-shadow:0 4px 12px rgba(79,70,229,.1);transform:translateY(-1px);}

/* Mobile */
@media(max-width:640px){
  .page,.page-w{padding:1rem .875rem 5rem;}
  .card{padding:1.1rem;border-radius:14px;}
  .g2{grid-template-columns:1fr;}
  .g3{grid-template-columns:1fr;}
  .row{flex-direction:column;}
  .bnav{display:flex;position:fixed;bottom:0;left:0;right:0;background:white;border-top:1px solid #e5e7eb;z-index:99;padding:.5rem 0 .25rem;}
  .bnav-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:.25rem;cursor:pointer;border:none;background:none;}
  .bnav-icon{font-size:1.2rem;}
  .bnav-label{font-size:.58rem;font-weight:600;color:#9ca3af;}
  .bnav-item.active .bnav-label{color:#4f46e5;}
  .hide-mobile{display:none!important;}
  .bubble-user,.bubble-ai{max-width:92%;}
}
@media(min-width:641px){.show-mobile{display:none!important;}}
`;

// ── PRIMITIVES ────────────────────────────────────────────────────────────────
const PBtn=({onClick,disabled,children,style:x={}})=>(
  <button onClick={onClick} disabled={disabled} style={{width:"100%",padding:"1rem",minHeight:52,border:"none",borderRadius:12,fontSize:16,fontWeight:700,cursor:disabled?"not-allowed":"pointer",transition:"all .18s",background:disabled?"#e5e7eb":"linear-gradient(135deg,#4f46e5,#7c3aed)",color:disabled?"#9ca3af":"white",boxShadow:disabled?"none":"0 4px 14px rgba(79,70,229,.28)",...x}}>{children}</button>
);
const BackBtn=({onClick,label="← Retour"})=><button onClick={onClick} style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:14,padding:"0.5rem 0",marginBottom:"0.875rem",display:"block",minHeight:44}}>{label}</button>;
const Lbl=({children})=><label style={{display:"block",fontWeight:700,marginBottom:8,color:"#111827",fontSize:14}}>{children}</label>;
const Pill=({bg,color,children})=><span style={{padding:"0.3rem .75rem",borderRadius:20,fontSize:12,fontWeight:700,background:bg,color,whiteSpace:"nowrap"}}>{children}</span>;
const Spinner=()=>(
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"5rem 2rem",gap:20}}>
    <div style={{position:"relative",width:60,height:60}}>
      <div style={{position:"absolute",inset:0,border:"4px solid #e0e7ff",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
      <div style={{position:"absolute",inset:8,border:"3px solid #f0e6ff",borderBottomColor:"#7c3aed",borderRadius:"50%",animation:"spin 1.2s linear infinite reverse"}}/>
    </div>
    <p style={{margin:0,fontWeight:700,fontSize:15,color:"#1e1b4b"}}>L'IA travaille...</p>
  </div>
);
function Field({label,type="text",value,onChange,placeholder,style:x={}}){
  return(<div style={{marginBottom:14}}><Lbl>{label}</Lbl><input type={type} value={value} onChange={onChange} placeholder={placeholder} style={{width:"100%",padding:"0.8rem 1rem",border:`2px solid ${value?"#4f46e5":"#e5e7eb"}`,borderRadius:10,fontSize:16,color:"#111827",transition:"border-color .2s",WebkitTextSizeAdjust:"100%",...x}}/></div>);
}

// ── LANDING ───────────────────────────────────────────────────────────────────
function Landing({onGetStarted}){
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0f0c29,#302b63,#24243e)"}}>
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1.25rem 2rem",position:"sticky",top:0,zIndex:10,background:"rgba(15,12,41,.85)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(99,102,241,.2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:22,fontWeight:900,color:"white",letterSpacing:"-0.04em"}}>EduCorrect</span>
          <span style={{background:"#312e81",color:"#a5b4fc",fontSize:10,padding:"2px 7px",borderRadius:6,fontWeight:700,border:"1px solid rgba(99,102,241,.4)"}}>IA</span>
        </div>
        <button onClick={onGetStarted} style={{background:"white",color:"#4f46e5",border:"none",borderRadius:10,padding:".6rem 1.4rem",fontWeight:700,cursor:"pointer",fontSize:14}}>Connexion →</button>
      </nav>
      <div style={{textAlign:"center",padding:"5rem 1.5rem 4rem"}}>
        <div style={{display:"inline-block",background:"rgba(99,102,241,.2)",border:"1px solid rgba(165,180,252,.3)",borderRadius:20,padding:".4rem 1rem",fontSize:12,fontWeight:700,color:"#a5b4fc",marginBottom:"1.75rem",letterSpacing:".06em"}}>
          🇸🇳 Programme officiel sénégalais (MENFP) · Du CI au BAC
        </div>
        <h1 style={{fontSize:"clamp(2rem,8vw,4.2rem)",fontWeight:900,color:"white",lineHeight:1.15,margin:"0 0 1.25rem",letterSpacing:"-0.03em"}}>
          Ton prof particulier<br/>
          <span style={{background:"linear-gradient(135deg,#a5b4fc,#f0abfc)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>alimenté par l'IA</span>
        </h1>
        <p style={{fontSize:"1.1rem",color:"#c7d2fe",maxWidth:540,margin:"0 auto 2.5rem",lineHeight:1.8}}>
          EduCorrect génère des exercices, corrige tes réponses, répond à toutes tes questions comme un vrai professeur — du CI au BAC, en respectant le programme du Sénégal.
        </p>
        <button onClick={onGetStarted} style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"white",border:"none",borderRadius:14,padding:"1.1rem 2.75rem",fontSize:17,fontWeight:800,cursor:"pointer",boxShadow:"0 8px 30px rgba(79,70,229,.5)"}}>
          Commencer gratuitement →
        </button>
        <p style={{color:"#818cf8",fontSize:12,marginTop:12}}>Gratuit · Sans carte bancaire</p>
      </div>
      <div style={{maxWidth:960px,margin:"0 auto",padding:"0 1.5rem 5rem",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:16}}>
        {[
          {i:"🤖",t:"Exercices IA adaptés",d:"Génère des exercices du programme sénégalais, du CI à la Terminale S, avec difficulté progressive."},
          {i:"💬",t:"Tuteur IA 24h/24",d:"Pose n'importe quelle question. L'IA t'explique pas à pas, comme un vrai professeur."},
          {i:"📄",t:"Upload d'exercices",d:"Téléverse un exercice de classe (PDF, photo) et reçois une correction détaillée."},
          {i:"🔒",t:"Correction à 15/20",d:"La correction complète se débloque quand tu mérites 15/20 — un vrai incentive !"},
          {i:"📚",t:"Ressources gratuites",d:"Vidéos YouTube, annales BAC, sites pédagogiques sélectionnés pour chaque matière."},
          {i:"📊",t:"Tableau de bord",d:"Suis ta progression, tes scores par matière, et ton streak de révision quotidienne."},
        ].map(f=>(
          <div key={f.t} style={{background:"rgba(255,255,255,.06)",borderRadius:16,padding:"1.5rem",border:"1px solid rgba(165,180,252,.12)"}}>
            <div style={{fontSize:32,marginBottom:10}}>{f.i}</div>
            <h3 style={{margin:"0 0 8px",fontSize:16,fontWeight:700,color:"white"}}>{f.t}</h3>
            <p style={{margin:0,fontSize:13,color:"#a5b4fc",lineHeight:1.65}}>{f.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
function AuthScreen({onSuccess,onBack}){
  const [mode,setMode]=useState("login");
  const [form,setForm]=useState({name:"",email:"",password:"",confirm:""});
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const set=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const submit=async()=>{
    setErr("");setLoading(true);
    try{
      if(mode==="register"){
        if(!form.name.trim())throw new Error("Entre ton prénom.");
        if(!form.email.includes("@"))throw new Error("Email invalide.");
        if(form.password.length<6)throw new Error("Mot de passe : 6 caractères minimum.");
        if(form.password!==form.confirm)throw new Error("Les mots de passe ne correspondent pas.");
        const u=registerUser({name:form.name.trim(),email:form.email.trim(),password:form.password,level:"",series:null});
        onSuccess(u,!u.isAdmin);
      }else{
        if(!form.email||!form.password)throw new Error("Remplis tous les champs.");
        const u=loginUser({email:form.email.trim(),password:form.password});
        onSuccess(u,!u.isAdmin&&!u.level);
      }
    }catch(e){setErr(e.message);}finally{setLoading(false);}
  };
  return(
    <div style={{minHeight:"100vh",background:"#f5f3ff",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:"2rem"}}>
          <div style={{fontSize:48,marginBottom:8}}>🎓</div>
          <h1 style={{fontSize:26,fontWeight:900,color:"#1e1b4b",margin:"0 0 6px"}}>EduCorrect</h1>
          <p style={{color:"#6b7280",margin:0,fontSize:14}}>{mode==="login"?"Connecte-toi à ton compte":"Crée ton compte gratuit"}</p>
        </div>
        <div className="card">
          <div style={{display:"flex",background:"#f3f4f6",borderRadius:10,padding:4,marginBottom:"1.5rem"}}>
            {["login","register"].map(m=>(
              <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:".5rem",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,fontSize:14,transition:"all .15s",background:mode===m?"white":"transparent",color:mode===m?"#4f46e5":"#6b7280",boxShadow:mode===m?"0 1px 4px rgba(0,0,0,.08)":"none"}}>
                {m==="login"?"Connexion":"Inscription"}
              </button>
            ))}
          </div>
          {mode==="register"&&<Field label="Ton prénom" value={form.name} onChange={set("name")} placeholder="Fatou..."/>}
          <Field label="Email" type="email" value={form.email} onChange={set("email")} placeholder="exemple@gmail.com"/>
          <Field label="Mot de passe" type="password" value={form.password} onChange={set("password")} placeholder="6 caractères minimum"/>
          {mode==="register"&&<Field label="Confirmer" type="password" value={form.confirm} onChange={set("confirm")} placeholder="Répète le mot de passe"/>}
          {err&&<p style={{color:"#dc2626",fontSize:13,margin:"0 0 12px",fontWeight:500}}>⚠ {err}</p>}
          <PBtn onClick={submit} disabled={loading}>{loading?"...":mode==="login"?"Se connecter →":"Créer mon compte →"}</PBtn>
        </div>
        <button onClick={onBack} style={{display:"block",margin:"1rem auto 0",background:"none",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:13}}>← Retour à l'accueil</button>
      </div>
    </div>
  );
}

// ── ONBOARDING ────────────────────────────────────────────────────────────────
function Onboarding({user,onDone}){
  const [step,setStep]=useState(0);
  const [level,setLevel]=useState("");
  const [series,setSeries]=useState("");
  const groups=[...new Set(LEVELS.map(l=>l.group))];
  const needsSeries=hasSeriesChoice(level);
  const finish=()=>{
    const u=updateUser({...user,level,series:needsSeries?series:null});
    onDone({...user,level,series:needsSeries?series:null});
  };
  return(
    <div style={{minHeight:"100vh",background:"#f5f3ff",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
      <div style={{width:"100%",maxWidth:500}}>
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:"2rem"}}>
          {Array.from({length:(needsSeries?2:1)+1}).map((_,i)=>(
            <div key={i} style={{width:i===step?24:8,height:8,borderRadius:4,background:i<=step?"#4f46e5":"#e0e7ff",transition:"all .3s"}}/>
          ))}
        </div>
        {step===0&&(
          <div className="card anim">
            <div style={{textAlign:"center",marginBottom:"1.5rem"}}><div style={{fontSize:40,marginBottom:8}}>🏫</div>
              <h2 style={{fontSize:22,fontWeight:900,color:"#1e1b4b",margin:"0 0 4px"}}>Bienvenue {user.name} !</h2>
              <p style={{color:"#6b7280",margin:0,fontSize:14}}>Dans quelle classe es-tu ?</p>
            </div>
            {groups.map(g=>(
              <div key={g} style={{marginBottom:14}}>
                <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".08em"}}>{g}</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {LEVELS.filter(l=>l.group===g).map(l=>(
                    <button key={l.id} onClick={()=>setLevel(l.id)} style={{padding:".5rem .9rem",minHeight:44,borderRadius:8,border:`2px solid ${level===l.id?"#4f46e5":"#e5e7eb"}`,background:level===l.id?"#eef2ff":"white",color:level===l.id?"#4f46e5":"#374151",fontWeight:level===l.id?700:400,cursor:"pointer",fontSize:14,transition:"all .15s"}}>{l.label}</button>
                  ))}
                </div>
              </div>
            ))}
            <PBtn onClick={()=>needsSeries?setStep(1):finish()} disabled={!level} style={{marginTop:8}}>{needsSeries?"Continuer →":"C'est parti →"}</PBtn>
          </div>
        )}
        {step===1&&needsSeries&&(
          <div className="card anim">
            <div style={{textAlign:"center",marginBottom:"1.5rem"}}><div style={{fontSize:40,marginBottom:8}}>📋</div>
              <h2 style={{fontSize:22,fontWeight:900,color:"#1e1b4b",margin:"0 0 4px"}}>Ta série</h2>
              <p style={{color:"#6b7280",margin:0,fontSize:14}}>Classe de <strong>{level}</strong></p>
            </div>
            {(SERIES_BY_LEVEL[level]||[]).map(s=>(
              <button key={s.id} onClick={()=>setSeries(s.id)} style={{display:"block",width:"100%",padding:"1rem",marginBottom:10,borderRadius:12,border:`2px solid ${series===s.id?"#4f46e5":"#e5e7eb"}`,background:series===s.id?"#eef2ff":"white",color:series===s.id?"#4f46e5":"#374151",fontWeight:series===s.id?700:400,cursor:"pointer",textAlign:"left",fontSize:15,transition:"all .15s"}}>{s.label}</button>
            ))}
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button onClick={()=>setStep(0)} style={{flex:1,padding:"1rem",border:"2px solid #e5e7eb",borderRadius:12,background:"white",cursor:"pointer",fontWeight:600,color:"#374151"}}>← Retour</button>
              <PBtn onClick={finish} disabled={!series} style={{flex:2}}>C'est parti →</PBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── APP SHELL ─────────────────────────────────────────────────────────────────
function AppShell({user,tab,setTab,children}){
  const nav=[
    {id:"dashboard",icon:"📊",label:"Accueil"},
    {id:"exercises",icon:"✏️",label:"Exercices"},
    {id:"tutor",    icon:"💬",label:"Aide IA"},
    {id:"resources",icon:"📚",label:"Ressources"},
    {id:"profile",  icon:"👤",label:"Profil"},
  ];
  const adminNav=[...nav,{id:"admin",icon:"🛡",label:"Admin"}];
  const items=user.isAdmin?adminNav:nav;
  return(
    <div style={{minHeight:"100vh",background:"#f5f3ff"}}>
      <div style={{background:"#1e1b4b",padding:".875rem 1.25rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18,fontWeight:900,color:"white",letterSpacing:"-0.04em"}}>EduCorrect</span>
          <span style={{background:"#312e81",color:"#a5b4fc",fontSize:10,padding:"2px 7px",borderRadius:6,fontWeight:700}}>IA</span>
          {user.isAdmin&&<span style={{background:"#7c3aed",color:"#f0abfc",fontSize:10,padding:"2px 7px",borderRadius:6,fontWeight:700}}>ADMIN</span>}
        </div>
        <div className="hide-mobile" style={{display:"flex",gap:4}}>
          {items.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)} style={{padding:".45rem .875rem",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,fontSize:13,background:tab===n.id?"rgba(255,255,255,.15)":"transparent",color:tab===n.id?"white":"rgba(255,255,255,.6)",transition:"all .15s"}}>
              {n.icon} {n.label}
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:34,height:34,borderRadius:"50%",background:user.isAdmin?"#7c3aed":"#4f46e5",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:800,fontSize:14,flexShrink:0}}>{user.name[0]?.toUpperCase()}</div>
        </div>
      </div>
      {children}
      <nav className="bnav">
        {items.map(n=>(
          <button key={n.id} className={`bnav-item${tab===n.id?" active":""}`} onClick={()=>setTab(n.id)}>
            <span className="bnav-icon">{n.icon}</span>
            <span className="bnav-label">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function DashboardTab({user,onGoExercises,onGoTutor}){
  const stats=getStats(user.id);
  const bars=stats.recent;
  return(
    <div className="page anim">
      <div style={{background:"linear-gradient(135deg,#1e1b4b,#4f46e5)",borderRadius:20,padding:"1.5rem",marginBottom:16,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-20,top:-20,fontSize:80,opacity:.08}}>🎓</div>
        <p style={{margin:"0 0 4px",color:"#a5b4fc",fontSize:13,fontWeight:600}}>Bonjour 👋</p>
        <h2 style={{margin:"0 0 8px",color:"white",fontSize:24,fontWeight:900}}>{user.name}</h2>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          <Pill bg="rgba(255,255,255,.15)" color="white">{user.level||"—"}</Pill>
          {user.series&&<Pill bg="rgba(255,255,255,.1)" color="#c7d2fe">Série {user.series}</Pill>}
        </div>
      </div>
      <div className="g3" style={{marginBottom:16}}>
        {[{n:stats.total,l:"Exercices",c:"#4f46e5"},{n:stats.avg,l:"Moyenne /20",c:"#10b981"},{n:`${stats.streak}j`,l:"Streak",c:"#f59e0b"}].map(s=>(
          <div key={s.l} className="card" style={{textAlign:"center",padding:"1rem .5rem"}}>
            <div style={{fontSize:22,fontWeight:900,color:s.c}}>{s.n}</div>
            <div style={{fontSize:11,color:"#9ca3af",marginTop:2,fontWeight:500}}>{s.l}</div>
          </div>
        ))}
      </div>
      {bars.length>0&&(
        <div className="card" style={{marginBottom:16}}>
          <p style={{margin:"0 0 12px",fontWeight:700,fontSize:14,color:"#1e1b4b"}}>📈 Derniers scores</p>
          <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80}}>
            {bars.map((e,i)=>{const h=Math.max(4,(e.score/20)*80);const c=e.score>=15?"#10b981":e.score>=10?"#f59e0b":"#ef4444";return(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                <span style={{fontSize:9,color:c,fontWeight:700}}>{e.score}</span>
                <div style={{width:"100%",height:h,background:c,borderRadius:"4px 4px 0 0"}}/>
              </div>
            );})}
          </div>
        </div>
      )}
      {Object.keys(stats.bySubject).length>0&&(
        <div className="card" style={{marginBottom:16}}>
          <p style={{margin:"0 0 12px",fontWeight:700,fontSize:14,color:"#1e1b4b"}}>📚 Par matière</p>
          {Object.entries(stats.bySubject).map(([id,s])=>{
            const subj=SUBJECTS.find(x=>x.id===id);
            const pct=Math.round((parseFloat(s.avg)/20)*100);
            return(
              <div key={id} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>{subj?.sym} {s.label}</span>
                  <span style={{fontSize:13,fontWeight:700,color:parseFloat(s.avg)>=15?"#10b981":parseFloat(s.avg)>=10?"#f59e0b":"#ef4444"}}>{s.avg}/20</span>
                </div>
                <div style={{background:"#f3f4f6",borderRadius:99,height:6,overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,height:"100%",background:"linear-gradient(90deg,#4f46e5,#7c3aed)",borderRadius:99,transition:"width .7s ease"}}/>
                </div>
                <span style={{fontSize:10,color:"#9ca3af"}}>{s.count} exercice{s.count>1?"s":""}</span>
              </div>
            );
          })}
        </div>
      )}
      {stats.total===0&&(
        <div style={{textAlign:"center",padding:"2rem 1rem"}}>
          <div style={{fontSize:56,marginBottom:12}}>✏️</div>
          <h3 style={{fontSize:18,fontWeight:800,color:"#1e1b4b",margin:"0 0 8px"}}>Commence ta première révision !</h3>
          <p style={{color:"#6b7280",fontSize:14,margin:"0 0 1.5rem"}}>L'IA va générer un exercice adapté à ton niveau.</p>
          <div style={{display:"flex",gap:10,maxWidth:360,margin:"0 auto"}}>
            <PBtn onClick={onGoExercises} style={{flex:2}}>Faire un exercice →</PBtn>
            <button onClick={onGoTutor} style={{flex:1,padding:"1rem",border:"2px solid #e0e7ff",borderRadius:12,background:"white",color:"#4f46e5",fontWeight:700,cursor:"pointer",fontSize:14}}>Aide IA 💬</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI TUTOR ──────────────────────────────────────────────────────────────────
function TutorTab({user}){
  const [messages,setMessages]=useState([]);
  const [input,   setInput]   =useState("");
  const [busy,    setBusy]    =useState(false);
  const [context, setContext] =useState({subject:"",topic:""});
  const bottomRef=useRef(null);
  const inputRef =useRef(null);

  const SYSTEM = `Tu es un professeur bienveillant, patient et pédagogue qui aide un élève sénégalais de ${user.level||"lycée"}${user.series?", Série "+user.series:""}. Programme : MENFP Sénégal.

Tes règles :
- Explique TOUJOURS étape par étape, ne saute aucune étape
- Utilise des exemples concrets tirés du quotidien sénégalais (marchés, agriculture, sport)  
- Si l'élève ne comprend pas, reformule différemment avec une autre approche
- Vérifie la compréhension en posant une question simple à la fin
- Pour les maths et la physique, montre toujours le calcul détaillé
- Encourage l'élève, ne le décourage jamais
- Réponds en français, sauf si la matière est l'anglais
- Sois concis mais complet (300-500 mots max par réponse)
- Utilise des emojis avec parcimonie pour rendre la lecture agréable
- Si une formule est demandée, présente-la clairement`;

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  const send=async()=>{
    const text=input.trim(); if(!text||busy) return;
    setInput("");
    // Snapshot history BEFORE adding new message
    const prevHistory=[...messages];
    setMessages(p=>[...p,{role:"user",content:text}]);
    setBusy(true);
    try{
      // Système injecté dans le premier message utilisateur
      // On garde les 8 derniers échanges max pour rester sous le timeout
      const trimmed = prevHistory.slice(-8);
      let convMessages;
      if(trimmed.length===0){
        // Première question — system + question dans un seul message
        convMessages=[{
          role:"user",
          content:`[PROF IA — INSTRUCTIONS]: ${SYSTEM}\n\n---\nQuestion: ${text}`
        }];
      } else {
        // Conversations suivantes — system dans le premier message, puis alternance user/assistant
        const [first,...rest]=trimmed;
        convMessages=[
          { role:"user",    content:`[PROF IA — INSTRUCTIONS]: ${SYSTEM}\n\n---\nQuestion: ${first.content}` },
          ...rest.map(m=>({ role:m.role, content:m.content })),
          { role:"user",    content:text },
        ];
      }
      const reply=await callClaude(convMessages);
      setMessages(p=>[...p,{role:"assistant",content:reply}]);
    }catch(e){
      const msg = e.message.includes("trop de temps")
        ? "⏱️ Le Prof IA met trop de temps à répondre. Pose une question plus courte ou réessaie."
        : `⚠️ Erreur : ${e.message}. Réessaie.`;
      setMessages(p=>[...p,{role:"assistant",content:msg}]);
    }finally{setBusy(false);setTimeout(()=>inputRef.current?.focus(),100);}
  };

  const suggestions=[
    `Explique-moi ${user.level?.includes("T")||user.level?.includes("P")?"la dérivation":"les fractions"} étape par étape`,
    "Je ne comprends pas cette question, peux-tu m'aider ?",
    "Donne-moi un exemple concret",
    "Comment résoudre ce type d'exercice ?",
    "Résume le cours sur ce sujet",
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 64px)"}}>
      {/* Header */}
      <div style={{background:"white",borderBottom:"1px solid #e5e7eb",padding:"1rem 1.25rem",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12,maxWidth:740,margin:"0 auto"}}>
          <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🎓</div>
          <div>
            <h2 style={{margin:0,fontSize:15,fontWeight:800,color:"#1e1b4b"}}>Prof IA — EduCorrect</h2>
            <p style={{margin:0,fontSize:12,color:"#10b981",fontWeight:600}}>● En ligne · Répond immédiatement</p>
          </div>
          {messages.length>0&&(
            <button onClick={()=>setMessages([])} style={{marginLeft:"auto",background:"none",border:"1px solid #e5e7eb",borderRadius:8,padding:".35rem .75rem",cursor:"pointer",fontSize:12,color:"#6b7280"}}>Nouvelle conv.</button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"1.25rem",display:"flex",flexDirection:"column",gap:12,maxWidth:740,margin:"0 auto",width:"100%"}}>
        {messages.length===0&&(
          <div style={{textAlign:"center",padding:"2rem 1rem"}}>
            <div style={{fontSize:50,marginBottom:12}}>💬</div>
            <h3 style={{fontSize:18,fontWeight:800,color:"#1e1b4b",margin:"0 0 8px"}}>Pose ta question au Prof IA</h3>
            <p style={{color:"#6b7280",fontSize:14,margin:"0 0 1.5rem",lineHeight:1.6}}>Il t'explique n'importe quel sujet du programme sénégalais, étape par étape, jusqu'à ce que tu comprennes.</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center"}}>
              {suggestions.map((s,i)=>(
                <button key={i} onClick={()=>{setInput(s);inputRef.current?.focus();}} style={{padding:".5rem .875rem",borderRadius:20,border:"1px solid #e0e7ff",background:"#f5f3ff",color:"#4f46e5",cursor:"pointer",fontSize:13,fontWeight:500}}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            {m.role==="assistant"&&(
              <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,marginRight:8,marginTop:2}}>🎓</div>
            )}
            <div className={m.role==="user"?"bubble-user":"bubble-ai"} style={{whiteSpace:"pre-wrap"}}>
              {m.content}
            </div>
          </div>
        ))}
        {busy&&(
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>🎓</div>
            <div className="bubble-ai" style={{display:"flex",gap:6,alignItems:"center",padding:".875rem 1rem"}}>
              {[0,.15,.3].map((d,i)=>(
                <div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#9ca3af",animation:`spin .9s ${d}s ease-in-out infinite`}}/>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{background:"white",borderTop:"1px solid #e5e7eb",padding:"1rem 1.25rem",flexShrink:0}}>
        <div style={{display:"flex",gap:10,maxWidth:740,margin:"0 auto"}}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="Pose ta question... (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)"
            rows={2}
            style={{flex:1,padding:".75rem 1rem",border:"2px solid #e0e7ff",borderRadius:12,fontSize:15,resize:"none",lineHeight:1.5,WebkitTextSizeAdjust:"100%",transition:"border-color .2s"}}
          />
          <button onClick={send} disabled={!input.trim()||busy}
            style={{width:52,flexShrink:0,background:input.trim()&&!busy?"linear-gradient(135deg,#4f46e5,#7c3aed)":"#e5e7eb",border:"none",borderRadius:12,cursor:input.trim()&&!busy?"pointer":"not-allowed",fontSize:20,transition:"all .15s"}}>
            ↑
          </button>
        </div>
        <p style={{textAlign:"center",fontSize:11,color:"#d1d5db",margin:"6px 0 0"}}>L'IA peut se tromper. Pour les examens, vérifie toujours avec ton manuel.</p>
      </div>
    </div>
  );
}

// ── RESOURCES ─────────────────────────────────────────────────────────────────
function ResourcesTab({user}){
  const [sel,setSel]=useState(null);
  const available=getSubjectsForStudent(user.level||"3ème",user.series);
  const RESOURCE_KEYS={mathematiques:"mathematiques",physique:"physique",svt:"svt",francais:"francais",histoire:"histoire",anglais:"anglais",philosophie:"philosophie",informatique:"informatique",sciences:"sciences",emc:"emc",eco:"eco"};

  if(sel){
    const subj=SUBJECTS.find(s=>s.id===sel);
    const res=RESOURCES[RESOURCE_KEYS[sel]]||[];
    const vids=res.filter(r=>r.type==="video");
    const webs=res.filter(r=>r.type==="web");
    const pdfs=res.filter(r=>r.type==="pdf");
    const TypeSection=({items,icon,label})=>items.length===0?null:(
      <div style={{marginBottom:16}}>
        <p style={{margin:"0 0 8px",fontSize:12,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:".06em"}}>{icon} {label} ({items.length})</p>
        {items.map((r,i)=>(
          <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="res-card">
            <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
              <span style={{fontSize:20,flexShrink:0,marginTop:1}}>{r.type==="video"?"▶️":r.type==="pdf"?"📄":"🌐"}</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{margin:"0 0 3px",fontSize:14,fontWeight:700,color:"#1e1b4b"}}>{r.title}</p>
                <p style={{margin:0,fontSize:12,color:"#6b7280",lineHeight:1.5}}>{r.desc}</p>
              </div>
              <span style={{color:"#9ca3af",fontSize:16,flexShrink:0}}>↗</span>
            </div>
          </a>
        ))}
      </div>
    );
    return(
      <div className="page anim">
        <BackBtn onClick={()=>setSel(null)} label={`← ${subj?.label}`}/>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:"1.5rem"}}>
          <div style={{width:44,height:44,borderRadius:10,background:subj?.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:subj?.color,flexShrink:0}}>{subj?.sym}</div>
          <div>
            <h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:0}}>{subj?.label}</h2>
            <p style={{margin:0,fontSize:13,color:"#9ca3af"}}>{res.length} ressources · Programme {user.level}</p>
          </div>
        </div>
        <TypeSection items={vids} icon="▶️" label="Vidéos YouTube"/>
        <TypeSection items={webs} icon="🌐" label="Sites & cours en ligne"/>
        <TypeSection items={pdfs} icon="📄" label="Documents PDF"/>
        <div style={{background:"#fffbeb",borderRadius:12,padding:"1rem",border:"1px solid #fde68a"}}>
          <p style={{margin:0,fontSize:12,color:"#92400e",lineHeight:1.6}}>💡 Ces ressources sont gratuites et s'ouvrent dans ton navigateur. Elles ne sont pas hébergées par EduCorrect. Si un lien ne fonctionne pas, essaie de rechercher directement le titre.</p>
        </div>
      </div>
    );
  }

  return(
    <div className="page anim">
      <h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px"}}>📚 Ressources gratuites</h2>
      <p style={{color:"#6b7280",fontSize:14,margin:"0 0 1.5rem"}}>Vidéos, cours, annales BAC et sites éducatifs sélectionnés pour le programme sénégalais</p>
      <div className="g2">
        {available.map(s=>{
          const count=(RESOURCES[RESOURCE_KEYS[s.id]]||[]).length;
          return(
            <button key={s.id} onClick={()=>setSel(s.id)} style={{padding:"1.1rem",minHeight:80,background:"white",border:`2px solid #e5e7eb`,borderRadius:14,cursor:"pointer",textAlign:"left",transition:"all .15s",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
              <div style={{width:40,height:40,borderRadius:10,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:800,color:s.color,flexShrink:0}}>{s.sym}</div>
              <div>
                <p style={{margin:0,fontWeight:700,fontSize:13,color:"#1e1b4b"}}>{s.label}</p>
                <p style={{margin:0,fontSize:11,color:"#9ca3af"}}>{count} ressource{count!==1?"s":""}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── PROFILE ───────────────────────────────────────────────────────────────────
function ProfileTab({user,onLogout,onUpdateUser}){
  const [editing,setEditing]=useState(false);
  const [name,setName]=useState(user.name);
  const stats=getStats(user.id);
  const save=()=>{const u=updateUser({...user,name:name.trim()||user.name});onUpdateUser(u);setEditing(false);};
  return(
    <div className="page anim">
      <h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:"0 0 1.5rem"}}>👤 Mon profil</h2>
      <div className="card" style={{marginBottom:14,textAlign:"center"}}>
        <div style={{width:70,height:70,borderRadius:"50%",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:28,fontWeight:900,color:"white"}}>{user.name[0]?.toUpperCase()}</div>
        {editing?(
          <>
            <input value={name} onChange={e=>setName(e.target.value)} style={{width:"100%",padding:".65rem 1rem",border:"2px solid #4f46e5",borderRadius:8,fontSize:16,textAlign:"center",marginBottom:10,WebkitTextSizeAdjust:"100%"}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setEditing(false)} style={{flex:1,padding:".75rem",border:"2px solid #e5e7eb",borderRadius:10,background:"white",cursor:"pointer",fontSize:14}}>Annuler</button>
              <PBtn onClick={save} style={{flex:2}}>Enregistrer</PBtn>
            </div>
          </>
        ):(
          <>
            <h3 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px"}}>{user.name}</h3>
            <p style={{color:"#6b7280",margin:"0 0 8px",fontSize:14}}>{user.email}</p>
            <div style={{display:"flex",justifyContent:"center",flexWrap:"wrap",gap:8,marginBottom:12}}>
              <Pill bg="#eef2ff" color="#4f46e5">{user.level||"—"}</Pill>
              {user.series&&<Pill bg="#f5f3ff" color="#7c3aed">Série {user.series}</Pill>}
            </div>
            <button onClick={()=>setEditing(true)} style={{background:"none",border:"1px solid #e5e7eb",borderRadius:8,padding:".5rem 1rem",cursor:"pointer",color:"#6b7280",fontSize:13}}>✏️ Modifier le prénom</button>
          </>
        )}
      </div>
      <div className="g2" style={{marginBottom:14}}>
        {[{n:stats.total,l:"Exercices",c:"#4f46e5"},{n:stats.avg,l:"Moyenne /20",c:"#10b981"},{n:stats.best,l:"Meilleur",c:"#f59e0b"},{n:`${stats.streak}j`,l:"Streak",c:"#ef4444"}].map(s=>(
          <div key={s.l} className="card" style={{textAlign:"center",padding:"1rem .75rem"}}>
            <div style={{fontSize:22,fontWeight:900,color:s.c,marginBottom:2}}>{s.n}</div>
            <div style={{fontSize:11,color:"#9ca3af"}}>{s.l}</div>
          </div>
        ))}
      </div>
      <button onClick={onLogout} style={{width:"100%",padding:"1rem",border:"2px solid #fecaca",borderRadius:12,background:"#fef2f2",color:"#dc2626",fontWeight:700,cursor:"pointer",fontSize:15,marginBottom:12}}>Se déconnecter</button>
      <p style={{textAlign:"center",fontSize:11,color:"#d1d5db"}}>EduCorrect · Programme sénégalais (MENFP) · Propulsé par Claude AI</p>
    </div>
  );
}

// ── ADMIN DASHBOARD ───────────────────────────────────────────────────────────
function AdminTab(){
  const [users,setUsers]=useState([]);
  const [selUser,setSelUser]=useState(null);
  const [search,setSearch]=useState("");

  useEffect(()=>{
    const all=getAllUsersForAdmin().filter(u=>!isAdminEmail(u.email));
    setUsers(all);
  },[]);

  const filtered=users.filter(u=>
    u.name.toLowerCase().includes(search.toLowerCase())||
    u.email.toLowerCase().includes(search.toLowerCase())||
    (u.level||"").toLowerCase().includes(search.toLowerCase())
  );

  const total=users.length;
  const totalEx=users.reduce((a,u)=>{try{const p=getProgress(u.id);return a+(p.exercises?.length||0);}catch{return a;}},0);
  const avgScore=()=>{
    let scores=[];
    users.forEach(u=>{try{const p=getProgress(u.id);(p.exercises||[]).forEach(e=>scores.push(e.score));}catch{}});
    return scores.length?(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1):"—";
  };
  const active=users.filter(u=>{try{const p=getProgress(u.id);return p.lastStudyDate===new Date().toISOString().split("T")[0];}catch{return false;}}).length;

  if(selUser){
    const stats=getStats(selUser.id);
    const prog=getProgress(selUser.id);
    return(
      <div className="page anim">
        <BackBtn onClick={()=>setSelUser(null)} label="← Tous les élèves"/>
        <div className="card" style={{marginBottom:14,textAlign:"center"}}>
          <div style={{width:60,height:60,borderRadius:"50%",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px",fontSize:24,fontWeight:900,color:"white"}}>{selUser.name[0]?.toUpperCase()}</div>
          <h3 style={{fontSize:18,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px"}}>{selUser.name}</h3>
          <p style={{color:"#6b7280",margin:"0 0 8px",fontSize:13}}>{selUser.email}</p>
          <div style={{display:"flex",justifyContent:"center",gap:8}}>
            <Pill bg="#eef2ff" color="#4f46e5">{selUser.level||"Non défini"}</Pill>
            {selUser.series&&<Pill bg="#f5f3ff" color="#7c3aed">Série {selUser.series}</Pill>}
          </div>
        </div>
        <div className="g3" style={{marginBottom:14}}>
          {[{n:stats.total,l:"Exercices",c:"#4f46e5"},{n:stats.avg,l:"Moyenne /20",c:"#10b981"},{n:`${stats.streak}j`,l:"Streak",c:"#f59e0b"}].map(s=>(
            <div key={s.l} className="admin-stat"><div style={{fontSize:20,fontWeight:900,color:s.c}}>{s.n}</div><div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{s.l}</div></div>
          ))}
        </div>
        {Object.keys(stats.bySubject).length>0&&(
          <div className="card" style={{marginBottom:14}}>
            <p style={{margin:"0 0 12px",fontWeight:700,fontSize:14,color:"#1e1b4b"}}>Résultats par matière</p>
            {Object.entries(stats.bySubject).map(([id,s])=>{
              const subj=SUBJECTS.find(x=>x.id===id);
              const pct=Math.round((parseFloat(s.avg)/20)*100);
              return(
                <div key={id} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>{subj?.sym} {s.label}</span>
                    <span style={{fontSize:13,fontWeight:700,color:parseFloat(s.avg)>=15?"#10b981":parseFloat(s.avg)>=10?"#f59e0b":"#ef4444"}}>{s.avg}/20 ({s.count} ex.)</span>
                  </div>
                  <div style={{background:"#f3f4f6",borderRadius:99,height:6,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:"linear-gradient(90deg,#4f46e5,#7c3aed)",borderRadius:99}}/></div>
                </div>
              );
            })}
          </div>
        )}
        <div className="card">
          <p style={{margin:"0 0 12px",fontWeight:700,fontSize:14,color:"#1e1b4b"}}>Derniers exercices</p>
          {(prog.exercises||[]).slice(0,10).map((e,i)=>{
            const c=e.score>=15?"#10b981":e.score>=10?"#f59e0b":"#ef4444";
            return(
              <div key={i} className="admin-row">
                <div style={{width:36,height:36,borderRadius:10,background:`${c}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:14,fontWeight:800,color:c}}>{e.score}</span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{margin:0,fontSize:13,fontWeight:600,color:"#1f2937",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.topic||"—"}</p>
                  <p style={{margin:0,fontSize:11,color:"#9ca3af"}}>{e.subjectLabel} · {new Date(e.date).toLocaleDateString("fr-FR")}</p>
                </div>
              </div>
            );
          })}
          {(prog.exercises||[]).length===0&&<p style={{color:"#9ca3af",fontSize:13,textAlign:"center",padding:"1rem"}}>Aucun exercice encore réalisé.</p>}
        </div>
      </div>
    );
  }

  return(
    <div className="page anim">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:"1.5rem"}}>
        <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#7c3aed,#4f46e5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🛡</div>
        <div>
          <h2 style={{fontSize:20,fontWeight:900,color:"#1e1b4b",margin:0}}>Tableau de bord Admin</h2>
          <p style={{margin:0,fontSize:12,color:"#9ca3af"}}>khalifadylla@gmail.com · Accès complet</p>
        </div>
      </div>

      <div className="g2" style={{marginBottom:16}}>
        {[{n:total,l:"Élèves inscrits",c:"#4f46e5"},{n:totalEx,l:"Exercices réalisés",c:"#10b981"},{n:avgScore(),l:"Score moyen /20",c:"#f59e0b"},{n:active,l:"Actifs aujourd'hui",c:"#ef4444"}].map(s=>(
          <div key={s.l} className="admin-stat" style={{padding:"1.1rem .75rem"}}>
            <div style={{fontSize:24,fontWeight:900,color:s.c,marginBottom:2}}>{s.n}</div>
            <div style={{fontSize:11,color:"#9ca3af"}}>{s.l}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <p style={{margin:0,fontWeight:700,fontSize:14,color:"#1e1b4b"}}>👥 Tous les élèves ({filtered.length})</p>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher par nom, email, classe..."
          style={{width:"100%",padding:".7rem 1rem",border:"2px solid #e5e7eb",borderRadius:10,fontSize:14,marginBottom:12,WebkitTextSizeAdjust:"100%"}}/>
        {filtered.length===0&&<p style={{color:"#9ca3af",textAlign:"center",fontSize:13,padding:"1rem"}}>Aucun élève trouvé.</p>}
        {filtered.map((u,i)=>{
          const s=getStats(u.id);
          return(
            <div key={u.id} className="admin-row" style={{cursor:"pointer"}} onClick={()=>setSelUser(u)}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:800,fontSize:14,flexShrink:0}}>{u.name[0]?.toUpperCase()}</div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{margin:0,fontSize:14,fontWeight:700,color:"#1f2937"}}>{u.name}</p>
                <p style={{margin:0,fontSize:11,color:"#9ca3af",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.email} · {u.level||"—"}{u.series?" Série "+u.series:""}</p>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <p style={{margin:0,fontSize:13,fontWeight:700,color:parseFloat(s.avg)>=15?"#10b981":parseFloat(s.avg)>=10?"#f59e0b":"#ef4444"}}>{s.avg}/20</p>
                <p style={{margin:0,fontSize:10,color:"#9ca3af"}}>{s.total} ex.</p>
              </div>
              <span style={{color:"#d1d5db",fontSize:16,flexShrink:0}}>›</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── EXERCISES TAB ─────────────────────────────────────────────────────────────
const DIFF_LABELS=["Débutant","Facile","Intermédiaire","Difficile","Expert"];
const DIFF_COLORS=["#10b981","#3b82f6","#f59e0b","#ef4444","#7c3aed"];

function ExercisesTab({user}){
  const [xStep,setXStep]=useState("subject");
  const [subject,setSubject]=useState("");
  const [topic,setTopic]=useState("");
  const [exercise,setExercise]=useState(null);
  const [correction,setCorr]=useState(null);
  const [difficulty,setDiff]=useState(1);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);
  const available=getSubjectsForStudent(user.level||"3ème",user.series);
  const subj=SUBJECTS.find(s=>s.id===subject);
  const dColor=DIFF_COLORS[difficulty-1];
  const reset=()=>{setXStep("subject");setSubject("");setTopic("");setExercise(null);setCorr(null);setError(null);};

  const doGenerate=useCallback(async(lvl,subId,tp,diff)=>{
    setLoading(true);setError(null);
    try{
      const serie=user.series?` Série ${user.series}`:"";
      // Prompt compact pour rester sous le timeout
      const raw=await callClaude(
        `Professeur sénégalais. Exercice de ${subId} sur "${tp}" — ${lvl}${serie}, difficulté ${diff}/5, programme MENFP.\n` +
        `JSON UNIQUEMENT sans markdown:\n` +
        `{"title":"...","instructions":"...","questions":[{"id":1,"text":"...","points":8},{"id":2,"text":"...","points":12}],"totalPoints":20,"duration":"X min"}\n` +
        `Règle: total exactement 20pts, 2-3 questions max.`
      );
      setExercise(parseJSON(raw));setXStep("exercise");
    }catch(e){setError(e.message);}finally{setLoading(false);}
  },[user]);

  const doParse=useCallback(async(fd)=>{
    setLoading(true);setError(null);
    const prompt=
      `Professeur sénégalais. Élève de ${user.level} en ${subject}. Extrais cet exercice.\n` +
      `JSON UNIQUEMENT sans markdown:\n` +
      `{"title":"...","topic":"...","instructions":"...","questions":[{"id":1,"text":"...","points":5}],"totalPoints":20,"duration":"X min","source":"uploaded"}\n` +
      `Règle: total=20pts.`;
    try{
      let raw;
      if(fd.type==="pdf")         raw=await callClaudePDF(fd.base64,prompt);
      else if(fd.type==="image")  raw=await callClaudeVision(fd.base64,fd.mediaType,prompt);
      else                        raw=await callClaude(prompt+`\n\nDOC:\n${fd.content.slice(0,3000)}`);
      const p=parseJSON(raw);
      setTopic(p.topic||"exercice uploadé");
      setExercise({...p,source:"uploaded"});setXStep("exercise");
    }catch(e){setError(e.message);}finally{setLoading(false);}
  },[user,subject]);

  const doCorrect=useCallback(async(ans)=>{
    if(!exercise)return;
    setLoading(true);setError(null);
    // Prompt compact — fullCorrection seulement si score potentiellement ≥15
    const qs=(exercise.questions||[]).map(q=>`Q${q.id}(${q.points}pts):${q.text}`).join("|");
    const base=
      `Professeur sénégalais. Corrige exercice de ${subject}, ${user.level}${user.series?" S."+user.series:""}.\n` +
      `EXERCICE: ${exercise.title} | ${qs} | Total:${exercise.totalPoints||20}pts\n` +
      `{ANSWER}\n` +
      `JSON UNIQUEMENT sans markdown:\n` +
      `{"score":<0-20>,"appreciation":"Excellent|Très bien|Bien|Assez bien|Passable|À améliorer|Insuffisant","feedback":"2 phrases max","corrections":[{"questionId":1,"pointsObtenus":<n>,"pointsMax":<n>,"commentaire":"Court commentaire"}],"fullCorrection":"Correction si score≥15 sinon chaîne vide","points_forts":["..."],"points_ameliorer":["..."]}`;
    try{
      let raw;
      if(ans.type==="image")
        raw=await callClaudeVision(ans.base64,ans.mediaType,base.replace("{ANSWER}","RÉPONSE:[image jointe]"));
      else
        raw=await callClaude(base.replace("{ANSWER}",`RÉPONSE:\n${ans.content.slice(0,2000)}`));
      const corr=parseJSON(raw);
      addExerciseResult(user.id,{subject,subjectLabel:subj?.label||subject,topic,score:corr.score,difficulty,source:exercise.source||"generated"});
      if(corr.score>=15)setDiff(d=>Math.min(d+1,5));
      setCorr(corr);setXStep("result");
    }catch(e){
      // Ne pas revenir à l'exercice sur timeout — afficher l'erreur en haut
      setError(e.message);
      // Si on a déjà soumis, rester sur l'écran d'exercice
      if(xStep!=="exercise")setXStep("exercise");
    }finally{setLoading(false);}
  },[exercise,user,subject,topic,difficulty,subj,xStep]);

  if(loading)return<Spinner/>;

  if(xStep==="subject")return(
    <div className="page anim">
      <h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px"}}>✏️ Exercices</h2>
      <p style={{color:"#6b7280",fontSize:14,margin:"0 0 1.5rem"}}>Quelle matière veux-tu travailler ?</p>
      {error&&<p style={{color:"#dc2626",fontSize:13,background:"#fef2f2",padding:".75rem",borderRadius:10,marginBottom:12}}>⚠ {error}</p>}
      <div className="g2">
        {available.map(s=>(
          <button key={s.id} onClick={()=>{setSubject(s.id);setXStep("mode");}} style={{padding:"1rem",minHeight:64,background:"white",border:"2px solid #e5e7eb",borderRadius:14,cursor:"pointer",textAlign:"left",transition:"all .15s",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
            <div style={{width:38,height:38,borderRadius:10,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:s.color,flexShrink:0}}>{s.sym}</div>
            <span style={{fontWeight:600,fontSize:13,color:"#1e1b4b"}}>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  if(xStep==="mode")return(
    <div className="page anim">
      <BackBtn onClick={()=>setXStep("subject")}/>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:"1.5rem"}}>
        <div style={{width:44,height:44,borderRadius:10,background:subj?.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:subj?.color,flexShrink:0}}>{subj?.sym}</div>
        <div><h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:0}}>{subj?.label}</h2><p style={{margin:0,fontSize:13,color:"#9ca3af"}}>{user.level}{user.series?` · Série ${user.series}`:""}</p></div>
      </div>
      <div className="g2" style={{gap:16}}>
        <button onClick={()=>setXStep("topic")} style={{padding:"1.5rem",minHeight:170,borderRadius:14,border:"2px solid #e0e7ff",background:"white",cursor:"pointer",textAlign:"left",transition:"all .2s",display:"flex",flexDirection:"column",gap:10}}>
          <span style={{fontSize:36}}>✨</span>
          <div><p style={{margin:"0 0 6px",fontSize:15,fontWeight:800,color:"#1e1b4b"}}>Générer un exercice</p><p style={{margin:0,fontSize:12,color:"#6b7280",lineHeight:1.5}}>L'IA crée un exercice adapté au programme sénégalais</p></div>
          <span style={{marginTop:"auto",fontSize:12,fontWeight:700,color:"#4f46e5"}}>Choisir un thème →</span>
        </button>
        <button onClick={()=>setXStep("upload")} style={{padding:"1.5rem",minHeight:170,borderRadius:14,border:"2px solid #fef3c7",background:"white",cursor:"pointer",textAlign:"left",transition:"all .2s",display:"flex",flexDirection:"column",gap:10}}>
          <span style={{fontSize:36}}>📄</span>
          <div><p style={{margin:"0 0 6px",fontSize:15,fontWeight:800,color:"#1e1b4b"}}>Mon exercice</p><p style={{margin:0,fontSize:12,color:"#6b7280",lineHeight:1.5}}>Téléverse un exercice reçu en classe</p></div>
          <span style={{marginTop:"auto",fontSize:12,fontWeight:700,color:"#d97706"}}>Téléverser →</span>
        </button>
      </div>
    </div>
  );

  if(xStep==="topic"){
    const suggestions=getTopicsForStudent(subject,user.level||"3ème",user.series);
    return(
      <div className="page anim">
        <BackBtn onClick={()=>setXStep("mode")}/>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:"1.25rem"}}>
          <div style={{width:44,height:44,borderRadius:10,background:subj?.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:subj?.color,flexShrink:0}}>{subj?.sym}</div>
          <div><h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:0}}>{subj?.label}</h2><p style={{margin:0,fontSize:12,color:"#9ca3af"}}>Programme {user.level}{user.series?` · Série ${user.series}`:""}</p></div>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:"1.25rem"}}>
          {suggestions.map(s=>(
            <button key={s} onClick={()=>setTopic(s)} style={{padding:".5rem .9rem",minHeight:40,borderRadius:20,border:`2px solid ${topic===s?subj?.color:"#e5e7eb"}`,background:topic===s?subj?.bg:"white",color:topic===s?subj?.color:"#374151",fontWeight:topic===s?700:400,cursor:"pointer",fontSize:13,transition:"all .15s"}}>{s}</button>
          ))}
        </div>
        <div className="card" style={{marginBottom:16}}>
          <Lbl>Ou entre un thème personnalisé</Lbl>
          <input type="text" value={topic} onChange={e=>setTopic(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&topic.trim()&&doGenerate(user.level,subject,topic.trim(),difficulty)}
            placeholder="Ex: Cinétique chimique..." style={{width:"100%",padding:".8rem 1rem",border:`2px solid ${topic?subj?.color||"#4f46e5":"#e5e7eb"}`,borderRadius:8,fontSize:16,transition:"border-color .2s",WebkitTextSizeAdjust:"100%"}}/>
        </div>
        <PBtn onClick={()=>topic.trim()&&doGenerate(user.level,subject,topic.trim(),difficulty)} disabled={!topic.trim()}>Générer l'exercice ✨</PBtn>
      </div>
    );
  }

  if(xStep==="upload")return<UploadExercise subj={subj} user={user} onParsed={doParse} onBack={()=>setXStep("mode")}/>;

  if(xStep==="exercise"&&exercise)return(
    <ExerciseView subj={subj} exercise={exercise} difficulty={difficulty} dColor={dColor} onSubmit={doCorrect} onBack={()=>setXStep("mode")} error={error}/>
  );

  if(xStep==="result"&&correction)return(
    <ResultView correction={correction} difficulty={difficulty} isUploaded={exercise?.source==="uploaded"}
      onNext={()=>{setCorr(null);doGenerate(user.level,subject,topic,difficulty);}}
      onRetry={()=>{setCorr(null);setXStep("exercise");}}
      onNew={reset}/>
  );
  return null;
}

function UploadExercise({subj,user,onParsed,onBack}){
  const [file,setFile]=useState(null);const[fd,setFd]=useState(null);const[proc,setProc]=useState(false);const[err,setErr]=useState("");const ref=useRef();
  const handle=async e=>{
    const f=e.target.files[0];if(!f)return;setProc(true);setErr("");setFd(null);
    try{
      if(f.type==="application/pdf"){setFd({type:"pdf",base64:await toB64(f),name:f.name});setFile(f);}
      else if(f.type.startsWith("image/")){setFd({type:"image",base64:await toB64(f),mediaType:f.type,name:f.name});setFile(f);}
      else if(f.name.endsWith(".docx")){try{const m=await import("mammoth");const r=await m.extractRawText({arrayBuffer:await f.arrayBuffer()});if(!r.value.trim()){setErr("Document vide.");return;}setFd({type:"text",content:r.value,name:f.name});setFile(f);}catch{setErr("Impossible de lire ce .docx.");}}
      else if(f.type.startsWith("text/")||f.name.endsWith(".txt")){const t=await f.text();if(!t.trim()){setErr("Fichier vide.");return;}setFd({type:"text",content:t,name:f.name});setFile(f);}
      else setErr("Format non supporté. PDF, image, .txt ou .docx.");
    }catch(ex){setErr(ex.message);}finally{setProc(false);}
  };
  return(
    <div className="page anim">
      <BackBtn onClick={onBack}/>
      <h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px"}}>Téléverse ton exercice</h2>
      <p style={{color:"#6b7280",fontSize:14,margin:"0 0 1.25rem"}}>{subj?.label} · {user.level}</p>
      <input type="file" ref={ref} onChange={handle} accept=".pdf,.txt,.docx,image/*" style={{display:"none"}}/>
      <div onClick={()=>!proc&&ref.current?.click()} style={{border:`2px dashed ${fd?"#4f46e5":"#d1d5db"}`,borderRadius:16,padding:"2rem",textAlign:"center",cursor:proc?"wait":"pointer",background:fd?"#eef2ff":"#fafaf9",marginBottom:12,minHeight:180,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>
        {proc?<p style={{margin:0,color:"#4f46e5",fontWeight:600}}>⏳ Lecture...</p>
          :fd?<div><div style={{fontSize:40,marginBottom:8}}>✅</div><p style={{margin:"0 0 4px",fontWeight:700,color:"#1e1b4b",fontSize:13}}>{file?.name}</p><p style={{margin:0,fontSize:11,color:"#9ca3af"}}>Appuyer pour changer</p></div>
          :<div><div style={{fontSize:48,marginBottom:10}}>📄</div><p style={{margin:"0 0 4px",fontWeight:700,color:"#374151"}}>Appuyer pour choisir</p><p style={{margin:0,fontSize:12,color:"#9ca3af"}}>PDF · Photo · Texte · Word</p></div>
        }
      </div>
      {err&&<p style={{color:"#dc2626",fontSize:13,background:"#fef2f2",padding:".75rem",borderRadius:10,marginBottom:12}}>⚠ {err}</p>}
      <div style={{background:"#fffbeb",borderRadius:10,padding:".875rem",marginBottom:14,border:"1px solid #fde68a"}}><p style={{margin:0,fontSize:12,color:"#92400e",lineHeight:1.6}}>💡 Pour un exercice sur papier, prends une photo nette. L'IA reconnaît l'écriture manuscrite.</p></div>
      <PBtn onClick={()=>fd&&onParsed(fd)} disabled={!fd||proc} style={{background:fd&&!proc?"linear-gradient(135deg,#d97706,#f59e0b)":"#e5e7eb",boxShadow:fd&&!proc?"0 4px 14px rgba(217,119,6,.3)":"none"}}>{proc?"Traitement...":"Analyser avec l'IA →"}</PBtn>
    </div>
  );
}

function ExerciseView({subj,exercise,difficulty,dColor,onSubmit,onBack,error}){
  const [answers,setAnswers]=useState({});const[fd,setFd]=useState(null);const[upl,setUpl]=useState(false);const ref=useRef();
  const hasAns=fd||Object.values(answers).some(v=>v?.trim());
  const submit=()=>{if(fd){onSubmit(fd);return;}onSubmit({type:"text",content:(exercise.questions||[]).map(q=>`Q${q.id}(${q.points}pts): ${q.text}\nRép: ${answers[q.id]||"(vide)"}`).join("\n\n")});};
  const handleFile=async e=>{const f=e.target.files[0];if(!f)return;setUpl(true);try{if(f.type.startsWith("image/"))setFd({type:"image",mediaType:f.type,base64:await toB64(f),name:f.name});else setFd({type:"text",content:await f.text(),name:f.name});}finally{setUpl(false);}};
  return(
    <div className="page-w anim">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem",flexWrap:"wrap",gap:8}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:14,padding:0,minHeight:44}}>← Retour</button>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Pill bg={subj?.bg} color={subj?.color}>{subj?.label}</Pill>
          <Pill bg={`${dColor}18`} color={dColor}>Niv. {DIFF_LABELS[difficulty-1]}</Pill>
          {exercise.source==="uploaded"&&<Pill bg="#fef3c7" color="#92400e">Mon exercice</Pill>}
        </div>
      </div>
      {error&&<p style={{color:"#dc2626",fontSize:13,background:"#fef2f2",padding:".75rem",borderRadius:10,marginBottom:12}}>⚠ {error}</p>}
      <div className="card" style={{marginBottom:12}}>
        <h2 style={{fontSize:18,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px"}}>{exercise.title}</h2>
        {exercise.duration&&<p style={{fontSize:12,color:"#9ca3af",margin:"0 0 1rem"}}>Durée: {exercise.duration} · {exercise.totalPoints||20} pts</p>}
        {exercise.instructions&&<div style={{background:"#f5f3ff",borderRadius:10,padding:".875rem 1rem",marginBottom:"1.25rem",borderLeft:"3px solid #7c3aed"}}><p style={{margin:0,color:"#374151",fontSize:14,lineHeight:1.65}}>{exercise.instructions}</p></div>}
        {(exercise.questions||[]).map((q,i,arr)=>(
          <div key={q.id} style={{marginBottom:18,borderBottom:i<arr.length-1?"1px solid #f3f4f6":"none",paddingBottom:i<arr.length-1?18:0}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:8}}>
              <p style={{margin:0,fontWeight:600,color:"#1f2937",fontSize:15,flex:1,lineHeight:1.5}}>
                <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:24,height:24,background:"#4f46e5",color:"white",borderRadius:6,fontSize:12,fontWeight:700,marginRight:8,verticalAlign:"middle",flexShrink:0}}>{i+1}</span>
                {q.text}
              </p>
              <span style={{fontSize:12,color:"#9ca3af",whiteSpace:"nowrap",fontWeight:600,paddingTop:3}}>{q.points} pts</span>
            </div>
            <textarea value={answers[q.id]||""} rows={3} onChange={e=>setAnswers(p=>({...p,[q.id]:e.target.value}))} placeholder={`Réponse ${i+1}...`}
              style={{width:"100%",padding:".75rem",border:`2px solid ${answers[q.id]?.trim()?"#c7d2fe":"#e5e7eb"}`,borderRadius:8,fontSize:15,resize:"vertical",lineHeight:1.6,WebkitTextSizeAdjust:"100%"}}/>
          </div>
        ))}
      </div>
      <div className="card" style={{marginBottom:12}}>
        <p style={{margin:"0 0 10px",fontSize:13,fontWeight:600,color:"#374151"}}>📎 Ou téléverse ta réponse (photo, .txt)</p>
        <input type="file" ref={ref} onChange={handleFile} accept=".txt,image/*" style={{display:"none"}}/>
        {!fd?<button onClick={()=>ref.current?.click()} style={{width:"100%",padding:".875rem",minHeight:50,border:"2px dashed #d1d5db",borderRadius:10,background:"#fafaf9",color:"#6b7280",cursor:"pointer",fontSize:14}}>{upl?"Chargement...":"Appuyer pour choisir"}</button>
          :<div style={{display:"flex",alignItems:"center",gap:10,padding:".75rem",background:"#f0fdf4",borderRadius:8,border:"1px solid #bbf7d0"}}>
            <span style={{flexShrink:0}}>✅</span>
            <p style={{margin:0,fontSize:13,fontWeight:600,color:"#166534",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fd.name}</p>
            <button onClick={()=>{setFd(null);if(ref.current)ref.current.value="";}} style={{background:"none",border:"none",cursor:"pointer",color:"#6b7280",fontSize:22,padding:"4px 8px",minHeight:44}}>×</button>
          </div>
        }
      </div>
      <PBtn onClick={submit} disabled={!hasAns} style={{background:hasAns?"linear-gradient(135deg,#059669,#10b981)":"#e5e7eb",boxShadow:hasAns?"0 4px 14px rgba(16,185,129,.32)":"none"}}>Soumettre ma réponse ✓</PBtn>
    </div>
  );
}

function ResultView({correction,difficulty,isUploaded,onNext,onRetry,onNew}){
  const pass=correction.score>=15;
  const sColor=correction.score>=15?"#10b981":correction.score>=10?"#f59e0b":"#ef4444";
  const pct=Math.round((correction.score/20)*100);
  return(
    <div className="page-w anim">
      <div style={{background:pass?"#ecfdf5":correction.score>=10?"#fffbeb":"#fef2f2",border:`2px solid ${pass?"#6ee7b7":correction.score>=10?"#fcd34d":"#fca5a5"}`,borderRadius:16,padding:"1.5rem",marginBottom:14,textAlign:"center"}}>
        {pass&&<div style={{fontSize:13,fontWeight:700,color:"#059669",marginBottom:8,letterSpacing:".06em"}}>🏆 EXCELLENT TRAVAIL !</div>}
        <div style={{fontSize:"clamp(42px,10vw,64px)",fontWeight:900,lineHeight:1,marginBottom:4,color:sColor}}>{correction.score}<span style={{fontSize:"clamp(18px,5vw,28px)",fontWeight:400,color:"#9ca3af"}}>/20</span></div>
        <div style={{fontSize:15,fontWeight:700,color:pass?"#065f46":correction.score>=10?"#92400e":"#991b1b",marginBottom:"1rem"}}>{correction.appreciation}</div>
        <div style={{background:"#e5e7eb",borderRadius:99,height:10,marginBottom:"1rem",overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${sColor},${sColor}bb)`,borderRadius:99,transition:"width .9s ease"}}/></div>
        <p style={{margin:0,color:"#4b5563",fontSize:14,lineHeight:1.7}}>{correction.feedback}</p>
      </div>
      {correction.corrections?.length>0&&(
        <div className="card" style={{marginBottom:12}}>
          <h3 style={{margin:"0 0 12px",fontSize:15,fontWeight:700,color:"#1e1b4b"}}>Détail par question</h3>
          {correction.corrections.map((c,i,arr)=>{
            const r=c.pointsMax>0?c.pointsObtenus/c.pointsMax:0;const col=r>=.75?"#10b981":r>=.5?"#f59e0b":"#ef4444";
            return(<div key={i} style={{padding:".875rem",borderRadius:10,background:`${col}0d`,border:`1px solid ${col}30`,marginBottom:i<arr.length-1?8:0}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontWeight:600,fontSize:14,color:"#1f2937"}}>Question {c.questionId}</span><span style={{fontWeight:700,color:col,fontSize:14}}>{c.pointsObtenus}/{c.pointsMax} pts</span></div>
              <p style={{margin:0,fontSize:13,color:"#6b7280",lineHeight:1.55}}>{c.commentaire}</p>
            </div>);
          })}
        </div>
      )}
      {(correction.points_forts?.length>0||correction.points_ameliorer?.length>0)&&(
        <div className="g2" style={{marginBottom:12}}>
          {correction.points_forts?.length>0&&<div style={{background:"#ecfdf5",borderRadius:12,padding:"1rem",border:"1px solid #a7f3d0"}}><p style={{margin:"0 0 8px",fontSize:11,fontWeight:800,color:"#065f46",textTransform:"uppercase",letterSpacing:".06em"}}>✓ Points forts</p>{correction.points_forts.map((p,i)=><p key={i} style={{margin:"0 0 3px",fontSize:12,color:"#047857"}}>· {p}</p>)}</div>}
          {correction.points_ameliorer?.length>0&&<div style={{background:"#fffbeb",borderRadius:12,padding:"1rem",border:"1px solid #fde68a"}}><p style={{margin:"0 0 8px",fontSize:11,fontWeight:800,color:"#92400e",textTransform:"uppercase",letterSpacing:".06em"}}>→ À travailler</p>{correction.points_ameliorer.map((p,i)=><p key={i} style={{margin:"0 0 3px",fontSize:12,color:"#b45309"}}>· {p}</p>)}</div>}
        </div>
      )}
      {pass&&correction.fullCorrection&&<div style={{background:"#eef2ff",borderRadius:14,padding:"1.25rem",marginBottom:14,border:"1px solid #c7d2fe"}}><h3 style={{margin:"0 0 10px",fontSize:15,fontWeight:700,color:"#3730a3"}}>📚 Correction complète</h3><div style={{fontSize:13,color:"#1e1b4b",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{correction.fullCorrection}</div></div>}
      {!pass&&<div style={{background:"#fef2f2",borderRadius:12,padding:"1rem",marginBottom:14,border:"1px solid #fecaca",textAlign:"center"}}><p style={{margin:0,fontSize:13,color:"#dc2626",fontWeight:600}}>🔒 Correction complète disponible à partir de 15/20</p><p style={{margin:"4px 0 0",fontSize:12,color:"#9ca3af"}}>Encore {15-correction.score} point{15-correction.score>1?"s":""} pour débloquer</p></div>}
      <div className="row" style={{marginBottom:10}}>
        <button onClick={onRetry} style={{flex:1,padding:"1rem",minHeight:50,border:"2px solid #e5e7eb",borderRadius:12,background:"white",color:"#374151",fontWeight:600,cursor:"pointer",fontSize:14}}>↩ Réessayer</button>
        <button onClick={onNext} style={{flex:2,padding:"1rem",minHeight:50,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"white",border:"none",borderRadius:12,fontWeight:700,cursor:"pointer",fontSize:14,boxShadow:"0 4px 12px rgba(79,70,229,.28)"}}>
          {pass&&difficulty<5?`Suivant — Niv. ${DIFF_LABELS[Math.min(difficulty,4)]} →`:"Nouvel exercice →"}
        </button>
      </div>
      <button onClick={onNew} style={{width:"100%",padding:".75rem",minHeight:44,background:"none",border:"1px solid #e5e7eb",borderRadius:10,color:"#9ca3af",cursor:"pointer",fontSize:13}}>Choisir une autre matière</button>
      <p style={{textAlign:"center",fontSize:12,color:"#9ca3af",margin:"10px 0 0"}}>{pass&&difficulty<5?"🎯 La difficulté augmentera au prochain exercice.":!pass?"💪 Correction complète disponible à 15/20 !":"🏆 Niveau maximum !"}</p>
    </div>
  );
}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
export default function App(){
  const [screen,setScreen]=useState("loading");
  const [user,setUser]=useState(null);
  const [tab,setTab]=useState("dashboard");

  useEffect(()=>{
    const u=getCurrentUser();
    if(u){setUser(u);setScreen(u.isAdmin||u.level?"app":"onboarding");}
    else setScreen("landing");
  },[]);

  const handleAuth=(u,needsOnboard)=>{setUser(u);setScreen(needsOnboard?"onboarding":"app");};
  const handleOnboard=(u)=>{setUser(u);setScreen("app");};
  const handleLogout=()=>{logoutUser();setUser(null);setScreen("landing");};
  const handleUpdate=(u)=>setUser(u);

  if(screen==="loading")return<div style={{minHeight:"100vh",background:"#f5f3ff",display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner/></div>;

  return(
    <>
      <style>{CSS}</style>
      {screen==="landing"    &&<Landing onGetStarted={()=>setScreen("auth")}/>}
      {screen==="auth"       &&<AuthScreen onSuccess={handleAuth} onBack={()=>setScreen("landing")}/>}
      {screen==="onboarding" &&user&&<Onboarding user={user} onDone={handleOnboard}/>}
      {screen==="app"        &&user&&(
        <AppShell user={user} tab={tab} setTab={setTab}>
          {tab==="dashboard"  &&<DashboardTab user={user} onGoExercises={()=>setTab("exercises")} onGoTutor={()=>setTab("tutor")}/>}
          {tab==="exercises"  &&<ExercisesTab user={user}/>}
          {tab==="tutor"      &&<TutorTab user={user}/>}
          {tab==="resources"  &&<ResourcesTab user={user}/>}
          {tab==="profile"    &&<ProfileTab user={user} onLogout={handleLogout} onUpdateUser={handleUpdate}/>}
          {tab==="admin"      &&user.isAdmin&&<AdminTab/>}
        </AppShell>
      )}
    </>
  );
}
