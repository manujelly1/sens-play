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

La branche `feature/devops-red` contient une régression volontaire dans la logique du niveau de recherche.

Fichier concerné :

- `game-logic.js`

Fonction concernée :

- `normalizeWantedLevel`

Version cassée :

```js
function normalizeWantedLevel(current, delta, maxWanted = 5) {
  return clamp(current + delta, 0, maxWanted - 1);
}
```

Le bug est simple :

- le niveau maximum devient `4` au lieu de `5`
- le test attend bien une borne max à `5`

## Comment corriger la branche red

### Correction à faire

Dans `feature/devops-red`, remplacer :

```js
function normalizeWantedLevel(current, delta, maxWanted = 5) {
  return clamp(current + delta, 0, maxWanted - 1);
}
```

par :

```js
function normalizeWantedLevel(current, delta, maxWanted = 5) {
  return clamp(current + delta, 0, maxWanted);
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
- bundler utilisé : `webpack`

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

Cette branche est compatible avec le pipeline natif Netlify.

Le dépôt contient la configuration suivante :

- `netlify.toml`

La commande versionnée pour Netlify est :

```toml
[build]
  command = "npm test && npm run build --if-present"
  publish = "."
```

Pour la démo, activer un branch deploy explicite sur :

- `feature/devops-green`

Résultat attendu sur cette branche :

- les tests passent
- le build Webpack passe
- le déploiement preview peut être publié
