// lib/store.js — Auth + progression via localStorage

const USERS_KEY    = "edu_users_v2";
const SESSION_KEY  = "edu_session_v2";
const PROGRESS_KEY = uid => `edu_progress_v2_${uid}`;

export const ADMIN_EMAIL = "khalifadylla@gmail.com";

export function isAdminEmail(email) {
  return (email || "").toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();
}

// ── Helpers internes ──────────────────────────────────────────────────────────
function genId() {
  return `u_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
}
function getAllUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
  catch { return []; }
}
function saveAllUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// Applique le flag isAdmin sur un objet user et le persiste si besoin
function ensureAdminFlag(user) {
  if (!user) return null;
  if (isAdminEmail(user.email) && !user.isAdmin) {
    const patched = { ...user, isAdmin: true };
    const users = getAllUsers();
    const idx   = users.findIndex(u => u.id === patched.id);
    if (idx !== -1) { users[idx] = patched; saveAllUsers(users); }
    return patched;
  }
  return user;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export function registerUser({ name, email, password, level, series }) {
  const users   = getAllUsers();
  const emailLC = email.toLowerCase().trim();
  if (users.find(u => u.email === emailLC)) {
    throw new Error("Un compte avec cet email existe déjà.");
  }
  const admin = isAdminEmail(email);
  const user  = {
    id:        genId(),
    name:      name.trim(),
    email:     emailLC,
    password,
    level:     admin ? "ALL" : (level || ""),
    series:    series || null,
    isAdmin:   admin,
    createdAt: Date.now(),
  };
  saveAllUsers([...users, user]);
  localStorage.setItem(SESSION_KEY, user.id);
  return user;
}

export function loginUser({ email, password }) {
  const users   = getAllUsers();
  const emailLC = email.toLowerCase().trim();
  let user = users.find(u => u.email === emailLC);
  if (!user)                      throw new Error("Aucun compte trouvé avec cet email.");
  if (user.password !== password) throw new Error("Mot de passe incorrect.");
  // Applique toujours le flag admin au login (même si compte créé avant)
  user = ensureAdminFlag(user);
  localStorage.setItem(SESSION_KEY, user.id);
  return user;
}

export function getCurrentUser() {
  try {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    const user = getAllUsers().find(u => u.id === id) || null;
    // Applique aussi le flag admin au chargement de session
    return ensureAdminFlag(user);
  } catch { return null; }
}

export function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
}

export function updateUser(updates) {
  const users = getAllUsers();
  const idx   = users.findIndex(u => u.id === updates.id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...updates };
  saveAllUsers(users);
  return users[idx];
}

export function getAllUsersForAdmin() {
  return getAllUsers()
    .filter(u => !isAdminEmail(u.email))
    .map(u => ({ ...u, password: "••••••" }));
}

// ── Progression ───────────────────────────────────────────────────────────────
function emptyProgress() {
  return { exercises: [], streak: 0, lastStudyDate: null };
}

export function getProgress(userId) {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY(userId));
    return raw ? JSON.parse(raw) : emptyProgress();
  } catch { return emptyProgress(); }
}

function saveProgress(userId, progress) {
  localStorage.setItem(PROGRESS_KEY(userId), JSON.stringify(progress));
}

function prevDay(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

export function addExerciseResult(userId, result) {
  const progress = getProgress(userId);
  const today    = new Date().toISOString().split("T")[0];
  if      (progress.lastStudyDate === today)          { /* même jour */ }
  else if (progress.lastStudyDate === prevDay(today)) { progress.streak += 1; }
  else                                                { progress.streak = 1; }
  progress.lastStudyDate = today;
  progress.exercises = [
    { id: `ex_${Date.now()}`, ...result, date: new Date().toISOString() },
    ...progress.exercises,
  ].slice(0, 200);
  saveProgress(userId, progress);
  return progress;
}

export function getStats(userId) {
  const { exercises, streak, lastStudyDate } = getProgress(userId);
  if (!exercises.length) {
    return { total: 0, avg: "—", best: 0, streak, bySubject: {}, recent: [], lastStudyDate };
  }
  const scores = exercises.map(e => e.score);
  const avg    = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  const best   = Math.max(...scores);
  const recent = exercises.slice(0, 7).reverse();
  const bySubject = {};
  exercises.forEach(e => {
    if (!bySubject[e.subject]) bySubject[e.subject] = { label: e.subjectLabel, scores: [] };
    bySubject[e.subject].scores.push(e.score);
  });
  Object.values(bySubject).forEach(s => {
    s.count = s.scores.length;
    s.avg   = (s.scores.reduce((a, b) => a + b, 0) / s.count).toFixed(1);
    s.best  = Math.max(...s.scores);
  });
  return { total: exercises.length, avg, best, streak, bySubject, recent, lastStudyDate };
}

// ── Badges ────────────────────────────────────────────────────────────────────
export const BADGES = [
  { id:"first_step",  icon:"🎯", name:"Premier pas",    desc:"1er exercice réalisé",          check:s=>s.total>=1     },
  { id:"score_15",    icon:"⭐", name:"Brillant",       desc:"Score ≥ 15/20 obtenu",           check:s=>s.best>=15     },
  { id:"score_18",    icon:"🌟", name:"Excellence",     desc:"Score ≥ 18/20 obtenu",           check:s=>s.best>=18     },
  { id:"perfect",     icon:"👑", name:"Perfection",     desc:"20/20 ! Score parfait",          check:s=>s.best>=20     },
  { id:"streak_3",    icon:"🔥", name:"En feu",         desc:"3 jours consécutifs",            check:s=>s.streak>=3    },
  { id:"streak_7",    icon:"💫", name:"Assidu",         desc:"7 jours consécutifs",            check:s=>s.streak>=7    },
  { id:"streak_30",   icon:"⚡", name:"Inépuisable",    desc:"30 jours consécutifs",           check:s=>s.streak>=30   },
  { id:"ex_5",        icon:"📚", name:"Studieux",       desc:"5 exercices réalisés",           check:s=>s.total>=5     },
  { id:"ex_20",       icon:"🏆", name:"Champion",       desc:"20 exercices réalisés",          check:s=>s.total>=20    },
  { id:"ex_50",       icon:"🎓", name:"Expert",         desc:"50 exercices réalisés",          check:s=>s.total>=50    },
  { id:"avg_14",      icon:"📈", name:"En progression", desc:"Moyenne ≥ 14/20",                check:s=>parseFloat(s.avg)>=14 },
  { id:"avg_16",      icon:"🥇", name:"Top élève",      desc:"Moyenne ≥ 16/20",                check:s=>parseFloat(s.avg)>=16 },
  { id:"polyvalent",  icon:"🌈", name:"Polyvalent",     desc:"3 matières différentes",         check:s=>Object.keys(s.bySubject).length>=3 },
  { id:"all_subject", icon:"🦁", name:"Encyclopédiste", desc:"5 matières différentes",         check:s=>Object.keys(s.bySubject).length>=5 },
  { id:"night_owl",   icon:"🦉", name:"Bosseur",        desc:"10 exercices + moy ≥ 13",        check:s=>s.total>=10&&parseFloat(s.avg)>=13 },
];

export function getBadges(userId) {
  const stats = getStats(userId);
  return BADGES.map(b => ({ ...b, earned: b.check(stats) }));
}

export function getNewBadges(userId, prevTotal, prevBest, prevStreak, prevSubjects) {
  // Compare avant/après pour détecter les nouveaux badges gagnés
  const stats = getStats(userId);
  const prevStats = {
    total:     prevTotal,
    best:      prevBest,
    streak:    prevStreak,
    avg:       "0",
    bySubject: Object.fromEntries(prevSubjects.map(s=>[s,{}])),
  };
  return BADGES.filter(b => !b.check(prevStats) && b.check(stats));
}
