// EduCorrect — Application pédagogique complète
// Programme sénégalais · Auth localStorage · Dashboard · Ressources
import { useState, useRef, useCallback, useEffect } from "react";
import {
  LEVELS, SERIES_BY_LEVEL, hasSeriesChoice,
  getLevelGroup, getSubjectsForStudent, getTopicsForStudent, SUBJECTS
} from "../lib/curriculum";
import {
  getCurrentUser, loginUser, registerUser, logoutUser, updateUser,
  addExerciseResult, getStats
} from "../lib/store";

// ── API ───────────────────────────────────────────────────────────────────────
const API_URL = "/api/claude";
const MODEL   = "claude-sonnet-4-20250514";

async function callClaude(text) {
  const r = await fetch(API_URL, { method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ model:MODEL, max_tokens:1800, messages:[{role:"user",content:text}] }) });
  if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e.error?.message||`HTTP ${r.status}`); }
  const d = await r.json();
  return d.content.filter(b=>b.type==="text").map(b=>b.text).join("");
}
async function callClaudeVision(b64,mt,prompt) {
  const r = await fetch(API_URL, { method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ model:MODEL, max_tokens:1800, messages:[{role:"user",content:[
      {type:"image",source:{type:"base64",media_type:mt,data:b64}},{type:"text",text:prompt}]}] }) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  return d.content.filter(b=>b.type==="text").map(b=>b.text).join("");
}
async function callClaudePDF(b64,prompt) {
  const r = await fetch(API_URL, { method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ model:MODEL, max_tokens:1800, messages:[{role:"user",content:[
      {type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},{type:"text",text:prompt}]}] }) });
  if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(e.error?.message||`HTTP ${r.status}`); }
  const d = await r.json();
  return d.content.filter(b=>b.type==="text").map(b=>b.text).join("");
}
function parseJSON(raw) {
  const c = raw.replace(/^```(?:json)?\n?/m,"").replace(/\n?```$/m,"").trim();
  try { return JSON.parse(c); } catch {
    const m = c.match(/\{[\s\S]+\}/); if(m) return JSON.parse(m[0]);
    throw new Error("JSON invalide");
  }
}
const toB64 = f => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(f); });

// ── RESSOURCES ────────────────────────────────────────────────────────────────
const RESOURCES = {
  mathematiques: [
    { type:"web",   title:"Khan Academy Mathématiques",    url:"https://fr.khanacademy.org/math",            desc:"Cours vidéo + exercices interactifs, du primaire au BAC" },
    { type:"video", title:"Maths BAC Sénégal — YouTube",   url:"https://www.youtube.com/results?search_query=mathematiques+bac+senegal", desc:"Chaînes YouTube dédiées au BAC sénégalais" },
    { type:"web",   title:"Bibmath.net",                   url:"https://www.bibmath.net",                    desc:"Cours, exercices corrigés et fiches de révision" },
    { type:"web",   title:"Mathrix (YouTube)",             url:"https://www.youtube.com/@Mathrix",           desc:"Vidéos pédagogiques claires pour le collège et lycée" },
  ],
  physique: [
    { type:"web",   title:"Khan Academy Physique-Chimie",  url:"https://fr.khanacademy.org/science/physics", desc:"Cours de physique du secondaire" },
    { type:"video", title:"PC Sénégal BAC — YouTube",      url:"https://www.youtube.com/results?search_query=physique+chimie+bac+senegal", desc:"Vidéos de révision BAC Sénégal" },
    { type:"web",   title:"Futura Sciences",               url:"https://www.futura-sciences.com/sciences/",  desc:"Articles et cours de physique et chimie" },
    { type:"web",   title:"PhysiqueChimie.fr",             url:"https://www.physique-chimie.fr",             desc:"Cours et exercices de lycée" },
  ],
  francais: [
    { type:"web",   title:"Lumni — Lycée",                 url:"https://www.lumni.fr/lycee/premiere",        desc:"Vidéos pédagogiques France Télévisions (programme africain)" },
    { type:"web",   title:"Alloprof Français",             url:"https://www.alloprof.qc.ca/fr/eleves/bv/francais", desc:"Grammaire, conjugaison, dissertation" },
    { type:"web",   title:"TV5Monde Langue française",     url:"https://langue-francaise.tv5monde.com",      desc:"Exercices de langue et compréhension" },
    { type:"video", title:"Français BAC Sénégal — YouTube",url:"https://www.youtube.com/results?search_query=francais+bac+senegal+commentaire",desc:"Méthodologie dissertation et commentaire" },
  ],
  svt: [
    { type:"web",   title:"Khan Academy Biologie",         url:"https://fr.khanacademy.org/science/biology", desc:"Cours complets de SVT" },
    { type:"video", title:"SVT Sénégal BAC — YouTube",     url:"https://www.youtube.com/results?search_query=svt+bac+senegal", desc:"Révisions SVT BAC" },
    { type:"web",   title:"SVT au Lycée — Cours gratuits", url:"https://www.svt-cours.fr",                   desc:"Cours et fiches de révision SVT" },
    { type:"web",   title:"Futura Santé",                  url:"https://www.futura-sciences.com/sante/",     desc:"Biologie humaine vulgarisée" },
  ],
  histoire: [
    { type:"web",   title:"Lumni Histoire-Géographie",     url:"https://www.lumni.fr/college/histoire-geographie", desc:"Vidéos sur l'histoire africaine et mondiale" },
    { type:"web",   title:"Alloprof Histoire",             url:"https://www.alloprof.qc.ca/fr/eleves/bv/histoire", desc:"Fiches et exercices d'histoire" },
    { type:"video", title:"Histoire Sénégal BFEM/BAC",     url:"https://www.youtube.com/results?search_query=histoire+geographie+bfem+bac+senegal", desc:"Révisions BFEM et BAC" },
    { type:"web",   title:"Monde Diplomatique",            url:"https://www.monde-diplomatique.fr",          desc:"Géopolitique et enjeux actuels" },
  ],
  anglais: [
    { type:"web",   title:"BBC Learning English",          url:"https://www.bbc.co.uk/learningenglish",      desc:"Cours audio/vidéo gratuits de la BBC" },
    { type:"web",   title:"British Council LearnEnglish",  url:"https://learnenglish.britishcouncil.org",    desc:"Grammaire, vocabulaire, compréhension" },
    { type:"web",   title:"Duolingo English",              url:"https://www.duolingo.com",                   desc:"Apprentissage ludique de l'anglais" },
    { type:"video", title:"Anglais BAC Sénégal",           url:"https://www.youtube.com/results?search_query=anglais+bac+bfem+senegal", desc:"Méthodologie BAC anglais Sénégal" },
  ],
  mathematiques_sup: [],
  sciences: [
    { type:"web",   title:"La main à la pâte",             url:"https://www.lamap.fr",                      desc:"Sciences à l'école primaire, expériences" },
    { type:"video", title:"Sciences primaire — YouTube",   url:"https://www.youtube.com/results?search_query=sciences+primaire+senegal", desc:"Vidéos pour les élèves du primaire" },
  ],
  philosophie: [
    { type:"web",   title:"Philocours",                    url:"https://www.philocours.com",                 desc:"Dissertations et notions de philosophie" },
    { type:"web",   title:"Philo52",                       url:"https://philo52.com",                        desc:"Cours complets de philosophie" },
    { type:"video", title:"Philosophie BAC Sénégal",       url:"https://www.youtube.com/results?search_query=philosophie+bac+senegal+terminale", desc:"Révisions philo BAC L et S" },
  ],
  informatique: [
    { type:"web",   title:"France-IOI (Algorithmique)",    url:"https://www.france-ioi.org",                 desc:"Initiation à la programmation et algorithmique" },
    { type:"web",   title:"OpenClassrooms — Python",       url:"https://openclassrooms.com/fr/courses/7168871-apprenez-les-bases-du-langage-python", desc:"Cours Python gratuit" },
    { type:"web",   title:"W3Schools (HTML/CSS/SQL)",      url:"https://www.w3schools.com",                  desc:"Référence web : HTML, CSS, JavaScript, SQL" },
  ],
  eco: [
    { type:"web",   title:"Alternatives Économiques",      url:"https://www.alternatives-economiques.fr",    desc:"Dossiers d'économie accessibles" },
    { type:"video", title:"Économie BAC STEG Sénégal",     url:"https://www.youtube.com/results?search_query=economie+steg+bac+senegal", desc:"Révisions économie BAC STEG" },
  ],
};

const DIFF_LABELS = ["Débutant","Facile","Intermédiaire","Difficile","Expert"];
const DIFF_COLORS = ["#10b981","#3b82f6","#f59e0b","#ef4444","#7c3aed"];

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
*,*::before,*::after{box-sizing:border-box;}
input,textarea,select{font-family:inherit;-webkit-appearance:none;}
input:focus,textarea:focus,select:focus{outline:none;box-shadow:0 0 0 3px rgba(79,70,229,.18);}
button:not([disabled]):active{transform:scale(.97);}
-webkit-tap-highlight-color:transparent;

.page{max-width:600px;margin:0 auto;padding:2rem 1.25rem 5rem;}
.page-w{max-width:720px;margin:0 auto;padding:1.5rem 1.25rem 5rem;}
.card{background:white;border-radius:16px;padding:1.5rem;box-shadow:0 1px 6px rgba(0,0,0,.07);}
.g2{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.row{display:flex;gap:10px;}
.anim{animation:fadeIn .3s ease;}
.bnav{display:none;}

/* Bottom nav on mobile */
@media(max-width:640px){
  .page,.page-w{padding:1rem .875rem 5rem;}
  .card{padding:1.1rem;border-radius:14px;}
  .g2{grid-template-columns:1fr;}
  .g3{grid-template-columns:1fr;}
  .row{flex-direction:column;}
  .bnav{display:flex;position:fixed;bottom:0;left:0;right:0;background:white;border-top:1px solid #e5e7eb;z-index:99;padding:.5rem 0 .25rem;}
  .bnav-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:.25rem;cursor:pointer;border:none;background:none;}
  .bnav-icon{font-size:1.3rem;}
  .bnav-label{font-size:.6rem;font-weight:600;color:#9ca3af;}
  .bnav-item.active .bnav-label{color:#4f46e5;}
  .hide-mobile{display:none!important;}
}
@media(min-width:641px){
  .show-mobile{display:none!important;}
}
`;

// ── PRIMITIVES ────────────────────────────────────────────────────────────────
const PBtn = ({onClick,disabled,children,style:x={}})=>(
  <button onClick={onClick} disabled={disabled} style={{width:"100%",padding:"1rem",minHeight:52,border:"none",borderRadius:12,fontSize:16,fontWeight:700,cursor:disabled?"not-allowed":"pointer",transition:"all .18s",background:disabled?"#e5e7eb":"linear-gradient(135deg,#4f46e5,#7c3aed)",color:disabled?"#9ca3af":"white",boxShadow:disabled?"none":"0 4px 14px rgba(79,70,229,.28)",...x}}>{children}</button>
);
const BackBtn = ({onClick,label="← Retour"})=>(
  <button onClick={onClick} style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:14,padding:"0.5rem 0",marginBottom:"0.875rem",display:"block",minHeight:44}}>{label}</button>
);
const Lbl = ({children})=><label style={{display:"block",fontWeight:700,marginBottom:8,color:"#111827",fontSize:14}}>{children}</label>;
const Pill = ({bg,color,children})=><span style={{padding:"0.3rem .75rem",borderRadius:20,fontSize:12,fontWeight:700,background:bg,color,whiteSpace:"nowrap"}}>{children}</span>;
const Spinner = ()=>(
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"5rem 2rem",gap:20}}>
    <div style={{position:"relative",width:60,height:60}}>
      <div style={{position:"absolute",inset:0,border:"4px solid #e0e7ff",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
      <div style={{position:"absolute",inset:8,border:"3px solid #f0e6ff",borderBottomColor:"#7c3aed",borderRadius:"50%",animation:"spin 1.2s linear infinite reverse"}}/>
    </div>
    <p style={{margin:0,fontWeight:700,fontSize:15,color:"#1e1b4b"}}>L'IA travaille...</p>
  </div>
);
function Field({label,type="text",value,onChange,placeholder,style:x={}}) {
  return (
    <div style={{marginBottom:14}}>
      <Lbl>{label}</Lbl>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{width:"100%",padding:"0.8rem 1rem",border:`2px solid ${value?"#4f46e5":"#e5e7eb"}`,borderRadius:10,fontSize:16,color:"#111827",transition:"border-color .2s",WebkitTextSizeAdjust:"100%",...x}}/>
    </div>
  );
}

// ── SCREEN: LANDING ───────────────────────────────────────────────────────────
function Landing({onGetStarted}) {
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%)"}}>
      {/* Nav */}
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1.25rem 2rem",position:"sticky",top:0,zIndex:10,background:"rgba(30,27,75,.85)",backdropFilter:"blur(12px)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:22,fontWeight:900,color:"white",letterSpacing:"-0.04em"}}>EduCorrect</span>
          <span style={{background:"#312e81",color:"#a5b4fc",fontSize:10,padding:"2px 7px",borderRadius:6,fontWeight:700,border:"1px solid #4f46e5"}}>IA</span>
        </div>
        <button onClick={onGetStarted} style={{background:"white",color:"#4f46e5",border:"none",borderRadius:10,padding:".6rem 1.25rem",fontWeight:700,cursor:"pointer",fontSize:14}}>
          Se connecter
        </button>
      </nav>

      {/* Hero */}
      <div style={{textAlign:"center",padding:"5rem 1.5rem 4rem",position:"relative"}}>
        <div style={{display:"inline-block",background:"rgba(99,102,241,.2)",border:"1px solid rgba(165,180,252,.3)",borderRadius:20,padding:".4rem 1rem",fontSize:12,fontWeight:700,color:"#a5b4fc",marginBottom:"1.5rem",letterSpacing:".06em"}}>
          🇸🇳 Programme officiel sénégalais (MENFP)
        </div>
        <h1 style={{fontSize:"clamp(2.2rem,7vw,4rem)",fontWeight:900,color:"white",lineHeight:1.15,margin:"0 0 1.25rem",letterSpacing:"-0.03em"}}>
          Ton prof particulier<br/>
          <span style={{background:"linear-gradient(135deg,#a5b4fc,#f0abfc)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>disponible 24h/24</span>
        </h1>
        <p style={{fontSize:"1.1rem",color:"#c7d2fe",maxWidth:520,margin:"0 auto 2.5rem",lineHeight:1.8}}>
          EduCorrect corrige tes exercices, s'adapte à ton niveau et te donne les ressources pour progresser — du CI au BAC.
        </p>
        <button onClick={onGetStarted} style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"white",border:"none",borderRadius:14,padding:"1rem 2.5rem",fontSize:17,fontWeight:800,cursor:"pointer",boxShadow:"0 8px 30px rgba(79,70,229,.5)",letterSpacing:"-0.01em"}}>
          Commencer gratuitement →
        </button>
        <p style={{color:"#818cf8",fontSize:12,marginTop:12}}>Aucune carte bancaire requise · 100% gratuit</p>
      </div>

      {/* Features */}
      <div style={{maxWidth:900,margin:"0 auto",padding:"0 1.5rem 5rem"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16}}>
          {[
            {icon:"🤖",title:"IA adaptative",desc:"Claude analyse tes réponses et génère des exercices correspondant exactement à ton niveau et à ta série."},
            {icon:"📊",title:"Suivi de progression",desc:"Tableau de bord avec ton score moyen, ta progression par matière et ton streak de révision."},
            {icon:"📄",title:"Upload d'exercices",desc:"Téléverse un exercice reçu en classe (PDF, photo) et l'IA le corrige immédiatement."},
            {icon:"🔒",title:"Correction débloquée",desc:"Obtiens la correction complète lorsque tu atteins 15/20. Un vrai incentive à se dépasser."},
            {icon:"📚",title:"Ressources gratuites",desc:"Vidéos YouTube, cours en ligne et sites éducatifs sélectionnés pour chaque matière."},
            {icon:"📱",title:"Sur téléphone",desc:"Installable sur ton écran d'accueil comme une application, sans passer par l'App Store."},
          ].map(f=>(
            <div key={f.title} style={{background:"rgba(255,255,255,.06)",borderRadius:16,padding:"1.5rem",border:"1px solid rgba(165,180,252,.15)"}}>
              <div style={{fontSize:32,marginBottom:12}}>{f.icon}</div>
              <h3 style={{margin:"0 0 8px",fontSize:16,fontWeight:700,color:"white"}}>{f.title}</h3>
              <p style={{margin:0,fontSize:13,color:"#a5b4fc",lineHeight:1.65}}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── SCREEN: AUTH ──────────────────────────────────────────────────────────────
function AuthScreen({onSuccess,onBack}) {
  const [mode,setMode] = useState("login"); // login | register
  const [form,setForm] = useState({name:"",email:"",password:"",confirm:""});
  const [err,setErr]   = useState("");
  const [loading,setLoading] = useState(false);

  const set = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const submit = async () => {
    setErr(""); setLoading(true);
    try {
      if (mode==="register") {
        if (!form.name.trim()) throw new Error("Entre ton prénom.");
        if (!form.email.includes("@")) throw new Error("Email invalide.");
        if (form.password.length < 6) throw new Error("Mot de passe trop court (6 caractères min).");
        if (form.password !== form.confirm) throw new Error("Les mots de passe ne correspondent pas.");
        const u = registerUser({name:form.name.trim(),email:form.email.trim(),password:form.password,level:"",series:null});
        onSuccess(u, true); // true = needs onboarding
      } else {
        if (!form.email || !form.password) throw new Error("Remplis tous les champs.");
        const u = loginUser({email:form.email.trim(),password:form.password});
        onSuccess(u, !u.level); // needs onboarding if no level set
      }
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:"100vh",background:"#f5f3ff",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:"2rem"}}>
          <div style={{fontSize:48,marginBottom:8}}>🎓</div>
          <h1 style={{fontSize:26,fontWeight:900,color:"#1e1b4b",margin:"0 0 6px"}}>EduCorrect</h1>
          <p style={{color:"#6b7280",margin:0,fontSize:14}}>{mode==="login"?"Connecte-toi à ton compte":"Crée ton compte gratuit"}</p>
        </div>

        <div className="card">
          {/* Toggle */}
          <div style={{display:"flex",background:"#f3f4f6",borderRadius:10,padding:4,marginBottom:"1.5rem"}}>
            {["login","register"].map(m=>(
              <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:".5rem",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,fontSize:14,transition:"all .15s",background:mode===m?"white":"transparent",color:mode===m?"#4f46e5":"#6b7280",boxShadow:mode===m?"0 1px 4px rgba(0,0,0,.08)":"none"}}>
                {m==="login"?"Connexion":"Inscription"}
              </button>
            ))}
          </div>

          {mode==="register" && <Field label="Ton prénom" value={form.name} onChange={set("name")} placeholder="Mamadou..." />}
          <Field label="Email" type="email" value={form.email} onChange={set("email")} placeholder="exemple@gmail.com" />
          <Field label="Mot de passe" type="password" value={form.password} onChange={set("password")} placeholder="6 caractères minimum" />
          {mode==="register" && <Field label="Confirmer le mot de passe" type="password" value={form.confirm} onChange={set("confirm")} placeholder="Répète ton mot de passe" />}

          {err && <p style={{color:"#dc2626",fontSize:13,margin:"0 0 12px",fontWeight:500}}>⚠ {err}</p>}

          <PBtn onClick={submit} disabled={loading}>
            {loading?"...":mode==="login"?"Se connecter →":"Créer mon compte →"}
          </PBtn>
        </div>

        <button onClick={onBack} style={{display:"block",margin:"1rem auto 0",background:"none",border:"none",color:"#9ca3af",cursor:"pointer",fontSize:13}}>
          ← Retour à l'accueil
        </button>
      </div>
    </div>
  );
}

// ── SCREEN: ONBOARDING ────────────────────────────────────────────────────────
function Onboarding({user,onDone}) {
  const [step,setStep]   = useState(0);
  const [level,setLevel] = useState("");
  const [series,setSeries] = useState("");
  const groups = [...new Set(LEVELS.map(l=>l.group))];
  const needsSeries = hasSeriesChoice(level);

  const steps = needsSeries ? 2 : 1;

  const finish = () => {
    const updated = updateUser({...user, level, series: needsSeries ? series : null });
    onDone({...user, level, series: needsSeries ? series : null});
  };

  return (
    <div style={{minHeight:"100vh",background:"#f5f3ff",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
      <div style={{width:"100%",maxWidth:500}}>
        {/* Progress dots */}
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:"2rem"}}>
          {Array.from({length:steps+1}).map((_,i)=>(
            <div key={i} style={{width:i===step?24:8,height:8,borderRadius:4,background:i<=step?"#4f46e5":"#e0e7ff",transition:"all .3s"}}/>
          ))}
        </div>

        {step===0 && (
          <div className="card anim">
            <div style={{textAlign:"center",marginBottom:"1.5rem"}}>
              <div style={{fontSize:40,marginBottom:8}}>🏫</div>
              <h2 style={{fontSize:22,fontWeight:900,color:"#1e1b4b",margin:"0 0 4px"}}>Bienvenue {user.name} !</h2>
              <p style={{color:"#6b7280",margin:0,fontSize:14}}>Dans quelle classe es-tu cette année ?</p>
            </div>
            {groups.map(g=>(
              <div key={g} style={{marginBottom:16}}>
                <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".08em"}}>{g}</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {LEVELS.filter(l=>l.group===g).map(l=>(
                    <button key={l.id} onClick={()=>setLevel(l.id)} style={{padding:".5rem .9rem",minHeight:44,borderRadius:8,border:`2px solid ${level===l.id?"#4f46e5":"#e5e7eb"}`,background:level===l.id?"#eef2ff":"white",color:level===l.id?"#4f46e5":"#374151",fontWeight:level===l.id?700:400,cursor:"pointer",fontSize:14,transition:"all .15s"}}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <PBtn onClick={()=>needsSeries?setStep(1):finish()} disabled={!level} style={{marginTop:8}}>
              {needsSeries?"Continuer →":"Commencer →"}
            </PBtn>
          </div>
        )}

        {step===1 && needsSeries && (
          <div className="card anim">
            <div style={{textAlign:"center",marginBottom:"1.5rem"}}>
              <div style={{fontSize:40,marginBottom:8}}>📋</div>
              <h2 style={{fontSize:22,fontWeight:900,color:"#1e1b4b",margin:"0 0 4px"}}>Ta série</h2>
              <p style={{color:"#6b7280",margin:0,fontSize:14}}>Classe de <strong>{level}</strong> — Quelle est ta série ?</p>
            </div>
            {(SERIES_BY_LEVEL[level]||[]).map(s=>(
              <button key={s.id} onClick={()=>setSeries(s.id)} style={{display:"block",width:"100%",padding:"1rem",marginBottom:10,borderRadius:12,border:`2px solid ${series===s.id?"#4f46e5":"#e5e7eb"}`,background:series===s.id?"#eef2ff":"white",color:series===s.id?"#4f46e5":"#374151",fontWeight:series===s.id?700:400,cursor:"pointer",textAlign:"left",fontSize:15,transition:"all .15s"}}>
                {s.label}
              </button>
            ))}
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button onClick={()=>setStep(0)} style={{flex:1,padding:"1rem",border:"2px solid #e5e7eb",borderRadius:12,background:"white",cursor:"pointer",fontWeight:600,fontSize:14,color:"#374151"}}>← Retour</button>
              <PBtn onClick={finish} disabled={!series} style={{flex:2}}>Commencer →</PBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── APP SHELL : Navigation ────────────────────────────────────────────────────
function AppShell({user,tab,setTab,children}) {
  const navItems = [
    {id:"dashboard",  icon:"📊", label:"Accueil"},
    {id:"exercises",  icon:"✏️",  label:"Exercices"},
    {id:"resources",  icon:"📚", label:"Ressources"},
    {id:"profile",    icon:"👤", label:"Profil"},
  ];
  return (
    <div style={{minHeight:"100vh",background:"#f5f3ff"}}>
      {/* Top header */}
      <div style={{background:"#1e1b4b",padding:".875rem 1.25rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18,fontWeight:900,color:"white",letterSpacing:"-0.04em"}}>EduCorrect</span>
          <span style={{background:"#312e81",color:"#a5b4fc",fontSize:10,padding:"2px 7px",borderRadius:6,fontWeight:700}}>IA</span>
        </div>
        {/* Desktop nav */}
        <div className="hide-mobile" style={{display:"flex",gap:4}}>
          {navItems.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)} style={{padding:".45rem .875rem",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,fontSize:13,background:tab===n.id?"rgba(255,255,255,.15)":"transparent",color:tab===n.id?"white":"rgba(255,255,255,.6)",transition:"all .15s"}}>
              {n.icon} {n.label}
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:34,height:34,borderRadius:"50%",background:"#4f46e5",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:800,fontSize:14,flexShrink:0}}>
            {user.name[0]?.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Content */}
      {children}

      {/* Bottom nav (mobile) */}
      <nav className="bnav">
        {navItems.map(n=>(
          <button key={n.id} className={`bnav-item${tab===n.id?" active":""}`} onClick={()=>setTab(n.id)}>
            <span className="bnav-icon">{n.icon}</span>
            <span className="bnav-label">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── TAB: DASHBOARD ────────────────────────────────────────────────────────────
function DashboardTab({user,onGoExercises}) {
  const stats  = getStats(user.id);
  const group  = getLevelGroup(user.level||"");
  const gLabel = group==="primaire"?"Primaire":group==="college"?"Collège":"Lycée";

  // Mini bar chart — last 7 exercises (recent is chronological)
  const maxScore = 20;
  const bars = stats.recent;

  return (
    <div className="page anim">
      {/* Welcome */}
      <div style={{background:"linear-gradient(135deg,#1e1b4b,#4f46e5)",borderRadius:20,padding:"1.5rem",marginBottom:16,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-20,top:-20,fontSize:80,opacity:.08}}>🎓</div>
        <p style={{margin:"0 0 4px",color:"#a5b4fc",fontSize:13,fontWeight:600}}>Bonjour 👋</p>
        <h2 style={{margin:"0 0 8px",color:"white",fontSize:24,fontWeight:900}}>{user.name}</h2>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          <Pill bg="rgba(255,255,255,.15)" color="white">{user.level||"—"}</Pill>
          {user.series&&<Pill bg="rgba(255,255,255,.1)" color="#c7d2fe">Série {user.series}</Pill>}
          <Pill bg="rgba(255,255,255,.1)" color="#c7d2fe">{gLabel}</Pill>
        </div>
      </div>

      {/* Stats cards */}
      <div className="g3" style={{marginBottom:16}}>
        {[
          {n:stats.total,    l:"Exercices",  c:"#4f46e5"},
          {n:stats.avg,      l:"Moyenne /20",c:"#10b981"},
          {n:`${stats.streak}j`,l:"Streak",  c:"#f59e0b"},
        ].map(s=>(
          <div key={s.l} className="card" style={{textAlign:"center",padding:"1rem .5rem"}}>
            <div style={{fontSize:22,fontWeight:900,color:s.c}}>{s.n}</div>
            <div style={{fontSize:11,color:"#9ca3af",marginTop:2,fontWeight:500}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Score history chart */}
      {bars.length>0&&(
        <div className="card" style={{marginBottom:16}}>
          <p style={{margin:"0 0 12px",fontWeight:700,fontSize:14,color:"#1e1b4b"}}>📈 Historique des scores</p>
          <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80,padding:"0 4px"}}>
            {bars.map((e,i)=>{
              const h  = Math.max(4, (e.score/maxScore)*80);
              const c  = e.score>=15?"#10b981":e.score>=10?"#f59e0b":"#ef4444";
              return (
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <span style={{fontSize:9,color:c,fontWeight:700}}>{e.score}</span>
                  <div style={{width:"100%",height:h,background:c,borderRadius:"4px 4px 0 0",transition:"height .5s ease"}}/>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
            <span style={{fontSize:10,color:"#9ca3af"}}>Exercice le + ancien</span>
            <span style={{fontSize:10,color:"#9ca3af"}}>Dernier</span>
          </div>
        </div>
      )}

      {/* Subject breakdown */}
      {Object.keys(stats.bySubject).length>0&&(
        <div className="card" style={{marginBottom:16}}>
          <p style={{margin:"0 0 12px",fontWeight:700,fontSize:14,color:"#1e1b4b"}}>📚 Par matière</p>
          {Object.entries(stats.bySubject).map(([id,s])=>{
            const subj = SUBJECTS.find(x=>x.id===id);
            const pct  = Math.round((parseFloat(s.avg)/20)*100);
            return (
              <div key={id} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#374151"}}>{subj?.sym} {s.label}</span>
                  <span style={{fontSize:13,fontWeight:700,color:parseFloat(s.avg)>=15?"#10b981":parseFloat(s.avg)>=10?"#f59e0b":"#ef4444"}}>{s.avg}/20</span>
                </div>
                <div style={{background:"#f3f4f6",borderRadius:99,height:6,overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,#4f46e5,#7c3aed)`,borderRadius:99,transition:"width .7s ease"}}/>
                </div>
                <span style={{fontSize:10,color:"#9ca3af"}}>{s.count} exercice{s.count>1?"s":""}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent exercises */}
      {stats.recent.length>0&&(
        <div className="card" style={{marginBottom:16}}>
          <p style={{margin:"0 0 12px",fontWeight:700,fontSize:14,color:"#1e1b4b"}}>🕐 Activité récente</p>
          {[...stats.recent].reverse().slice(0,5).map((e,i)=>{
            const c = e.score>=15?"#10b981":e.score>=10?"#f59e0b":"#ef4444";
            return (
              <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:".625rem 0",borderBottom:i<4?"1px solid #f3f4f6":"none"}}>
                <div style={{width:36,height:36,borderRadius:10,background:`${c}18`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:14,fontWeight:800,color:c}}>{e.score}</span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{margin:0,fontSize:13,fontWeight:600,color:"#1f2937",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.topic}</p>
                  <p style={{margin:0,fontSize:11,color:"#9ca3af"}}>{e.subjectLabel} · {new Date(e.date).toLocaleDateString("fr-FR")}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CTA if no exercises */}
      {stats.total===0&&(
        <div style={{textAlign:"center",padding:"2rem 1rem"}}>
          <div style={{fontSize:56,marginBottom:12}}>✏️</div>
          <h3 style={{fontSize:18,fontWeight:800,color:"#1e1b4b",margin:"0 0 8px"}}>Commence ta première révision !</h3>
          <p style={{color:"#6b7280",fontSize:14,margin:"0 0 1.5rem"}}>L'IA va générer un exercice adapté à ton niveau.</p>
          <PBtn onClick={onGoExercises} style={{maxWidth:280,margin:"0 auto"}}>Faire un exercice →</PBtn>
        </div>
      )}
    </div>
  );
}

// ── TAB: RESSOURCES ───────────────────────────────────────────────────────────
function ResourcesTab({user}) {
  const [selectedSubject,setSelectedSubject] = useState(null);
  const available = getSubjectsForStudent(user.level||"3ème", user.series);

  if (selectedSubject) {
    const subj = SUBJECTS.find(s=>s.id===selectedSubject);
    const res  = RESOURCES[selectedSubject] || [];
    return (
      <div className="page anim">
        <BackBtn onClick={()=>setSelectedSubject(null)} label={`← ${subj?.label}`}/>
        <h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px"}}>{subj?.sym} {subj?.label}</h2>
        <p style={{color:"#6b7280",fontSize:14,margin:"0 0 1.25rem"}}>Ressources gratuites pour {user.level}</p>
        {res.length===0&&<p style={{color:"#9ca3af",textAlign:"center",padding:"2rem"}}>Ressources bientôt disponibles.</p>}
        {res.map((r,i)=>(
          <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
            style={{display:"block",textDecoration:"none",marginBottom:10}}>
            <div className="card" style={{transition:"all .2s",cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                <span style={{fontSize:22,flexShrink:0}}>
                  {r.type==="video"?"▶️":r.type==="pdf"?"📄":"🌐"}
                </span>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{margin:"0 0 4px",fontSize:14,fontWeight:700,color:"#1e1b4b"}}>{r.title}</p>
                  <p style={{margin:0,fontSize:12,color:"#6b7280",lineHeight:1.5}}>{r.desc}</p>
                </div>
                <span style={{color:"#9ca3af",fontSize:18,flexShrink:0}}>↗</span>
              </div>
            </div>
          </a>
        ))}
        <div style={{background:"#fef3c7",borderRadius:12,padding:"1rem",border:"1px solid #fde68a",marginTop:8}}>
          <p style={{margin:0,fontSize:12,color:"#92400e",lineHeight:1.6}}>💡 Ces ressources sont gratuites et s'ouvrent dans ton navigateur. Elles ne sont pas hébergées par EduCorrect.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page anim">
      <h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px"}}>📚 Ressources gratuites</h2>
      <p style={{color:"#6b7280",fontSize:14,margin:"0 0 1.5rem"}}>Vidéos, cours et exercices sélectionnés pour le programme sénégalais</p>
      <div className="g2">
        {available.map(s=>(
          <button key={s.id} onClick={()=>setSelectedSubject(s.id)}
            style={{padding:"1.1rem",minHeight:80,background:"white",border:`2px solid ${s.bg}`,borderRadius:14,cursor:"pointer",textAlign:"left",transition:"all .15s",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
            <div style={{width:40,height:40,borderRadius:10,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:s.color,flexShrink:0}}>
              {s.sym}
            </div>
            <div>
              <p style={{margin:0,fontWeight:700,fontSize:13,color:"#1e1b4b"}}>{s.label}</p>
              <p style={{margin:0,fontSize:11,color:"#9ca3af"}}>{(RESOURCES[s.id]||[]).length} ressource{(RESOURCES[s.id]||[]).length!==1?"s":""}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── TAB: PROFIL ───────────────────────────────────────────────────────────────
function ProfileTab({user,onLogout,onUpdateUser}) {
  const [editing,setEditing] = useState(false);
  const [name,setName]       = useState(user.name);
  const stats = getStats(user.id);

  const save = () => {
    const u = updateUser({...user, name: name.trim()||user.name});
    onUpdateUser(u);
    setEditing(false);
  };

  return (
    <div className="page anim">
      <h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:"0 0 1.5rem"}}>👤 Mon profil</h2>

      {/* Avatar + info */}
      <div className="card" style={{marginBottom:14,textAlign:"center"}}>
        <div style={{width:70,height:70,borderRadius:"50%",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:28,fontWeight:900,color:"white"}}>
          {user.name[0]?.toUpperCase()}
        </div>
        {editing?(
          <>
            <input value={name} onChange={e=>setName(e.target.value)}
              style={{width:"100%",padding:".65rem 1rem",border:"2px solid #4f46e5",borderRadius:8,fontSize:16,textAlign:"center",marginBottom:10,WebkitTextSizeAdjust:"100%"}}/>
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
            <button onClick={()=>setEditing(true)} style={{background:"none",border:"1px solid #e5e7eb",borderRadius:8,padding:".5rem 1rem",cursor:"pointer",color:"#6b7280",fontSize:13}}>
              ✏️ Modifier le prénom
            </button>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="g2" style={{marginBottom:14}}>
        {[
          {n:stats.total,    l:"Exercices réalisés",c:"#4f46e5"},
          {n:stats.avg,      l:"Score moyen /20",   c:"#10b981"},
          {n:stats.best,     l:"Meilleur score",    c:"#f59e0b"},
          {n:`${stats.streak}j`,l:"Streak actuel",  c:"#ef4444"},
        ].map(s=>(
          <div key={s.l} className="card" style={{textAlign:"center",padding:"1rem .75rem"}}>
            <div style={{fontSize:24,fontWeight:900,color:s.c,marginBottom:2}}>{s.n}</div>
            <div style={{fontSize:11,color:"#9ca3af"}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Logout */}
      <button onClick={onLogout} style={{width:"100%",padding:"1rem",border:"2px solid #fecaca",borderRadius:12,background:"#fef2f2",color:"#dc2626",fontWeight:700,cursor:"pointer",fontSize:15}}>
        Se déconnecter
      </button>

      <p style={{textAlign:"center",fontSize:11,color:"#d1d5db",marginTop:"1.5rem"}}>EduCorrect · Programme sénégalais (MENFP) · Propulsé par Claude AI</p>
    </div>
  );
}

// ── TAB: EXERCICES ────────────────────────────────────────────────────────────
function ExercisesTab({user}) {
  // Sub-steps: subject → mode → topic|upload → exercise → result
  const [xStep, setXStep]       = useState("subject");
  const [subject, setSubject]   = useState("");
  const [topic,   setTopic]     = useState("");
  const [exercise,setExercise]  = useState(null);
  const [correction,setCorr]    = useState(null);
  const [difficulty,setDiff]    = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const available = getSubjectsForStudent(user.level||"3ème", user.series);
  const subj      = SUBJECTS.find(s=>s.id===subject);
  const dColor    = DIFF_COLORS[difficulty-1];

  const reset = () => { setXStep("subject"); setSubject(""); setTopic(""); setExercise(null); setCorr(null); setError(null); };

  // ─ Generate ────────────────────────────────────────────────────────────────
  const doGenerate = useCallback(async (lvl,subj,tp,diff) => {
    setLoading(true); setError(null);
    try {
      const group  = getLevelGroup(lvl);
      const serie  = user.series ? ` (Série ${user.series})` : "";
      const raw = await callClaude(
        `Tu es professeur au Sénégal. Crée un exercice de ${subj} sur "${tp}" pour un élève de ${lvl}${serie}, cycle ${group}, difficulté ${diff}/5 (${DIFF_LABELS[diff-1].toLowerCase()}). Respecte strictement le programme officiel sénégalais (MENFP).

Réponds UNIQUEMENT en JSON valide sans markdown:
{"title":"Titre","instructions":"Consigne courte","questions":[{"id":1,"text":"Énoncé complet","points":8},{"id":2,"text":"Énoncé complet","points":12}],"totalPoints":20,"duration":"X min"}

RÈGLES: total=20pts, 2-4 questions, programme sénégalais ${lvl}${serie}.`
      );
      setExercise(parseJSON(raw));
      setXStep("exercise");
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [user]);

  // ─ Parse uploaded exercise ──────────────────────────────────────────────────
  const doParse = useCallback(async (fd) => {
    setLoading(true); setError(null);
    const prompt = `Tu es professeur au Sénégal. Un élève de ${user.level} en ${subject} te soumet cet exercice.

Extrais et structure. Réponds UNIQUEMENT en JSON valide sans markdown:
{"title":"Titre","topic":"Thème précis","instructions":"Consigne","questions":[{"id":1,"text":"Énoncé exact","points":5}],"totalPoints":20,"duration":"X min","source":"uploaded"}

Règle: total=20pts, proportionnel à la difficulté de chaque question.`;
    try {
      let raw;
      if      (fd.type==="pdf")   raw = await callClaudePDF(fd.base64, prompt);
      else if (fd.type==="image") raw = await callClaudeVision(fd.base64, fd.mediaType, prompt);
      else                        raw = await callClaude(`${prompt}\n\nDOCUMENT:\n${fd.content}`);
      const parsed = parseJSON(raw);
      setTopic(parsed.topic||"exercice uploadé");
      setExercise({...parsed, source:"uploaded"});
      setXStep("exercise");
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [user, subject]);

  // ─ Correct ─────────────────────────────────────────────────────────────────
  const doCorrect = useCallback(async (ans) => {
    if (!exercise) return;
    setLoading(true); setError(null);
    const base = `Tu es professeur bienveillant au Sénégal, corrigeant un exercice de ${subject} pour ${user.level}${user.series?" Série "+user.series:""}.

EXERCICE: ${exercise.title} | ${(exercise.questions||[]).map(q=>`Q${q.id}(${q.points}pts): ${q.text}`).join(" | ")} | Total: ${exercise.totalPoints||20}pts

{ANSWER}

Réponds UNIQUEMENT en JSON valide sans markdown:
{"score":<0-20>,"appreciation":"Excellent|Très bien|Bien|Assez bien|Passable|À améliorer|Insuffisant","feedback":"Commentaire 2-3 phrases","corrections":[{"questionId":1,"pointsObtenus":<n>,"pointsMax":<n>,"commentaire":"Commentaire pédagogique"}],"fullCorrection":"Correction complète avec bonnes réponses","points_forts":["..."],"points_ameliorer":["..."]}`;
    try {
      let raw;
      if (ans.type==="image") raw = await callClaudeVision(ans.base64, ans.mediaType, base.replace("{ANSWER}","RÉPONSE: [Voir image jointe]"));
      else                    raw = await callClaude(base.replace("{ANSWER}",`RÉPONSE:\n${ans.content}`));
      const corr = parseJSON(raw);
      // Save to progress
      addExerciseResult(user.id, {
        subject, subjectLabel: subj?.label||subject,
        topic, score: corr.score, difficulty,
        source: exercise.source||"generated",
      });
      if (corr.score>=15) setDiff(d=>Math.min(d+1,5));
      setCorr(corr); setXStep("result");
    } catch(e) { setError(e.message); setXStep("exercise"); }
    finally { setLoading(false); }
  }, [exercise, user, subject, topic, difficulty, subj]);

  if (loading) return <Spinner/>;

  // ─ Subject selection ────────────────────────────────────────────────────────
  if (xStep==="subject") return (
    <div className="page anim">
      <h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px"}}>✏️ Exercices</h2>
      <p style={{color:"#6b7280",fontSize:14,margin:"0 0 1.5rem"}}>Quelle matière veux-tu travailler ?</p>
      {error&&<p style={{color:"#dc2626",fontSize:13,background:"#fef2f2",padding:".75rem",borderRadius:10,marginBottom:12}}>⚠ {error}</p>}
      <div className="g2">
        {available.map(s=>(
          <button key={s.id} onClick={()=>{setSubject(s.id);setXStep("mode");}}
            style={{padding:"1rem",minHeight:64,background:"white",border:`2px solid ${s.bg}`,borderRadius:14,cursor:"pointer",textAlign:"left",transition:"all .15s",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
            <div style={{width:38,height:38,borderRadius:10,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:s.color,flexShrink:0}}>{s.sym}</div>
            <span style={{fontWeight:600,fontSize:13,color:"#1e1b4b"}}>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ─ Mode ─────────────────────────────────────────────────────────────────────
  if (xStep==="mode") return (
    <div className="page anim">
      <BackBtn onClick={()=>setXStep("subject")}/>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:"1.5rem"}}>
        <div style={{width:44,height:44,borderRadius:10,background:subj?.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:subj?.color,flexShrink:0}}>{subj?.sym}</div>
        <div>
          <h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:0}}>{subj?.label}</h2>
          <p style={{margin:0,fontSize:13,color:"#9ca3af"}}>{user.level}{user.series?` · Série ${user.series}`:""}</p>
        </div>
      </div>
      <div className="g2" style={{gap:16}}>
        <button onClick={()=>setXStep("topic")} style={{padding:"1.5rem",minHeight:170,borderRadius:14,border:"2px solid #e0e7ff",background:"white",cursor:"pointer",textAlign:"left",transition:"all .2s",display:"flex",flexDirection:"column",gap:10}}>
          <span style={{fontSize:36}}>✨</span>
          <div>
            <p style={{margin:"0 0 6px",fontSize:15,fontWeight:800,color:"#1e1b4b"}}>Générer un exercice</p>
            <p style={{margin:0,fontSize:12,color:"#6b7280",lineHeight:1.5}}>L'IA crée un exercice adapté à ton programme sénégalais</p>
          </div>
          <span style={{marginTop:"auto",fontSize:12,fontWeight:700,color:"#4f46e5"}}>Choisir un thème →</span>
        </button>
        <button onClick={()=>setXStep("upload")} style={{padding:"1.5rem",minHeight:170,borderRadius:14,border:"2px solid #fef3c7",background:"white",cursor:"pointer",textAlign:"left",transition:"all .2s",display:"flex",flexDirection:"column",gap:10}}>
          <span style={{fontSize:36}}>📄</span>
          <div>
            <p style={{margin:"0 0 6px",fontSize:15,fontWeight:800,color:"#1e1b4b"}}>Mon exercice</p>
            <p style={{margin:0,fontSize:12,color:"#6b7280",lineHeight:1.5}}>Téléverse un exercice reçu en classe</p>
          </div>
          <span style={{marginTop:"auto",fontSize:12,fontWeight:700,color:"#d97706"}}>Téléverser →</span>
        </button>
      </div>
    </div>
  );

  // ─ Topic ────────────────────────────────────────────────────────────────────
  if (xStep==="topic") {
    const suggestions = getTopicsForStudent(subject, user.level||"3ème", user.series);
    return (
      <div className="page anim">
        <BackBtn onClick={()=>setXStep("mode")}/>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:"1.25rem"}}>
          <div style={{width:44,height:44,borderRadius:10,background:subj?.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:subj?.color,flexShrink:0}}>{subj?.sym}</div>
          <div>
            <h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:0}}>{subj?.label}</h2>
            <p style={{margin:0,fontSize:12,color:"#9ca3af"}}>Programme {user.level}{user.series?` · Série ${user.series}`:""}</p>
          </div>
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
            placeholder="Ex: Cinétique chimique..."
            style={{width:"100%",padding:".8rem 1rem",border:`2px solid ${topic?subj?.color||"#4f46e5":"#e5e7eb"}`,borderRadius:8,fontSize:16,transition:"border-color .2s",WebkitTextSizeAdjust:"100%"}}/>
        </div>
        <PBtn onClick={()=>topic.trim()&&doGenerate(user.level,subject,topic.trim(),difficulty)} disabled={!topic.trim()}>Générer l'exercice ✨</PBtn>
      </div>
    );
  }

  // ─ Upload ───────────────────────────────────────────────────────────────────
  if (xStep==="upload") return <UploadExercise subj={subj} user={user} onParsed={doParse} onBack={()=>setXStep("mode")}/>;

  // ─ Exercise ─────────────────────────────────────────────────────────────────
  if (xStep==="exercise" && exercise) return (
    <ExerciseView subj={subj} exercise={exercise} difficulty={difficulty} dColor={dColor}
      onSubmit={doCorrect} onBack={()=>setXStep("mode")} error={error}/>
  );

  // ─ Result ───────────────────────────────────────────────────────────────────
  if (xStep==="result" && correction) return (
    <ResultView correction={correction} difficulty={difficulty} isUploaded={exercise?.source==="uploaded"}
      onNext={()=>{setCorr(null);doGenerate(user.level,subject,topic,difficulty);}}
      onRetry={()=>{setCorr(null);setXStep("exercise");}}
      onNew={reset}/>
  );

  return null;
}

// ─ Upload sub-component ───────────────────────────────────────────────────────
function UploadExercise({subj,user,onParsed,onBack}) {
  const [file,setFile]     = useState(null);
  const [fd,setFd]         = useState(null);
  const [proc,setProc]     = useState(false);
  const [err,setErr]       = useState("");
  const ref = useRef();

  const handle = async (e) => {
    const f=e.target.files[0]; if(!f)return;
    setProc(true); setErr(""); setFd(null);
    try {
      if (f.type==="application/pdf") {
        setFd({type:"pdf",base64:await toB64(f),name:f.name}); setFile(f);
      } else if (f.type.startsWith("image/")) {
        setFd({type:"image",base64:await toB64(f),mediaType:f.type,name:f.name}); setFile(f);
      } else if (f.name.endsWith(".docx")) {
        try {
          const m = await import("mammoth");
          const r = await m.extractRawText({arrayBuffer:await f.arrayBuffer()});
          if (!r.value.trim()) {setErr("Document vide. Exporte en PDF."); return;}
          setFd({type:"text",content:r.value,name:f.name}); setFile(f);
        } catch { setErr("Impossible de lire ce .docx. Exporte en PDF."); }
      } else if (f.type.startsWith("text/")||f.name.endsWith(".txt")) {
        const t=await f.text();
        if(!t.trim()){setErr("Fichier texte vide.");return;}
        setFd({type:"text",content:t,name:f.name}); setFile(f);
      } else { setErr("Format non supporté. Utilise PDF, image, .txt ou .docx."); }
    } catch(ex){setErr(ex.message);}
    finally{setProc(false);}
  };

  return (
    <div className="page anim">
      <BackBtn onClick={onBack}/>
      <h2 style={{fontSize:20,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px"}}>Téléverse ton exercice</h2>
      <p style={{color:"#6b7280",fontSize:14,margin:"0 0 1.25rem"}}>{subj?.label} · {user.level}</p>
      <input type="file" ref={ref} onChange={handle} accept=".pdf,.txt,.docx,image/*" style={{display:"none"}}/>
      <div onClick={()=>!proc&&ref.current?.click()} style={{border:`2px dashed ${fd?"#4f46e5":"#d1d5db"}`,borderRadius:16,padding:"2rem 1.5rem",textAlign:"center",cursor:proc?"wait":"pointer",background:fd?"#eef2ff":"#fafaf9",marginBottom:12,minHeight:180,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>
        {proc?<p style={{margin:0,color:"#4f46e5",fontWeight:600}}>⏳ Lecture...</p>
          :fd?(<div><div style={{fontSize:40,marginBottom:8}}>✅</div><p style={{margin:"0 0 4px",fontWeight:700,color:"#1e1b4b",fontSize:13}}>{file?.name}</p><p style={{margin:0,fontSize:11,color:"#9ca3af"}}>Appuyer pour changer</p></div>)
          :(<div><div style={{fontSize:48,marginBottom:10}}>📄</div><p style={{margin:"0 0 4px",fontWeight:700,color:"#374151"}}>Appuyer pour choisir</p><p style={{margin:0,fontSize:12,color:"#9ca3af"}}>PDF · Photo · Texte · Word</p></div>)
        }
      </div>
      {err&&<p style={{color:"#dc2626",fontSize:13,background:"#fef2f2",padding:".75rem",borderRadius:10,marginBottom:12}}>⚠ {err}</p>}
      <div style={{background:"#fffbeb",borderRadius:10,padding:".875rem",marginBottom:16,border:"1px solid #fde68a"}}>
        <p style={{margin:0,fontSize:12,color:"#92400e",lineHeight:1.6}}>💡 Pour un exercice sur papier, prends une photo nette. L'IA reconnaît l'écriture.</p>
      </div>
      <PBtn onClick={()=>fd&&onParsed(fd)} disabled={!fd||proc}
        style={{background:fd&&!proc?"linear-gradient(135deg,#d97706,#f59e0b)":"#e5e7eb",boxShadow:fd&&!proc?"0 4px 14px rgba(217,119,6,.3)":"none"}}>
        {proc?"Traitement...":"Analyser avec l'IA →"}
      </PBtn>
    </div>
  );
}

// ─ ExerciseView ───────────────────────────────────────────────────────────────
function ExerciseView({subj,exercise,difficulty,dColor,onSubmit,onBack,error}) {
  const [answers,setAnswers] = useState({});
  const [fd,setFd]           = useState(null);
  const [upl,setUpl]         = useState(false);
  const ref = useRef();
  const hasAns = fd||Object.values(answers).some(v=>v?.trim());

  const submit = () => {
    if (fd){onSubmit(fd);return;}
    onSubmit({type:"text",content:(exercise.questions||[]).map(q=>`Q${q.id}(${q.points}pts): ${q.text}\nRép: ${answers[q.id]||"(vide)"}`).join("\n\n")});
  };
  const handleFile = async e => {
    const f=e.target.files[0]; if(!f)return; setUpl(true);
    try {
      if(f.type.startsWith("image/"))setFd({type:"image",mediaType:f.type,base64:await toB64(f),name:f.name});
      else setFd({type:"text",content:await f.text(),name:f.name});
    }finally{setUpl(false);}
  };

  return (
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
            <textarea value={answers[q.id]||""} rows={3}
              onChange={e=>setAnswers(p=>({...p,[q.id]:e.target.value}))}
              placeholder={`Réponse ${i+1}...`}
              style={{width:"100%",padding:".75rem",border:`2px solid ${answers[q.id]?.trim()?"#c7d2fe":"#e5e7eb"}`,borderRadius:8,fontSize:15,resize:"vertical",lineHeight:1.6,WebkitTextSizeAdjust:"100%"}}/>
          </div>
        ))}
      </div>
      <div className="card" style={{marginBottom:12}}>
        <p style={{margin:"0 0 10px",fontSize:13,fontWeight:600,color:"#374151"}}>📎 Ou téléverse ta réponse (photo/.txt)</p>
        <input type="file" ref={ref} onChange={handleFile} accept=".txt,image/*" style={{display:"none"}}/>
        {!fd?<button onClick={()=>ref.current?.click()} style={{width:"100%",padding:".875rem",minHeight:50,border:"2px dashed #d1d5db",borderRadius:10,background:"#fafaf9",color:"#6b7280",cursor:"pointer",fontSize:14}}>{upl?"Chargement...":"Appuyer pour choisir"}</button>
          :<div style={{display:"flex",alignItems:"center",gap:10,padding:".75rem",background:"#f0fdf4",borderRadius:8,border:"1px solid #bbf7d0"}}>
            <span style={{flexShrink:0}}>✅</span>
            <p style={{margin:0,fontSize:13,fontWeight:600,color:"#166534",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fd.name}</p>
            <button onClick={()=>{setFd(null);if(ref.current)ref.current.value="";}} style={{background:"none",border:"none",cursor:"pointer",color:"#6b7280",fontSize:22,padding:"4px 8px",minHeight:44}}>×</button>
          </div>
        }
      </div>
      <PBtn onClick={submit} disabled={!hasAns}
        style={{background:hasAns?"linear-gradient(135deg,#059669,#10b981)":"#e5e7eb",boxShadow:hasAns?"0 4px 14px rgba(16,185,129,.32)":"none"}}>
        Soumettre ma réponse ✓
      </PBtn>
    </div>
  );
}

// ─ ResultView ─────────────────────────────────────────────────────────────────
function ResultView({correction,difficulty,isUploaded,onNext,onRetry,onNew}) {
  const pass   = correction.score>=15;
  const sColor = correction.score>=15?"#10b981":correction.score>=10?"#f59e0b":"#ef4444";
  const pct    = Math.round((correction.score/20)*100);

  return (
    <div className="page-w anim">
      <div style={{background:pass?"#ecfdf5":correction.score>=10?"#fffbeb":"#fef2f2",border:`2px solid ${pass?"#6ee7b7":correction.score>=10?"#fcd34d":"#fca5a5"}`,borderRadius:16,padding:"1.5rem",marginBottom:14,textAlign:"center"}}>
        {pass&&<div style={{fontSize:13,fontWeight:700,color:"#059669",marginBottom:8,letterSpacing:".06em"}}>🏆 EXCELLENT TRAVAIL !</div>}
        <div style={{fontSize:"clamp(42px,10vw,64px)",fontWeight:900,lineHeight:1,marginBottom:4,color:sColor}}>
          {correction.score}<span style={{fontSize:"clamp(18px,5vw,28px)",fontWeight:400,color:"#9ca3af"}}>/20</span>
        </div>
        <div style={{fontSize:15,fontWeight:700,color:pass?"#065f46":correction.score>=10?"#92400e":"#991b1b",marginBottom:"1rem"}}>{correction.appreciation}</div>
        <div style={{background:"#e5e7eb",borderRadius:99,height:10,marginBottom:"1rem",overflow:"hidden"}}>
          <div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${sColor},${sColor}bb)`,borderRadius:99,transition:"width .9s ease"}}/>
        </div>
        <p style={{margin:0,color:"#4b5563",fontSize:14,lineHeight:1.7}}>{correction.feedback}</p>
      </div>

      {correction.corrections?.length>0&&(
        <div className="card" style={{marginBottom:12}}>
          <h3 style={{margin:"0 0 12px",fontSize:15,fontWeight:700,color:"#1e1b4b"}}>Détail par question</h3>
          {correction.corrections.map((c,i,arr)=>{
            const r=c.pointsMax>0?c.pointsObtenus/c.pointsMax:0;
            const col=r>=.75?"#10b981":r>=.5?"#f59e0b":"#ef4444";
            return (
              <div key={i} style={{padding:".875rem",borderRadius:10,background:`${col}0d`,border:`1px solid ${col}30`,marginBottom:i<arr.length-1?8:0}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontWeight:600,fontSize:14,color:"#1f2937"}}>Question {c.questionId}</span>
                  <span style={{fontWeight:700,color:col,fontSize:14}}>{c.pointsObtenus}/{c.pointsMax} pts</span>
                </div>
                <p style={{margin:0,fontSize:13,color:"#6b7280",lineHeight:1.55}}>{c.commentaire}</p>
              </div>
            );
          })}
        </div>
      )}

      {(correction.points_forts?.length>0||correction.points_ameliorer?.length>0)&&(
        <div className="g2" style={{marginBottom:12}}>
          {correction.points_forts?.length>0&&<div style={{background:"#ecfdf5",borderRadius:12,padding:"1rem",border:"1px solid #a7f3d0"}}>
            <p style={{margin:"0 0 8px",fontSize:11,fontWeight:800,color:"#065f46",textTransform:"uppercase",letterSpacing:".06em"}}>✓ Points forts</p>
            {correction.points_forts.map((p,i)=><p key={i} style={{margin:"0 0 3px",fontSize:12,color:"#047857"}}>· {p}</p>)}
          </div>}
          {correction.points_ameliorer?.length>0&&<div style={{background:"#fffbeb",borderRadius:12,padding:"1rem",border:"1px solid #fde68a"}}>
            <p style={{margin:"0 0 8px",fontSize:11,fontWeight:800,color:"#92400e",textTransform:"uppercase",letterSpacing:".06em"}}>→ À travailler</p>
            {correction.points_ameliorer.map((p,i)=><p key={i} style={{margin:"0 0 3px",fontSize:12,color:"#b45309"}}>· {p}</p>)}
          </div>}
        </div>
      )}

      {pass&&correction.fullCorrection&&(
        <div style={{background:"#eef2ff",borderRadius:14,padding:"1.25rem",marginBottom:14,border:"1px solid #c7d2fe"}}>
          <h3 style={{margin:"0 0 10px",fontSize:15,fontWeight:700,color:"#3730a3"}}>📚 Correction complète</h3>
          <div style={{fontSize:13,color:"#1e1b4b",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{correction.fullCorrection}</div>
        </div>
      )}
      {!pass&&<div style={{background:"#fef2f2",borderRadius:12,padding:"1rem",marginBottom:14,border:"1px solid #fecaca",textAlign:"center"}}>
        <p style={{margin:0,fontSize:13,color:"#dc2626",fontWeight:600}}>🔒 Correction complète à partir de 15/20</p>
        <p style={{margin:"4px 0 0",fontSize:12,color:"#9ca3af"}}>Encore {15-correction.score} point{15-correction.score>1?"s":""} pour débloquer</p>
      </div>}

      <div className="row" style={{marginBottom:10}}>
        <button onClick={onRetry} style={{flex:1,padding:"1rem",minHeight:50,border:"2px solid #e5e7eb",borderRadius:12,background:"white",color:"#374151",fontWeight:600,cursor:"pointer",fontSize:14}}>↩ Réessayer</button>
        <button onClick={onNext} style={{flex:2,padding:"1rem",minHeight:50,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"white",border:"none",borderRadius:12,fontWeight:700,cursor:"pointer",fontSize:14,boxShadow:"0 4px 12px rgba(79,70,229,.28)"}}>
          {pass&&difficulty<5?`Suivant — Niv. ${DIFF_LABELS[Math.min(difficulty,4)]} →`:"Nouvel exercice →"}
        </button>
      </div>
      <button onClick={onNew} style={{width:"100%",padding:".75rem",minHeight:44,background:"none",border:"1px solid #e5e7eb",borderRadius:10,color:"#9ca3af",cursor:"pointer",fontSize:13}}>
        Choisir une autre matière
      </button>
      <p style={{textAlign:"center",fontSize:12,color:"#9ca3af",margin:"10px 0 0"}}>
        {pass&&difficulty<5?"🎯 La difficulté augmentera au prochain exercice.":!pass?"💪 Correction complète disponible à 15/20 !":"🏆 Niveau maximum !"}
      </p>
    </div>
  );
}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,  setScreen]  = useState("loading"); // loading|landing|auth|onboarding|app
  const [user,    setUser]    = useState(null);
  const [tab,     setTab]     = useState("dashboard");

  // Restore session on mount
  useEffect(() => {
    const u = getCurrentUser();
    if (u) {
      setUser(u);
      setScreen(u.level ? "app" : "onboarding");
    } else {
      setScreen("landing");
    }
  }, []);

  const handleAuthSuccess = (u, needsOnboarding) => {
    setUser(u);
    setScreen(needsOnboarding ? "onboarding" : "app");
  };
  const handleOnboardingDone = (u) => { setUser(u); setScreen("app"); };
  const handleLogout = () => { logoutUser(); setUser(null); setScreen("landing"); };
  const handleUpdateUser = (u) => setUser(u);

  if (screen==="loading") return (
    <div style={{minHeight:"100vh",background:"#f5f3ff",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <Spinner/>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      {screen==="landing"   && <Landing onGetStarted={()=>setScreen("auth")}/>}
      {screen==="auth"      && <AuthScreen onSuccess={handleAuthSuccess} onBack={()=>setScreen("landing")}/>}
      {screen==="onboarding"&& user && <Onboarding user={user} onDone={handleOnboardingDone}/>}
      {screen==="app"       && user && (
        <AppShell user={user} tab={tab} setTab={setTab}>
          {tab==="dashboard"  && <DashboardTab user={user} onGoExercises={()=>setTab("exercises")}/>}
          {tab==="exercises"  && <ExercisesTab user={user}/>}
          {tab==="resources"  && <ResourcesTab user={user}/>}
          {tab==="profile"    && <ProfileTab user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser}/>}
        </AppShell>
      )}
    </>
  );
}
