# cdtm-map

Projet squelette pour une carte interactive du RP "Chroniques de la Terre du Milieu".

## But du projet

Fournir une base de travail propre pour afficher plus tard une carte interactive de la Terre du Milieu decoupee en cases territoriales, avec separation entre geometries cartographiques et donnees RP.

## Principe general

- Les geometries des cases seront produites hors application, depuis QGIS.
- L'application web chargera ensuite des exports GeoJSON et des donnees JSON complementaires.
- Les donnees cartographiques et les donnees RP restent separees pour faciliter la maintenance.

## Statut actuel

Le depot contient uniquement l'architecture initiale, la documentation, des schemas JSON simples et quelques fichiers exemples a completer.

## Workflow prevu

`QGIS -> GeoPackage -> GeoJSON -> application web`

## Donnees geographiques vs donnees RP

- Donnees geographiques : contours des cases, localites, frontieres, couches cartographiques.
- Donnees RP : faction, controle, notes, affiliations, styles d'affichage metier.

## Structure

- `docs/` : documentation fonctionnelle, technique et organisationnelle.
- `data/schemas/` : schemas JSON de reference.
- `data/reference/` : nomenclatures et exemples minimaux.
- `public/` : futurs exports servis par l'application.
- `src/` : squelettes TypeScript pour la carte, les donnees et l'UI.
- `scripts/` : scripts utilitaires a completer.

## TODO

- Ajouter les premiers exports GeoJSON issus de QGIS.
- Precisier le choix de la bibliotheque cartographique web.
- Definir le format exact des jeux de donnees charges en production.
