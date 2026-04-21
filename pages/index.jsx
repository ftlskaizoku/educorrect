// EduCorrect — Assistant pédagogique IA
// Next.js version — API via proxy sécurisé /api/claude
import { useState, useRef, useCallback } from "react";

// ── NIVEAUX ───────────────────────────────────────────────────────────────────

const LEVELS = [
  { id: "CP",        label: "CP",        group: "Primaire" },
  { id: "CE1",       label: "CE1",       group: "Primaire" },
  { id: "CE2",       label: "CE2",       group: "Primaire" },
  { id: "CM1",       label: "CM1",       group: "Primaire" },
  { id: "CM2",       label: "CM2",       group: "Primaire" },
  { id: "6ème",      label: "6ème",      group: "Collège"  },
  { id: "5ème",      label: "5ème",      group: "Collège"  },
  { id: "4ème",      label: "4ème",      group: "Collège"  },
  { id: "3ème",      label: "3ème",      group: "Collège"  },
  { id: "Seconde",   label: "Seconde",   group: "Lycée"    },
  { id: "Première",  label: "Première",  group: "Lycée"    },
  { id: "Terminale", label: "Terminale", group: "Lycée"    },
];

// Retourne "primaire" | "college" | "lycee" pour un identifiant de niveau
function getLevelGroup(levelId) {
  if (["CP","CE1","CE2","CM1","CM2"].includes(levelId))          return "primaire";
  if (["6ème","5ème","4ème","3ème"].includes(levelId))           return "college";
  return "lycee";
}

// ── MATIÈRES PAR CYCLE ────────────────────────────────────────────────────────
// Chaque matière déclare dans quels cycles elle est disponible.
// "primaire" = CP→CM2 | "college" = 6ème→3ème | "lycee" = Seconde→Terminale

const SUBJECTS = [
  // ─ Toujours disponibles ─────────────────────────────────────────────────
  { id: "mathematiques", label: "Mathématiques",    sym: "∑",   color: "#2563eb", bg: "#eff6ff",
    cycles: ["primaire","college","lycee"] },
  { id: "francais",      label: "Français",         sym: "Aa",  color: "#7c3aed", bg: "#f5f3ff",
    cycles: ["primaire","college","lycee"] },
  { id: "histoire",      label: "Histoire-Géo",     sym: "◈",   color: "#d97706", bg: "#fffbeb",
    cycles: ["primaire","college","lycee"] },
  { id: "anglais",       label: "Anglais",          sym: "EN",  color: "#0891b2", bg: "#ecfeff",
    cycles: ["primaire","college","lycee"] },

  // ─ Primaire uniquement ───────────────────────────────────────────────────
  { id: "sciences",      label: "Sciences & Nature", sym: "🌿", color: "#059669", bg: "#ecfdf5",
    cycles: ["primaire"] },
  { id: "morale",        label: "EMC / Morale",      sym: "🤝", color: "#0ea5e9", bg: "#e0f2fe",
    cycles: ["primaire"] },

  // ─ Collège + Lycée ───────────────────────────────────────────────────────
  { id: "svt",           label: "SVT",              sym: "◉",   color: "#16a34a", bg: "#f0fdf4",
    cycles: ["college","lycee"] },
  { id: "physique",      label: "Physique-Chimie",  sym: "⚗",   color: "#dc2626", bg: "#fef2f2",
    cycles: ["college","lycee"] },
  { id: "technologie",   label: "Technologie",      sym: "⚙",   color: "#64748b", bg: "#f8fafc",
    cycles: ["college"] },

  // ─ Lycée uniquement ─────────────────────────────────────────────────────
  { id: "philosophie",   label: "Philosophie",      sym: "φ",   color: "#9333ea", bg: "#faf5ff",
    cycles: ["lycee"] },
  { id: "informatique",  label: "Informatique",     sym: "</>", color: "#0f766e", bg: "#f0fdfa",
    cycles: ["lycee"] },
  { id: "ses",           label: "SES",              sym: "€",   color: "#b45309", bg: "#fffbeb",
    cycles: ["lycee"] },
];

// Retourne les matières accessibles pour un niveau donné
function getSubjectsForLevel(levelId) {
  const group = getLevelGroup(levelId);
  return SUBJECTS.filter(s => s.cycles.includes(group));
}

// ── SUJETS PAR MATIÈRE ET PAR CYCLE ──────────────────────────────────────────
// Organisés par cycle pour refléter les programmes officiels français.

const TOPICS = {
  mathematiques: {
    primaire: ["Addition / Soustraction","Multiplication / Division","Fractions simples","Géométrie de base","Tables de multiplication","Mesures & grandeurs","Problèmes concrets","Nombres décimaux"],
    college:  ["Fractions","Géométrie plane","Algèbre","Statistiques","Calcul littéral","Fonctions de base","Probabilités","Trigonométrie","Équations du 1er degré","Systèmes d'équations"],
    lycee:    ["Fonctions","Suites numériques","Probabilités avancées","Trigonométrie avancée","Géométrie dans l'espace","Dérivation","Calcul intégral","Matrices","Nombres complexes","Limites"],
  },
  francais: {
    primaire: ["Lecture & compréhension","Écriture et copie","Conjugaison (temps simples)","Grammaire de base","Orthographe lexicale","Dictée","Expression écrite","Vocabulaire"],
    college:  ["Conjugaison","Grammaire","Orthographe","Compréhension de texte","Rédaction","Introduction à l'analyse littéraire","Figures de style","Textes argumentatifs"],
    lycee:    ["Commentaire composé","Dissertation","Contraction de texte","Analyse littéraire avancée","Figures de style avancées","Texte théâtral","Roman & société","Poésie"],
  },
  histoire: {
    primaire: ["Ma ville & ma région","La France","L'Europe","Les grandes inventions","La Préhistoire","Les Gaulois","La Révolution française (intro)","Figures historiques"],
    college:  ["Préhistoire & Antiquité","Moyen Âge","Grandes découvertes","Révolution française","19ème siècle","1ère Guerre mondiale","2ème Guerre mondiale","Décolonisation","Géographie mondiale"],
    lycee:    ["Guerre froide","Mondialisation","Géopolitique contemporaine","Mémoire & histoire","La France depuis 1958","Enjeux environnementaux","Espaces mondialisés","Régimes totalitaires"],
  },
  anglais: {
    primaire: ["Alphabet & phonétique","Couleurs & nombres","Famille & corps","Animaux","Jours & mois","Salutations","Présent simple (être / avoir)","Chansons & comptines"],
    college:  ["Present simple","Past simple","Present perfect","Futur (will / going to)","Vocabulaire du quotidien","Compréhension écrite","Expression écrite","Phrasal verbs","Comparatifs"],
    lycee:    ["Argumentation écrite","Compréhension orale","Expression orale","Temps avancés","Vocabulaire thématique","Textes littéraires","Civilisation anglophone","Traduction"],
  },
  sciences: {
    primaire: ["Les animaux","Les plantes","Le corps humain","L'eau et ses états","Les saisons","La Terre et l'espace","Les matières","Les 5 sens","L'environnement"],
  },
  morale: {
    primaire: ["Vivre ensemble","Le respect","La solidarité","La liberté","Les règles de vie","La justice","Citoyenneté","Le bien commun"],
  },
  svt: {
    college: ["La cellule","Ecosystèmes","Reproduction sexuée","Génétique de base","Photosynthèse","Corps humain & santé","Evolution des espèces","Biodiversité"],
    lycee:   ["Génétique moléculaire","Immunologie","Neurosciences","Evolution & phylogénèse","Ecosystèmes avancés","Géologie","Biotechnologies","Biologie de la reproduction"],
  },
  physique: {
    college: ["Mécanique (forces, mouvement)","Electricité (circuits)","Optique (lumière)","Propriétés de la matière","Réactions chimiques","Mélanges & solutions","Sécurité en chimie"],
    lycee:   ["Mécanique avancée","Thermodynamique","Ondes & acoustique","Optique ondulatoire","Chimie organique","Électricité avancée","Cinétique chimique","Quantique (intro)"],
  },
  technologie: {
    college: ["Systèmes techniques","Matériaux","Énergie","Programmation (Scratch)","Réseaux informatiques","Design & innovation","CAO (dessin technique)"],
  },
  philosophie: {
    lycee: ["La liberté","La connaissance","La morale","L'existence","Le langage","La politique","La vérité","La technique","L'art","La conscience","Le bonheur","Le temps"],
  },
  informatique: {
    lycee: ["Algorithmique","Python — bases","Python — fonctions","Récursivité","Structures de données","HTML / CSS","Bases de données SQL","Réseaux","Cryptographie","Intelligence artificielle (intro)"],
  },
  ses: {
    lycee: ["Marchés et prix","Croissance économique","Inégalités sociales","Mondialisation","Institutions politiques","Stratification sociale","Socialisation","Système de protection sociale","Chômage"],
  },
};

// Retourne les sujets adaptés à une matière et un niveau
function getTopicsForSubjectAndLevel(subjectId, levelId) {
  const group   = getLevelGroup(levelId);
  const byLevel = TOPICS[subjectId];
  if (!byLevel) return [];
  // Priorité : sujets du cycle exact, sinon vider
  return byLevel[group] || byLevel["primaire"] || byLevel["college"] || byLevel["lycee"] || [];
}

// ── NIVEAUX DE DIFFICULTÉ ─────────────────────────────────────────────────────

const DIFF_LABELS = ["Débutant","Facile","Intermédiaire","Difficile","Expert"];
const DIFF_COLORS = ["#10b981","#3b82f6","#f59e0b","#ef4444","#7c3aed"];

// ── URL DU PROXY (jamais l'API Anthropic en direct côté client) ───────────────
const API_URL = "/api/claude";

// ── CSS RESPONSIVE ────────────────────────────────────────────────────────────

const CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  *, *::before, *::after { box-sizing: border-box; }
  input, textarea { font-family: inherit; -webkit-appearance: none; }
  input:focus, textarea:focus { outline: none; box-shadow: 0 0 0 3px rgba(79,70,229,.18); }
  button:not([disabled]):active { transform: scale(.97); }
  .ep  { max-width: 580px; margin: 0 auto; padding: 2.5rem 1.25rem 2rem; }
  .epw { max-width: 700px; margin: 0 auto; padding: 1.5rem 1.25rem 2rem; }
  .ec  { background: white; border-radius: 16px; padding: 1.5rem; box-shadow: 0 1px 6px rgba(0,0,0,.07); }
  .g2  { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; }
  .fa  { display: flex; gap: 10px; }
  .hst { display: block; }
  .snum { font-size: 64px; font-weight: 900; line-height: 1; margin-bottom: 4px; }
  .ssub { font-size: 28px; font-weight: 400; color: #9ca3af; }
  .mcard:hover  { border-color: #4f46e5 !important; box-shadow: 0 4px 16px rgba(79,70,229,.12); transform: translateY(-1px); }
  .mcard-up:hover { border-color: #d97706 !important; box-shadow: 0 4px 16px rgba(217,119,6,.12); transform: translateY(-1px); }
  @media (max-width: 520px) {
    .ep, .epw { padding: 1rem 0.875rem 2rem; }
    .ec  { padding: 1.1rem; border-radius: 14px; }
    .g2  { grid-template-columns: 1fr; }
    .fa  { flex-direction: column; }
    .hst { display: none; }
    .snum { font-size: 48px; }
    .ssub { font-size: 20px; }
  }
`;

// ── API HELPERS ───────────────────────────────────────────────────────────────

async function callClaude(text) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1800, messages: [{ role: "user", content: text }] }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${res.status}`); }
  const d = await res.json();
  return d.content.filter(b => b.type === "text").map(b => b.text).join("");
}

async function callClaudeVision(base64, mediaType, prompt) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 1800,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
        { type: "text", text: prompt },
      ]}],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  return d.content.filter(b => b.type === "text").map(b => b.text).join("");
}

async function callClaudePDF(base64, prompt) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 1800,
      messages: [{ role: "user", content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
        { type: "text", text: prompt },
      ]}],
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `HTTP ${res.status}`); }
  const d = await res.json();
  return d.content.filter(b => b.type === "text").map(b => b.text).join("");
}

function parseJSON(raw) {
  const c = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  try { return JSON.parse(c); } catch {
    const m = c.match(/\{[\s\S]+\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Réponse JSON invalide");
  }
}

const fileToBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file);
});

// ── PRIMITIVES ────────────────────────────────────────────────────────────────

function PBtn({ onClick, disabled, children, style: x = {} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: "1rem", minHeight: 52, border: "none", borderRadius: 12,
      fontSize: 16, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", transition: "all .18s",
      background: disabled ? "#e5e7eb" : "linear-gradient(135deg,#4f46e5,#7c3aed)",
      color: disabled ? "#9ca3af" : "white",
      boxShadow: disabled ? "none" : "0 4px 14px rgba(79,70,229,.28)", ...x,
    }}>{children}</button>
  );
}
function BackBtn({ onClick }) {
  return <button onClick={onClick} style={{ background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:14,padding:"0.5rem 0",marginBottom:"0.875rem",display:"block",minHeight:44 }}>← Retour</button>;
}
function Lbl({ children }) {
  return <label style={{ display:"block",fontWeight:700,marginBottom:10,color:"#111827",fontSize:14 }}>{children}</label>;
}
function Pill({ bg, color, children }) {
  return <span style={{ padding:"0.3rem 0.75rem",borderRadius:20,fontSize:12,fontWeight:700,background:bg,color,whiteSpace:"nowrap" }}>{children}</span>;
}
function Loader({ msg }) {
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"5rem 2rem",gap:20 }}>
      <div style={{ position:"relative",width:60,height:60 }}>
        <div style={{ position:"absolute",inset:0,border:"4px solid #e0e7ff",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin .8s linear infinite" }} />
        <div style={{ position:"absolute",inset:8,border:"3px solid #f0e6ff",borderBottomColor:"#7c3aed",borderRadius:"50%",animation:"spin 1.2s linear infinite reverse" }} />
      </div>
      <div style={{ textAlign:"center" }}>
        <p style={{ margin:"0 0 4px",fontWeight:700,fontSize:16,color:"#1e1b4b" }}>{msg}</p>
        <p style={{ margin:0,fontSize:13,color:"#9ca3af" }}>Quelques secondes...</p>
      </div>
    </div>
  );
}

// ── SCREEN: PROFIL ────────────────────────────────────────────────────────────

function ProfileScreen({ onNext }) {
  const [name, setName]   = useState("");
  const [level, setLevel] = useState("");
  const groups = [...new Set(LEVELS.map(l => l.group))];
  const ok = name.trim() && level;
  return (
    <div className="ep" style={{ maxWidth:500 }}>
      <div style={{ textAlign:"center",marginBottom:"2rem" }}>
        <div style={{ fontSize:52 }}>🎓</div>
        <h1 style={{ fontSize:28,fontWeight:900,color:"#1e1b4b",margin:"8px 0 6px",letterSpacing:"-0.03em" }}>EduCorrect</h1>
        <p style={{ color:"#6b7280",margin:0,fontSize:14 }}>Ton assistant pédagogique propulsé par l'IA</p>
      </div>
      <div className="ec" style={{ marginBottom:14 }}>
        <Lbl>Ton prénom</Lbl>
        <input type="text" value={name} onChange={e=>setName(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&ok&&onNext({name:name.trim(),level})}
          placeholder="Entre ton prénom..."
          style={{ width:"100%",padding:"0.8rem 1rem",border:`2px solid ${name?"#4f46e5":"#e5e7eb"}`,borderRadius:10,fontSize:16,color:"#111827",transition:"border-color .2s",WebkitTextSizeAdjust:"100%" }} />
      </div>
      <div className="ec" style={{ marginBottom:20 }}>
        <Lbl>Ta classe</Lbl>
        {groups.map(g=>(
          <div key={g} style={{ marginBottom:14 }}>
            <p style={{ margin:"0 0 8px",fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".08em" }}>{g}</p>
            <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
              {LEVELS.filter(l=>l.group===g).map(l=>(
                <button key={l.id} onClick={()=>setLevel(l.id)} style={{ padding:"0.5rem 0.9rem",minHeight:44,borderRadius:8,border:`2px solid ${level===l.id?"#4f46e5":"#e5e7eb"}`,background:level===l.id?"#eef2ff":"white",color:level===l.id?"#4f46e5":"#374151",fontWeight:level===l.id?700:400,cursor:"pointer",fontSize:14,transition:"all .15s" }}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <PBtn onClick={()=>ok&&onNext({name:name.trim(),level})} disabled={!ok}>Commencer →</PBtn>
    </div>
  );
}

// ── SCREEN: MATIÈRE ───────────────────────────────────────────────────────────
// Filtre les matières selon le cycle du niveau de l'élève

function SubjectScreen({ student, onNext, onBack }) {
  const [sel, setSel] = useState("");
  const available = getSubjectsForLevel(student.level);
  const group     = getLevelGroup(student.level);
  const groupLabel = group === "primaire" ? "Primaire" : group === "college" ? "Collège" : "Lycée";

  return (
    <div className="ep" style={{ maxWidth:580 }}>
      <BackBtn onClick={onBack} />
      <h2 style={{ fontSize:22,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px" }}>Bonjour {student.name} ! 👋</h2>
      <p style={{ color:"#6b7280",margin:"0 0 1.25rem",fontSize:14 }}>
        Classe de <strong style={{ color:"#4f46e5" }}>{student.level}</strong> ({groupLabel}) — Quelle matière ?
      </p>
      <div className="g2" style={{ marginBottom:20 }}>
        {available.map(s=>(
          <button key={s.id} onClick={()=>setSel(s.id)} style={{ padding:"1rem 1.25rem",minHeight:60,background:sel===s.id?s.color:"white",color:sel===s.id?"white":"#374151",border:`2px solid ${sel===s.id?s.color:"#e5e7eb"}`,borderRadius:12,cursor:"pointer",textAlign:"left",transition:"all .15s",display:"flex",alignItems:"center",gap:12,boxShadow:sel===s.id?`0 4px 12px ${s.color}40`:"0 1px 3px rgba(0,0,0,.05)" }}>
            <span style={{ fontSize:18,fontWeight:800,minWidth:28,textAlign:"center" }}>{s.sym}</span>
            <span style={{ fontWeight:600,fontSize:13,lineHeight:1.3 }}>{s.label}</span>
          </button>
        ))}
      </div>
      <PBtn onClick={()=>sel&&onNext(sel)} disabled={!sel}>Continuer →</PBtn>
    </div>
  );
}

// ── SCREEN: CHOIX DU MODE ─────────────────────────────────────────────────────

function ModeScreen({ student, onGenerate, onUpload, onBack }) {
  const subj = SUBJECTS.find(s=>s.id===student.subject);
  return (
    <div className="ep" style={{ maxWidth:560 }}>
      <BackBtn onClick={onBack} />
      <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:"1.5rem" }}>
        <div style={{ width:44,height:44,borderRadius:10,background:subj?.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:subj?.color,flexShrink:0 }}>{subj?.sym}</div>
        <div>
          <h2 style={{ fontSize:20,fontWeight:800,color:"#1e1b4b",margin:0 }}>Comment veux-tu travailler ?</h2>
          <p style={{ margin:0,fontSize:13,color:"#9ca3af" }}>{subj?.label} · {student.level}</p>
        </div>
      </div>
      <div className="g2" style={{ marginBottom:20,gap:16 }}>
        <button className="mcard" onClick={onGenerate} style={{ padding:"1.5rem",minHeight:180,borderRadius:14,border:"2px solid #e0e7ff",background:"white",cursor:"pointer",textAlign:"left",transition:"all .2s",display:"flex",flexDirection:"column",gap:10 }}>
          <span style={{ fontSize:38 }}>✨</span>
          <div>
            <p style={{ margin:"0 0 6px",fontSize:15,fontWeight:800,color:"#1e1b4b" }}>Générer un exercice</p>
            <p style={{ margin:0,fontSize:13,color:"#6b7280",lineHeight:1.55 }}>L'IA crée un exercice adapté à ton niveau et au thème de ton choix</p>
          </div>
          <span style={{ marginTop:"auto",fontSize:12,fontWeight:700,color:"#4f46e5" }}>Choisir un thème →</span>
        </button>
        <button className="mcard-up" onClick={onUpload} style={{ padding:"1.5rem",minHeight:180,borderRadius:14,border:"2px solid #fef3c7",background:"white",cursor:"pointer",textAlign:"left",transition:"all .2s",display:"flex",flexDirection:"column",gap:10 }}>
          <span style={{ fontSize:38 }}>📄</span>
          <div>
            <p style={{ margin:"0 0 6px",fontSize:15,fontWeight:800,color:"#1e1b4b" }}>Mon exercice</p>
            <p style={{ margin:0,fontSize:13,color:"#6b7280",lineHeight:1.55 }}>Soumettre un exercice reçu en classe pour le faire corriger par l'IA</p>
          </div>
          <span style={{ marginTop:"auto",fontSize:12,fontWeight:700,color:"#d97706" }}>Téléverser un fichier →</span>
        </button>
      </div>
    </div>
  );
}

// ── SCREEN: THÈME ─────────────────────────────────────────────────────────────
// Suggestions filtrées par matière ET par cycle

function TopicScreen({ student, onNext, onBack }) {
  const [topic, setTopic] = useState("");
  const subj       = SUBJECTS.find(s=>s.id===student.subject);
  const suggestions = getTopicsForSubjectAndLevel(student.subject, student.level);
  const ok = topic.trim().length > 0;

  return (
    <div className="ep" style={{ maxWidth:560 }}>
      <BackBtn onClick={onBack} />
      <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:"1.25rem" }}>
        <div style={{ width:44,height:44,borderRadius:10,background:subj?.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:subj?.color,flexShrink:0 }}>{subj?.sym}</div>
        <div>
          <h2 style={{ fontSize:20,fontWeight:800,color:"#1e1b4b",margin:0 }}>{subj?.label}</h2>
          <p style={{ margin:0,fontSize:13,color:"#9ca3af" }}>Programme de {student.level}</p>
        </div>
      </div>
      <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:"1.25rem" }}>
        {suggestions.map(s=>(
          <button key={s} onClick={()=>setTopic(s)} style={{ padding:"0.5rem 0.9rem",minHeight:40,borderRadius:20,border:`2px solid ${topic===s?subj?.color:"#e5e7eb"}`,background:topic===s?subj?.bg:"white",color:topic===s?subj?.color:"#374151",fontWeight:topic===s?700:400,cursor:"pointer",fontSize:13,transition:"all .15s" }}>{s}</button>
        ))}
      </div>
      <div className="ec" style={{ marginBottom:20 }}>
        <Lbl>Ou entre un thème personnalisé</Lbl>
        <input type="text" value={topic} onChange={e=>setTopic(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&ok&&onNext(topic.trim())}
          placeholder="Ex: Les fractions..."
          style={{ width:"100%",padding:"0.8rem 1rem",border:`2px solid ${ok?subj?.color||"#4f46e5":"#e5e7eb"}`,borderRadius:8,fontSize:16,transition:"border-color .2s",WebkitTextSizeAdjust:"100%" }} />
      </div>
      <PBtn onClick={()=>ok&&onNext(topic.trim())} disabled={!ok}>Générer l'exercice ✨</PBtn>
    </div>
  );
}

// ── SCREEN: UPLOAD D'EXERCICE ─────────────────────────────────────────────────

function UploadExerciseScreen({ student, onParsed, onBack }) {
  const [file,       setFile]       = useState(null);
  const [fileData,   setFileData]   = useState(null);
  const [processing, setProcessing] = useState(false);
  const [procErr,    setProcErr]    = useState("");
  const fileRef = useRef();
  const subj = SUBJECTS.find(s=>s.id===student.subject);

  const handleFile = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    setProcessing(true); setProcErr(""); setFileData(null);
    try {
      if (f.type==="application/pdf") {
        setFileData({ type:"pdf", base64: await fileToBase64(f), name:f.name });
        setFile(f);
      } else if (f.type.startsWith("image/")) {
        setFileData({ type:"image", base64: await fileToBase64(f), mediaType:f.type, name:f.name });
        setFile(f);
      } else if (f.name.endsWith(".docx")||f.type.includes("wordprocessingml")) {
        try {
          const mammoth = await import("mammoth");
          const result  = await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() });
          if (!result.value.trim()) { setProcErr("Document Word vide ou illisible. Exporte-le en PDF."); return; }
          setFileData({ type:"text", content:result.value, name:f.name });
          setFile(f);
        } catch { setProcErr("Impossible de lire ce fichier Word. Exporte-le en PDF."); }
      } else if (f.type.startsWith("text/")||f.name.endsWith(".txt")) {
        const text = await f.text();
        if (!text.trim()) { setProcErr("Fichier texte vide."); return; }
        setFileData({ type:"text", content:text, name:f.name });
        setFile(f);
      } else {
        setProcErr("Format non supporté. Utilise PDF, image, .txt ou .docx.");
      }
    } catch(err) { setProcErr(`Erreur: ${err.message}`); }
    finally { setProcessing(false); }
  };

  const emoji = f => f?.type==="application/pdf"?"📕":f?.type?.startsWith("image/")?"🖼️":f?.name?.endsWith(".docx")?"📝":"📄";

  return (
    <div className="ep" style={{ maxWidth:560 }}>
      <BackBtn onClick={onBack} />
      <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:"1.25rem" }}>
        <div style={{ width:44,height:44,borderRadius:10,background:subj?.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:subj?.color,flexShrink:0 }}>{subj?.sym}</div>
        <div>
          <h2 style={{ fontSize:20,fontWeight:800,color:"#1e1b4b",margin:0 }}>Téléverse ton exercice</h2>
          <p style={{ margin:0,fontSize:13,color:"#9ca3af" }}>{subj?.label} · {student.level}</p>
        </div>
      </div>
      <input type="file" ref={fileRef} onChange={handleFile} accept=".pdf,.txt,.docx,image/*" style={{ display:"none" }} />
      <div onClick={()=>!processing&&fileRef.current?.click()} style={{ border:`2px dashed ${fileData?"#4f46e5":"#d1d5db"}`,borderRadius:16,padding:"2rem 1.5rem",textAlign:"center",cursor:processing?"wait":"pointer",background:fileData?"#eef2ff":"#fafaf9",marginBottom:14,transition:"all .2s",minHeight:190,display:"flex",alignItems:"center",justifyContent:"center" }}>
        {processing ? <p style={{ margin:0,fontWeight:600,color:"#4f46e5",fontSize:15 }}>⏳ Lecture du fichier...</p>
          : fileData ? (
            <div>
              <div style={{ fontSize:42,marginBottom:8 }}>{emoji(file)}</div>
              <p style={{ margin:"0 0 4px",fontWeight:700,color:"#1e1b4b",fontSize:14,wordBreak:"break-word",maxWidth:300 }}>{file?.name}</p>
              <p style={{ margin:"0 0 8px",fontSize:12,color:"#10b981",fontWeight:600 }}>✓ Fichier chargé</p>
              <p style={{ margin:0,fontSize:11,color:"#9ca3af" }}>Appuyer pour changer</p>
            </div>
          ) : (
            <div>
              <div style={{ fontSize:50,marginBottom:12 }}>📄</div>
              <p style={{ margin:"0 0 6px",fontWeight:700,color:"#374151",fontSize:15 }}>Appuyer pour choisir ton exercice</p>
              <p style={{ margin:0,fontSize:12,color:"#9ca3af" }}>PDF · Photo · Texte · Word</p>
            </div>
          )}
      </div>
      {procErr && <div style={{ background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"0.75rem 1rem",marginBottom:14 }}><p style={{ margin:0,fontSize:13,color:"#dc2626" }}>⚠️ {procErr}</p></div>}
      <div className="ec" style={{ marginBottom:20,background:"#fffbeb",boxShadow:"none",border:"1px solid #fde68a" }}>
        <p style={{ margin:0,fontSize:13,color:"#92400e",lineHeight:1.6 }}>💡 <strong>Astuce :</strong> Pour un exercice sur papier, prends une photo nette. L'IA lira les questions et les extraira automatiquement.</p>
      </div>
      <PBtn onClick={()=>fileData&&onParsed(fileData)} disabled={!fileData||processing}
        style={{ background:fileData&&!processing?"linear-gradient(135deg,#d97706,#f59e0b)":"#e5e7eb",boxShadow:fileData&&!processing?"0 4px 14px rgba(217,119,6,.3)":"none" }}>
        {processing?"Traitement...":"Analyser avec l'IA →"}
      </PBtn>
    </div>
  );
}

// ── SCREEN: EXERCICE ──────────────────────────────────────────────────────────

function ExerciseScreen({ student, exercise, difficulty, onSubmit, onChangeMode }) {
  const [answers,   setAnswers]   = useState({});
  const [fileData,  setFileData]  = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const subj   = SUBJECTS.find(s=>s.id===student.subject);
  const dColor = DIFF_COLORS[difficulty-1];
  const hasAns = fileData||Object.values(answers).some(v=>v?.trim());
  const isUploaded = exercise?.source==="uploaded";

  const handleAnswerFile = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    setUploading(true);
    try {
      if (f.type.startsWith("image/")) setFileData({ type:"image",mediaType:f.type,base64:await fileToBase64(f),name:f.name });
      else setFileData({ type:"text",content:await f.text(),name:f.name });
    } finally { setUploading(false); }
  };

  const submit = () => {
    if (fileData) { onSubmit(fileData); return; }
    onSubmit({ type:"text", content:(exercise.questions||[]).map(q=>`Q${q.id}(${q.points}pts): ${q.text}\nRéponse: ${answers[q.id]||"(sans réponse)"}`).join("\n\n") });
  };

  return (
    <div className="epw">
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.1rem",flexWrap:"wrap",gap:8 }}>
        <button onClick={onChangeMode} style={{ background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:14,padding:0,minHeight:44 }}>← Retour</button>
        <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
          <Pill bg={subj?.bg} color={subj?.color}>{subj?.label}</Pill>
          <Pill bg={`${dColor}18`} color={dColor}>Niv. {DIFF_LABELS[difficulty-1]}</Pill>
          {isUploaded&&<Pill bg="#fef3c7" color="#92400e">Mon exercice</Pill>}
        </div>
      </div>
      <div className="ec" style={{ marginBottom:14 }}>
        <h2 style={{ fontSize:20,fontWeight:800,color:"#1e1b4b",margin:"0 0 4px" }}>{exercise.title}</h2>
        {exercise.duration&&<p style={{ fontSize:12,color:"#9ca3af",margin:"0 0 1rem" }}>Durée: {exercise.duration} · {exercise.totalPoints||20} pts</p>}
        {exercise.instructions&&(
          <div style={{ background:"#f5f3ff",borderRadius:10,padding:"0.875rem 1rem",marginBottom:"1.25rem",borderLeft:"3px solid #7c3aed" }}>
            <p style={{ margin:0,color:"#374151",fontSize:14,lineHeight:1.65 }}>{exercise.instructions}</p>
          </div>
        )}
        {(exercise.questions||[]).map((q,i,arr)=>(
          <div key={q.id} style={{ marginBottom:20,borderBottom:i<arr.length-1?"1px solid #f3f4f6":"none",paddingBottom:i<arr.length-1?20:0 }}>
            <div style={{ display:"flex",justifyContent:"space-between",gap:12,marginBottom:8 }}>
              <p style={{ margin:0,fontWeight:600,color:"#1f2937",fontSize:15,flex:1,lineHeight:1.5 }}>
                <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",width:24,height:24,background:"#4f46e5",color:"white",borderRadius:6,fontSize:12,fontWeight:700,marginRight:8,verticalAlign:"middle" }}>{i+1}</span>
                {q.text}
              </p>
              <span style={{ fontSize:12,color:"#9ca3af",whiteSpace:"nowrap",fontWeight:600,paddingTop:3 }}>{q.points} pts</span>
            </div>
            <textarea value={answers[q.id]||""} rows={3}
              onChange={e=>setAnswers(p=>({...p,[q.id]:e.target.value}))}
              placeholder={`Réponse ${i+1}...`}
              style={{ width:"100%",padding:"0.75rem",border:`2px solid ${answers[q.id]?.trim()?"#c7d2fe":"#e5e7eb"}`,borderRadius:8,fontSize:15,resize:"vertical",lineHeight:1.6,WebkitTextSizeAdjust:"100%" }} />
          </div>
        ))}
      </div>
      <div className="ec" style={{ marginBottom:14 }}>
        <p style={{ margin:"0 0 10px",fontSize:13,fontWeight:600,color:"#374151" }}>📎 Ou téléverse ta réponse (photo, image, .txt)</p>
        <input type="file" ref={fileRef} onChange={handleAnswerFile} accept=".txt,image/*" style={{ display:"none" }} />
        {!fileData
          ? <button onClick={()=>fileRef.current?.click()} style={{ width:"100%",padding:"0.875rem",minHeight:52,border:"2px dashed #d1d5db",borderRadius:10,background:"#fafaf9",color:"#6b7280",cursor:"pointer",fontSize:14 }}>
              {uploading?"Chargement...":"Appuyer pour choisir un fichier"}
            </button>
          : <div style={{ display:"flex",alignItems:"center",gap:10,padding:"0.75rem",background:"#f0fdf4",borderRadius:8,border:"1px solid #bbf7d0" }}>
              <span style={{ fontSize:20,flexShrink:0 }}>✅</span>
              <div style={{ flex:1,minWidth:0 }}>
                <p style={{ margin:0,fontSize:13,fontWeight:600,color:"#166534",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{fileData.name}</p>
                <p style={{ margin:0,fontSize:11,color:"#4ade80" }}>{fileData.type==="image"?"Image prête":"Fichier prêt"}</p>
              </div>
              <button onClick={()=>{setFileData(null);if(fileRef.current)fileRef.current.value="";}} style={{ background:"none",border:"none",cursor:"pointer",color:"#6b7280",fontSize:22,lineHeight:1,padding:"4px 8px",minHeight:44 }}>×</button>
            </div>
        }
      </div>
      <PBtn onClick={submit} disabled={!hasAns}
        style={{ background:hasAns?"linear-gradient(135deg,#059669,#10b981)":"#e5e7eb",boxShadow:hasAns?"0 4px 14px rgba(16,185,129,.32)":"none" }}>
        Soumettre ma réponse ✓
      </PBtn>
    </div>
  );
}

// ── SCREEN: RÉSULTATS ─────────────────────────────────────────────────────────

function ResultScreen({ correction, difficulty, stats, isUploaded, onNext, onRetry, onChangeMode }) {
  const pass   = correction.score>=15;
  const sColor = correction.score>=15?"#10b981":correction.score>=10?"#f59e0b":"#ef4444";
  const pct    = Math.round((correction.score/20)*100);
  const nextLabel = pass&&difficulty<5 ? (isUploaded?"Générer exercice similaire →":`Suivant — Niv. ${DIFF_LABELS[Math.min(difficulty,4)]} →`) : (isUploaded&&!pass?"Autre exercice →":"Nouvel exercice →");
  const nextAction = isUploaded&&!pass ? onChangeMode : onNext;

  return (
    <div className="epw">
      <div style={{ background:pass?"#ecfdf5":correction.score>=10?"#fffbeb":"#fef2f2",border:`2px solid ${pass?"#6ee7b7":correction.score>=10?"#fcd34d":"#fca5a5"}`,borderRadius:16,padding:"1.5rem",marginBottom:14,textAlign:"center" }}>
        {pass&&<div style={{ fontSize:13,fontWeight:700,color:"#059669",marginBottom:8,letterSpacing:".06em" }}>🏆 EXCELLENT TRAVAIL !</div>}
        <div className="snum" style={{ color:sColor }}>{correction.score}<span className="ssub">/20</span></div>
        <div style={{ fontSize:15,fontWeight:700,color:pass?"#065f46":correction.score>=10?"#92400e":"#991b1b",marginBottom:"1rem" }}>{correction.appreciation}</div>
        <div style={{ background:"#e5e7eb",borderRadius:99,height:10,marginBottom:"1rem",overflow:"hidden" }}>
          <div style={{ width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${sColor},${sColor}bb)`,borderRadius:99,transition:"width .9s ease" }} />
        </div>
        <p style={{ margin:0,color:"#4b5563",fontSize:14,lineHeight:1.7 }}>{correction.feedback}</p>
      </div>

      {correction.corrections?.length>0&&(
        <div className="ec" style={{ marginBottom:12 }}>
          <h3 style={{ margin:"0 0 12px",fontSize:15,fontWeight:700,color:"#1e1b4b" }}>Détail par question</h3>
          {correction.corrections.map((c,i,arr)=>{
            const r=c.pointsMax>0?c.pointsObtenus/c.pointsMax:0;
            const col=r>=.75?"#10b981":r>=.5?"#f59e0b":"#ef4444";
            return (
              <div key={i} style={{ padding:"0.875rem",borderRadius:10,background:`${col}0d`,border:`1px solid ${col}30`,marginBottom:i<arr.length-1?8:0 }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <span style={{ fontWeight:600,fontSize:14,color:"#1f2937" }}>Question {c.questionId}</span>
                  <span style={{ fontWeight:700,color:col,fontSize:14 }}>{c.pointsObtenus}/{c.pointsMax} pts</span>
                </div>
                <p style={{ margin:0,fontSize:13,color:"#6b7280",lineHeight:1.55 }}>{c.commentaire}</p>
              </div>
            );
          })}
        </div>
      )}

      {(correction.points_forts?.length>0||correction.points_ameliorer?.length>0)&&(
        <div className="g2" style={{ marginBottom:12 }}>
          {correction.points_forts?.length>0&&(
            <div style={{ background:"#ecfdf5",borderRadius:12,padding:"1rem",border:"1px solid #a7f3d0" }}>
              <p style={{ margin:"0 0 8px",fontSize:11,fontWeight:800,color:"#065f46",textTransform:"uppercase",letterSpacing:".06em" }}>✓ Points forts</p>
              {correction.points_forts.map((p,i)=><p key={i} style={{ margin:"0 0 3px",fontSize:12,color:"#047857" }}>· {p}</p>)}
            </div>
          )}
          {correction.points_ameliorer?.length>0&&(
            <div style={{ background:"#fffbeb",borderRadius:12,padding:"1rem",border:"1px solid #fde68a" }}>
              <p style={{ margin:"0 0 8px",fontSize:11,fontWeight:800,color:"#92400e",textTransform:"uppercase",letterSpacing:".06em" }}>→ À travailler</p>
              {correction.points_ameliorer.map((p,i)=><p key={i} style={{ margin:"0 0 3px",fontSize:12,color:"#b45309" }}>· {p}</p>)}
            </div>
          )}
        </div>
      )}

      {pass&&correction.fullCorrection&&(
        <div style={{ background:"#eef2ff",borderRadius:14,padding:"1.25rem",marginBottom:14,border:"1px solid #c7d2fe" }}>
          <h3 style={{ margin:"0 0 10px",fontSize:15,fontWeight:700,color:"#3730a3" }}>📚 Correction complète</h3>
          <div style={{ fontSize:13,color:"#1e1b4b",lineHeight:1.8,whiteSpace:"pre-wrap" }}>{correction.fullCorrection}</div>
        </div>
      )}
      {!pass&&(
        <div style={{ background:"#fef2f2",borderRadius:12,padding:"1rem",marginBottom:14,border:"1px solid #fecaca",textAlign:"center" }}>
          <p style={{ margin:0,fontSize:13,color:"#dc2626",fontWeight:600 }}>🔒 Correction complète disponible à partir de 15/20</p>
          <p style={{ margin:"4px 0 0",fontSize:12,color:"#9ca3af" }}>Encore {15-correction.score} point{15-correction.score>1?"s":""} pour débloquer</p>
        </div>
      )}

      <div style={{ display:"flex",gap:10,marginBottom:14 }}>
        {[{v:stats.completed,l:"Exercices"},{v:`${stats.avgScore}/20`,l:"Moyenne"},{v:`${difficulty}/5`,l:"Niveau"}].map(s=>(
          <div key={s.l} style={{ flex:1,background:"white",borderRadius:10,padding:"0.75rem 0.5rem",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
            <div style={{ fontSize:20,fontWeight:800,color:"#1e1b4b" }}>{s.v}</div>
            <div style={{ fontSize:11,color:"#9ca3af",marginTop:2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div className="fa" style={{ marginBottom:10 }}>
        <button onClick={onRetry} style={{ flex:1,padding:"1rem",minHeight:52,border:"2px solid #e5e7eb",borderRadius:12,background:"white",color:"#374151",fontWeight:600,cursor:"pointer",fontSize:14 }}>↩ Réessayer</button>
        <button onClick={nextAction} style={{ flex:2,padding:"1rem",minHeight:52,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"white",border:"none",borderRadius:12,fontWeight:700,cursor:"pointer",fontSize:14,boxShadow:"0 4px 12px rgba(79,70,229,.28)" }}>
          {nextLabel}
        </button>
      </div>
      <button onClick={onChangeMode} style={{ width:"100%",padding:"0.75rem",minHeight:44,background:"none",border:"1px solid #e5e7eb",borderRadius:10,color:"#9ca3af",cursor:"pointer",fontSize:13 }}>
        Choisir un autre exercice
      </button>
      <p style={{ textAlign:"center",fontSize:12,color:"#9ca3af",margin:"10px 0 0" }}>
        {pass&&difficulty<5?"🎯 Super score ! La difficulté augmentera au prochain exercice."
          :!pass?"💪 Continue à pratiquer — correction complète à 15/20 !"
          :"🏆 Niveau maximum atteint !"}
      </p>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────

export default function App() {
  const [step,       setStep]       = useState("profile");
  const [student,    setStudent]    = useState({ name:"",level:"",subject:"",topic:"" });
  const [exercise,   setExercise]   = useState(null);
  const [correction, setCorrection] = useState(null);
  const [difficulty, setDifficulty] = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error,      setError]      = useState(null);
  const [stats,      setStats]      = useState({ completed:0, scores:[] });

  const avgScore = stats.scores.length
    ? (Math.round((stats.scores.reduce((a,b)=>a+b,0)/stats.scores.length)*10)/10).toFixed(1)
    : "—";

  const doGenerate = useCallback(async (level, subject, topic, diff) => {
    setLoading(true); setLoadingMsg("Génération de l'exercice..."); setError(null);
    try {
      const group = getLevelGroup(level);
      const raw = await callClaude(
        `Tu es un professeur expert du système éducatif français. Crée un exercice de ${subject} sur "${topic}" pour un élève de ${level} (cycle ${group}), difficulté ${diff}/5 (${DIFF_LABELS[diff-1].toLowerCase()}).

IMPORTANT: Le contenu DOIT correspondre exactement au niveau ${level} du programme français officiel.

Réponds UNIQUEMENT avec du JSON valide sans markdown:
{"title":"Titre clair","instructions":"Consigne en 1-2 phrases","questions":[{"id":1,"text":"Énoncé complet","points":8},{"id":2,"text":"Énoncé complet","points":12}],"totalPoints":20,"duration":"X min"}

RÈGLES: total=20pts exactement, 2-4 questions adaptées au niveau ${level} cycle ${group}, difficulté ${diff}/5, en français (sauf Anglais).`
      );
      setExercise(parseJSON(raw));
      setStep("exercise");
    } catch(e) { setError(`Erreur de génération: ${e.message}`); }
    finally { setLoading(false); }
  }, []);

  const doParseExercise = useCallback(async (fileData) => {
    setLoading(true); setLoadingMsg("L'IA analyse ton exercice..."); setError(null);
    const prompt = `Tu es un professeur expert. Un élève de ${student.level} en ${student.subject} te soumet cet exercice.

Extrais et structure l'exercice. Réponds UNIQUEMENT avec du JSON valide sans markdown:
{"title":"Titre","topic":"Thème précis","instructions":"Consigne générale","questions":[{"id":1,"text":"Énoncé exact","points":5}],"totalPoints":20,"duration":"X min","source":"uploaded"}

RÈGLES: total=20pts (répartis proportionnellement), transcris les questions exactement.`;
    try {
      let raw;
      if      (fileData.type==="pdf")   raw = await callClaudePDF(fileData.base64, prompt);
      else if (fileData.type==="image") raw = await callClaudeVision(fileData.base64, fileData.mediaType, prompt);
      else                              raw = await callClaude(`${prompt}\n\nCONTENU:\n${fileData.content}`);
      const parsed = parseJSON(raw);
      setStudent(p=>({...p,topic:parsed.topic||"exercice personnalisé"}));
      setExercise({...parsed,source:"uploaded"});
      setStep("exercise");
    } catch(e) { setError(`Impossible d'analyser: ${e.message}`); }
    finally { setLoading(false); }
  }, [student]);

  const doCorrect = useCallback(async (answerData) => {
    if (!exercise) return;
    setLoading(true); setLoadingMsg("L'IA corrige ton exercice..."); setError(null);
    const base = `Tu es un professeur bienveillant corrigeant un exercice de ${student.subject} pour un élève de ${student.level}.

EXERCICE: Titre: ${exercise.title} | Instructions: ${exercise.instructions||"—"} | Questions: ${(exercise.questions||[]).map(q=>`Q${q.id}(${q.points}pts): ${q.text}`).join(" | ")} | Total: ${exercise.totalPoints||20}pts

{ANSWER}

Réponds UNIQUEMENT en JSON valide sans markdown:
{"score":<0-20>,"appreciation":"Excellent|Très bien|Bien|Assez bien|Passable|À améliorer|Insuffisant","feedback":"Commentaire 2-3 phrases","corrections":[{"questionId":1,"pointsObtenus":<n>,"pointsMax":<n>,"commentaire":"Commentaire pédagogique"}],"fullCorrection":"Correction complète avec bonnes réponses","points_forts":["..."],"points_ameliorer":["..."]}`;
    try {
      let raw;
      if (answerData.type==="image")
        raw = await callClaudeVision(answerData.base64, answerData.mediaType, base.replace("{ANSWER}","RÉPONSE: [Voir image jointe]"));
      else
        raw = await callClaude(base.replace("{ANSWER}",`RÉPONSE:\n${answerData.content}`));
      const corr = parseJSON(raw);
      setStats(p=>({completed:p.completed+1,scores:[...p.scores,corr.score]}));
      if (corr.score>=15) setDifficulty(d=>Math.min(d+1,5));
      setCorrection(corr);
      setStep("result");
    } catch(e) { setError(`Erreur: ${e.message}`); setStep("exercise"); }
    finally { setLoading(false); }
  }, [exercise, student]);

  const handleNext      = ()=>{ setCorrection(null); doGenerate(student.level,student.subject,student.topic,difficulty); };
  const handleRetry     = ()=>{ setCorrection(null); setStep("exercise"); };
  const handleChangeMode= ()=>{ setStep("mode"); setExercise(null); setCorrection(null); };

  const view = () => {
    if (loading) return <Loader msg={loadingMsg} />;
    switch (step) {
      case "profile":  return <ProfileScreen  onNext={({name,level})=>{ setStudent(p=>({...p,name,level})); setStep("subject"); }} />;
      case "subject":  return <SubjectScreen  student={student} onBack={()=>setStep("profile")} onNext={subject=>{ setStudent(p=>({...p,subject})); setStep("mode"); }} />;
      case "mode":     return <ModeScreen     student={student} onBack={()=>setStep("subject")} onGenerate={()=>setStep("topic")} onUpload={()=>setStep("upload")} />;
      case "topic":    return <TopicScreen    student={student} onBack={()=>setStep("mode")} onNext={topic=>{ setStudent(p=>({...p,topic})); doGenerate(student.level,student.subject,topic,difficulty); }} />;
      case "upload":   return <UploadExerciseScreen student={student} onBack={()=>setStep("mode")} onParsed={doParseExercise} />;
      case "exercise": return exercise   ? <ExerciseScreen   student={student} exercise={exercise} difficulty={difficulty} onSubmit={doCorrect} onChangeMode={handleChangeMode} /> : null;
      case "result":   return correction ? <ResultScreen correction={correction} difficulty={difficulty} stats={{completed:stats.completed,avgScore}} isUploaded={exercise?.source==="uploaded"} onNext={handleNext} onRetry={handleRetry} onChangeMode={handleChangeMode} /> : null;
      default: return null;
    }
  };

  return (
    <div style={{ minHeight:"100vh",background:"#f5f3ff",fontFamily:"'Segoe UI',system-ui,-apple-system,sans-serif" }}>
      <style>{CSS}</style>
      <div style={{ background:"#1e1b4b",padding:"0.875rem 1.25rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:20,fontWeight:900,color:"white",letterSpacing:"-0.04em" }}>EduCorrect</span>
          <span style={{ background:"#312e81",color:"#a5b4fc",fontSize:10,padding:"0.2rem 0.5rem",borderRadius:6,fontWeight:700,letterSpacing:".06em" }}>IA</span>
        </div>
        {student.name&&(
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            {stats.completed>0&&<div className="hst"><p style={{ margin:0,color:"#a5b4fc",fontSize:11 }}>{stats.completed} ex · moy. {avgScore}/20</p></div>}
            <div style={{ width:34,height:34,borderRadius:"50%",background:"#4f46e5",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:800,fontSize:14,flexShrink:0 }}>
              {student.name[0]?.toUpperCase()}
            </div>
          </div>
        )}
      </div>
      {error&&!loading&&(
        <div style={{ background:"#fef2f2",padding:"0.75rem 1.25rem",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #fecaca" }}>
          <span style={{ color:"#dc2626",fontSize:13 }}>⚠️ {error}</span>
          <button onClick={()=>setError(null)} style={{ background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:22,fontWeight:700,padding:"0 4px",minHeight:44 }}>×</button>
        </div>
      )}
      {view()}
    </div>
  );
}
