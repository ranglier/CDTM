# cdtm-map

Projet web pour la future carte interactive du RP **Chroniques de la Terre du Milieu**.

Le projet a d'abord servi de squelette documentaire pour une carte interactive minimale. Il dispose maintenant d'un premier socle technique local pour preparer l'application web publique et staff decrite dans la roadmap.

## Objectif

Fournir une base propre pour afficher et administrer une carte de la Terre du Milieu decoupee en cases territoriales.

L'outil doit permettre :

- d'afficher les cases sur une carte interactive ;
- de separer les geometries cartographiques des donnees RP ;
- de proposer une vue publique sans donnees internes ;
- de proposer une vue staff avec les informations reservees ;
- de valider les donnees avant import ou publication ;
- de preparer une evolution future vers l'edition encadree des cases.

## Cap technique retenu

Les choix techniques de reference sont :

- application web : `Next.js / React / TypeScript` ;
- moteur cartographique : `OpenLayers` ;
- backend : API legere integree a l'application ;
- base de donnees applicative : `PostgreSQL + PostGIS` ;
- authentification staff : login applicatif simple en V1 ;
- preparation des geometries : `QGIS` ;
- formats d'echange et d'import : `GeoJSON` et `JSON`.

Les fichiers `GeoJSON` et `JSON` restent importants pour les imports, les exports, les tests et les snapshots. En production, la source de verite applicative visee est la base `PostgreSQL + PostGIS`, pas une collection de fichiers JSON versionnes.

## Statut actuel

Le depot contient actuellement :

- une documentation fonctionnelle et technique ;
- des nomenclatures de reference ;
- un modele de donnees initial ;
- un schema JSON des cases ;
- un script de validation de donnees ;
- des fichiers d'exemple pour tester la validation ;
- un socle `Next.js` minimal ;
- un environnement local `PostgreSQL + PostGIS` via `docker-compose.yml`.

La carte `OpenLayers` et le pipeline d'import/staging restent a brancher dans les prochaines phases.

## Workflow cible

Le workflow general vise est :

```txt
QGIS -> GeoPackage / GeoJSON -> validation -> staging/import -> PostgreSQL + PostGIS -> API -> vues publique/staff
```

Principes associes :

- les geometries des cases sont produites hors application, depuis QGIS ;
- les donnees RP sont rattachees aux geometries via `id_case` ;
- les donnees staff ne doivent jamais etre servies a la carte publique ;
- les exports publics doivent etre produits explicitement depuis une source controlee ;
- les fichiers d'import doivent etre valides avant integration.

## Demarrage local

1. Copier les variables d'environnement :

```bash
cp .env.example .env
```

2. Installer les dependances :

```bash
npm install
```

3. Lancer PostgreSQL + PostGIS :

```bash
docker compose up -d postgis
```

4. Verifier les donnees d'exemple :

```bash
npm run validate:data
```

5. Lancer l'application :

```bash
npm run dev
```

L'application est ensuite disponible sur `http://localhost:3000`.

## Scripts utiles

- `npm run dev` : lance le serveur de developpement Next.js
- `npm run build` : construit l'application
- `npm run start` : lance l'application construite
- `npm run lint` : verifie le code avec ESLint
- `npm run format` : reformate le projet avec Prettier
- `npm run typecheck` : verifie TypeScript sans generer de build
- `npm run validate:data` : valide les fichiers `cases*.json` et `cases*.geojson`

## Donnees geographiques vs donnees RP

- Donnees geographiques : contours des cases, localites, frontieres, couches cartographiques, geometries issues de QGIS.
- Donnees RP : faction, controle, peuple majoritaire, emplacements, notes publiques, notes staff, styles d'affichage metier.

`id_case` sert de cle stable entre les geometries, les donnees RP et les futures tables complementaires.

## Separation public / staff

La separation public/staff est un principe central du projet.

- La vue publique ne doit charger que les champs publics.
- `note_staff` et les donnees internes ne doivent pas etre presentes dans les exports ou reponses publiques.
- La vue staff peut afficher les informations publiques et internes, apres authentification.
- Les futures publications publiques devront passer par un snapshot controle.

## Structure

- `docs/` : documentation fonctionnelle, technique et organisationnelle.
- `data/schemas/` : schemas JSON de reference.
- `data/reference/` : nomenclatures et regles metier.
- `data/examples/` : fichiers d'exemple pour tester la validation.
- `public/` : futurs exports servis par l'application.
- `src/app/` : squelette applicatif Next.js.
- `src/components/` : composants React reutilisables.
- `src/data/` : chargement et preparation des donnees.
- `src/map/` : logique cartographique future.
- `src/server/` : helpers serveur et futur code d'integration backend.
- `scripts/` : scripts utilitaires.

## Validation des donnees

Le script de validation se lance depuis le dossier `cdtm-map` :

```bash
node scripts/validate-data.mjs
```

Sans argument, le script decouvre les fichiers `cases*.json` et `cases*.geojson` du projet, hors dossiers de reference et de schemas.

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

Les fichiers invalides ne commencent volontairement pas par `cases` afin de ne pas etre pris par la decouverte automatique du script.

## Documentation principale

- `docs/ROADMAP.md` : trajectoire generale du projet.
- `docs/FORGEJO_CI.md` : baseline CI minimale pour Forgejo prive.
- `docs/SPEC_CARTE_INTERACTIVE_CDTM.md` : specification fonctionnelle initiale de la carte.
- `docs/DATA_MODEL.md` : modele de donnees cible.
- `docs/NOMENCLATURES.md` : valeurs controlees.
- `docs/WORKFLOW_QGIS_VECTORISATION_CASES.md` : workflow QGIS.

## Prochaines etapes

- Integrer la premiere carte `OpenLayers`.
- Charger un jeu de donnees d'exemple valide dans l'application.
- Brancher un premier environnement d'import et de staging.
- Preparer les futures integrations `PostGIS` cote application.
