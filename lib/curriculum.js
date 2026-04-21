// ─────────────────────────────────────────────────────────────────────────────
// Programme officiel sénégalais (MENFP / FASTEF)
// ─────────────────────────────────────────────────────────────────────────────

export const LEVELS = [
  { id:"CI",        label:"CI",        group:"Primaire", order:1  },
  { id:"CP",        label:"CP",        group:"Primaire", order:2  },
  { id:"CE1",       label:"CE1",       group:"Primaire", order:3  },
  { id:"CE2",       label:"CE2",       group:"Primaire", order:4  },
  { id:"CM1",       label:"CM1",       group:"Primaire", order:5  },
  { id:"CM2",       label:"CM2 — CFEE",group:"Primaire", order:6  },
  { id:"6ème",      label:"6ème",      group:"Collège",  order:7  },
  { id:"5ème",      label:"5ème",      group:"Collège",  order:8  },
  { id:"4ème",      label:"4ème",      group:"Collège",  order:9  },
  { id:"3ème",      label:"3ème — BFEM",group:"Collège", order:10 },
  { id:"Seconde",   label:"Seconde",   group:"Lycée",    order:11 },
  { id:"Première",  label:"Première",  group:"Lycée",    order:12 },
  { id:"Terminale", label:"Terminale — BAC",group:"Lycée",order:13},
];

// Séries disponibles par niveau au lycée (programme sénégalais)
export const SERIES_BY_LEVEL = {
  Seconde:  [
    { id:"S1",   label:"S1 — Sciences Mathématiques" },
    { id:"S3",   label:"S3 — Sciences de la Vie et de la Terre" },
    { id:"L",    label:"L — Lettres et Sciences Humaines" },
    { id:"STEG", label:"STEG — Sciences et Technologies Économiques" },
  ],
  Première: [
    { id:"S",    label:"S — Sciences" },
    { id:"L",    label:"L — Lettres et Sciences Humaines" },
    { id:"STEG", label:"STEG — Sciences et Technologies Économiques" },
  ],
  Terminale:[
    { id:"S",    label:"S — Sciences (BAC S)" },
    { id:"L",    label:"L — Lettres (BAC L)" },
    { id:"STEG", label:"STEG (BAC STEG)" },
  ],
};

export function hasSeriesChoice(levelId) {
  return ["Seconde","Première","Terminale"].includes(levelId);
}

// ── Groupes de cycles ─────────────────────────────────────────────────────────
export function getLevelGroup(levelId) {
  if (["CI","CP","CE1","CE2","CM1","CM2"].includes(levelId))  return "primaire";
  if (["6ème","5ème","4ème","3ème"].includes(levelId))        return "college";
  return "lycee";
}

// ── Matières ──────────────────────────────────────────────────────────────────
// cycles:  quels groupes peuvent avoir cette matière
// series:  si non vide, seulement ces séries au lycée (null = toutes)
export const SUBJECTS = [
  { id:"mathematiques", label:"Mathématiques",   sym:"∑",  color:"#2563eb", bg:"#eff6ff",
    cycles:["primaire","college","lycee"], series:null },
  { id:"francais",      label:"Français",        sym:"Aa", color:"#7c3aed", bg:"#f5f3ff",
    cycles:["primaire","college","lycee"], series:null },
  { id:"histoire",      label:"Histoire-Géo",    sym:"◈",  color:"#d97706", bg:"#fffbeb",
    cycles:["primaire","college","lycee"], series:null },
  { id:"anglais",       label:"Anglais",         sym:"EN", color:"#0891b2", bg:"#ecfeff",
    cycles:["primaire","college","lycee"], series:null },
  // Primaire uniquement
  { id:"sciences",      label:"Sciences & Vie",  sym:"🌿", color:"#059669", bg:"#ecfdf5",
    cycles:["primaire"], series:null },
  { id:"emc",           label:"Éducation civique",sym:"🤝",color:"#0ea5e9", bg:"#e0f2fe",
    cycles:["primaire"], series:null },
  // Collège + Lycée
  { id:"svt",           label:"SVT",             sym:"◉",  color:"#16a34a", bg:"#f0fdf4",
    cycles:["college","lycee"], series:["S","S1","S3",null] },
  { id:"physique",      label:"Physique-Chimie", sym:"⚗",  color:"#dc2626", bg:"#fef2f2",
    cycles:["college","lycee"], series:["S","S1","S3",null] },
  { id:"technologie",   label:"Technologie",     sym:"⚙",  color:"#64748b", bg:"#f8fafc",
    cycles:["college"], series:null },
  // Lycée uniquement
  { id:"philosophie",   label:"Philosophie",     sym:"φ",  color:"#9333ea", bg:"#faf5ff",
    cycles:["lycee"], series:null },
  { id:"informatique",  label:"Informatique",    sym:"</>",color:"#0f766e", bg:"#f0fdfa",
    cycles:["lycee"], series:["S","S1","S3",null] },
  { id:"eco",           label:"Économie",        sym:"€",  color:"#b45309", bg:"#fffbeb",
    cycles:["lycee"], series:["STEG",null] },
];

// Retourne les matières disponibles pour un élève
export function getSubjectsForStudent(levelId, seriesId) {
  const group = getLevelGroup(levelId);
  return SUBJECTS.filter(s => {
    if (!s.cycles.includes(group)) return false;
    // Pour le lycée, certaines matières sont restreintes par série
    if (group === "lycee" && s.series && s.series[0] !== null) {
      if (!s.series.includes(seriesId)) return false;
    }
    return true;
  });
}

// ── Sujets (thèmes) par matière et par niveau — Programme SÉNÉGALAIS ─────────
const TOPICS = {
  mathematiques: {
    primaire: {
      CI:  ["Reconnaissance des nombres","Compter jusqu'à 10","Formes géométriques simples","Calcul mental simple"],
      CP:  ["Nombres jusqu'à 100","Addition simple","Soustraction","Mesures simples"],
      CE1: ["Tables d'addition","Tables de multiplication","Fractions simples","Géométrie plane"],
      CE2: ["Multiplication","Division","Fractions","Périmètre et aire"],
      CM1: ["Nombres décimaux","Fractions avancées","Géométrie","Problèmes concrets"],
      CM2: ["Proportionnalité","Statistiques simples","Géométrie","Problèmes CFEE"],
    },
    college: {
      "6ème": ["Nombres entiers et décimaux","Fractions","Proportionnalité","Géométrie plane","Statistiques"],
      "5ème": ["Calcul littéral","Équations du 1er degré","Géométrie (triangles)","Fractions avancées","Ratios"],
      "4ème": ["Équations et inéquations","Fonctions linéaires","Géométrie (cercle, angles)","Statistiques","Pythagore"],
      "3ème": ["Fonctions","Systèmes d'équations","Géométrie dans l'espace","Trigonométrie (BFEM)","Statistiques avancées"],
    },
    lycee: {
      Seconde: ["Fonctions de référence","Équations du 2nd degré","Vecteurs","Géométrie analytique","Statistiques et probabilités"],
      Première_S: ["Dérivation","Suites numériques","Probabilités","Trigonométrie","Géométrie dans l'espace"],
      Première_L: ["Statistiques","Fonctions de base","Probabilités simples","Logique et ensembles"],
      Terminale_S: ["Calcul intégral","Limites et continuité","Nombres complexes","Matrices","Probabilités avancées"],
      Terminale_L: ["Statistiques avancées","Probabilités","Logique","Dénombrement"],
    },
  },
  francais: {
    primaire: {
      CI:  ["Lettres et sons","Lecture syllabique","Copie simple","Vocabulaire de base"],
      CP:  ["Lecture courante","Écriture","Conjugaison (être, avoir)","Dictée simple"],
      CE1: ["Lecture compréhension","Grammaire (nom, verbe)","Conjugaison (présent)","Expression écrite"],
      CE2: ["Textes narratifs","Grammaire (adjectif, complément)","Conjugaison (passé composé)","Orthographe"],
      CM1: ["Analyse grammaticale","Conjugaison (imparfait, futur)","Textes descriptifs","Vocabulaire"],
      CM2: ["Grammaire complète","Conjugaison avancée","Rédaction CFEE","Compréhension de texte"],
    },
    college: {
      "6ème": ["Récit et narration","Conjugaison (temps du passé)","Grammaire de phrase","Vocabulaire thématique"],
      "5ème": ["Texte argumentatif","Conjugaison (subjonctif)","Figures de style","Expression écrite"],
      "4ème": ["Analyse de texte","Style indirect","Poésie","Rédaction argumentative"],
      "3ème": ["Commentaire de texte (BFEM)","Dissertation simple","Figures de style","Analyse littéraire"],
    },
    lycee: {
      Seconde: ["Introduction à la dissertation","Commentaire composé","Figures de style avancées","Textes littéraires sénégalais"],
      Première_S: ["Dissertation","Commentaire composé","Textes africains","Argumentation"],
      Première_L: ["Dissertation avancée","Commentaire composé","Littérature africaine","Texte théâtral"],
      Terminale_S: ["Dissertation BAC","Commentaire BAC","Littérature mondiale","Essai"],
      Terminale_L: ["Dissertation BAC","Commentaire BAC","Littérature africaine francophone","Essai critique"],
    },
  },
  physique: {
    college: {
      "6ème": ["La matière et ses états","L'eau et ses propriétés","Circuits électriques simples","La lumière et les ombres","Sécurité électrique"],
      "5ème": ["États et changements d'état","Loi d'Ohm","Réactions chimiques","Mélanges et solutions","Électricité domestique"],
      "4ème": ["Forces et équilibre","Résistances en série et parallèle","Optique : miroirs et réfraction","Atomes et molécules","Poussée d'Archimède"],
      "3ème": ["Cinématique : vitesse et MRU","Électricité : puissance et énergie","Acides-bases et oxydoréduction","Radioactivité (introduction)","Énergies renouvelables"],
    },
    lycee: {
      Seconde:       ["Cinématique : MRU et MRUA","Statique des fluides","Lois de Kirchhoff","Solutions et dosages","Optique : réflexion et réfraction"],
      Première_S:    ["Mécanique : lois de Newton","Chute libre et mouvement circulaire","Dipôle RC","Dipôle RL et oscillations","Oxydoréduction","Acides-Bases avancé","Lentilles convergentes"],
      Première_STEG: ["Énergie électrique","Circuits électriques pratiques","Notions de chimie"],
      Terminale_S:   ["Thermodynamique : 1er principe","Thermodynamique : 2ème principe","Mécanique : travail et énergie","Oscillations mécaniques","Oscillations électriques RLC","Chimie organique : structures","Chimie organique : réactions","Optique : instruments (lunette, microscope)"],
    },
  },
  svt: {
    college: {
      "6ème": ["La cellule végétale et animale","La nutrition des plantes","Digestion et absorption","Respiration et échanges gazeux"],
      "5ème": ["La reproduction sexuée","Écosystèmes du Sénégal","Biodiversité","Le sol et les micro-organismes"],
      "4ème": ["Corps humain : appareil locomoteur","Système nerveux","Hérédité et génétique","Santé et maladies"],
      "3ème": ["Génétique (BFEM)","Evolution des espèces","Immunologie et SIDA","Reproduction humaine"],
    },
    lycee: {
      Seconde:    ["Organisation du vivant","Génétique moléculaire (intro)","Ecosystèmes africains","Corps humain : nutrition et santé"],
      Première_S: ["Génétique moléculaire","La cellule et ses fonctions","Système nerveux et hormones","Écologie"],
      Terminale_S:["Immunologie avancée","Génétique et maladies héréditaires","Biotechnologies","Géologie du Sénégal","Évolution et phylogénèse"],
      Première_L: ["Biologie humaine et santé","Environnement et développement durable"],
      Terminale_L:["Santé et environnement","Biotechnologies et société"],
    },
  },
  histoire: {
    primaire: {
      CI:  ["Ma famille","Mon village/quartier"],
      CP:  ["Mon école","Ma commune"],
      CE1: ["Le Sénégal : pays et peuples","Les transports"],
      CE2: ["Histoire du Sénégal (grandes figures)","La géographie du Sénégal"],
      CM1: ["L'Afrique","Les grandes civilisations africaines","Gorée et la traite"],
      CM2: ["L'Indépendance du Sénégal","L'Afrique contemporaine","Le monde (CFEE)"],
    },
    college: {
      "6ème": ["Préhistoire en Afrique","Antiquité : Égypte et Nubie","Empires africains (Ghana, Mali)","Géographie du Sénégal"],
      "5ème": ["Empire Songhaï","Royaumes du Sénégal (Djolof, Cayor)","Islam en Afrique","Géographie de l'Afrique"],
      "4ème": ["Traite négrière et colonisation","Résistances africaines","1ère Guerre mondiale","Géographie mondiale"],
      "3ème": ["Décolonisation de l'Afrique","Indépendance du Sénégal","2ème Guerre mondiale","Le monde depuis 1945 (BFEM)"],
    },
    lycee: {
      Seconde:    ["Monde antique","Émergence de l'Islam","Géographie humaine","Médiéval Afrique"],
      Première_S: ["19ème siècle : colonisation","Révolutions industrielles","Géopolitique mondiale","Nationalisme africain"],
      Première_L: ["19ème siècle : colonisation","Guerres mondiales","Géopolitique","Civilisations modernes"],
      Terminale_S:["Guerre froide","Indépendances africaines","Sénégal depuis 1960","Mondialisation","BAC : grandes questions"],
      Terminale_L:["Guerre froide","Monde actuel","Sénégal contemporain","BAC : essai historique"],
    },
  },
  anglais: {
    primaire: {
      CI:  ["Greetings and colours","Numbers 1-10","My body","Animals"],
      CP:  ["My family","School vocabulary","Simple sentences","Songs and rhymes"],
      CE1: ["My house","Food and drinks","Present simple (to be)","Countries"],
      CE2: ["Daily routines","Present simple","Adjectives","Simple questions"],
      CM1: ["Present continuous","Comparatives","Sports and hobbies","Short texts"],
      CM2: ["Past simple","Future (will)","Comprehension","Short essay"],
    },
    college: {
      "6ème": ["Present simple and continuous","Vocabulary (school, family)","Short texts","Introductions"],
      "5ème": ["Past simple","Comparatives and superlatives","Comprehension","Descriptive writing"],
      "4ème": ["Present perfect","Conditionals","Vocabulary (environment, society)","Debate"],
      "3ème": ["Past perfect","Passive voice","Comprehension (BFEM)","Essay writing"],
    },
    lycee: {
      Seconde:    ["Revision of tenses","Reported speech","Comprehension","Essay"],
      Première_S: ["Advanced tenses","Argumentation","Literature excerpts","Oral expression"],
      Première_L: ["Advanced writing","Literature","Civilization (UK, US, Africa)","Oral"],
      Terminale_S:["BAC comprehension","Essay writing","Civilization topics","Grammar advanced"],
      Terminale_L:["BAC writing","Literature analysis","Civilization","Translation"],
    },
  },
  sciences: {
    primaire: {
      CI:  ["Les animaux de la ferme","Les plantes autour de nous","Mon corps"],
      CP:  ["Les saisons au Sénégal","L'eau","Les animaux sauvages"],
      CE1: ["Les plantes et leur croissance","La santé et l'hygiène","L'air"],
      CE2: ["La chaîne alimentaire","L'environnement au Sénégal","Le ciel et l'espace"],
      CM1: ["Le cycle de l'eau","L'énergie solaire","La pollution"],
      CM2: ["Les écosystèmes du Sénégal","Le développement durable","Sciences et société"],
    },
  },
  emc: {
    primaire: {
      CI:  ["Vivre ensemble","Le respect","Les règles de la classe"],
      CP:  ["La famille sénégalaise","La solidarité","Les droits de l'enfant"],
      CE1: ["Les institutions (mairie, école)","Le civisme","La tolérance"],
      CE2: ["La citoyenneté","Les symboles nationaux","La démocratie (intro)"],
      CM1: ["Les droits et devoirs","L'environnement et la responsabilité","Paix et dialogue"],
      CM2: ["Les institutions du Sénégal","La démocratie","L'Afrique et le monde"],
    },
  },
  philosophie: {
    lycee: {
      Seconde:    ["Introduction à la philosophie","Qu'est-ce que penser ?","La conscience","Le langage"],
      Première_S: ["La liberté","La connaissance","La vérité","Le sujet"],
      Première_L: ["La liberté","La morale","La politique","La vérité","L'art"],
      Terminale_S:["La raison","La science","La technique","L'existence","BAC S"],
      Terminale_L:["La morale","La politique","La religion","L'art","BAC L — Dissert."],
    },
  },
  technologie: {
    college: {
      "6ème": ["Objets techniques simples","Les matériaux","Énergie et mouvements"],
      "5ème": ["Dessin technique","Électronique simple","Systèmes automatisés"],
      "4ème": ["Programmation (Scratch)","Réseaux informatiques","Robotique"],
      "3ème": ["Projet technologique","Internet et société","BFEM : synthèse"],
    },
  },
  informatique: {
    lycee: {
      Seconde:    ["Algorithmique de base","Scratch / Python initiation","Internet et réseaux","Données et représentation"],
      Première_S: ["Python : fonctions et listes","Algorithmes de tri","Bases de données","HTML/CSS"],
      Terminale_S:["Récursivité","Structures de données","SQL","Cryptographie","Intelligence artificielle"],
    },
  },
  eco: {
    lycee: {
      Seconde:    ["Introduction à l'économie","Les marchés","La monnaie"],
      Première_STEG: ["Microéconomie","Macroéconomie","Comptabilité générale","Entreprise et gestion"],
      Terminale_STEG:["Économie du Sénégal","Commerce international","Gestion financière","BAC STEG"],
    },
  },
};

// Retourne les sujets (thèmes) pour une matière, un niveau et une série
export function getTopicsForStudent(subjectId, levelId, seriesId) {
  const group    = getLevelGroup(levelId);
  const bySubj   = TOPICS[subjectId];
  if (!bySubj) return [];

  if (group === "primaire") {
    const byPrim = bySubj.primaire;
    if (!byPrim) return [];
    return byPrim[levelId] || [];
  }
  if (group === "college") {
    const byColl = bySubj.college;
    if (!byColl) return [];
    return byColl[levelId] || [];
  }
  // Lycée : clé = "Terminale_S", "Première_L", ou juste "Seconde"
  const byLyc = bySubj.lycee;
  if (!byLyc) return [];
  const key = seriesId ? `${levelId}_${seriesId}` : levelId;
  return byLyc[key] || byLyc[levelId] || byLyc["Seconde"] || [];
}
