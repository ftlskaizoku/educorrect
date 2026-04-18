# EduCorrect — Guide de déploiement Netlify

## Prérequis
- Compte GitHub (gratuit) : https://github.com
- Compte Netlify (gratuit) : https://netlify.com
- Clé API Anthropic : https://console.anthropic.com

---

## Étape 1 — Obtenir ta clé API Anthropic

1. Va sur https://console.anthropic.com
2. Clique **API Keys** > **Create Key**
3. Copie la clé (commence par `sk-ant-api03-...`)
4. Garde-la de côté pour l'étape 4

---

## Étape 2 — Créer les icônes PWA

Crée un dossier `public/icons/` et ajoute deux images PNG :
- `icon-192.png` (192×192 px)
- `icon-512.png` (512×512 px)

Tu peux générer des icônes rapidement sur : https://favicon.io/favicon-generator/
(Texte: "EC", background: #4f46e5, color: white)

---

## Étape 3 — Pousser sur GitHub

```bash
# Dans le dossier educorrect/
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/educorrect.git
git push -u origin main
```

---

## Étape 4 — Déployer sur Netlify

1. Va sur https://app.netlify.com
2. Clique **Add new site** > **Import an existing project**
3. Choisis **GitHub** et sélectionne ton dépôt `educorrect`
4. Paramètres de build (Netlify les détecte automatiquement grâce à `netlify.toml`) :
   - Build command : `npm run build`
   - Publish directory : `.next`
5. Avant de déployer, clique **Environment variables** et ajoute :
   - **Nom** : `ANTHROPIC_API_KEY`
   - **Valeur** : `sk-ant-api03-...` (ta clé)
6. Clique **Deploy site**

Netlify installera automatiquement le plugin `@netlify/plugin-nextjs`.
Délai de premier déploiement : ~3-5 minutes.

---

## Étape 5 — Installer comme application sur mobile

### Sur iPhone (Safari uniquement) :
1. Ouvre l'URL de ton site dans Safari
2. Appuie sur le bouton **Partager** (carré avec flèche)
3. Défiler et choisir **Sur l'écran d'accueil**
4. Appuyer **Ajouter**

### Sur Android (Chrome) :
1. Ouvre l'URL dans Chrome
2. Chrome affichera automatiquement une bannière **"Ajouter à l'écran d'accueil"**
3. Ou : menu ⋮ > **Ajouter à l'écran d'accueil**

L'application s'installe comme une vraie app native, sans passer par l'App Store ou le Play Store.

---

## Structure des fichiers

```
educorrect/
├── pages/
│   ├── _app.jsx          ← Enregistrement PWA + meta tags
│   ├── index.jsx         ← Application principale
│   └── api/
│       └── claude.js     ← Proxy API sécurisé (clé côté serveur)
├── public/
│   ├── manifest.json     ← Configuration PWA
│   ├── sw.js             ← Service Worker (cache + offline)
│   └── icons/
│       ├── icon-192.png  ← À créer (voir Étape 2)
│       └── icon-512.png  ← À créer (voir Étape 2)
├── styles/
│   └── globals.css
├── next.config.js
├── netlify.toml
└── package.json
```

---

## Mises à jour

Pour mettre à jour l'application après un changement :
```bash
git add .
git commit -m "Description du changement"
git push
```
Netlify redéploiera automatiquement en ~2 minutes.

---

## Domaine personnalisé (optionnel)

Dans Netlify : **Domain settings** > **Add custom domain**
Tu peux acheter un domaine directement via Netlify ou utiliser un domaine existant.

---

## Dépannage

| Problème | Solution |
|----------|---------- |
| "ANTHROPIC_API_KEY non configurée" | Vérifie la variable dans Netlify > Environment variables |
| Exercices ne se génèrent pas | Vérifie la clé API sur console.anthropic.com |
| PWA ne s'installe pas sur iPhone | Utilise Safari (pas Chrome) sur iOS |
| Erreur 413 (fichier trop grand) | Réduis la taille du PDF/image (max ~15MB) |
