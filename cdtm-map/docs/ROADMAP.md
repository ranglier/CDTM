# Roadmap

Cette roadmap guide la construction du futur outil web CDTM.

La cible n'est plus une simple carte interactive minimale, mais un outil web public et staff conçu dès le départ pour évoluer vers un vrai back-office de gestion cartographique.

Le cap technique retenu est le suivant :

- application web en `Next.js / React / TypeScript` ;
- moteur cartographique `OpenLayers` ;
- source de vérité applicative en `PostgreSQL + PostGIS` ;
- backend léger intégré à l'application ;
- authentification staff simple en V1 ;
- géométries toujours préparées en amont dans `QGIS` ;
- fichiers `GeoJSON` et `JSON` conservés comme formats d'échange, d'import, de test et de snapshot.

## Décisions techniques retenues

- architecture : monolithe TypeScript web ;
- frontend : `Next.js + React` ;
- cartographie : `OpenLayers` ;
- backend : API intégrée légère ;
- base de données : `PostgreSQL + PostGIS` ;
- auth staff : login applicatif simple ;
- source amont des géométries : `QGIS` ;
- source de vérité applicative : base de données, pas fichiers JSON versionnés en production.

## Principes structurants

- Les géométries cartographiques et les données RP restent séparées.
- `id_case` est la clé stable de liaison entre géométries, données métier et futures tables.
- Les données publiques et staff doivent être séparées côté backend.
- La carte publique ne doit jamais charger les données staff.
- `note_staff` ne doit jamais apparaître dans un export ou une réponse publique.
- Les géométries restent produites hors application.
- Les fichiers `GeoJSON` et `JSON` restent utiles comme formats d'échange, d'import, de test et de publication contrôlée.
- L'architecture doit pouvoir évoluer sans remplacement du moteur cartographique.

## Phase 0 : cadrage et socle documentaire

- Figer la stack technique principale.
- Poser l'architecture monolithique de l'application.
- Définir les premiers contrats de données applicatifs.
- Documenter clairement la séparation entre public et staff.
- Stabiliser les nomenclatures initiales.
- Stabiliser les règles de validation de base.

Contrats applicatifs à stabiliser :

- `CaseGeometryFeature`
- `CasePublicRecord`
- `CaseStaffRecord`
- `ValidationIssue`
- `PublishedSnapshot`
- `ImportBatch`

## Phase 0 bis : initialisation technique du projet

Cette phase sert à transformer le squelette documentaire actuel en vrai projet applicatif lançable localement.

- Initialiser l'application `Next.js` en TypeScript.
- Ajouter `package.json`, `tsconfig.json` et la configuration de lint/format.
- Ajouter les scripts npm de base :
  - `dev`
  - `build`
  - `lint`
  - `validate:data`
- Préparer une structure minimale d'application :
  - `src/app/`
  - `src/components/`
  - `src/map/`
  - `src/data/`
  - `src/server/`
- Ajouter un environnement local `PostgreSQL + PostGIS`, idéalement via `docker-compose.yml`.
- Ajouter `.env.example`.
- Documenter le lancement local du projet.
- Vérifier que le script de validation reste utilisable depuis le projet initialisé.

## Phase 1 : socle application et carte

- Créer la base de l'application web.
- Intégrer `OpenLayers`.
- Afficher un fond de carte custom.
- Charger une première couche de cases depuis un fichier d'exemple validé.
- Afficher les contours noirs des cases.
- Préparer une première fonction de style simple.

Livrable attendu : une carte visible en local, même avec un jeu de données minimal.

## Phase 2 : pipeline de données et validation

- Formaliser l'import des exports `QGIS` / `GeoJSON`.
- Valider les données géographiques et métier avant intégration.
- Préparer un espace de staging avant publication.
- Clarifier les formats et flux des exports publics et privés.
- Générer un rapport de validation lisible.
- Préparer les règles de rejet ou de correction avant import.
- Préparer la future insertion en base `PostGIS`.

Points de vigilance :

- l'unicité globale de `id_case` ;
- la cohérence `terrain_cat` / `terrain_type` ;
- le calcul `empl_base` / `empl_max` ;
- l'absence de données staff dans les exports publics ;
- la conservation d'un snapshot public stable.

## Phase 3 : V1 publique

- Proposer une carte consultable avec navigation.
- Ajouter les popups publiques.
- Ajouter les filtres de base.
- Ajouter une légende initiale.
- Ajouter une recherche simple.
- Garantir qu'aucune donnée staff n'est chargée côté public.
- Préparer un premier export ou endpoint public contrôlé.

La V1 publique doit rester simple : consultation, lisibilité, sécurité des données.

## Phase 4 : V1 staff consultative

- Ajouter l'authentification.
- Proposer une vue staff séparée de la vue publique.
- Afficher les notes internes utiles au staff.
- Charger les calques privés nécessaires.
- Ajouter des filtres avancés.
- Afficher les problèmes de validation ou les statuts de vérification.

Cette phase reste consultative : l'édition directe peut attendre.

## Phase 5 : publication et workflow staff

- Importer un jeu de données à vérifier.
- Produire un rapport de validation lisible.
- Corriger ou rejeter les entrées problématiques.
- Publier un snapshot public contrôlé.
- Conserver une version publiée stable.
- Documenter le workflow staff de publication.

Objectif : rendre la publication reproductible et sûre.

## Phase 6 : montée en charge et optimisation cartographique

- Optimiser le chargement des couches.
- Mettre en place un découpage par emprise ou une stratégie de chargement adaptée.
- Préparer l'évolution vers des sources plus performantes si nécessaire.
- Préserver la stabilité des styles, popups et filtres malgré l'évolution des sources.
- Évaluer si certains exports publics doivent être pré-générés.

## Phase 7 : évolutions ultérieures

- Introduire une édition encadrée des données.
- Ajouter un historique temporel des évolutions.
- Affiner les rôles et permissions si nécessaire.
- Prévoir des outils collaboratifs supplémentaires.
- Ajouter des outils d'audit des modifications.
- Ajouter des exports ciblés pour le staff ou les joueurs.

## Ordre recommandé à court terme

1. Garder le script de validation fonctionnel et documenté.
2. Ajouter des fichiers d'exemple valides et invalides.
3. Initialiser le projet `Next.js` proprement.
4. Ajouter l'environnement local `PostGIS`.
5. Brancher une première carte OpenLayers sur un jeu d'exemple validé.
6. Construire ensuite seulement le pipeline d'import/staging.

## Notes de mise en œuvre

- Ne pas construire le back-office complet trop tôt.
- Ne pas mélanger les données publiques et staff dans un même endpoint public.
- Ne pas déplacer la production de géométries dans l'application web.
- Ne pas considérer les fichiers d'exemple comme des données canoniques.
- Prioriser une chaîne fiable : validation -> import/staging -> snapshot public -> affichage.

## Note

Cette roadmap reste indicative et pourra être réordonnée selon les besoins du projet, mais les grandes décisions techniques ci-dessus sont considérées comme actées pour la suite du chantier.
