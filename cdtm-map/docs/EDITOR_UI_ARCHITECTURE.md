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

Ce lot ne fait aucune ecriture en base.
Il ne modifie pas non plus les cases ni leurs styles publics.

Les prochains lots prevus sont :
1. creation de localite par clic
2. edition de formulaire
3. deplacement drag/drop
4. landmarks
5. forces
6. routes
