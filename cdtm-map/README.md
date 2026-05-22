# Chroniques de la Terre du Milieu

Application web pour afficher et enrichir une carte de cases du projet CDTM.

## Objectif

Le projet se concentre sur deux usages :

- une carte publique de consultation ;
- une brique admin V1 pour enrichir les cases sans melanger les donnees staff au GeoJSON public.

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

Les autres fichiers de `docs/` restent des notes de travail secondaires.
