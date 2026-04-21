// lib/store.js — Auth + progress via localStorage
const USERS_KEY    = "edu_users_v2";
const SESSION_KEY  = "edu_session_v2";
const PROGRESS_KEY = (uid) => `edu_progress_v2_${uid}`;

// Admin fixe — accès total
export const ADMIN_EMAIL = "khalifadylla@gmail.com";
export function isAdminEmail(email) {
  return email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();
}

function uid() { return `u_${Date.now()}_${Math.random().toString(36).substr(2,8)}`; }
function getAllUsers() { try { return JSON.parse(localStorage.getItem(USERS_KEY)||"[]"); } catch { return []; } }
function saveAllUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }

export function registerUser({ name, email, password, level, series }) {
  const users = getAllUsers();
  if (users.find(u=>u.email.toLowerCase()===email.toLowerCase())) throw new Error("Un compte avec cet email existe déjà.");
  const isAdmin = isAdminEmail(email);
  const user = { id:uid(), name, email:email.toLowerCase(), password, level:isAdmin?"ALL":level, series:series||null, isAdmin, createdAt:Date.now() };
  saveAllUsers([...users, user]);
  localStorage.setItem(SESSION_KEY, user.id);
  return user;
}

export function loginUser({ email, password }) {
  const users = getAllUsers();
  // Auto-create admin if first login
  let user = users.find(u=>u.email.toLowerCase()===email.toLowerCase());
  if (!user) throw new Error("Aucun compte trouvé avec cet email.");
  if (user.password !== password) throw new Error("Mot de passe incorrect.");
  // Ensure admin flag is always set for admin email
  if (isAdminEmail(email) && !user.isAdmin) {
    user = { ...user, isAdmin:true, level:"ALL" };
    const idx = users.findIndex(u=>u.id===user.id);
    users[idx] = user;
    saveAllUsers(users);
  }
  localStorage.setItem(SESSION_KEY, user.id);
  return user;
}

export function getCurrentUser() {
  try { const id=localStorage.getItem(SESSION_KEY); if(!id) return null; return getAllUsers().find(u=>u.id===id)||null; }
  catch { return null; }
}
export function logoutUser() { localStorage.removeItem(SESSION_KEY); }
export function updateUser(updates) {
  const users=getAllUsers(); const idx=users.findIndex(u=>u.id===updates.id); if(idx===-1) return;
  users[idx]={...users[idx],...updates}; saveAllUsers(users); return users[idx];
}

// Admin only — get all users
export function getAllUsersForAdmin() { return getAllUsers().map(u=>({...u, password:"***"})); }

// Progress
function emptyProgress() { return { exercises:[], streak:0, lastStudyDate:null }; }
export function getProgress(userId) {
  try { const r=localStorage.getItem(PROGRESS_KEY(userId)); return r?JSON.parse(r):emptyProgress(); }
  catch { return emptyProgress(); }
}
export function saveProgress(userId,progress) { localStorage.setItem(PROGRESS_KEY(userId),JSON.stringify(progress)); }
export function addExerciseResult(userId, result) {
  const progress=getProgress(userId);
  const today=new Date().toISOString().split("T")[0];
  const prev = getPreviousDay(today);
  if (progress.lastStudyDate===today) {} else if (progress.lastStudyDate===prev) progress.streak+=1; else progress.streak=1;
  progress.lastStudyDate=today;
  progress.exercises=[{ id:`ex_${Date.now()}`, ...result, date:new Date().toISOString() }, ...progress.exercises].slice(0,200);
  saveProgress(userId,progress);
  return progress;
}
function getPreviousDay(d) { const dt=new Date(d); dt.setDate(dt.getDate()-1); return dt.toISOString().split("T")[0]; }
export function getStats(userId) {
  const {exercises,streak,lastStudyDate}=getProgress(userId);
  if (!exercises.length) return {total:0,avg:"—",best:0,streak,bySubject:{},recent:[],lastStudyDate};
  const scores=exercises.map(e=>e.score);
  const avg=(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1);
  const best=Math.max(...scores);
  const recent=exercises.slice(0,7).reverse();
  const bySubject={};
  exercises.forEach(e=>{
    if(!bySubject[e.subject]) bySubject[e.subject]={label:e.subjectLabel,scores:[]};
    bySubject[e.subject].scores.push(e.score);
  });
  Object.values(bySubject).forEach(s=>{ s.count=s.scores.length; s.avg=(s.scores.reduce((a,b)=>a+b,0)/s.count).toFixed(1); s.best=Math.max(...s.scores); });
  return {total:exercises.length,avg,best,streak,bySubject,recent,lastStudyDate};
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export const ADMIN_EMAIL = "khalifadylla@gmail.com";

export function isAdmin(user) {
  return user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

export function getAllUsersForAdmin() {
  return getAllUsers().map(u => ({
    ...u,
    password: "••••••", // mask password
    stats: getProgress(u.id),
  }));
}
