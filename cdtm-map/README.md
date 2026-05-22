# cdtm-map

Projet de carte interactive pour le RP **Chroniques de la Terre du Milieu**.

Le projet vise à construire progressivement un outil web public et staff autour d'une carte découpée en cases territoriales. La direction retenue pour le modèle de données est désormais de séparer strictement :

- la couche géographique stable des cases ;
- les tables métier évolutives liées aux règles, terrains, contrôles, peuples, notes et emplacements.

## Objectif

Fournir une base propre pour afficher et administrer une carte de la Terre du Milieu découpée en cases territoriales.

La couche de base `cases` doit rester durable dans le temps. Elle ne contient que les informations géographiques stables :

- `id_case`
- `region`
- `sous_region`
- `cote`
- `lac_majeur`
- `cours_eau_majeur`
- la géométrie de la case, portée par le GeoJSON ou par PostGIS selon le support

Les informations susceptibles d'évoluer avec les règles ou avec le RP ne sont pas supprimées du projet. Elles seront déplacées plus tard dans des tables métier séparées.

## Cap technique retenu

Les choix techniques de référence sont :

- application web : `Next.js / React / TypeScript` ;
- fondation UI : `Tailwind CSS v4` + composants `shadcn/ui` versionnés dans le dépôt ;
- moteur cartographique : `OpenLayers` ;
- backend : API légère intégrée à l'application ;
- base de données applicative : `PostgreSQL + PostGIS` ;
- authentification staff : login applicatif simple en V1 ;
- préparation des géométries : `QGIS` ;
- formats d'échange et d'import : `GeoJSON` et `JSON`.

Les fichiers `GeoJSON` et `JSON` restent importants pour les imports, les exports, les tests et les snapshots. En production, la source de vérité applicative visée est la base `PostgreSQL + PostGIS`.

## Workflow cible

```txt
QGIS -> GeoPackage / GeoJSON -> validation -> staging/import -> PostgreSQL + PostGIS -> API -> vues publique/staff
```

Principes associés :

- les géométries des cases sont produites hors application, depuis QGIS ;
- les données métier sont rattachées aux cases via `id_case` ;
- les données staff ne doivent jamais être servies à la carte publique ;
- les exports publics doivent être produits explicitement depuis une source contrôlée ;
- les fichiers d'import doivent être validés avant intégration.

## Structure

- `docs/` : documentation fonctionnelle, technique et organisationnelle.
- `data/schemas/` : schémas JSON de référence.
- `data/reference/` : nomenclatures et règles métier de travail.
- `data/exports/` : exports amont générés hors application, notamment depuis QGIS.
- `data/examples/` : fichiers d'exemple pour tester la validation.
- `public/` : données effectivement servies par l'application, dont `public/data/cases.geojson`.
- `src/` : application web, carte OpenLayers, chargement des données et UI publique.
- `scripts/` : scripts utilitaires.

## V0 web actuelle

La phase 1.1 expose deja une premiere carte publique plus aboutie dans l'application :

- moteur cartographique `OpenLayers` ;
- shell sombre de consultation, sans Bootstrap ;
- base UI `Tailwind CSS v4` et composants `shadcn/ui` locaux ;
- chargement client de `public/data/cases.geojson` ;
- fond statique `public/maps/CTM.png` charge via `ImageStatic` ;
- projection locale applicative `CDTM-LOCAL`, sans fond OSM ;
- panneau lateral de consultation de la case selectionnee ;
- bouton pour afficher ou masquer la couche `cases` ;
- recentrage sur l'emprise complete du fond `[0, -4000, 3200, 0]` ;
- contours de cases visibles avec interieur transparent par defaut ;
- affichage strictement limite aux champs stables de `cases`.

L'image `CTM.png` et le GeoJSON sont affiches dans le meme repere local. Aucune
reprojection vers `EPSG:3857` ou vers des coordonnees longitude/latitude n'est
effectuee dans l'application.

## Validation des données

Le script de validation se lance depuis le dossier `cdtm-map` :

```bash
node scripts/validate-data.mjs
```

Sans argument, le script découvre les fichiers `cases*.json` et `cases*.geojson` du projet, hors dossiers de référence et de schémas.

Il est aussi possible de valider explicitement un fichier :

```bash
node scripts/validate-data.mjs data/examples/cases.valid.geojson
node scripts/validate-data.mjs public/data/cases.geojson
```

Des exemples invalides sont fournis pour tester les erreurs attendues :

```bash
node scripts/validate-data.mjs data/examples/invalid-cote-string.geojson
node scripts/validate-data.mjs data/examples/invalid-terrain-type.geojson
node scripts/validate-data.mjs data/examples/invalid-emplacements.json
node scripts/validate-data.mjs data/examples/invalid-missing-id.geojson
```

Les fichiers invalides ne commencent volontairement pas par `cases`, afin de ne pas être pris par la découverte automatique du script.

## Déploiement Osgiliath

Le dépôt applicatif embarque désormais les artefacts minimaux de déploiement pour la VM `osgiliath` :

- `Dockerfile` : build Next.js production en mode `standalone` ;
- `docker-compose.prod.yml` : application `cdtm-app` + base `postgres/postgis` ;
- `src/app/api/health/route.ts` : healthcheck HTTP simple ;
- `scripts/deploy-osgiliath.sh` : synchronisation SSH + `docker compose up -d --build`.

Le workflow Forgejo visé est :

```txt
push main -> CI Forgejo (aldburg) -> sync SSH -> docker compose sur osgiliath
```

Le job de déploiement attend au minimum les secrets Forgejo suivants :

- `OSGILIATH_SSH_HOST`
- `OSGILIATH_SSH_PORT`
- `OSGILIATH_SSH_USER`
- `OSGILIATH_SSH_PRIVATE_KEY`
- `OSGILIATH_DEPLOY_PATH`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`

Le fichier d'environnement runtime est généré par la CI puis déposé sur la VM dans `${OSGILIATH_DEPLOY_PATH}/.env`.
La valeur de référence de `DATABASE_URL` est :

```text
postgresql://cdtm:<password>@postgres:5432/cdtm
```

Le service Compose de base s'appelle `postgres` dans la stack de production.

Pour tester la stack de production en local :

```bash
docker compose -f docker-compose.prod.yml --env-file .env.example config
```

Pour la préparation du reverse proxy Caddy, voir :
`docs/deployment/caddy-cdtm.example.caddy`

## Documentation principale

- `docs/ROADMAP.md` : trajectoire générale du projet.
- `docs/SPEC_CARTE_INTERACTIVE_CDTM.md` : spécification fonctionnelle initiale de la carte.
- `docs/DATA_MODEL.md` : modèle de données cible.
- `docs/NOMENCLATURES.md` : valeurs contrôlées.
- `docs/WORKFLOW_QGIS_VECTORISATION_CASES.md` : workflow QGIS.
- `docs/FORGEJO_CI.md` : pipeline Forgejo CI/CD et contrat de secrets.

## Prochaines étapes

- Ajouter ensuite les filtres publics utiles sans elargir la couche stable.
- Introduire plus tard les tables metier separees pour les terrains, controles et notes.
- Ajouter si besoin d'autres fonds statiques ou tuiles, sur le meme principe d'alignement local.
- Raccorder ensuite la publication applicative et le futur environnement PostGIS.
