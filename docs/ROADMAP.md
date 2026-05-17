# Roadmap

## Phase 0 — Cadrage

- documenter le workflow QGIS ;
- définir le modèle de données ;
- définir les nomenclatures ;
- préparer l’arborescence du dépôt.

## Phase 1 — Données géographiques

- obtenir la carte définitive du staff ;
- produire la couche `cases` finale dans QGIS ;
- exporter GeoPackage et GeoJSON ;
- conserver les fichiers intermédiaires.

## Phase 2 — Prototype web statique

- charger un fond de carte ;
- charger un GeoJSON de cases ;
- afficher les contours ;
- colorer par faction ;
- afficher une popup simple.

## Phase 3 — Filtres et légende

- filtre par faction ;
- filtre par terrain ;
- filtre par type de contrôle ;
- légende dynamique ;
- bouton d’affichage des contours.

## Phase 4 — Données enrichies

- ajouter table `localites` ;
- ajouter table `factions` ;
- ajouter table `controleurs` ;
- relier les données par `id_case`.

## Phase 5 — Vue staff

- afficher les notes staff ;
- séparer données publiques et privées ;
- ajouter filtres avancés ;
- préparer l’édition.

## Phase 6 — Édition collaborative

- authentification staff ;
- édition des cases ;
- validation des modifications ;
- journal d’audit.

## Phase 7 — Historique temporel

- historique du contrôle territorial ;
- affichage par période ;
- comparaison entre dates.
