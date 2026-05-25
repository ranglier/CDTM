# Editor UI Architecture

## Objectif

L'interface OpenLayers de l'editeur doit vivre dans un module dedie. Elle ne doit pas etre absorbee par `TechnicalAdminPage`.

## Separation attendue

- UI editeur : `src/components/editor/`
- types et logique partagee editeur : `src/editor/`
- APIs serveur : `/api/admin/editor/...`

## Sources de verite

L'editeur UI doit s'appuyer sur :
- `src/editor/types.ts`
- `GET /api/admin/editor/reference-data`
- les routes dediees :
  - `localities`
  - `landmarks`
  - `forces`
  - `routes` plus tard

## Regles de modele

L'UI peut proposer une experience unifiee, mais ne doit pas reconstruire une table generique `map_points`.

Les objets restent separes :
- `map_localities`
- `map_landmarks`
- `map_forces`
- `map_routes` plus tard

## Statuts

L'editeur doit distinguer :
- `draft`
- `published`
- `archived`

La carte publique ne doit pas afficher automatiquement les objets `draft`.

## Integration future

Le premier lot UI repose deja sur une carte OpenLayers en lecture seule :
- chargement de `reference-data`
- chargement des `localities`
- affichage des localites existantes
- selection et inspection
- filtre local par statut
- overlay optionnel `Influence` pour afficher les cases selon la meme logique que la carte publique
- couche Influence rendue sous les objets editeur
- overlay `Influence` traite comme une option d'affichage de carte, distincte du filtre de statut des localites
- overlay active par defaut pour donner un contexte strategique immediat
- couche OpenLayers des cases factorisee dans un module partage avec la carte publique
- reactivation de l'overlay Influence sans rechargement des donnees de cases

## Couche cases partagee

La carte publique et l'editeur reutilisent la meme brique OpenLayers pour :
- creer la source vectorielle des cases
- lire le GeoJSON stable
- appliquer `getCaseStyle`
- resoudre l'identite d'une case via `registry_id_case` puis `id_case`
- synchroniser la visibilite de la couche

La difference reste uniquement au niveau du contexte :
- carte publique : modes `Faction`, `Influence`, `Topo` et etats `active/selected/default`
- editeur : mode `Influence` uniquement, toujours en lecture seule pour les cases

L'editeur charge lui-meme `cases.geojson`, comme la page Carte, au lieu de recevoir une collection de features depuis son parent. Cela evite les desynchronisations entre chargement des donnees et visibilite de la couche.

Dans l'editeur :
- `EditorMapCanvas` possede sa source et sa layer OpenLayers des cases
- `casesVisible` est l'unique source de verite pour masquer ou reafficher la couche
- les proprietes publiques et les styles viennent de `/api/cases/public-index`
- les localites restent une couche distincte au-dessus des cases
- le mode cases est force a `influence`

L'editeur n'ajoute donc plus qu'une couche localites au-dessus de la couche cases partagee.

Ce lot ne fait aucune ecriture en base.
Il ne modifie pas non plus les cases ni leurs styles publics.

Les prochains lots prevus sont :
1. creation de localite par clic
2. edition de formulaire
3. deplacement drag/drop
4. landmarks
5. forces
6. routes
