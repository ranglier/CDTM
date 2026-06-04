# Tuilage du fond de carte

Ce document conserve le cadrage initial et decrit l'implementation actuelle du
fond de carte tuile et administrable.

## Objectif

Remplacer le chargement du fond de carte monolithique par un fond tuile afin
d'ameliorer la fluidite du pan et du zoom sur la carte publique et dans
`/editeur`, tout en conservant les couches vectorielles existantes dans le meme
repere pixel.

Le fond peut maintenant etre remplace par un `tech_admin` depuis l'admin
technique. Les coordonnees, la projection, les cases, les objets cartographiques
et les API metier existantes restent inchanges.

## Etat actuel

- Le fond par defaut reste `public/maps/CTM.png`.
- Les tuiles du fond par defaut sont generees au build dans
  `public/maps/tiles/ctm/{z}/{x}/{y}.webp`.
- La carte charge `GET /api/map/background` avant de construire la couche de
  fond.
- La couche OpenLayers est construite dans `src/map/openlayers/map-core.ts` avec
  un `TileLayer` et un `TileGrid` en projection locale.
- La projection locale est `CDTM-LOCAL`.
- L'extent de reference est `[0, -4000, 3200, 0]`, defini dans
  `src/map/config.ts`.
- Les cases, localites, landmarks et routes sont conservees dans le meme repere
  pixel que le fond.
- Les couches vectorielles doivent continuer a se superposer sans transformation
  de coordonnees.
- Le fallback temporaire `NEXT_PUBLIC_CDTM_MAP_BACKGROUND=static` force
  `ImageStatic` + `public/maps/CTM.png`.

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

- serveur de tuiles dynamique ;
- changement de projection ;
- simplification ou generalisation des geometries vectorielles ;
- modification des coordonnees des cases, objets ou routes.

## Implementation retenue

La cible retenue combine une generation au build pour le fond par defaut et une
generation serveur apres upload pour les fonds administrables.

- Outil de generation : `sharp`.
- Script : `scripts/generate-map-tiles.mjs`.
- Source : `public/maps/CTM.png`.
- Sortie : `public/maps/tiles/ctm/{z}/{x}/{y}.webp`.
- Uploads admin : `/app/uploads/map-backgrounds/{id}/`.
- Branchement OpenLayers : `TileLayer` avec une source `ImageTile` et un
  `TileGrid` adapte au repere pixel `CDTM-LOCAL`.
- Fallback temporaire : `NEXT_PUBLIC_CDTM_MAP_BACKGROUND=static`.

Le script doit etre deterministe : meme source, memes options, meme arborescence
de tuiles.

Les uploads admin sont acceptes uniquement en PNG ou WebP, avec signature
coherente, image non animee, taille maximale 25 Mo et dimensions exactes
`3200 x 4000`.

## Proposition de grille

La source actuelle mesure 3200 x 4000 pixels dans un extent
`[0, -4000, 3200, 0]`. Une taille de tuile de 256 px est un bon point de depart.

Niveaux recommandes pour la premiere version :

- `z0` : vue globale tres reduite ;
- `z1` a `z3` : niveaux intermediaires ;
- `z4` : proche de la resolution native du fond actuel ;
- `z5` et au-dela : a eviter au debut sauf besoin explicite, car ils
  agrandissent le fond source sans detail supplementaire.

Avec une grille 256 px et les resolutions `[16, 8, 4, 2, 1]`, `z0` a `z4`
produisent 285 tuiles :

- `z0` : 1 x 1
- `z1` : 2 x 2
- `z2` : 4 x 4
- `z3` : 7 x 8
- `z4` : 13 x 16

La definition exacte des resolutions doit etre verifiee dans OpenLayers avec le
fond et les vecteurs visibles simultanement. C'est le point de controle le plus
important du chantier.

## Fond administrable

La table `map_backgrounds` conserve l'historique des fonds importes. Une
contrainte unique partielle garantit qu'un seul fond uploade peut etre actif a la
fois.

Routes principales :

- `GET /api/map/background` : manifeste public du fond actif, avec fallback vers
  le fond par defaut.
- `GET /uploads/map-backgrounds/[id]/tiles/[z]/[x]/[y].webp` : tuile uploadee,
  cachee longuement car l'id est immuable.
- `GET /api/admin/tech/map-backgrounds` : historique admin.
- `POST /api/admin/tech/map-backgrounds` : upload, validation, generation et
  activation si la generation reussit.
- `PATCH /api/admin/tech/map-backgrounds/[id]` : reactivation d'un fond deja
  genere.
- `DELETE /api/admin/tech/map-backgrounds/[id]` : suppression d'un fond inactif.

En cas d'echec de generation, le nouveau fond est marque `failed`, l'erreur est
affichee dans l'admin, et l'ancien fond actif reste conserve.

## Garde-fous de rendu

Les motifs de cases sont couteux lorsque beaucoup de polygones sont visibles.
Pour stabiliser le pan et le zoom, ils restent dessines pendant les interactions
tant que la vue reste sous un budget de resolution et de nombre de cases
visibles. Aux niveaux de dezoom ou de densite ou ils deviennent peu lisibles,
ils sont masques. Les couleurs de fond, contours, objets et routes restent
visibles.

## Tuiles raster de cases publiques

La vue publique peut maintenant remplacer le rendu vectoriel lourd des cases par
des tuiles raster transparentes. L'editeur reste en rendu vectoriel complet.

La table `map_case_tile_sets` conserve les jeux generes. Une contrainte unique
partielle garantit qu'un seul jeu est actif. Le manifeste public continue de
servir le dernier jeu `ready`, meme si son `state_hash` ne correspond plus au
hash courant : l'admin affiche alors l'etat `A regenerer`.

Le pipeline serveur `src/server/map-case-tiling.ts` :

- utilise `sharp` avec un SVG intermediaire ;
- genere les modes `faction`, `influence` et `topographic` ;
- genere aussi un mode technique `picking`, invisible, dont chaque case porte
  une couleur unique reliee a son identifiant par un index embarque dans le jeu
  de tuiles ;
- utilise la meme grille que le fond, soit 256 px, `z0` a `z4`, resolutions
  `[16, 8, 4, 2, 1]` ;
- ecrit les tuiles dans
  `/app/uploads/map-case-tiles/{id}/tiles/{mode}/{z}/{x}/{y}.webp` ;
- produit 1140 tuiles par jeu, soit 285 tuiles pour chacun des 3 modes publics
  et 285 tuiles de picking.

Routes principales :

- `GET /api/map/case-tiles/manifest` : manifeste public du jeu actif, avec
  fallback vectoriel.
- `GET /uploads/map-case-tiles/[id]/tiles/[mode]/[z]/[x]/[y].webp` : tuile de
  cases, cachee longuement car l'id du jeu est immuable.
- `GET /api/admin/tech/map-case-tiles` : statut admin, hash actif, hash courant,
  historique recent.
- `POST /api/admin/tech/map-case-tiles/regenerate` : generation synchrone et
  activation uniquement si toutes les tuiles sont presentes.

La carte publique charge ce manifeste avant de construire OpenLayers. Si un jeu
`ready` existe, elle ajoute un `TileLayer` raster au-dessus du fond et garde une
couche vectorielle legere pour selection et focus.

Quand le jeu actif contient l'index de picking, les clics et survols de cases
lisent la tuile `picking` au zoom natif et recuperent l'identifiant de case par
couleur. Les contours exacts des cases selectionnees sont ensuite charges a la
demande via `/api/map/cases/geometries`, sans charger toute la couche dans
OpenLayers. Si l'index de picking est absent, si aucun jeu n'est pret, ou si
`NEXT_PUBLIC_CDTM_CASE_TILES=vector` est defini, la carte revient au rendu
vectoriel actuel.

## Decoupage propose

### Lot 1 - Pipeline de generation

- Ajouter `sharp` en dependance runtime.
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
- Aucun changement de coordonnees, projection ou API metier n'est introduit.

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
