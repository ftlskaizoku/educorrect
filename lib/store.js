// lib/store.js — Auth + progress via localStorage (client-side only)
// ⚠ Ne pas stocker de données sensibles. Les mots de passe sont en clair.
//   Pour la production, migrer vers Netlify Identity.

const USERS_KEY    = "edu_users_v2";
const SESSION_KEY  = "edu_session_v2";
const PROGRESS_KEY = (uid) => `edu_progress_v2_${uid}`;

function uid() {
  return `u_${Date.now()}_${Math.random().toString(36).substr(2,8)}`;
}

// ── Utilisateurs ──────────────────────────────────────────────────────────────

function getAllUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
  catch { return []; }
}

function saveAllUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function registerUser({ name, email, password, level, series }) {
  const users = getAllUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("Un compte avec cet email existe déjà.");
  }
  const user = { id: uid(), name, email: email.toLowerCase(), password, level, series: series || null, createdAt: Date.now() };
  saveAllUsers([...users, user]);
  localStorage.setItem(SESSION_KEY, user.id);
  return user;
}

export function loginUser({ email, password }) {
  const users = getAllUsers();
  const user  = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user)              throw new Error("Aucun compte trouvé avec cet email.");
  if (user.password !== password) throw new Error("Mot de passe incorrect.");
  localStorage.setItem(SESSION_KEY, user.id);
  return user;
}

export function getCurrentUser() {
  try {
    const id    = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    const users = getAllUsers();
    return users.find(u => u.id === id) || null;
  } catch { return null; }
}

export function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
}

export function updateUser(updates) {
  const users = getAllUsers();
  const idx   = users.findIndex(u => u.id === updates.id);
  if (idx === -1) return;
  users[idx] = { ...users[idx], ...updates };
  saveAllUsers(users);
  return users[idx];
}

// ── Progression ───────────────────────────────────────────────────────────────

function emptyProgress() {
  return { exercises: [], streak: 0, lastStudyDate: null };
}

export function getProgress(userId) {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY(userId));
    if (!raw) return emptyProgress();
    return JSON.parse(raw);
  } catch { return emptyProgress(); }
}

export function saveProgress(userId, progress) {
  localStorage.setItem(PROGRESS_KEY(userId), JSON.stringify(progress));
}

export function addExerciseResult(userId, result) {
  const progress = getProgress(userId);
  const today    = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Streak
  if (progress.lastStudyDate === today) {
    // Already studied today — no change
  } else if (progress.lastStudyDate === getPreviousDay(today)) {
    progress.streak += 1;
  } else {
    progress.streak = 1;
  }
  progress.lastStudyDate = today;

  const entry = {
    id:           `ex_${Date.now()}`,
    subject:      result.subject,
    subjectLabel: result.subjectLabel,
    topic:        result.topic,
    score:        result.score,
    difficulty:   result.difficulty,
    date:         new Date().toISOString(),
    source:       result.source || "generated",
  };
  progress.exercises = [entry, ...progress.exercises].slice(0, 200); // keep last 200
  saveProgress(userId, progress);
  return progress;
}

function getPreviousDay(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

// Calcule les statistiques globales depuis les exercices
export function getStats(userId) {
  const { exercises, streak, lastStudyDate } = getProgress(userId);
  if (!exercises.length) return { total:0, avg:"—", best:0, streak, bySubject:{}, recent:[], lastStudyDate };

  const total   = exercises.length;
  const scores  = exercises.map(e => e.score);
  const avg     = (scores.reduce((a,b)=>a+b,0)/total).toFixed(1);
  const best    = Math.max(...scores);
  const recent  = exercises.slice(0,7).reverse(); // last 7, chronological

  // Par matière
  const bySubject = {};
  exercises.forEach(e => {
    if (!bySubject[e.subject]) bySubject[e.subject] = { label:e.subjectLabel, scores:[] };
    bySubject[e.subject].scores.push(e.score);
  });
  Object.values(bySubject).forEach(s => {
    s.count  = s.scores.length;
    s.avg    = (s.scores.reduce((a,b)=>a+b,0)/s.count).toFixed(1);
    s.best   = Math.max(...s.scores);
  });

  return { total, avg, best, streak, bySubject, recent, lastStudyDate };
}
