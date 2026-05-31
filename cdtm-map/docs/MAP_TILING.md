# Cadrage du tuilage du fond de carte

Ce document cadre un chantier futur. Il ne decrit pas une fonctionnalite deja
livree et ne suppose pas que le script de generation existe aujourd'hui.

## Objectif

Remplacer le chargement du fond de carte monolithique par un fond tuile afin
d'ameliorer la fluidite du pan et du zoom sur la carte publique et dans
`/editeur`, tout en conservant les couches vectorielles existantes dans le meme
repere pixel.

Le tuilage doit rester un changement de rendu frontend et de packaging. Il ne
doit pas entrainer de migration BDD ni de changement API.

## Etat actuel

- Le fond de carte est servi depuis `public/maps/CTM.png`.
- La couche OpenLayers est construite dans `src/map/openlayers/map-core.ts` avec
  `ImageStatic`.
- La projection locale est `CDTM-LOCAL`.
- L'extent de reference est `[0, -4000, 3200, 0]`, defini dans
  `src/map/config.ts`.
- Les cases, localites, landmarks et routes sont conservees dans le meme repere
  pixel que le fond.
- Les couches vectorielles doivent continuer a se superposer sans transformation
  de coordonnees.

## Qualification du cout

Estimation de charge :

- 2 a 3 jours humain pour une implementation prudente, avec verification
  visuelle et integration de build.
- 3 a 5 heures avec automatisation Codex si le chantier reste strictement
  limite au fond de carte tuile.

Risque principal :

- alignement exact entre les tuiles, les cases, les objets et les routes.

Risques secondaires :

- packaging incomplet des tuiles dans l'image Docker standalone ;
- temps de build accru si les tuiles sont regenerees systematiquement ;
- differences de rendu liees a la compression WebP ;
- confusion entre zoom OpenLayers, resolution pixel et niveaux `{z}` du
  tuilage.

Hors perimetre :

- migration BDD ou API ;
- serveur de tuiles dynamique ;
- changement de projection ;
- simplification ou generalisation des geometries vectorielles ;
- modification des coordonnees des cases, objets ou routes.

## Cible technique

La cible retenue est une generation au build depuis le fond source actuel.

- Outil de generation : `sharp`.
- Script prevu : `scripts/generate-map-tiles.mjs`.
- Source : `public/maps/CTM.png`.
- Sortie : `public/maps/tiles/ctm/{z}/{x}/{y}.webp`.
- Branchement OpenLayers : `TileLayer` avec une source `XYZ` ou `TileImage` et
  un `TileGrid` adapte au repere pixel `CDTM-LOCAL`.
- Fallback temporaire : conserver la possibilite de revenir a
  `ImageStatic` + `CTM.png` tant que l'alignement n'est pas valide.

Le script doit etre deterministe : meme source, memes options, meme arborescence
de tuiles.

## Proposition de grille

La source actuelle mesure 3200 x 4000 pixels dans un extent
`[0, -4000, 3200, 0]`. Une taille de tuile de 256 px est un bon point de depart.

Niveaux recommandes pour la premiere version :

- `z0` : vue globale tres reduite ;
- `z1` a `z3` : niveaux intermediaires ;
- `z4` : proche de la resolution native du fond actuel ;
- `z5` et au-dela : a eviter au debut sauf besoin explicite, car ils
  agrandissent le fond source sans detail supplementaire.

Ordre de grandeur avec une grille 256 px et `z0` a `z4` : environ 285 tuiles.
Ce volume est acceptable pour un build applicatif et pour un deploiement Docker.

La definition exacte des resolutions doit etre verifiee dans OpenLayers avec le
fond et les vecteurs visibles simultanement. C'est le point de controle le plus
important du chantier.

## Decoupage propose

### Lot 1 - Pipeline de generation

- Ajouter `sharp` en dependance de developpement.
- Creer `scripts/generate-map-tiles.mjs`.
- Generer les tuiles WebP dans `public/maps/tiles/ctm/{z}/{x}/{y}.webp`.
- Ajouter une commande npm dediee, par exemple `generate:map-tiles`.
- Nettoyer la sortie avant regeneration pour eviter les tuiles obsoletes.
- Documenter les options de generation : taille, niveaux, qualite WebP.

Livrable attendu :

- l'arborescence de tuiles est produite localement de maniere reproductible ;
- aucun code OpenLayers n'est encore oblige d'utiliser ces tuiles.

### Lot 2 - Branchement OpenLayers

- Ajouter une fabrique de couche tuilee dans `src/map/openlayers/map-core.ts`.
- Construire un `TileGrid` compatible avec `CDTM-LOCAL` et
  `[0, -4000, 3200, 0]`.
- Brancher la carte publique et `/editeur` sur la couche tuilee.
- Garder un fallback vers `createCdtmBackgroundLayer()` tant que necessaire.
- Comparer visuellement le fond tuile avec les cases, objets et routes.

Livrable attendu :

- le fond tuile s'affiche sur carte publique et editeur ;
- les couches vectorielles restent alignees ;
- le fallback vers `CTM.png` reste simple a activer pendant la validation.

### Lot 3 - Build, Docker et validation

- Integrer la generation dans le build applicatif ou dans une etape Docker
  explicite.
- Verifier que `public/maps/tiles/ctm/` est bien present dans l'image produite.
- Controler le temps de build et la taille finale de l'image.
- Ajouter une verification documentaire ou scriptable pour detecter l'absence de
  tuiles.
- Supprimer le fallback uniquement apres validation manuelle stable.

Livrable attendu :

- les tuiles sont disponibles en production ;
- le deploiement standalone Docker embarque le fond tuile ;
- le comportement reste identique fonctionnellement.

## Criteres d'acceptation

- Aucun decalage visible entre le fond tuile et les cases.
- Les localites, landmarks et routes restent alignes avec le fond.
- Le pan et le zoom sont plus fluides que le chargement `ImageStatic`.
- Les tuiles sont servies depuis `public/maps/tiles/ctm/`.
- L'image Docker standalone contient les tuiles generees.
- Le fallback vers `public/maps/CTM.png` reste possible pendant la phase de
  validation.
- Aucun changement BDD ou API n'est introduit.

## Validation conseillee

Commandes a prevoir lorsque le chantier sera implemente :

```bash
npm run generate:map-tiles
npm run typecheck
npm run lint
npm run test
npm run validate:data
npm run build
git diff --check
```

Validation manuelle :

- carte publique : pan horizontal et vertical rapide ;
- `/editeur` : pan rapide avec cases, localites, landmarks et routes visibles ;
- controle d'alignement a plusieurs niveaux de zoom ;
- comparaison visuelle temporaire entre le fond `ImageStatic` et le fond tuile ;
- verification reseau : seules les tuiles visibles doivent etre chargees.

## Points a trancher au demarrage

- Les tuiles doivent-elles etre commitees ou generees uniquement au build ?
  Cible recommandee : generation au build, sans commit des tuiles, sauf si le
  temps de build devient trop couteux.
- Qualite WebP cible : commencer autour de 85, puis ajuster selon le poids et le
  rendu visuel.
- Politique de cache : a definir au moment du deploiement, possiblement avec des
  entetes longs si les chemins de tuiles sont invalides a chaque regeneration.
- Niveaux de zoom exacts : commencer avec `z0` a `z4`, puis etendre seulement si
  l'usage le justifie.
