// lib/store.js — Auth + progression via localStorage (client-side only)
// Clé admin fixe — accès complet à toutes les données de l'application

const USERS_KEY    = "edu_users_v2";
const SESSION_KEY  = "edu_session_v2";
const PROGRESS_KEY = uid => `edu_progress_v2_${uid}`;

// ── Admin ─────────────────────────────────────────────────────────────────────
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

// ── Auth ──────────────────────────────────────────────────────────────────────
export function registerUser({ name, email, password, level, series }) {
  const users = getAllUsers();
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
    level:     level || "",
    series:    series || null,
    isAdmin:   admin,
    createdAt: Date.now(),
  };
  saveAllUsers([...users, user]);
  localStorage.setItem(SESSION_KEY, user.id);
  return user;
}

export function loginUser({ email, password }) {
  const users  = getAllUsers();
  const emailLC = email.toLowerCase().trim();
  let user = users.find(u => u.email === emailLC);
  if (!user)                      throw new Error("Aucun compte trouvé avec cet email.");
  if (user.password !== password) throw new Error("Mot de passe incorrect.");
  // Garantit le flag admin même si le compte a été créé avant
  if (isAdminEmail(email) && !user.isAdmin) {
    user = { ...user, isAdmin: true };
    const idx = users.findIndex(u => u.id === user.id);
    users[idx] = user;
    saveAllUsers(users);
  }
  localStorage.setItem(SESSION_KEY, user.id);
  return user;
}

export function getCurrentUser() {
  try {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    return getAllUsers().find(u => u.id === id) || null;
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

// Retourne tous les utilisateurs (sans mot de passe) — réservé admin
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
  if      (progress.lastStudyDate === today)        { /* même jour, streak inchangé */ }
  else if (progress.lastStudyDate === prevDay(today)) { progress.streak += 1; }
  else                                              { progress.streak = 1; }
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
