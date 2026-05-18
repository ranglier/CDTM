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
- `data/examples/` : fichiers d'exemple pour tester la validation.
- `public/` : futurs exports servis par l'application.
- `src/` : squelettes TypeScript pour la carte, les données et l'UI.
- `scripts/` : scripts utilitaires.

## Validation des données

Le script de validation se lance depuis le dossier `cdtm-map` :

```bash
node scripts/validate-data.mjs
```

Sans argument, le script découvre les fichiers `cases*.json` et `cases*.geojson` du projet, hors dossiers de référence et de schémas.

Il est aussi possible de valider explicitement un fichier :

```bash
node scripts/validate-data.mjs data/examples/cases.valid.geojson
```

Des exemples invalides sont fournis pour tester les erreurs attendues :

```bash
node scripts/validate-data.mjs data/examples/invalid-cote-string.geojson
node scripts/validate-data.mjs data/examples/invalid-terrain-type.geojson
node scripts/validate-data.mjs data/examples/invalid-emplacements.json
node scripts/validate-data.mjs data/examples/invalid-missing-id.geojson
```

Les fichiers invalides ne commencent volontairement pas par `cases`, afin de ne pas être pris par la découverte automatique du script.

## Documentation principale

- `docs/ROADMAP.md` : trajectoire générale du projet.
- `docs/SPEC_CARTE_INTERACTIVE_CDTM.md` : spécification fonctionnelle initiale de la carte.
- `docs/DATA_MODEL.md` : modèle de données cible.
- `docs/NOMENCLATURES.md` : valeurs contrôlées.
- `docs/WORKFLOW_QGIS_VECTORISATION_CASES.md` : workflow QGIS.

## Prochaines étapes

- Produire une première couche QGIS propre avec des géométries exploitables.
- Garantir l'unicité et la stabilité de `id_case`.
- Valider les booléens d'eau sur les cases.
- Préparer ensuite les futures tables métier sans les mélanger à la couche géographique stable.
