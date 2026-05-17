# CDTM — Carte interactive

Projet de carte interactive pour le RP **Les Chroniques de la Terre du Milieu**.

## Objectif

Ce dépôt vise à préparer une carte web consultable par les joueurs et maintenable par le staff.

La carte représentera la Terre du Milieu découpée en cases territoriales. Chaque case pourra porter des informations de terrain, de contrôle politique, de faction, de race dominante et d’emplacements disponibles.

## Statut actuel

Le projet est en phase de cadrage technique.

La géométrie définitive des cases sera produite dans QGIS à partir des cartes fournies par le staff, puis exportée en GeoPackage et/ou GeoJSON.

## Workflow prévu

```txt
cartes source staff
→ QGIS / GIMP
→ masque de contours
→ polygonisation
→ nettoyage GeoPackage
→ export GeoJSON
→ application web
```

## Principes

- La géométrie des cases reste séparée des données RP détaillées.
- La couche `cases` contient uniquement les champs essentiels à l’identification, l’affichage et le filtrage.
- Les localités, historiques, bâtiments et données staff détaillées pourront être stockés dans des fichiers ou tables séparés reliés par `id_case`.

## Documentation

- [`docs/SPEC_CARTE_INTERACTIVE_CDTM.md`](docs/SPEC_CARTE_INTERACTIVE_CDTM.md)
- [`docs/WORKFLOW_QGIS_VECTORISATION_CASES.md`](docs/WORKFLOW_QGIS_VECTORISATION_CASES.md)
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)
- [`docs/NOMENCLATURES.md`](docs/NOMENCLATURES.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)
