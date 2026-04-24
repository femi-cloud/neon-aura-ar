# Neon Aura AR — Mystical Rainbow Edition ✨

Une expérience AR immersive directement dans le navigateur : ta webcam + MediaPipe Hands transforment tes gestes en effets visuels néon réactifs et en sons synthétisés en temps réel.

> Pas de fond généré : tu te vois en direct, et les effets viennent se superposer à toi.

![Neon Aura AR](https://id-preview--2b7b6579-a3ec-4d19-b24f-a229f3b6a339.lovable.app)

---

## ✨ Fonctionnalités

### Détection de gestes (MediaPipe Hands)
| Geste | Effet |
|---|---|
| 🖐 Paume ouverte | Aura de particules arc-en-ciel qui jaillit de la main |
| 🤏 Pinch (pouce + index) | Onde de choc circulaire qui s'étend |
| ✊ Poing fermé | Orbe d'énergie qui flotte au-dessus de la main |
| 💨 Mouvement rapide | Traînées lumineuses qui s'estompent |
| ⚡ Deux mains proches | Éclairs animés entre les paumes |
| ✌️ Peace sign | Cycle vers la palette de couleurs suivante (toast) |

### Audio réactif (Web Audio API)
- 100% synthétisé dans le navigateur, aucun fichier audio
- Whoosh sur les shockwaves, crackle sur les éclairs, pad aérien sur l'aura, hum grave sur l'orbe
- Pitch et volume modulés par la profondeur (Z) et la vitesse de la main

### Capture / partage
- Snapshot PNG instantané du composite caméra + canvas
- Enregistrement vidéo **MP4 (H.264)** via WebCodecs + `mp4-muxer` — fallback WebM si le navigateur ne supporte pas WebCodecs
- 30 FPS, jusqu'à 30 s, prêt à partager sur tous les OS et messageries

### Panneau de contrôle complet
- On/off individuel pour chaque effet (aura, shockwave, orbe, trails, lightning)
- Slider d'intensité des particules
- Vitesse + opacité du mandala (overlay optionnel)
- Mode couleur : rainbow / purple-gold / neon-cyan / fire / aurora / custom hue
- Volume audio + mute
- Miroir caméra, affichage du squelette de main
- Mini HUD : FPS + geste détecté en temps réel

### Onboarding
- Écran d'accueil (permissions caméra + déblocage de l'audio en un clic)
- Calibration interactive qui guide l'utilisateur à travers chaque geste avec confirmation en temps réel

### Performance
- Garde-fou auto : réduit le nombre de particules si le FPS tombe sous 25
- Modèle MediaPipe chargé via CDN

---

## 🛠️ Stack technique

- **Framework** : [TanStack Start](https://tanstack.com/start) v1 (React 19 + Vite 7)
- **Langage** : TypeScript (strict)
- **Styling** : Tailwind CSS v4 + design tokens sémantiques (`src/styles.css`)
- **UI** : shadcn/ui + Radix UI
- **Vision** : [MediaPipe Hands](https://developers.google.com/mediapipe) (chargé via CDN)
- **Audio** : Web Audio API (oscillateurs + filtres synthétisés)
- **Encodage vidéo** : WebCodecs API + [`mp4-muxer`](https://github.com/Vanilagy/mp4-muxer)
- **Déploiement** : Cloudflare Workers (via `@cloudflare/vite-plugin`)

---

## 🚀 Démarrage

### Prérequis
- Node.js 20+ (ou [Bun](https://bun.sh/) si tu préfères, c'est plus rapide)
- Une webcam
- Un navigateur moderne (Chrome / Edge recommandé pour WebCodecs)

### Installation

```bash
# Cloner le repo
git clone <url-de-ton-repo>
cd <nom-du-repo>

# Installer les dépendances
npm install

# Lancer en dev
npm run dev
```

> Tu peux remplacer `npm` par `pnpm`, `yarn` ou `bun` — c'est un projet Vite standard, tous les gestionnaires de paquets fonctionnent.

L'app sera dispo sur `http://localhost:3000` (ou le port indiqué dans la console).

### Scripts disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement avec HMR |
| `npm run build` | Build de production |
| `npm run preview` | Prévisualise le build de prod |
| `npm run lint` | Lint le code avec ESLint |
| `npm run format` | Formate le code avec Prettier |

---

## 📂 Structure du projet

```
src/
├── components/
│   ├── aura/
│   │   ├── AuraExperience.tsx    # Composant principal (caméra + canvas + boucle de rendu)
│   │   ├── StartScreen.tsx       # Écran d'accueil + permissions
│   │   ├── ControlPanel.tsx      # Drawer Sheet avec tous les réglages
│   │   ├── HUD.tsx               # FPS + geste détecté
│   │   ├── Calibration.tsx       # Onboarding interactif des gestes
│   │   └── CaptureControls.tsx   # Snapshot PNG + enregistrement MP4
│   └── ui/                       # Composants shadcn
├── lib/
│   └── aura/
│       ├── audio.ts              # SFX synthétisés Web Audio
│       ├── effects.ts            # Engine particules / shockwaves / mandala / squelette
│       ├── gestures.ts           # Détection des gestes à partir des landmarks
│       └── types.ts              # Types et settings par défaut
├── routes/
│   ├── __root.tsx                # Layout racine (head, providers)
│   └── index.tsx                 # Route /
└── styles.css                    # Tailwind v4 + design tokens
```

---

## 🎨 Design system

Les couleurs et tokens sont définis dans `src/styles.css` au format `oklch`. La palette de base est purple/indigo profond avec accents dorés ; les particules cyclent dans tout le spectre selon le mode couleur sélectionné.

**Important** : les composants n'utilisent jamais de couleurs Tailwind brutes (`text-white`, `bg-black`...). Tout passe par les tokens sémantiques (`bg-background`, `text-foreground`, `bg-primary`...).

---

## 🔒 Vie privée

- **Aucune image n'est envoyée sur un serveur.** Tout le traitement (vision, audio, rendu, encodage vidéo) se fait dans ton navigateur.
- Les snapshots et enregistrements sont téléchargés directement en local.
- MediaPipe charge ses modèles depuis un CDN Google la première fois.

---

## 🌐 Déploiement

Le projet est configuré pour Cloudflare Workers (voir `wrangler.jsonc`). Tu peux aussi le déployer directement depuis [Lovable](https://lovable.dev) en cliquant sur **Publish**, ou l'exporter et l'héberger où tu veux (Vercel, Netlify, etc.).

---

## 🙏 Crédits

- Construit avec [Lovable](https://lovable.dev)
- Vision par [MediaPipe](https://developers.google.com/mediapipe)
- UI par [shadcn/ui](https://ui.shadcn.com) et [Radix UI](https://www.radix-ui.com)
- Encodage MP4 par [`mp4-muxer`](https://github.com/Vanilagy/mp4-muxer)

---

## 📄 Licence

MIT — fais-en ce que tu veux. ✨
