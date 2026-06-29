# Demo DevOps: branches green/red

## Objectif

Cette démo montre une évolution fonctionnelle identique sur deux branches `feature` :

- `feature/devops-green` : la feature passe les tests
- `feature/devops-red` : la même feature est présente, mais les tests échouent

L'idée est de montrer qu'un pipeline DevOps ne valide pas "une intention", mais un état réel du code.

## Etat des branches

- `main`
  - base propre pour la présentation
  - les tests passent
- `feature/devops-green`
  - version 3D avec `Three.js`
  - ouverture directe possible via `index.html`
  - les tests passent
  - les étoiles du wanted reflètent correctement le niveau affiché
- `feature/devops-red`
  - même évolution 3D avec `Three.js`
  - ouverture directe possible via `index.html`
  - un test échoue volontairement

## Commandes de démo

### 1. Montrer la branche green

```bash
git switch feature/devops-green
npm test
open index.html
```

Résultat attendu :

- l'application s'ouvre en 3D
- tous les tests passent
- un wanted level à `3` affiche bien `★★★☆☆`

### 2. Montrer la branche red

```bash
git switch feature/devops-red
npm test
open index.html
```

Résultat attendu :

- l'application s'ouvre aussi en 3D
- un test échoue

### 3. Revenir au point neutre

```bash
git switch main
npm test
```

## Pourquoi la branche red échoue

La branche `feature/devops-red` contient une régression volontaire dans l'affichage des étoiles du niveau de recherche.

Fichier concerné :

- `game-logic.js`

Fonction concernée :

- `formatWantedStars`

Version cassée :

```js
function formatWantedStars(wanted, maxWanted = 5) {
  const safeWanted = clamp(Math.round(wanted), 0, maxWanted);
  const visibleWanted = Math.max(0, safeWanted - 1);
  return "★".repeat(visibleWanted) + "☆".repeat(maxWanted - visibleWanted);
}
```

Le bug est simple :

- l'interface affiche toujours une étoile de moins que prévu
- par exemple, un wanted level à `3` montre `★★☆☆☆` au lieu de `★★★☆☆`
- c'est beaucoup plus parlant en présentation qu'une borne interne incorrecte

## Comment corriger la branche red

### Correction à faire

Dans `feature/devops-red`, remplacer :

```js
function formatWantedStars(wanted, maxWanted = 5) {
  const safeWanted = clamp(Math.round(wanted), 0, maxWanted);
  const visibleWanted = Math.max(0, safeWanted - 1);
  return "★".repeat(visibleWanted) + "☆".repeat(maxWanted - visibleWanted);
}
```

par :

```js
function formatWantedStars(wanted, maxWanted = 5) {
  const safeWanted = clamp(Math.round(wanted), 0, maxWanted);
  return "★".repeat(safeWanted) + "☆".repeat(maxWanted - safeWanted);
}
```

### Commandes de correction

```bash
git switch feature/devops-red
npm test
```

Modifier ensuite `game-logic.js`, puis relancer :

```bash
npm test
```

Résultat attendu après correction :

- le test rouge redevient vert
- la branche red se comporte comme la green côté pipeline

## Note sur le lancement local

Les branches feature sont prévues pour fonctionner en ouverture directe du fichier HTML.

Le chargement du jeu 3D a été rendu compatible `file://` grâce à un bundle navigateur classique :

- source maintenable : `game-src.js`
- bundle exécuté par le navigateur : `game.js`

Si la source 3D est modifiée sur une branche feature, reconstruire le bundle avec :

```bash
npm run build
```

## Message clé pour la présentation

Le message à faire passer :

- la feature peut être "visuellement présente" sur les deux branches
- seule la qualité vérifiée par les tests permet de distinguer un changement livrable d'un changement risqué
- le pipeline DevOps sert précisément à empêcher qu'un état "red" parte plus loin dans la chaîne

## Déploiement Netlify

Le dépôt peut s'appuyer sur le pipeline natif Netlify.

Le dépôt contient la configuration suivante :

- `netlify.toml`

Comportement prévu :

- `main`
  - déploiement production via le pipeline natif Netlify
- `feature/devops-green`
  - branch deploy Netlify dédié pour la démo green
- `feature/devops-red`
  - branch deploy Netlify dédié pour la démo red

La config versionnée indique simplement à Netlify de publier la racine du projet :

```toml
[build]
  command = "npm test && npm run build --if-present"
  publish = "."
```

Effet recherché :

- Netlify lance les tests avant le déploiement
- si les tests échouent, le déploiement est bloqué
- si un script `build` existe sur la branche, il est lancé après les tests

### Réglage Netlify recommandé

Dans Netlify, activer les branch deploys pour :

- `feature/devops-green`
- `feature/devops-red`

Si vous préférez une règle plus large pour d'autres démos, vous pouvez aussi utiliser :

- `feature/*`

Pour la présentation, les deux branches de démonstration sont plus parlantes quand elles sont configurées explicitement :

- `feature/devops-green`
  - les tests passent, le déploiement peut aboutir
  - les étoiles visibles du wanted sont correctes
- `feature/devops-red`
  - les tests échouent, Netlify stoppe le pipeline avant publication
  - une étoile manque systématiquement dans l'UI

### Comment corriger une branche red côté déploiement

Le déploiement ne doit pas partir tant que les tests échouent.

Donc pour permettre le déploiement de `feature/devops-red`, il faut d'abord corriger la régression dans :

- `game-logic.js`

Puis relancer :

```bash
npm test
```

Une fois les tests repassés au vert, la branche peut repartir dans le pipeline natif Netlify.
