# cdtm-map

Projet de carte interactive pour le RP **Chroniques de la Terre du Milieu**.

Le projet a d'abord servi de squelette documentaire pour une carte interactive minimale. La cible retenue est désormais plus large : construire progressivement un outil web public et staff, capable d'évoluer vers un vrai back-office de gestion cartographique.

## Objectif

Fournir une base propre pour afficher et administrer une carte de la Terre du Milieu découpée en cases territoriales.

L'outil doit permettre :

- d'afficher les cases sur une carte interactive ;
- de séparer les géométries cartographiques des données RP ;
- de proposer une vue publique sans données internes ;
- de proposer une vue staff avec les informations réservées ;
- de valider les données avant import ou publication ;
- de préparer une évolution future vers l'édition encadrée des cases.

## Cap technique retenu

Les choix techniques de référence sont :

- application web : `Next.js / React / TypeScript` ;
- moteur cartographique : `OpenLayers` ;
- backend : API légère intégrée à l'application ;
- base de données applicative : `PostgreSQL + PostGIS` ;
- authentification staff : login applicatif simple en V1 ;
- préparation des géométries : `QGIS` ;
- formats d'échange et d'import : `GeoJSON` et `JSON`.

Les fichiers `GeoJSON` et `JSON` restent importants pour les imports, les exports, les tests et les snapshots. En production, la source de vérité applicative visée est la base `PostgreSQL + PostGIS`, pas une collection de fichiers JSON versionnés.

## Statut actuel

Le dépôt contient actuellement :

- une documentation fonctionnelle et technique ;
- des nomenclatures de référence ;
- un modèle de données initial ;
- un schéma JSON des cases ;
- un script de validation de données ;
- des fichiers d'exemple pour tester la validation ;
- des squelettes TypeScript pour les futures briques cartographiques.

L'application `Next.js` n'est pas encore initialisée. La prochaine étape technique consiste à poser ce socle applicatif proprement avant d'intégrer OpenLayers et PostGIS.

## Workflow cible

Le workflow général visé est :

```txt
QGIS -> GeoPackage / GeoJSON -> validation -> staging/import -> PostgreSQL + PostGIS -> API -> vues publique/staff
```

Principes associés :

- les géométries des cases sont produites hors application, depuis QGIS ;
- les données RP sont rattachées aux géométries via `id_case` ;
- les données staff ne doivent jamais être servies à la carte publique ;
- les exports publics doivent être produits explicitement depuis une source contrôlée ;
- les fichiers d'import doivent être validés avant intégration.

## Données géographiques vs données RP

- Données géographiques : contours des cases, localités, frontières, couches cartographiques, géométries issues de QGIS.
- Données RP : faction, contrôle, peuple majoritaire, emplacements, notes publiques, notes staff, styles d'affichage métier.

`id_case` sert de clé stable entre les géométries, les données RP et les futures tables complémentaires.

## Séparation public / staff

La séparation public/staff est un principe central du projet.

- La vue publique ne doit charger que les champs publics.
- `note_staff` et les données internes ne doivent pas être présentes dans les exports ou réponses publiques.
- La vue staff peut afficher les informations publiques et internes, après authentification.
- Les futures publications publiques devront passer par un snapshot contrôlé.

## Structure

- `docs/` : documentation fonctionnelle, technique et organisationnelle.
- `data/schemas/` : schémas JSON de référence.
- `data/reference/` : nomenclatures et règles métier.
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
node scripts/validate-data.mjs data/examples/invalid-terrain-type.geojson
node scripts/validate-data.mjs data/examples/invalid-cote-string.geojson
node scripts/validate-data.mjs data/examples/invalid-emplacements.json
```

Les fichiers invalides ne commencent volontairement pas par `cases` afin de ne pas être pris par la découverte automatique du script.

## Documentation principale

- `docs/ROADMAP.md` : trajectoire générale du projet.
- `docs/SPEC_CARTE_INTERACTIVE_CDTM.md` : spécification fonctionnelle initiale de la carte.
- `docs/DATA_MODEL.md` : modèle de données cible.
- `docs/NOMENCLATURES.md` : valeurs contrôlées.
- `docs/WORKFLOW_QGIS_VECTORISATION_CASES.md` : workflow QGIS.

## Prochaines étapes

- Initialiser le projet `Next.js` en TypeScript.
- Ajouter `package.json`, `tsconfig.json`, lint et formatage.
- Ajouter un environnement local `PostgreSQL + PostGIS`.
- Préparer un premier import/staging de données validées.
- Intégrer ensuite une première carte OpenLayers minimale.
