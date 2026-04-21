// EduCorrect — Programme sénégalais MENFP
// Tuteur IA dédié · Admin toutes classes · Dashboard stats complet
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

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = "/api/claude";
const MODEL   = "claude-sonnet-4-20250514";
const MAX_TOK = 1200;

async function apiPost(body) {
  let r;
  try {
    r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOK, ...body }),
    });
  } catch (e) {
    throw new Error(
      e.message === "Failed to fetch"
        ? "Connexion impossible. Vérifie ton accès internet."
        : `Erreur réseau : ${e.message}`
    );
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error?.message || `Erreur serveur ${r.status}`);
  return data;
}

const callClaude = async (msgs) => {
  const d = await apiPost({ messages: Array.isArray(msgs) ? msgs : [{ role:"user", content: msgs }] });
  return d.content.filter(b => b.type === "text").map(b => b.text).join("");
};
const callVision = async (b64, mt, prompt) => {
  const d = await apiPost({ messages:[{ role:"user", content:[
    { type:"image", source:{ type:"base64", media_type:mt, data:b64 }},
    { type:"text", text: prompt }
  ]}]});
  return d.content.filter(b => b.type === "text").map(b => b.text).join("");
};
const callPDF = async (b64, prompt) => {
  const d = await apiPost({ messages:[{ role:"user", content:[
    { type:"document", source:{ type:"base64", media_type:"application/pdf", data:b64 }},
    { type:"text", text: prompt }
  ]}]});
  return d.content.filter(b => b.type === "text").map(b => b.text).join("");
};
const parseJSON = raw => {
  const c = raw.replace(/^```(?:json)?\n?/m,"").replace(/\n?```$/m,"").trim();
  try { return JSON.parse(c); } catch {
    const m = c.match(/\{[\s\S]+\}/); if (m) return JSON.parse(m[0]);
    throw new Error("Réponse IA non analysable");
  }
};
const toB64 = f => new Promise((res,rej) => {
  const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(f);
});

const DIFF  = ["Débutant","Facile","Intermédiaire","Difficile","Expert"];
const DCOL  = ["#10b981","#3b82f6","#f59e0b","#ef4444","#7c3aed"];

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────
const CSS = `
@keyframes spin  { to { transform:rotate(360deg); }}
@keyframes fadeUp{ from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
@keyframes slideIn{ from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
*,*::before,*::after { box-sizing:border-box; }
body { margin:0; }
input,textarea,select { font-family:inherit; -webkit-appearance:none; }
input:focus,textarea:focus { outline:none; box-shadow:0 0 0 3px rgba(79,70,229,.18); }
button:not([disabled]):active { transform:scale(.97); }

/* Layout */
.pg  { max-width:620px; margin:0 auto; padding:1.75rem 1.25rem 5.5rem; }
.pgw { max-width:760px; margin:0 auto; padding:1.5rem 1.25rem 5.5rem; }
.card { background:white; border-radius:16px; padding:1.5rem; box-shadow:0 1px 8px rgba(0,0,0,.07); }
.g2  { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
.g3  { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.row { display:flex; gap:10px; }
.anim{ animation:fadeUp .28s ease both; }

/* Tutor chat */
.chat-area { flex:1; overflow-y:auto; padding:1.25rem; display:flex; flex-direction:column; gap:14px; }
.msg-user  { align-self:flex-end; background:#4f46e5; color:white;  border-radius:18px 18px 4px 18px; padding:.75rem 1rem; font-size:14px; line-height:1.65; max-width:82%; animation:slideIn .2s ease; }
.msg-ai    { align-self:flex-start; background:white; color:#1f2937; border-radius:18px 18px 18px 4px; padding:.875rem 1.1rem; font-size:14px; line-height:1.75; max-width:88%; box-shadow:0 1px 6px rgba(0,0,0,.09); animation:slideIn .2s ease; white-space:pre-wrap; }
.msg-ai strong { color:#1e1b4b; }
.msg-ai code  { background:#f1f5f9; padding:1px 5px; border-radius:4px; font-size:12px; }

/* Bottom nav */
.bnav { display:none; }
@media(max-width:640px){
  .pg,.pgw { padding:1rem .875rem 5.5rem; }
  .card    { padding:1.1rem; border-radius:14px; }
  .g2      { grid-template-columns:1fr; }
  .g3      { grid-template-columns:1fr; }
  .row     { flex-direction:column; }
  .hide-m  { display:none!important; }
  .bnav    { display:flex; position:fixed; bottom:0; left:0; right:0; background:white;
             border-top:1px solid #e5e7eb; z-index:99; padding:.5rem 0 .3rem; }
  .bni     { flex:1; display:flex; flex-direction:column; align-items:center; gap:2px;
             padding:.2rem; cursor:pointer; border:none; background:none; }
  .bni-ic  { font-size:1.2rem; }
  .bni-lb  { font-size:.58rem; font-weight:600; color:#9ca3af; }
  .bni.on .bni-lb { color:#4f46e5; }
  .chat-area { padding:.875rem; }
  .msg-user,.msg-ai { max-width:93%; }
}
@media(min-width:641px){ .show-m{display:none!important;} }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────
const PBtn = ({ onClick, disabled, children, s={} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width:"100%", padding:"1rem", minHeight:52, border:"none", borderRadius:12,
    fontSize:16, fontWeight:700,
    cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? "#e5e7eb" : "linear-gradient(135deg,#4f46e5,#7c3aed)",
    color: disabled ? "#9ca3af" : "white",
    boxShadow: disabled ? "none" : "0 4px 14px rgba(79,70,229,.28)",
    transition:"all .18s", ...s
  }}>{children}</button>
);
const BkBtn  = ({ onClick, label="← Retour" }) =>
  <button onClick={onClick} style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:14,padding:".5rem 0",marginBottom:".875rem",display:"block",minHeight:44}}>{label}</button>;
const Lbl    = ({ children }) => <label style={{display:"block",fontWeight:700,marginBottom:8,color:"#111827",fontSize:14}}>{children}</label>;
const Pill   = ({ bg, color, children }) =>
  <span style={{padding:".3rem .75rem",borderRadius:20,fontSize:12,fontWeight:700,background:bg,color,whiteSpace:"nowrap"}}>{children}</span>;
const ErrBox = ({ msg }) => msg
  ? <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:".75rem 1rem",marginBottom:12,fontSize:13,color:"#dc2626"}}>⚠️ {msg}</div>
  : null;
const Loader = () => (
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"5rem 2rem",gap:20}}>
    <div style={{position:"relative",width:60,height:60}}>
      <div style={{position:"absolute",inset:0,border:"4px solid #e0e7ff",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
      <div style={{position:"absolute",inset:8,border:"3px solid #f0e6ff",borderBottomColor:"#7c3aed",borderRadius:"50%",animation:"spin 1.2s linear infinite reverse"}}/>
    </div>
    <p style={{margin:0,fontWeight:700,fontSize:15,color:"#1e1b4b"}}>L'IA travaille…</p>
  </div>
);
const Field = ({ label, type="text", value, onChange, placeholder }) => (
  <div style={{marginBottom:14}}>
    <Lbl>{label}</Lbl>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{width:"100%",padding:".8rem 1rem",border:`2px solid ${value?"#4f46e5":"#e5e7eb"}`,borderRadius:10,fontSize:16,color:"#111827",WebkitTextSizeAdjust:"100%"}}/>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// LANDING
// ─────────────────────────────────────────────────────────────────────────────
function Landing({ onStart }) {
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0f0c29 0%,#302b63 55%,#1a1040 100%)"}}>
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1.25rem 2rem",position:"sticky",top:0,zIndex:10,background:"rgba(15,12,41,.88)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(99,102,241,.2)"}}>
        <span style={{fontSize:22,fontWeight:900,color:"white",letterSpacing:"-0.04em"}}>EduCorrect <span style={{background:"#312e81",color:"#a5b4fc",fontSize:10,padding:"2px 7px",borderRadius:6,fontWeight:700}}>IA</span></span>
        <button onClick={onStart} style={{background:"white",color:"#4f46e5",border:"none",borderRadius:10,padding:".6rem 1.4rem",fontWeight:700,cursor:"pointer",fontSize:14}}>Connexion →</button>
      </nav>
      <div style={{textAlign:"center",padding:"5rem 1.5rem 3.5rem"}}>
        <div style={{display:"inline-block",background:"rgba(99,102,241,.2)",border:"1px solid rgba(165,180,252,.3)",borderRadius:20,padding:".4rem 1rem",fontSize:12,fontWeight:700,color:"#a5b4fc",marginBottom:"1.75rem",letterSpacing:".06em"}}>
          🇸🇳 Programme officiel sénégalais (MENFP) · Du CI au BAC
        </div>
        <h1 style={{fontSize:"clamp(2rem,8vw,4.2rem)",fontWeight:900,color:"white",lineHeight:1.15,margin:"0 0 1.25rem",letterSpacing:"-0.03em"}}>
          Ton prof particulier IA<br/>
          <span style={{background:"linear-gradient(135deg,#a5b4fc,#f0abfc)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>disponible 24h/24</span>
        </h1>
        <p style={{fontSize:"1.1rem",color:"#c7d2fe",maxWidth:540,margin:"0 auto 2.5rem",lineHeight:1.8}}>
          Génère des exercices du programme sénégalais, reçois des corrections détaillées et demande à l'IA de t'expliquer n'importe quel cours comme un vrai professeur.
        </p>
        <button onClick={onStart} style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"white",border:"none",borderRadius:14,padding:"1.1rem 2.75rem",fontSize:17,fontWeight:800,cursor:"pointer",boxShadow:"0 8px 30px rgba(79,70,229,.5)"}}>
          Commencer gratuitement →
        </button>
        <p style={{color:"#818cf8",fontSize:12,marginTop:12}}>Gratuit · Sans carte bancaire</p>
      </div>
      <div style={{maxWidth:960,margin:"0 auto",padding:"0 1.5rem 5rem",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:16}}>
        {[
          ["🤖","Exercices IA","Génère des exercices adaptés au programme sénégalais, de la CI à la Terminale."],
          ["💬","Tuteur IA","Pose n'importe quelle question. Le Prof IA explique étape par étape jusqu'à ce que tu comprennes."],
          ["📄","Upload d'exercices","Téléverse un exercice de classe (PDF, photo) et reçois une correction détaillée."],
          ["🔒","Correction à 15/20","La correction complète se débloque dès 15/20 — un vrai incentive à progresser."],
          ["📚","Ressources gratuites","Vidéos, annales BAC, sites pédagogiques pour chaque matière."],
          ["📊","Tableau de bord","Suis ta progression, tes scores et ton streak de révision quotidien."],
        ].map(([i,t,d])=>(
          <div key={t} style={{background:"rgba(255,255,255,.06)",borderRadius:16,padding:"1.5rem",border:"1px solid rgba(165,180,252,.12)"}}>
            <div style={{fontSize:32,marginBottom:10}}>{i}</div>
            <h3 style={{margin:"0 0 8px",fontSize:16,fontWeight:700,color:"white"}}>{t}</h3>
            <p style={{margin:0,fontSize:13,color:"#a5b4fc",lineHeight:1.65}}>{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────
function AuthScreen({ onSuccess, onBack }) {
  const [mode,setMode] = useState("login");
  const [f,setF]       = useState({ name:"", email:"", pw:"", pw2:"" });
  const [err,setErr]   = useState(""); const [busy,setBusy] = useState(false);
  const set = k => e => setF(p=>({...p,[k]:e.target.value}));
  const go  = async () => {
    setErr(""); setBusy(true);
    try {
      if (mode==="register") {
        if (!f.name.trim())           throw new Error("Entre ton prénom.");
        if (!f.email.includes("@"))   throw new Error("Email invalide.");
        if (f.pw.length<6)            throw new Error("Mot de passe : 6 caractères min.");
        if (f.pw!==f.pw2)             throw new Error("Les mots de passe ne correspondent pas.");
        const u = registerUser({ name:f.name.trim(), email:f.email.trim(), password:f.pw, level:"", series:null });
        onSuccess(u, !u.isAdmin);
      } else {
        if (!f.email||!f.pw) throw new Error("Remplis tous les champs.");
        const u = loginUser({ email:f.email.trim(), password:f.pw });
        onSuccess(u, !u.isAdmin && !u.level);
      }
    } catch(e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div style={{minHeight:"100vh",background:"#f5f3ff",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:"2rem"}}>
          <div style={{fontSize:48,marginBottom:8}}>🎓</div>
          <h1 style={{fontSize:26,fontWeight:900,color:"#1e1b4b",margin:"0 0 6px"}}>EduCorrect</h1>
          <p style={{color:"#6b7280",margin:0,fontSize:14}}>{mode==="login"?"Connecte-toi":"Crée ton compte gratuit"}</p>
        </div>
        <div className="card">
          <div style={{display:"flex",background:"#f3f4f6",borderRadius:10,padding:4,marginBottom:"1.5rem"}}>
            {["login","register"].map(m=>(
              <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:".5rem",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,fontSize:14,background:mode===m?"white":"transparent",color:mode===m?"#4f46e5":"#6b7280",boxShadow:mode===m?"0 1px 4px rgba(0,0,0,.08)":"none"}}>
                {m==="login"?"Connexion":"Inscription"}
              </button>
            ))}
          </div>
          {mode==="register" && <Field label="Prénom" value={f.name} onChange={set("name")} placeholder="Mamadou…"/>}
          <Field label="Email" type="email" value={f.email} onChange={set("email")} placeholder="exemple@gmail.com"/>
          <Field label="Mot de passe" type="password" value={f.pw} onChange={set("pw")} placeholder="6 caractères min"/>
          {mode==="register" && <Field label="Confirmer" type="password" value={f.pw2} onChange={set("pw2")} placeholder="Répète le mot de passe"/>}
          <ErrBox msg={err}/>
          <PBtn onClick={go} disabled={busy}>{busy?"…":mode==="login"?"Se connecter →":"Créer mon compte →"}</PBtn>
        </div>
        <button onClick={onBack} style={{display:"block",margin:"1rem auto 0",background:"none",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:13}}>← Retour</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────────────────────────────────────────
function Onboarding({ user, onDone }) {
  const [step,setStep]     = useState(0);
  const [level,setLevel]   = useState("");
  const [series,setSeries] = useState("");
  const groups = [...new Set(LEVELS.map(l=>l.group))];
  const need   = hasSeriesChoice(level);
  const finish = () => { updateUser({...user,level,series:need?series:null}); onDone({...user,level,series:need?series:null}); };
  return (
    <div style={{minHeight:"100vh",background:"#f5f3ff",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
      <div style={{width:"100%",maxWidth:500}}>
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:"2rem"}}>
          {Array.from({length:(need?2:1)+1}).map((_,i)=>(
            <div key={i} style={{width:i===step?24:8,height:8,borderRadius:4,background:i<=step?"#4f46e5":"#e0e7ff",transition:"all .3s"}}/>
          ))}
        </div>
        {step===0 && (
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
                    <button key={l.id} onClick={()=>setLevel(l.id)} style={{padding:".5rem .9rem",minHeight:44,borderRadius:8,border:`2px solid ${level===l.id?"#4f46e5":"#e5e7eb"}`,background:level===l.id?"#eef2ff":"white",color:level===l.id?"#4f46e5":"#374151",fontWeight:level===l.id?700:400,cursor:"pointer",fontSize:14}}>{l.label}</button>
                  ))}
                </div>
              </div>
            ))}
            <PBtn onClick={()=>need?setStep(1):finish()} disabled={!level} s={{marginTop:8}}>{need?"Continuer →":"C'est parti →"}</PBtn>
          </div>
        )}
        {step===1 && need && (
          <div className="card anim">
            <div style={{textAlign:"center",marginBottom:"1.5rem"}}><div style={{fontSize:40,marginBottom:8}}>📋</div>
              <h2 style={{fontSize:22,fontWeight:900,color:"#1e1b4b",margin:"0 0 4px"}}>Ta série</h2>
              <p style={{color:"#6b7280",margin:0,fontSize:14}}>Classe de <strong>{level}</strong></p>
            </div>
            {(SERIES_BY_LEVEL[level]||[]).map(s=>(
              <button key={s.id} onClick={()=>setSeries(s.id)} style={{display:"block",width:"100%",padding:"1rem",marginBottom:10,borderRadius:12,border:`2px solid ${series===s.id?"#4f46e5":"#e5e7eb"}`,background:series===s.id?"#eef2ff":"white",color:series===s.id?"#4f46e5":"#374151",fontWeight:series===s.id?700:400,cursor:"pointer",textAlign:"left",fontSize:15}}>{s.label}</button>
            ))}
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button onClick={()=>setStep(0)} style={{flex:1,padding:"1rem",border:"2px solid #e5e7eb",borderRadius:12,background:"white",cursor:"pointer",fontWeight:600,color:"#374151"}}>← Retour</button>
              <PBtn onClick={finish} disabled={!series} s={{flex:2}}>C'est parti →</PBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP SHELL
// ─────────────────────────────────────────────────────────────────────────────
function Shell({ user, tab, setTab, children }) {
  const nav = [
    { id:"dashboard",  ic:"📊", lb:"Accueil"   },
    { id:"exercises",  ic:"✏️",  lb:"Exercices" },
    { id:"tutor",      ic:"💬", lb:"Prof IA"   },
    { id:"resources",  ic:"📚", lb:"Ressources"},
    { id:"profile",    ic:"👤", lb:"Profil"    },
  ];
  if (user.isAdmin) nav.push({ id:"admin", ic:"🛡", lb:"Admin" });
  return (
    <div style={{minHeight:"100vh",background:"#f5f3ff"}}>
      {/* Header */}
      <div style={{background:"#1e1b4b",padding:".875rem 1.25rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18,fontWeight:900,color:"white",letterSpacing:"-0.04em"}}>EduCorrect</span>
          <span style={{background:"#312e81",color:"#a5b4fc",fontSize:10,padding:"2px 7px",borderRadius:6,fontWeight:700}}>IA</span>
          {user.isAdmin && <span style={{background:"#7c3aed",color:"#f0abfc",fontSize:10,padding:"2px 7px",borderRadius:6,fontWeight:700}}>ADMIN</span>}
        </div>
        {/* Desktop nav */}
        <div className="hide-m" style={{display:"flex",gap:4}}>
          {nav.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)} style={{padding:".45rem .875rem",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,fontSize:13,background:tab===n.id?"rgba(255,255,255,.15)":"transparent",color:tab===n.id?"white":"rgba(255,255,255,.6)"}}>
              {n.ic} {n.lb}
            </button>
          ))}
        </div>
        <div style={{width:34,height:34,borderRadius:"50%",background:user.isAdmin?"#7c3aed":"#4f46e5",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:800,fontSize:14,flexShrink:0}}>
          {user.name[0]?.toUpperCase()}
        </div>
      </div>
      {children}
      {/* Mobile bottom nav */}
      <nav className="bnav">
        {nav.map(n=>(
          <button key={n.id} className={`bni${tab===n.id?" on":""}`} onClick={()=>setTab(n.id)}>
            <span className="bni-ic">{n.ic}</span>
            <span className="bni-lb">{n.lb}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function DashboardTab({ user, goExercises, goTutor }) {
  const st = getStats(user.id);
  return (
    <div className="pg anim">
      {/* Welcome hero */}
      <div style={{background:"linear-gradient(135deg,#1e1b4b,#4f46e5)",borderRadius:20,padding:"1.5rem",marginBottom:16,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-20,top:-20,fontSize:80,opacity:.08}}>🎓</div>
        <p style={{margin:"0 0 4px",color:"#a5b4fc",fontSize:13,fontWeight:600}}>Bonjour 👋</p>
        <h2 style={{margin:"0 0 8px",color:"white",fontSize:24,fontWeight:900}}>{user.name}</h2>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          <Pill bg="rgba(255,255,255,.15)" color="white">{user.level||"—"}</Pill>
          {user.series && <Pill bg="rgba(255,255,255,.1)" color="#c7d2fe">Série {user.series}</Pill>}
        </div>
      </div>
      {/* Stats */}
      <div className="g3" style={{marginBottom:16}}>
        {[{n:st.total,l:"Exercices",c:"#4f46e5"},{n:st.avg,l:"Moyenne /20",c:"#10b981"},{n:`${st.streak}j`,l:"Streak",c:"#f59e0b"}].map(s=>(
          <div key={s.l} className="card" style={{textAlign:"center",padding:"1rem .5rem"}}>
            <div style={{fontSize:22,fontWeight:900,color:s.c}}>{s.n}</div>
            <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>
      {/* Score chart */}
      {st.recent.length>0 && (
        <div className="card" style={{marginBottom:16}}>
          <p style={{margin:"0 0 12px",fontWeight:700,fontSize:14,color:"#1e1b4b"}}>📈 Derniers scores</p>
          <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80}}>
            {st.recent.map((e,i)=>{
              const h=Math.max(4,(e.score/20)*80); const c=e.score>=15?"#10b981":e.score>=10?"#f59e0b":"#ef4444";
              return <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><span style={{fontSize:9,color:c,fontWeight:700}}>{e.score}</span><div style={{width:"100%",height:h,background:c,borderRadius:"4px 4px 0 0"}}/></div>;
            })}
          </div>
        </div>
      )}
      {/* By subject */}
      {Object.keys(st.bySubject).length>0 && (
        <div className="card" style={{marginBottom:16}}>
          <p style={{margin:"0 0 12px",fontWeight:700,fontSize:14,color:"#1e1b4b"}}>📚 Par matière</p>
          {Object.entries(st.bySubject).map(([id,s])=>{
            const sj=SUBJECTS.find(x=>x.id===id); const pct=Math.round((parseFloat(s.avg)/20)*100);
            return (
              <div key={id} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>{sj?.sym} {s.label}</span>
                  <span style={{fontSize:13,fontWeight:700,color:parseFloat(s.avg)>=15?"#10b981":parseFloat(s.avg)>=10?"#f59e0b":"#ef4444"}}>{s.avg}/20</span>
                </div>
                <div style={{background:"#f3f4f6",borderRadius:99,height:6,overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,height:"100%",background:"linear-gradient(90deg,#4f46e5,#7c3aed)",borderRadius:99}}/>
                </div>
                <span style={{fontSize:10,color:"#9ca3af"}}>{s.count} ex.</span>
              </div>
            );
          })}
        </div>
      )}
      {st.total===0 && (
        <div style={{textAlign:"center",padding:"2rem 1rem"}}>
          <div style={{fontSize:56,marginBottom:12}}>✏️</div>
          <h3 style={{fontSize:18,fontWeight:800,color:"#1e1b4b",margin:"0 0 8px"}}>Commence ta première révision !</h3>
          <p style={{color:"#6b7280",fontSize:14,margin:"0 0 1.5rem"}}>L'IA va générer un exercice adapté à ton niveau sénégalais.</p>
          <div style={{display:"flex",gap:10,maxWidth:380,margin:"0 auto"}}>
            <PBtn onClick={goExercises} s={{flex:2}}>Faire un exercice →</PBtn>
            <button onClick={goTutor} style={{flex:1,padding:"1rem",border:"2px solid #e0e7ff",borderRadius:12,background:"white",color:"#4f46e5",fontWeight:700,cursor:"pointer",fontSize:14}}>Prof IA 💬</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TUTEUR IA — page dédiée complète
// ─────────────────────────────────────────────────────────────────────────────
function TutorPage({ user }) {
  // Phase : "home" | "setup" | "chat"
  const [phase,    setPhase]   = useState("home");
  const [subject,  setSubject] = useState(null);   // objet SUBJECTS
  const [topic,    setTopic]   = useState("");
  const [customLvl,setCustomLvl] = useState(user.level||"");  // pour l'admin
  const [messages, setMsgs]    = useState([]);
  const [input,    setInput]   = useState("");
  const [busy,     setBusy]    = useState(false);
  const [errMsg,   setErrMsg]  = useState("");
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  const effectiveLevel = user.isAdmin ? (customLvl||user.level||"3ème") : (user.level||"3ème");
  const available = getSubjectsForStudent(effectiveLevel, user.series);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  // Prompt système du prof
  const SYSTEM = () =>
    `Tu es un professeur au Sénégal, expert en ${subject?.label||"toutes matières"} pour le niveau ${effectiveLevel}${user.series?` Série ${user.series}`:""}.
Programme : MENFP Sénégal.
Tu abordes le thème : "${topic||"question libre"}".

Ton style d'enseignement :
• Explique TOUJOURS étape par étape, ne saute aucune étape
• Utilise des exemples du quotidien sénégalais (marché Sandaga, agriculture, football, Tabaski…)
• Si l'élève ne comprend pas, reformule avec une AUTRE approche ou analogie
• Pour maths/physique : montre TOUS les calculs intermédiaires
• Termine chaque explication par une question courte de vérification
• Encourage sincèrement, ne décourage JAMAIS
• Réponds en français (sauf si la matière est Anglais)
• Sois concis mais complet — 200 à 400 mots max par réponse
• Si l'élève dit "je ne comprends toujours pas" ou "encore", reformule complètement différemment`;

  const buildMessages = (history, newText) => {
    const trimmed = history.slice(-8); // garde 8 derniers échanges
    if (trimmed.length === 0) {
      return [{ role:"user", content:`[PROFESSEUR IA — INSTRUCTIONS]:\n${SYSTEM()}\n\n---\nQuestion de l'élève : ${newText}` }];
    }
    const [first, ...rest] = trimmed;
    return [
      { role:"user",      content:`[PROFESSEUR IA — INSTRUCTIONS]:\n${SYSTEM()}\n\n---\nQuestion : ${first.content}` },
      ...rest.map(m => ({ role:m.role, content:m.content })),
      { role:"user",      content: newText },
    ];
  };

  const startSession = () => {
    if (!subject || !topic.trim()) return;
    setMsgs([]);
    setErrMsg("");
    setPhase("chat");
    // Message d'accueil automatique de l'IA
    setTimeout(() => sendAutoWelcome(), 100);
  };

  const sendAutoWelcome = async () => {
    setBusy(true);
    try {
      const prompt = `[PROFESSEUR IA — INSTRUCTIONS]:\n${SYSTEM()}\n\n---\nPrésente-toi en 2 phrases et explique ce que vous allez apprendre ensemble sur "${topic}". Pose une première question simple pour évaluer ce que l'élève sait déjà.`;
      const reply = await callClaude([{ role:"user", content:prompt }]);
      setMsgs([{ role:"assistant", content:reply }]);
    } catch(e) { setErrMsg(e.message); }
    finally { setBusy(false); setTimeout(() => inputRef.current?.focus(), 100); }
  };

  const send = async () => {
    const text = input.trim(); if (!text || busy) return;
    setInput("");
    const prev = [...messages];
    setMsgs(p => [...p, { role:"user", content:text }]);
    setBusy(true);
    setErrMsg("");
    try {
      const reply = await callClaude(buildMessages(prev, text));
      setMsgs(p => [...p, { role:"assistant", content:reply }]);
    } catch(e) {
      setErrMsg(e.message);
      setMsgs(p => [...p, { role:"assistant", content:`⚠️ ${e.message}` }]);
    } finally { setBusy(false); setTimeout(() => inputRef.current?.focus(), 100); }
  };

  // ── HOME ─────────────────────────────────────────────────────────────────
  if (phase === "home") return (
    <div className="pg anim">
      {/* Hero banner */}
      <div style={{background:"linear-gradient(135deg,#312e81,#4f46e5)",borderRadius:20,padding:"1.75rem",marginBottom:20,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-10,bottom:-10,fontSize:90,opacity:.09}}>🎓</div>
        <h2 style={{margin:"0 0 8px",color:"white",fontSize:22,fontWeight:900}}>💬 Prof IA</h2>
        <p style={{margin:"0 0 16px",color:"#c7d2fe",fontSize:14,lineHeight:1.65}}>
          Ton professeur particulier IA est disponible à toute heure. Choisis une matière, un thème, et il t'explique étape par étape jusqu'à ce que tu comprennes vraiment.
        </p>
        <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
          {["📖 Cours & explications","🔢 Résolution de problèmes","✏️ Aide sur un exercice","💡 Mémorisation"].map(t=>(
            <span key={t} style={{background:"rgba(255,255,255,.15)",color:"#e0e7ff",fontSize:12,fontWeight:600,padding:".35rem .75rem",borderRadius:20}}>{t}</span>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="card" style={{marginBottom:20}}>
        <h3 style={{fontSize:15,fontWeight:800,color:"#1e1b4b",margin:"0 0 14px"}}>Comment ça marche</h3>
        {[
          ["1","Choisis la matière","Sélectionne la matière que tu veux travailler"],
          ["2","Indique le thème","Précise le chapitre ou la notion que tu veux comprendre"],
          ["3","Discute avec le Prof IA","Pose toutes tes questions — il reformule jusqu'à ce que tu comprennes"],
        ].map(([n,t,d])=>(
          <div key={n} style={{display:"flex",gap:14,marginBottom:14,alignItems:"flex-start"}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"white",fontWeight:800,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{n}</div>
            <div><p style={{margin:"0 0 2px",fontWeight:700,fontSize:14,color:"#1e1b4b"}}>{t}</p><p style={{margin:0,fontSize:13,color:"#6b7280"}}>{d}</p></div>
          </div>
        ))}
      </div>

      <button onClick={()=>setPhase("setup")} style={{width:"100%",padding:"1.1rem",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"white",border:"none",borderRadius:14,fontSize:17,fontWeight:800,cursor:"pointer",boxShadow:"0 6px 20px rgba(79,70,229,.35)"}}>
        Commencer une session →
      </button>
    </div>
  );

  // ── SETUP ────────────────────────────────────────────────────────────────
  if (phase === "setup") return (
    <div className="pg anim">
      <BkBtn onClick={()=>setPhase("home")}/>
      <h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px"}}>Nouvelle session avec le Prof IA</h2>
      <p style={{color:"#6b7280",fontSize:14,margin:"0 0 1.5rem"}}>Choisis ce que tu veux apprendre</p>

      {/* Admin : niveau custom */}
      {user.isAdmin && (
        <div className="card" style={{marginBottom:14,background:"#faf5ff",border:"1px solid #e9d5ff"}}>
          <p style={{margin:"0 0 10px",fontSize:12,fontWeight:700,color:"#7c3aed",textTransform:"uppercase",letterSpacing:".06em"}}>🛡 Mode Admin — Niveau d'enseignement</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {LEVELS.map(l=>(
              <button key={l.id} onClick={()=>setCustomLvl(l.id)} style={{padding:".4rem .8rem",minHeight:38,borderRadius:8,border:`2px solid ${customLvl===l.id?"#7c3aed":"#e9d5ff"}`,background:customLvl===l.id?"#f5f3ff":"white",color:customLvl===l.id?"#7c3aed":"#374151",fontWeight:customLvl===l.id?700:400,cursor:"pointer",fontSize:13}}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Matière */}
      <div className="card" style={{marginBottom:14}}>
        <Lbl>Matière</Lbl>
        <div className="g2">
          {available.map(s=>(
            <button key={s.id} onClick={()=>setSubject(s)} style={{padding:".875rem",borderRadius:12,border:`2px solid ${subject?.id===s.id?s.color:"#e5e7eb"}`,background:subject?.id===s.id?s.bg:"white",cursor:"pointer",display:"flex",alignItems:"center",gap:10,transition:"all .15s"}}>
              <div style={{width:34,height:34,borderRadius:9,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:s.color,flexShrink:0}}>{s.sym}</div>
              <span style={{fontWeight:600,fontSize:13,color:subject?.id===s.id?s.color:"#374151"}}>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Thème */}
      {subject && (
        <div className="card anim" style={{marginBottom:14}}>
          <Lbl>Thème ou chapitre à étudier</Lbl>
          {/* Suggestions */}
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
            {getTopicsForStudent(subject.id, effectiveLevel, user.series).slice(0,8).map(t=>(
              <button key={t} onClick={()=>setTopic(t)} style={{padding:".45rem .875rem",borderRadius:20,border:`2px solid ${topic===t?subject.color:"#e5e7eb"}`,background:topic===t?subject.bg:"white",color:topic===t?subject.color:"#374151",fontWeight:topic===t?700:400,cursor:"pointer",fontSize:13}}>
                {t}
              </button>
            ))}
          </div>
          <input value={topic} onChange={e=>setTopic(e.target.value)} placeholder={`Ex: ${getTopicsForStudent(subject.id,effectiveLevel,user.series)[0]||"Thème personnalisé"}…`}
            style={{width:"100%",padding:".8rem 1rem",border:`2px solid ${topic?subject.color:"#e5e7eb"}`,borderRadius:10,fontSize:15,WebkitTextSizeAdjust:"100%"}}/>
        </div>
      )}

      <PBtn onClick={startSession} disabled={!subject||!topic.trim()} s={{background:subject&&topic?"linear-gradient(135deg,#059669,#10b981)":"#e5e7eb",boxShadow:subject&&topic?"0 4px 14px rgba(16,185,129,.32)":"none"}}>
        Démarrer la session avec le Prof IA 🎓
      </PBtn>
    </div>
  );

  // ── CHAT ─────────────────────────────────────────────────────────────────
  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 64px)"}}>
      {/* Chat header */}
      <div style={{background:"white",borderBottom:"1px solid #e5e7eb",padding:".875rem 1.25rem",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12,maxWidth:760,margin:"0 auto"}}>
          <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🎓</div>
          <div style={{flex:1,minWidth:0}}>
            <h2 style={{margin:0,fontSize:15,fontWeight:800,color:"#1e1b4b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              Prof IA — {subject?.label} · {topic}
            </h2>
            <p style={{margin:0,fontSize:12,color:"#10b981",fontWeight:600}}>● En ligne · {effectiveLevel}{user.series?` · Série ${user.series}`:""}</p>
          </div>
          <div style={{display:"flex",gap:8,flexShrink:0}}>
            <button onClick={()=>{setPhase("setup");setMsgs([]);setErrMsg("");}} style={{background:"none",border:"1px solid #e5e7eb",borderRadius:8,padding:".35rem .75rem",cursor:"pointer",fontSize:12,color:"#6b7280",whiteSpace:"nowrap"}}>
              ← Changer
            </button>
            <button onClick={()=>{setPhase("home");setMsgs([]);setErrMsg("");setSubject(null);setTopic("");}} style={{background:"none",border:"1px solid #e5e7eb",borderRadius:8,padding:".35rem .75rem",cursor:"pointer",fontSize:12,color:"#6b7280",whiteSpace:"nowrap"}}>
              Accueil
            </button>
          </div>
        </div>
        {errMsg && <p style={{margin:"8px auto 0",maxWidth:760,fontSize:12,color:"#dc2626",background:"#fef2f2",padding:".5rem .875rem",borderRadius:8}}>⚠️ {errMsg}</p>}
      </div>

      {/* Messages */}
      <div className="chat-area">
        {messages.length===0 && !busy && (
          <div style={{textAlign:"center",padding:"3rem 1rem",color:"#9ca3af"}}>
            <div style={{fontSize:40,marginBottom:8}}>🎓</div>
            <p style={{fontSize:14}}>Le professeur prépare ton cours…</p>
          </div>
        )}
        {messages.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",alignItems:"flex-end",gap:8}}>
            {m.role==="assistant" && (
              <div style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0,marginBottom:2}}>🎓</div>
            )}
            <div className={m.role==="user"?"msg-user":"msg-ai"}>{m.content}</div>
          </div>
        ))}
        {busy && (
          <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
            <div style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>🎓</div>
            <div className="msg-ai" style={{display:"flex",gap:5,alignItems:"center",padding:".875rem 1.1rem"}}>
              {[0,.18,.36].map((d,i)=>(
                <div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#c7d2fe",animation:`spin .8s ${d}s ease-in-out infinite`}}/>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Quick replies */}
      <div style={{background:"white",borderTop:"1px solid #f3f4f6",padding:".5rem 1.25rem 0",flexShrink:0,maxWidth:760,width:"100%",margin:"0 auto"}}>
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:".5rem"}}>
          {["Je n'ai pas compris, réexplique","Donne-moi un exemple concret","Résume en 3 points","Donne-moi un exercice simple sur ce thème"].map(q=>(
            <button key={q} onClick={()=>{ setInput(q); inputRef.current?.focus(); }} style={{flexShrink:0,padding:".4rem .875rem",borderRadius:20,border:"1px solid #e0e7ff",background:"#f5f3ff",color:"#4f46e5",cursor:"pointer",fontSize:12,fontWeight:500,whiteSpace:"nowrap"}}>
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div style={{background:"white",borderTop:"1px solid #e5e7eb",padding:".875rem 1.25rem",flexShrink:0}}>
        <div style={{display:"flex",gap:10,maxWidth:760,margin:"0 auto"}}>
          <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();} }}
            placeholder="Pose ta question… (Entrée pour envoyer)"
            rows={2}
            style={{flex:1,padding:".75rem 1rem",border:"2px solid #e0e7ff",borderRadius:12,fontSize:15,resize:"none",lineHeight:1.5,WebkitTextSizeAdjust:"100%"}}
          />
          <button onClick={send} disabled={!input.trim()||busy}
            style={{width:50,flexShrink:0,background:input.trim()&&!busy?"linear-gradient(135deg,#4f46e5,#7c3aed)":"#e5e7eb",border:"none",borderRadius:12,cursor:input.trim()&&!busy?"pointer":"not-allowed",fontSize:22,color:"white",transition:"all .15s"}}>
            ↑
          </button>
        </div>
        <p style={{textAlign:"center",fontSize:10,color:"#d1d5db",margin:"5px 0 0"}}>L'IA peut faire des erreurs. Pour les examens, vérifie avec ton manuel.</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOURCES
// ─────────────────────────────────────────────────────────────────────────────
function ResourcesTab({ user }) {
  const [sel,setSel] = useState(null);
  const available   = getSubjectsForStudent(user.level||"3ème", user.series);
  const RES_KEY     = { mathematiques:"mathematiques",physique:"physique",svt:"svt",francais:"francais",histoire:"histoire",anglais:"anglais",philosophie:"philosophie",informatique:"informatique",sciences:"sciences",emc:"emc",eco:"eco" };

  if (sel) {
    const sj  = SUBJECTS.find(s=>s.id===sel);
    const res = RESOURCES[RES_KEY[sel]] || [];
    const vids = res.filter(r=>r.type==="video"), webs = res.filter(r=>r.type==="web"), pdfs = res.filter(r=>r.type==="pdf");
    const Sec = ({ items, icon, label }) => items.length===0 ? null : (
      <div style={{marginBottom:16}}>
        <p style={{margin:"0 0 8px",fontSize:12,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:".06em"}}>{icon} {label} ({items.length})</p>
        {items.map((r,i)=>(
          <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
            style={{display:"block",textDecoration:"none",marginBottom:9}}>
            <div style={{background:"white",borderRadius:14,padding:"1rem",border:"1px solid #e5e7eb",display:"flex",alignItems:"flex-start",gap:12,transition:"all .15s"}}>
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
    return (
      <div className="pg anim">
        <BkBtn onClick={()=>setSel(null)} label={`← ${sj?.label}`}/>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:"1.5rem"}}>
          <div style={{width:44,height:44,borderRadius:10,background:sj?.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:sj?.color,flexShrink:0}}>{sj?.sym}</div>
          <div><h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:0}}>{sj?.label}</h2>
            <p style={{margin:0,fontSize:13,color:"#9ca3af"}}>{res.length} ressources gratuites · {user.level}</p></div>
        </div>
        <Sec items={vids} icon="▶️" label="Vidéos YouTube"/>
        <Sec items={webs} icon="🌐" label="Sites & cours en ligne"/>
        <Sec items={pdfs} icon="📄" label="Documents PDF"/>
        <div style={{background:"#fffbeb",borderRadius:12,padding:"1rem",border:"1px solid #fde68a",marginTop:4}}>
          <p style={{margin:0,fontSize:12,color:"#92400e",lineHeight:1.6}}>💡 Ressources gratuites. Si un lien ne fonctionne pas, recherche directement le titre dans YouTube ou Google.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pg anim">
      <h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px"}}>📚 Ressources gratuites</h2>
      <p style={{color:"#6b7280",fontSize:14,margin:"0 0 1.5rem"}}>Vidéos, cours, annales BAC — programme sénégalais</p>
      <div className="g2">
        {available.map(s=>{
          const count = (RESOURCES[RES_KEY[s.id]]||[]).length;
          return (
            <button key={s.id} onClick={()=>setSel(s.id)} style={{padding:"1.1rem",minHeight:80,background:"white",border:"2px solid #e5e7eb",borderRadius:14,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
              <div style={{width:40,height:40,borderRadius:10,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:800,color:s.color,flexShrink:0}}>{s.sym}</div>
              <div><p style={{margin:0,fontWeight:700,fontSize:13,color:"#1e1b4b"}}>{s.label}</p>
                <p style={{margin:0,fontSize:11,color:"#9ca3af"}}>{count} ressource{count!==1?"s":""}</p></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────
function ProfileTab({ user, onLogout, onUpdate }) {
  const [editing,setEditing] = useState(false); const [name,setName] = useState(user.name);
  const st = getStats(user.id);
  const save = () => { onUpdate(updateUser({...user,name:name.trim()||user.name})); setEditing(false); };
  return (
    <div className="pg anim">
      <h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:"0 0 1.5rem"}}>👤 Mon profil</h2>
      <div className="card" style={{marginBottom:14,textAlign:"center"}}>
        <div style={{width:70,height:70,borderRadius:"50%",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:28,fontWeight:900,color:"white"}}>{user.name[0]?.toUpperCase()}</div>
        {editing ? (
          <>
            <input value={name} onChange={e=>setName(e.target.value)} style={{width:"100%",padding:".65rem 1rem",border:"2px solid #4f46e5",borderRadius:8,fontSize:16,textAlign:"center",marginBottom:10,WebkitTextSizeAdjust:"100%"}}/>
            <div style={{display:"flex",gap:8}}><button onClick={()=>setEditing(false)} style={{flex:1,padding:".75rem",border:"2px solid #e5e7eb",borderRadius:10,background:"white",cursor:"pointer"}}>Annuler</button><PBtn onClick={save} s={{flex:2}}>Enregistrer</PBtn></div>
          </>
        ) : (
          <>
            <h3 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px"}}>{user.name}</h3>
            <p style={{color:"#6b7280",margin:"0 0 8px",fontSize:14}}>{user.email}</p>
            <div style={{display:"flex",justifyContent:"center",flexWrap:"wrap",gap:8,marginBottom:12}}>
              <Pill bg="#eef2ff" color="#4f46e5">{user.level||"—"}</Pill>
              {user.series && <Pill bg="#f5f3ff" color="#7c3aed">Série {user.series}</Pill>}
            </div>
            <button onClick={()=>setEditing(true)} style={{background:"none",border:"1px solid #e5e7eb",borderRadius:8,padding:".5rem 1rem",cursor:"pointer",color:"#6b7280",fontSize:13}}>✏️ Modifier le prénom</button>
          </>
        )}
      </div>
      <div className="g2" style={{marginBottom:14}}>
        {[{n:st.total,l:"Exercices",c:"#4f46e5"},{n:st.avg,l:"Moyenne /20",c:"#10b981"},{n:st.best,l:"Meilleur",c:"#f59e0b"},{n:`${st.streak}j`,l:"Streak",c:"#ef4444"}].map(s=>(
          <div key={s.l} className="card" style={{textAlign:"center",padding:"1rem .75rem"}}>
            <div style={{fontSize:22,fontWeight:900,color:s.c,marginBottom:2}}>{s.n}</div>
            <div style={{fontSize:11,color:"#9ca3af"}}>{s.l}</div>
          </div>
        ))}
      </div>
      <button onClick={onLogout} style={{width:"100%",padding:"1rem",border:"2px solid #fecaca",borderRadius:12,background:"#fef2f2",color:"#dc2626",fontWeight:700,cursor:"pointer",fontSize:15,marginBottom:12}}>Se déconnecter</button>
      <p style={{textAlign:"center",fontSize:11,color:"#d1d5db"}}>EduCorrect · Programme MENFP Sénégal · Propulsé par Claude AI</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN DASHBOARD — accès complet à toutes les classes et données
// ─────────────────────────────────────────────────────────────────────────────
function AdminTab({ adminUser }) {
  const [view,    setView]    = useState("stats");   // "stats" | "users" | "classroom"
  const [selUser, setSelUser] = useState(null);
  const [classLvl,setClassLvl]= useState("Terminale");
  const [classSer,setClassSer]= useState("S");
  const [search,  setSearch]  = useState("");

  const allUsers = getAllUsersForAdmin().filter(u => !isAdminEmail(u.email));

  // Global stats
  const totalEx    = allUsers.reduce((a,u)=>{ try{return a+(getProgress(u.id).exercises?.length||0);}catch{return a;} },0);
  const allScores  = allUsers.flatMap(u=>{ try{return getProgress(u.id).exercises?.map(e=>e.score)||[];}catch{return [];} });
  const globalAvg  = allScores.length ? (allScores.reduce((a,b)=>a+b,0)/allScores.length).toFixed(1) : "—";
  const todayStr   = new Date().toISOString().split("T")[0];
  const activeToday= allUsers.filter(u=>{ try{return getProgress(u.id).lastStudyDate===todayStr;}catch{return false;} }).length;
  const by15       = allScores.filter(s=>s>=15).length;
  const pct15      = allScores.length ? Math.round(by15/allScores.length*100) : 0;

  // By level distribution
  const byLevel = {};
  allUsers.forEach(u=>{ const k=u.level||"Non défini"; byLevel[k]=(byLevel[k]||0)+1; });

  const TAB_BTN = (id,label) => (
    <button onClick={()=>setView(id)} style={{padding:".6rem 1.1rem",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,fontSize:13,background:view===id?"#4f46e5":"#f3f4f6",color:view===id?"white":"#374151"}}>
      {label}
    </button>
  );

  if (selUser) {
    const st  = getStats(selUser.id);
    const pr  = getProgress(selUser.id);
    return (
      <div className="pg anim">
        <BkBtn onClick={()=>setSelUser(null)} label="← Tous les élèves"/>
        <div className="card" style={{marginBottom:14,textAlign:"center"}}>
          <div style={{width:60,height:60,borderRadius:"50%",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px",fontSize:24,fontWeight:900,color:"white"}}>{selUser.name[0]?.toUpperCase()}</div>
          <h3 style={{fontSize:18,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px"}}>{selUser.name}</h3>
          <p style={{color:"#6b7280",margin:"0 0 10px",fontSize:13}}>{selUser.email}</p>
          <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap"}}>
            <Pill bg="#eef2ff" color="#4f46e5">{selUser.level||"—"}</Pill>
            {selUser.series && <Pill bg="#f5f3ff" color="#7c3aed">Série {selUser.series}</Pill>}
          </div>
        </div>
        <div className="g3" style={{marginBottom:14}}>
          {[{n:st.total,l:"Exercices",c:"#4f46e5"},{n:st.avg,l:"Moyenne /20",c:"#10b981"},{n:`${st.streak}j`,l:"Streak",c:"#f59e0b"}].map(s=>(
            <div key={s.l} className="card" style={{textAlign:"center",padding:".875rem .5rem"}}>
              <div style={{fontSize:20,fontWeight:900,color:s.c}}>{s.n}</div>
              <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>
        {Object.keys(st.bySubject).length>0 && (
          <div className="card" style={{marginBottom:14}}>
            <p style={{margin:"0 0 12px",fontWeight:700,fontSize:14,color:"#1e1b4b"}}>Résultats par matière</p>
            {Object.entries(st.bySubject).map(([id,s])=>{
              const sj=SUBJECTS.find(x=>x.id===id); const pct=Math.round((parseFloat(s.avg)/20)*100);
              return (
                <div key={id} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>{sj?.sym} {s.label}</span>
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
          {(pr.exercises||[]).slice(0,12).map((e,i)=>{
            const c=e.score>=15?"#10b981":e.score>=10?"#f59e0b":"#ef4444";
            return (
              <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:".625rem 0",borderBottom:i<11?"1px solid #f3f4f6":"none"}}>
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
          {!(pr.exercises?.length) && <p style={{color:"#9ca3af",textAlign:"center",fontSize:13,padding:"1rem"}}>Aucun exercice encore réalisé.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="pg anim">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:"1.5rem"}}>
        <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#7c3aed,#4f46e5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🛡</div>
        <div>
          <h2 style={{fontSize:20,fontWeight:900,color:"#1e1b4b",margin:0}}>Tableau de bord Admin</h2>
          <p style={{margin:0,fontSize:12,color:"#9ca3af"}}>khalifadylla@gmail.com · Accès complet</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {TAB_BTN("stats","📊 Statistiques")}
        {TAB_BTN("users","👥 Élèves")}
        {TAB_BTN("classroom","🏫 Mode Classe")}
      </div>

      {/* ── STATS ── */}
      {view==="stats" && (
        <div className="anim">
          <div className="g2" style={{marginBottom:14}}>
            {[
              {n:allUsers.length, l:"Élèves inscrits",   c:"#4f46e5"},
              {n:totalEx,         l:"Exercices réalisés",c:"#10b981"},
              {n:globalAvg,       l:"Score moyen /20",   c:"#f59e0b"},
              {n:activeToday,     l:"Actifs aujourd'hui",c:"#ef4444"},
              {n:`${pct15}%`,     l:"Score ≥ 15/20",     c:"#7c3aed"},
              {n:allScores.length,l:"Corrections faites", c:"#0891b2"},
            ].map(s=>(
              <div key={s.l} className="card" style={{padding:"1rem .75rem",textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:900,color:s.c,marginBottom:2}}>{s.n}</div>
                <div style={{fontSize:11,color:"#9ca3af"}}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Score distribution bar */}
          {allScores.length>0 && (
            <div className="card" style={{marginBottom:14}}>
              <p style={{margin:"0 0 14px",fontWeight:700,fontSize:14,color:"#1e1b4b"}}>📈 Distribution des scores</p>
              {[[0,9,"#ef4444","< 10"],[10,14,"#f59e0b","10-14"],[15,17,"#3b82f6","15-17"],[18,20,"#10b981","18-20"]].map(([lo,hi,col,label])=>{
                const cnt=allScores.filter(s=>s>=lo&&s<=hi).length;
                const pct=allScores.length?Math.round(cnt/allScores.length*100):0;
                return (
                  <div key={label} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>{label}/20</span>
                      <span style={{fontSize:13,fontWeight:700,color:col}}>{cnt} élève{cnt>1?"s":""} ({pct}%)</span>
                    </div>
                    <div style={{background:"#f3f4f6",borderRadius:99,height:8,overflow:"hidden"}}>
                      <div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:99,transition:"width .6s ease"}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* By level */}
          <div className="card">
            <p style={{margin:"0 0 12px",fontWeight:700,fontSize:14,color:"#1e1b4b"}}>🏫 Répartition par classe</p>
            {Object.entries(byLevel).sort((a,b)=>b[1]-a[1]).map(([lvl,cnt])=>(
              <div key={lvl} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:".5rem 0",borderBottom:"1px solid #f3f4f6"}}>
                <span style={{fontSize:14,fontWeight:600,color:"#374151"}}>{lvl}</span>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:80,height:6,background:"#f3f4f6",borderRadius:3,overflow:"hidden"}}>
                    <div style={{width:`${Math.round(cnt/allUsers.length*100)}%`,height:"100%",background:"#4f46e5",borderRadius:3}}/>
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color:"#4f46e5",minWidth:28,textAlign:"right"}}>{cnt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── USERS ── */}
      {view==="users" && (
        <div className="anim">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un élève…"
            style={{width:"100%",padding:".75rem 1rem",border:"2px solid #e5e7eb",borderRadius:10,fontSize:14,marginBottom:12,WebkitTextSizeAdjust:"100%"}}/>
          <div className="card">
            {allUsers.filter(u=>!search||(u.name+u.email+(u.level||"")).toLowerCase().includes(search.toLowerCase())).map((u,i,arr)=>{
              const st=getStats(u.id);
              return (
                <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:".75rem",borderBottom:i<arr.length-1?"1px solid #f3f4f6":"none",cursor:"pointer"}} onClick={()=>setSelUser(u)}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:800,fontSize:14,flexShrink:0}}>{u.name[0]?.toUpperCase()}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:0,fontSize:14,fontWeight:700,color:"#1f2937"}}>{u.name}</p>
                    <p style={{margin:0,fontSize:11,color:"#9ca3af",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.email} · {u.level||"—"}{u.series?` · Série ${u.series}`:""}</p>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <p style={{margin:0,fontSize:13,fontWeight:700,color:parseFloat(st.avg)>=15?"#10b981":parseFloat(st.avg)>=10?"#f59e0b":"#ef4444"}}>{st.avg}/20</p>
                    <p style={{margin:0,fontSize:10,color:"#9ca3af"}}>{st.total} ex.</p>
                  </div>
                  <span style={{color:"#d1d5db",fontSize:18}}>›</span>
                </div>
              );
            })}
            {allUsers.length===0 && <p style={{textAlign:"center",color:"#9ca3af",fontSize:13,padding:"2rem"}}>Aucun élève inscrit pour l'instant.</p>}
          </div>
        </div>
      )}

      {/* ── CLASSROOM MODE — admin voit l'app comme un élève de n'importe quel niveau ── */}
      {view==="classroom" && (
        <div className="anim">
          <div className="card" style={{marginBottom:14,background:"#faf5ff",border:"1px solid #e9d5ff"}}>
            <p style={{margin:"0 0 12px",fontSize:13,fontWeight:700,color:"#7c3aed"}}>🏫 Mode Classe — Visualise l'app comme un élève</p>
            <p style={{margin:"0 0 12px",fontSize:13,color:"#6b7280",lineHeight:1.6}}>Sélectionne un niveau pour voir les matières, sujets et ressources disponibles pour cette classe.</p>
            <Lbl>Niveau</Lbl>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
              {LEVELS.map(l=>(
                <button key={l.id} onClick={()=>{ setClassLvl(l.id); setClassSer(""); }} style={{padding:".45rem .875rem",minHeight:40,borderRadius:8,border:`2px solid ${classLvl===l.id?"#7c3aed":"#e9d5ff"}`,background:classLvl===l.id?"#f5f3ff":"white",color:classLvl===l.id?"#7c3aed":"#374151",fontWeight:classLvl===l.id?700:400,cursor:"pointer",fontSize:13}}>
                  {l.label}
                </button>
              ))}
            </div>
            {hasSeriesChoice(classLvl) && (
              <>
                <Lbl>Série</Lbl>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {(SERIES_BY_LEVEL[classLvl]||[]).map(s=>(
                    <button key={s.id} onClick={()=>setClassSer(s.id)} style={{padding:".45rem .875rem",minHeight:40,borderRadius:8,border:`2px solid ${classSer===s.id?"#7c3aed":"#e9d5ff"}`,background:classSer===s.id?"#f5f3ff":"white",color:classSer===s.id?"#7c3aed":"#374151",fontWeight:classSer===s.id?700:400,cursor:"pointer",fontSize:13}}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Matières disponibles pour cette classe */}
          {classLvl && (
            <div className="anim">
              <p style={{margin:"0 0 10px",fontWeight:700,fontSize:14,color:"#1e1b4b"}}>
                Matières pour {classLvl}{classSer?` · Série ${classSer}`:""} ({getSubjectsForStudent(classLvl,classSer).length} matières)
              </p>
              <div className="g2" style={{marginBottom:14}}>
                {getSubjectsForStudent(classLvl, classSer).map(s=>(
                  <div key={s.id} style={{background:"white",borderRadius:12,padding:"1rem",border:`1px solid ${s.bg}`,display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:36,height:36,borderRadius:9,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:s.color,flexShrink:0}}>{s.sym}</div>
                    <span style={{fontWeight:600,fontSize:13,color:"#1e1b4b"}}>{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Sujets par matière */}
              {getSubjectsForStudent(classLvl, classSer).map(s=>{
                const topics = getTopicsForStudent(s.id, classLvl, classSer);
                if (!topics.length) return null;
                return (
                  <div key={s.id} className="card" style={{marginBottom:12}}>
                    <p style={{margin:"0 0 10px",fontWeight:700,fontSize:13,color:s.color}}>{s.sym} {s.label} — {topics.length} sujets</p>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {topics.map(t=>(
                        <span key={t} style={{padding:".35rem .75rem",borderRadius:20,background:s.bg,color:s.color,fontSize:12,fontWeight:500}}>{t}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXERCISES TAB
// ─────────────────────────────────────────────────────────────────────────────
function ExercisesTab({ user }) {
  const [step,   setStep]  = useState("subject");
  const [subj,   setSubj]  = useState(null);
  const [topic,  setTopic] = useState("");
  const [exo,    setExo]   = useState(null);
  const [corr,   setCorr]  = useState(null);
  const [diff,   setDiff]  = useState(1);
  const [busy,   setBusy]  = useState(false);
  const [err,    setErr]   = useState("");
  const available = getSubjectsForStudent(user.level||"3ème", user.series);
  const dColor    = DCOL[diff-1];
  const reset     = () => { setStep("subject"); setSubj(null); setTopic(""); setExo(null); setCorr(null); setErr(""); };

  const doGen = useCallback(async (lvl,sid,tp,d) => {
    setBusy(true); setErr("");
    try {
      const serie = user.series ? ` Série ${user.series}` : "";
      const raw   = await callClaude(
        `Professeur sénégalais. Exercice de ${sid} sur "${tp}" — ${lvl}${serie}, difficulté ${d}/5. Programme MENFP.\n` +
        `JSON UNIQUEMENT sans markdown:\n` +
        `{"title":"...","instructions":"...","questions":[{"id":1,"text":"...","points":8},{"id":2,"text":"...","points":12}],"totalPoints":20,"duration":"X min"}\n` +
        `Règle: total=20pts, 2-3 questions max.`
      );
      setExo(parseJSON(raw)); setStep("exercise");
    } catch(e) { setErr(e.message); } finally { setBusy(false); }
  },[user]);

  const doParse = useCallback(async fd => {
    setBusy(true); setErr("");
    const prompt =
      `Professeur sénégalais. Élève de ${user.level} en ${subj?.id}. Extrais cet exercice.\n` +
      `JSON UNIQUEMENT sans markdown:\n` +
      `{"title":"...","topic":"...","instructions":"...","questions":[{"id":1,"text":"...","points":5}],"totalPoints":20,"duration":"X min","source":"uploaded"}\n` +
      `Règle: total=20pts.`;
    try {
      let raw;
      if      (fd.type==="pdf")   raw = await callPDF(fd.base64, prompt);
      else if (fd.type==="image") raw = await callVision(fd.base64, fd.mediaType, prompt);
      else                        raw = await callClaude(prompt + `\n\nDOC:\n${fd.content.slice(0,3000)}`);
      const p = parseJSON(raw);
      setTopic(p.topic||"exercice uploadé"); setExo({...p, source:"uploaded"}); setStep("exercise");
    } catch(e) { setErr(e.message); } finally { setBusy(false); }
  },[user, subj]);

  const doCorr = useCallback(async ans => {
    if (!exo) return;
    setBusy(true); setErr("");
    const qs  = (exo.questions||[]).map(q=>`Q${q.id}(${q.points}pts):${q.text}`).join("|");
    const base =
      `Professeur sénégalais. Corrige exercice de ${subj?.id}, ${user.level}${user.series?` S.${user.series}`:""}.` +
      `EXERCICE:${exo.title}|${qs}|Total:${exo.totalPoints||20}pts\n{ANS}\n` +
      `JSON UNIQUEMENT:\n{"score":<0-20>,"appreciation":"Excellent|Très bien|Bien|Assez bien|Passable|À améliorer|Insuffisant","feedback":"2 phrases","corrections":[{"questionId":1,"pointsObtenus":<n>,"pointsMax":<n>,"commentaire":"..."}],"fullCorrection":"correction si score≥15 sinon chaîne vide","points_forts":["..."],"points_ameliorer":["..."]}`;
    try {
      let raw;
      if (ans.type==="image") raw = await callVision(ans.base64, ans.mediaType, base.replace("{ANS}","RÉP:[image]"));
      else                    raw = await callClaude(base.replace("{ANS}",`RÉP:\n${ans.content.slice(0,2000)}`));
      const c = parseJSON(raw);
      addExerciseResult(user.id,{subject:subj?.id,subjectLabel:subj?.label,topic,score:c.score,difficulty:diff,source:exo.source||"generated"});
      if (c.score>=15) setDiff(d=>Math.min(d+1,5));
      setCorr(c); setStep("result");
    } catch(e) { setErr(e.message); } finally { setBusy(false); }
  },[exo, user, subj, topic, diff]);

  if (busy) return <Loader/>;

  /* Subject */
  if (step==="subject") return (
    <div className="pg anim">
      <h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px"}}>✏️ Exercices</h2>
      <p style={{color:"#6b7280",fontSize:14,margin:"0 0 1.5rem"}}>Quelle matière veux-tu travailler ?</p>
      <ErrBox msg={err}/>
      <div className="g2">
        {available.map(s=>(
          <button key={s.id} onClick={()=>{setSubj(s);setStep("mode");}} style={{padding:"1rem",minHeight:64,background:"white",border:"2px solid #e5e7eb",borderRadius:14,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:38,height:38,borderRadius:10,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:s.color,flexShrink:0}}>{s.sym}</div>
            <span style={{fontWeight:600,fontSize:13,color:"#1e1b4b"}}>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  /* Mode */
  if (step==="mode") return (
    <div className="pg anim">
      <BkBtn onClick={()=>setStep("subject")}/>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:"1.5rem"}}>
        <div style={{width:44,height:44,borderRadius:10,background:subj?.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:subj?.color,flexShrink:0}}>{subj?.sym}</div>
        <div><h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:0}}>{subj?.label}</h2><p style={{margin:0,fontSize:13,color:"#9ca3af"}}>{user.level}{user.series?` · Série ${user.series}`:""}</p></div>
      </div>
      <div className="g2" style={{gap:16}}>
        <button onClick={()=>setStep("topic")} style={{padding:"1.5rem",minHeight:170,borderRadius:14,border:"2px solid #e0e7ff",background:"white",cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:10}}>
          <span style={{fontSize:36}}>✨</span>
          <div><p style={{margin:"0 0 6px",fontSize:15,fontWeight:800,color:"#1e1b4b"}}>Générer un exercice</p><p style={{margin:0,fontSize:12,color:"#6b7280",lineHeight:1.5}}>L'IA crée un exercice du programme sénégalais</p></div>
          <span style={{marginTop:"auto",fontSize:12,fontWeight:700,color:"#4f46e5"}}>Choisir un thème →</span>
        </button>
        <button onClick={()=>setStep("upload")} style={{padding:"1.5rem",minHeight:170,borderRadius:14,border:"2px solid #fef3c7",background:"white",cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:10}}>
          <span style={{fontSize:36}}>📄</span>
          <div><p style={{margin:"0 0 6px",fontSize:15,fontWeight:800,color:"#1e1b4b"}}>Mon exercice</p><p style={{margin:0,fontSize:12,color:"#6b7280",lineHeight:1.5}}>Téléverse un exercice reçu en classe</p></div>
          <span style={{marginTop:"auto",fontSize:12,fontWeight:700,color:"#d97706"}}>Téléverser →</span>
        </button>
      </div>
    </div>
  );

  /* Topic */
  if (step==="topic") {
    const sugg = getTopicsForStudent(subj?.id||"", user.level||"3ème", user.series);
    return (
      <div className="pg anim">
        <BkBtn onClick={()=>setStep("mode")}/>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:"1.25rem"}}>
          <div style={{width:44,height:44,borderRadius:10,background:subj?.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:subj?.color,flexShrink:0}}>{subj?.sym}</div>
          <div><h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:0}}>{subj?.label}</h2><p style={{margin:0,fontSize:12,color:"#9ca3af"}}>Programme {user.level}{user.series?` · Série ${user.series}`:""}</p></div>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:"1.25rem"}}>
          {sugg.map(t=>(
            <button key={t} onClick={()=>setTopic(t)} style={{padding:".5rem .9rem",minHeight:40,borderRadius:20,border:`2px solid ${topic===t?subj?.color:"#e5e7eb"}`,background:topic===t?subj?.bg:"white",color:topic===t?subj?.color:"#374151",fontWeight:topic===t?700:400,cursor:"pointer",fontSize:13}}>
              {t}
            </button>
          ))}
        </div>
        <div className="card" style={{marginBottom:14}}>
          <Lbl>Ou entre un thème personnalisé</Lbl>
          <input value={topic} onChange={e=>setTopic(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&topic.trim()&&doGen(user.level,subj?.id,topic.trim(),diff)}
            placeholder="Ex: Cinétique chimique…"
            style={{width:"100%",padding:".8rem 1rem",border:`2px solid ${topic?subj?.color||"#4f46e5":"#e5e7eb"}`,borderRadius:8,fontSize:16,WebkitTextSizeAdjust:"100%"}}/>
        </div>
        <PBtn onClick={()=>topic.trim()&&doGen(user.level,subj?.id,topic.trim(),diff)} disabled={!topic.trim()}>Générer l'exercice ✨</PBtn>
      </div>
    );
  }

  /* Upload */
  if (step==="upload") return <UploadView subj={subj} user={user} onParsed={doParse} onBack={()=>setStep("mode")}/>;

  /* Exercise */
  if (step==="exercise" && exo) return <ExoView subj={subj} exo={exo} diff={diff} dColor={dColor} onSubmit={doCorr} onBack={()=>setStep("mode")} err={err}/>;

  /* Result */
  if (step==="result" && corr) return (
    <ResultView corr={corr} diff={diff}
      onNext={()=>{setCorr(null);doGen(user.level,subj?.id,topic,diff);}}
      onRetry={()=>{setCorr(null);setStep("exercise");}}
      onNew={reset}/>
  );
  return null;
}

// Upload helper
function UploadView({ subj, user, onParsed, onBack }) {
  const [fd,setFd]=useState(null);const[file,setFile]=useState(null);const[proc,setProc]=useState(false);const[err,setErr]=useState("");const ref=useRef();
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
  return (
    <div className="pg anim">
      <BkBtn onClick={onBack}/>
      <h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px"}}>Téléverse ton exercice</h2>
      <p style={{color:"#6b7280",fontSize:14,margin:"0 0 1.25rem"}}>{subj?.label} · {user.level}</p>
      <input type="file" ref={ref} onChange={handle} accept=".pdf,.txt,.docx,image/*" style={{display:"none"}}/>
      <div onClick={()=>!proc&&ref.current?.click()} style={{border:`2px dashed ${fd?"#4f46e5":"#d1d5db"}`,borderRadius:16,padding:"2rem",textAlign:"center",cursor:proc?"wait":"pointer",background:fd?"#eef2ff":"#fafaf9",marginBottom:12,minHeight:180,display:"flex",alignItems:"center",justifyContent:"center"}}>
        {proc?<p style={{margin:0,color:"#4f46e5",fontWeight:600}}>⏳ Lecture…</p>
          :fd?<div><div style={{fontSize:40,marginBottom:8}}>✅</div><p style={{margin:"0 0 4px",fontWeight:700,color:"#1e1b4b",fontSize:13}}>{file?.name}</p><p style={{margin:0,fontSize:11,color:"#9ca3af"}}>Appuyer pour changer</p></div>
          :<div><div style={{fontSize:48,marginBottom:10}}>📄</div><p style={{margin:"0 0 4px",fontWeight:700,color:"#374151"}}>Appuyer pour choisir</p><p style={{margin:0,fontSize:12,color:"#9ca3af"}}>PDF · Photo · Texte · Word</p></div>
        }
      </div>
      <ErrBox msg={err}/>
      <div style={{background:"#fffbeb",borderRadius:10,padding:".875rem",marginBottom:14,border:"1px solid #fde68a"}}><p style={{margin:0,fontSize:12,color:"#92400e",lineHeight:1.6}}>💡 Pour un exercice sur papier, prends une photo nette. L'IA reconnaît l'écriture manuscrite.</p></div>
      <PBtn onClick={()=>fd&&onParsed(fd)} disabled={!fd||proc} s={{background:fd&&!proc?"linear-gradient(135deg,#d97706,#f59e0b)":"#e5e7eb",boxShadow:fd&&!proc?"0 4px 14px rgba(217,119,6,.3)":"none"}}>{proc?"Traitement…":"Analyser avec l'IA →"}</PBtn>
    </div>
  );
}

// Exercise view
function ExoView({ subj, exo, diff, dColor, onSubmit, onBack, err }) {
  const [ans,setAns]=useState({});const[fd,setFd]=useState(null);const[upl,setUpl]=useState(false);const ref=useRef();
  const hasAns=fd||Object.values(ans).some(v=>v?.trim());
  const submit=()=>{ if(fd){onSubmit(fd);return;} onSubmit({type:"text",content:(exo.questions||[]).map(q=>`Q${q.id}(${q.points}pts):${q.text}\nRép:${ans[q.id]||"(vide)"}`).join("\n\n")}); };
  const handleFile=async e=>{const f=e.target.files[0];if(!f)return;setUpl(true);try{if(f.type.startsWith("image/"))setFd({type:"image",mediaType:f.type,base64:await toB64(f),name:f.name});else setFd({type:"text",content:await f.text(),name:f.name});}finally{setUpl(false);}};
  return (
    <div className="pgw anim">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem",flexWrap:"wrap",gap:8}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:14,padding:0,minHeight:44}}>← Retour</button>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Pill bg={subj?.bg} color={subj?.color}>{subj?.label}</Pill>
          <Pill bg={`${dColor}18`} color={dColor}>Niv. {DIFF[diff-1]}</Pill>
          {exo.source==="uploaded"&&<Pill bg="#fef3c7" color="#92400e">Mon exercice</Pill>}
        </div>
      </div>
      <ErrBox msg={err}/>
      <div className="card" style={{marginBottom:12}}>
        <h2 style={{fontSize:18,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px"}}>{exo.title}</h2>
        {exo.duration&&<p style={{fontSize:12,color:"#9ca3af",margin:"0 0 1rem"}}>Durée: {exo.duration} · {exo.totalPoints||20} pts</p>}
        {exo.instructions&&<div style={{background:"#f5f3ff",borderRadius:10,padding:".875rem 1rem",marginBottom:"1.25rem",borderLeft:"3px solid #7c3aed"}}><p style={{margin:0,color:"#374151",fontSize:14,lineHeight:1.65}}>{exo.instructions}</p></div>}
        {(exo.questions||[]).map((q,i,arr)=>(
          <div key={q.id} style={{marginBottom:18,borderBottom:i<arr.length-1?"1px solid #f3f4f6":"none",paddingBottom:i<arr.length-1?18:0}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:8}}>
              <p style={{margin:0,fontWeight:600,color:"#1f2937",fontSize:15,flex:1,lineHeight:1.5}}>
                <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:24,height:24,background:"#4f46e5",color:"white",borderRadius:6,fontSize:12,fontWeight:700,marginRight:8,verticalAlign:"middle",flexShrink:0}}>{i+1}</span>
                {q.text}
              </p>
              <span style={{fontSize:12,color:"#9ca3af",whiteSpace:"nowrap",fontWeight:600,paddingTop:3}}>{q.points} pts</span>
            </div>
            <textarea value={ans[q.id]||""} rows={3} onChange={e=>setAns(p=>({...p,[q.id]:e.target.value}))} placeholder={`Réponse ${i+1}…`}
              style={{width:"100%",padding:".75rem",border:`2px solid ${ans[q.id]?.trim()?"#c7d2fe":"#e5e7eb"}`,borderRadius:8,fontSize:15,resize:"vertical",lineHeight:1.6,WebkitTextSizeAdjust:"100%"}}/>
          </div>
        ))}
      </div>
      <div className="card" style={{marginBottom:12}}>
        <p style={{margin:"0 0 10px",fontSize:13,fontWeight:600,color:"#374151"}}>📎 Ou téléverse ta réponse (photo / .txt)</p>
        <input type="file" ref={ref} onChange={handleFile} accept=".txt,image/*" style={{display:"none"}}/>
        {!fd?<button onClick={()=>ref.current?.click()} style={{width:"100%",padding:".875rem",minHeight:50,border:"2px dashed #d1d5db",borderRadius:10,background:"#fafaf9",color:"#6b7280",cursor:"pointer",fontSize:14}}>{upl?"Chargement…":"Appuyer pour choisir"}</button>
          :<div style={{display:"flex",alignItems:"center",gap:10,padding:".75rem",background:"#f0fdf4",borderRadius:8,border:"1px solid #bbf7d0"}}>
            <span>✅</span>
            <p style={{margin:0,fontSize:13,fontWeight:600,color:"#166534",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fd.name}</p>
            <button onClick={()=>{setFd(null);if(ref.current)ref.current.value="";}} style={{background:"none",border:"none",cursor:"pointer",color:"#6b7280",fontSize:22,padding:"4px 8px",minHeight:44}}>×</button>
          </div>
        }
      </div>
      <PBtn onClick={submit} disabled={!hasAns} s={{background:hasAns?"linear-gradient(135deg,#059669,#10b981)":"#e5e7eb",boxShadow:hasAns?"0 4px 14px rgba(16,185,129,.32)":"none"}}>Soumettre ma réponse ✓</PBtn>
    </div>
  );
}

// Result view
function ResultView({ corr, diff, onNext, onRetry, onNew }) {
  const pass=corr.score>=15; const sColor=corr.score>=15?"#10b981":corr.score>=10?"#f59e0b":"#ef4444"; const pct=Math.round((corr.score/20)*100);
  return (
    <div className="pgw anim">
      <div style={{background:pass?"#ecfdf5":corr.score>=10?"#fffbeb":"#fef2f2",border:`2px solid ${pass?"#6ee7b7":corr.score>=10?"#fcd34d":"#fca5a5"}`,borderRadius:16,padding:"1.5rem",marginBottom:14,textAlign:"center"}}>
        {pass&&<div style={{fontSize:13,fontWeight:700,color:"#059669",marginBottom:8,letterSpacing:".06em"}}>🏆 EXCELLENT TRAVAIL !</div>}
        <div style={{fontSize:"clamp(42px,10vw,64px)",fontWeight:900,lineHeight:1,marginBottom:4,color:sColor}}>{corr.score}<span style={{fontSize:"clamp(18px,5vw,28px)",fontWeight:400,color:"#9ca3af"}}>/20</span></div>
        <div style={{fontSize:15,fontWeight:700,color:pass?"#065f46":corr.score>=10?"#92400e":"#991b1b",marginBottom:"1rem"}}>{corr.appreciation}</div>
        <div style={{background:"#e5e7eb",borderRadius:99,height:10,marginBottom:"1rem",overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${sColor},${sColor}bb)`,borderRadius:99,transition:"width .9s ease"}}/></div>
        <p style={{margin:0,color:"#4b5563",fontSize:14,lineHeight:1.7}}>{corr.feedback}</p>
      </div>

      {corr.corrections?.length>0&&(
        <div className="card" style={{marginBottom:12}}>
          <h3 style={{margin:"0 0 12px",fontSize:15,fontWeight:700,color:"#1e1b4b"}}>Détail par question</h3>
          {corr.corrections.map((c,i,arr)=>{
            const r=c.pointsMax>0?c.pointsObtenus/c.pointsMax:0; const col=r>=.75?"#10b981":r>=.5?"#f59e0b":"#ef4444";
            return(<div key={i} style={{padding:".875rem",borderRadius:10,background:`${col}0d`,border:`1px solid ${col}30`,marginBottom:i<arr.length-1?8:0}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontWeight:600,fontSize:14,color:"#1f2937"}}>Question {c.questionId}</span><span style={{fontWeight:700,color:col,fontSize:14}}>{c.pointsObtenus}/{c.pointsMax} pts</span></div>
              <p style={{margin:0,fontSize:13,color:"#6b7280",lineHeight:1.55}}>{c.commentaire}</p>
            </div>);
          })}
        </div>
      )}

      {(corr.points_forts?.length>0||corr.points_ameliorer?.length>0)&&(
        <div className="g2" style={{marginBottom:12}}>
          {corr.points_forts?.length>0&&<div style={{background:"#ecfdf5",borderRadius:12,padding:"1rem",border:"1px solid #a7f3d0"}}><p style={{margin:"0 0 8px",fontSize:11,fontWeight:800,color:"#065f46",textTransform:"uppercase",letterSpacing:".06em"}}>✓ Points forts</p>{corr.points_forts.map((p,i)=><p key={i} style={{margin:"0 0 3px",fontSize:12,color:"#047857"}}>· {p}</p>)}</div>}
          {corr.points_ameliorer?.length>0&&<div style={{background:"#fffbeb",borderRadius:12,padding:"1rem",border:"1px solid #fde68a"}}><p style={{margin:"0 0 8px",fontSize:11,fontWeight:800,color:"#92400e",textTransform:"uppercase",letterSpacing:".06em"}}>→ À travailler</p>{corr.points_ameliorer.map((p,i)=><p key={i} style={{margin:"0 0 3px",fontSize:12,color:"#b45309"}}>· {p}</p>)}</div>}
        </div>
      )}

      {pass&&corr.fullCorrection&&corr.fullCorrection.length>5&&(
        <div style={{background:"#eef2ff",borderRadius:14,padding:"1.25rem",marginBottom:14,border:"1px solid #c7d2fe"}}>
          <h3 style={{margin:"0 0 10px",fontSize:15,fontWeight:700,color:"#3730a3"}}>📚 Correction complète</h3>
          <div style={{fontSize:13,color:"#1e1b4b",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{corr.fullCorrection}</div>
        </div>
      )}
      {!pass&&(
        <div style={{background:"#fef2f2",borderRadius:12,padding:"1rem",marginBottom:14,border:"1px solid #fecaca",textAlign:"center"}}>
          <p style={{margin:0,fontSize:13,color:"#dc2626",fontWeight:600}}>🔒 Correction complète disponible à partir de 15/20</p>
          <p style={{margin:"4px 0 0",fontSize:12,color:"#9ca3af"}}>Encore {15-corr.score} point{15-corr.score>1?"s":""} pour débloquer</p>
        </div>
      )}

      <div className="row" style={{marginBottom:10}}>
        <button onClick={onRetry} style={{flex:1,padding:"1rem",minHeight:50,border:"2px solid #e5e7eb",borderRadius:12,background:"white",color:"#374151",fontWeight:600,cursor:"pointer",fontSize:14}}>↩ Réessayer</button>
        <button onClick={onNext} style={{flex:2,padding:"1rem",minHeight:50,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"white",border:"none",borderRadius:12,fontWeight:700,cursor:"pointer",fontSize:14,boxShadow:"0 4px 12px rgba(79,70,229,.28)"}}>
          {pass&&diff<5?`Suivant — Niv. ${DIFF[Math.min(diff,4)]} →`:"Nouvel exercice →"}
        </button>
      </div>
      <button onClick={onNew} style={{width:"100%",padding:".75rem",minHeight:44,background:"none",border:"1px solid #e5e7eb",borderRadius:10,color:"#9ca3af",cursor:"pointer",fontSize:13}}>Choisir une autre matière</button>
      <p style={{textAlign:"center",fontSize:12,color:"#9ca3af",margin:"10px 0 0"}}>{pass&&diff<5?"🎯 La difficulté augmentera au prochain exercice.":!pass?"💪 Correction complète à 15/20 !":"🏆 Niveau max !"}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("loading");
  const [user,   setUser]   = useState(null);
  const [tab,    setTab]    = useState("dashboard");

  useEffect(() => {
    const u = getCurrentUser();
    if (u) { setUser(u); setScreen(u.isAdmin||u.level ? "app" : "onboarding"); }
    else     setScreen("landing");
  }, []);

  const onAuth   = (u, needOnboard) => { setUser(u); setScreen(needOnboard?"onboarding":"app"); };
  const onBoard  = u => { setUser(u); setScreen("app"); };
  const onLogout = () => { logoutUser(); setUser(null); setScreen("landing"); };
  const onUpdate = u => setUser(u);

  if (screen==="loading") return (
    <div style={{minHeight:"100vh",background:"#f5f3ff",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <Loader/>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      {screen==="landing"    && <Landing onStart={()=>setScreen("auth")}/>}
      {screen==="auth"       && <AuthScreen onSuccess={onAuth} onBack={()=>setScreen("landing")}/>}
      {screen==="onboarding" && user && <Onboarding user={user} onDone={onBoard}/>}
      {screen==="app"        && user && (
        <Shell user={user} tab={tab} setTab={setTab}>
          {tab==="dashboard"  && <DashboardTab  user={user} goExercises={()=>setTab("exercises")} goTutor={()=>setTab("tutor")}/>}
          {tab==="exercises"  && <ExercisesTab  user={user}/>}
          {tab==="tutor"      && <TutorPage     user={user}/>}
          {tab==="resources"  && <ResourcesTab  user={user}/>}
          {tab==="profile"    && <ProfileTab    user={user} onLogout={onLogout} onUpdate={onUpdate}/>}
          {tab==="admin"      && user.isAdmin && <AdminTab adminUser={user}/>}
        </Shell>
      )}
    </>
  );
}
