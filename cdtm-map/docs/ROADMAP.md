# Roadmap

Cette roadmap guide la construction du futur outil web CDTM.

La cible n'est plus une simple carte interactive minimale, mais un outil web public et staff concu des le depart pour evoluer vers un vrai back-office de gestion cartographique.

Le cap technique retenu est le suivant :

- application web en `Next.js / React`
- moteur cartographique `OpenLayers`
- source de verite en `PostgreSQL + PostGIS`
- backend leger integre a l'application
- authentification staff simple en V1
- geometries toujours preparees en amont dans `QGIS`

## Decisions techniques retenues

- architecture : monolithe TypeScript web
- frontend : `Next.js + React`
- cartographie : `OpenLayers`
- backend : API integree legere
- base de donnees : `PostgreSQL + PostGIS`
- auth staff : login applicatif simple
- source amont des geometries : `QGIS`
- source de verite applicative : base de donnees, pas fichiers JSON versionnes en production

## Phase 0 : cadrage et socle technique

- Figer la stack technique principale.
- Poser l'architecture monolithique de l'application.
- Definir les premiers contrats de donnees applicatifs.
- Documenter clairement la separation entre public et staff.

Contrats applicatifs a stabiliser :

- `CaseGeometryFeature`
- `CasePublicRecord`
- `CaseStaffRecord`
- `ValidationIssue`
- `PublishedSnapshot`

## Phase 1 : socle application et carte

- Creer la base de l'application web.
- Integrer `OpenLayers`.
- Afficher un fond de carte custom.
- Charger une premiere couche de cases.

## Phase 2 : pipeline de donnees et validation

- Formaliser l'import des exports `QGIS` / `GeoJSON`.
- Valider les donnees geographiques et metier avant integration.
- Preparer un espace de staging avant publication.
- Clarifier les formats et flux des exports publics et prives.

## Phase 3 : V1 publique

- Proposer une carte consultable avec navigation.
- Ajouter les popups publiques.
- Ajouter les filtres de base.
- Ajouter une legende initiale.
- Ajouter une recherche simple.
- Garantir qu'aucune donnee staff n'est chargee cote public.

## Phase 4 : V1 staff consultative

- Ajouter l'authentification.
- Proposer une vue staff separee de la vue publique.
- Afficher les notes internes utiles au staff.
- Charger les calques prives necessaires.
- Ajouter des filtres avances.

## Phase 5 : publication et workflow staff

- Importer un jeu de donnees a verifier.
- Produire un rapport de validation lisible.
- Publier un snapshot public controle.
- Conserver une version publiee stable.

## Phase 6 : montee en charge et optimisation cartographique

- Optimiser le chargement des couches.
- Mettre en place un decoupage par emprise ou une strategie de chargement adaptee.
- Preparer l'evolution vers des sources plus performantes si necessaire.
- Preserver la stabilite des styles, popups et filtres malgre l'evolution des sources.

## Phase 7 : evolutions ulterieures

- Introduire une edition encadree des donnees.
- Ajouter un historique temporel des evolutions.
- Affiner les roles et permissions si necessaire.
- Prevoir des outils collaboratifs supplementaires.

## Principes de mise en oeuvre

- Les donnees publiques et staff doivent etre separees cote backend.
- La carte publique ne doit jamais charger les donnees staff.
- Les geometries restent produites hors application.
- Les fichiers `GeoJSON` et `JSON` restent utiles comme formats d'echange et d'import.
- L'architecture doit pouvoir evoluer sans remplacement du moteur cartographique.

## Note

Cette roadmap reste indicative et pourra etre reordonnee selon les besoins du projet, mais les grandes decisions techniques ci-dessus sont considerees comme actees pour la suite du chantier.
