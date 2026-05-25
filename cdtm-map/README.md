# Chroniques de la Terre du Milieu

Application web pour afficher et enrichir une carte de cases du projet CDTM.

## Objectif

Le projet se concentre sur deux usages :

- une carte publique de consultation ;
- une brique admin V1 pour enrichir les cases sans melanger les donnees staff au GeoJSON public.

## Etat actuel

L'application contient aujourd'hui :

- une carte publique OpenLayers basee sur un fond statique et `public/data/cases.geojson` ;
- des filtres cartographiques `Faction`, `Influence` et `Topo` ;
- un index public des cases capable de fusionner la couche stable avec les surcharges publiques stockees en base ;
- une authentification staff simple par cookie de session ;
- une interface admin integree pour consulter et modifier les donnees de case ;
- une edition de masse pour les champs publics, terrain et controle ;
- un espace admin technique pour gerer les referentiels globaux et creer des tables metier dynamiques ;
- un deploiement Docker Compose vers `osgiliath` via Forgejo CI/CD.

Les limites et priorites issues de l'audit sont suivies dans `docs/AUDIT_ROADMAP.md`.

## Architecture

- frontend : `Next.js`, `React`, `TypeScript`
- UI : `Tailwind CSS v4` et composants locaux
- carte : `OpenLayers`
- backend : routes API integrees a l'application
- donnees stables : `public/data/cases.geojson`
- donnees admin : `PostgreSQL`
- geometries preparees hors application via `QGIS`

## Lancement local

Depuis `cdtm-map` :

```bash
npm ci
npm run validate:data
npm run dev
```

Verifications principales :

```bash
npm run lint
npm run typecheck
npm run build
```

## Deploiement

Le deploiement de production repose sur :

- `docker-compose.prod.yml`
- `.forgejo/workflows/cdtm-ci.yml`
- `scripts/deploy-osgiliath.sh`

La configuration de deploiement attend les secrets Forgejo existants pour PostgreSQL et SSH.
Le deploiement standard ne requiert pas de secrets `ADMIN_*`.

## Documentation principale

- `docs/ADMIN.md` : fonctionnement et limites de l'admin V1
- `docs/FORGEJO_CI.md` : CI/CD et deploiement
- `docs/AUDIT_ROADMAP.md` : etat d'audit, risques et priorites d'evolution

Les autres fichiers de `docs/` restent des notes de travail secondaires.
