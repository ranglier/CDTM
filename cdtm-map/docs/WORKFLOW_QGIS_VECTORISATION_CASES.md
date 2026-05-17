# Workflow QGIS vectorisation cases

Document de travail pour decrire le pipeline de production des geometries territoriales.

## Objectif

Documenter une methode reproductible pour passer d'une carte source a un export vectoriel exploitable dans l'application web.

## Etapes prevues

### 1. Carte vierge

- Preparer une carte de base sans annotations inutiles.
- Verifier la resolution et la projection de travail.

### 2. Carte avec cases

- Produire une version contenant les contours des cases a vectoriser.
- Conserver si possible une source raster propre pour archivage.

### 3. Calculatrice raster

- Utiliser la calculatrice raster pour isoler ou renforcer les elements utiles.
- TODO : documenter les reglages retenus.

### 4. Masque des contours

- Generer un masque exploitable pour les frontieres des cases.

### 5. Correction GIMP

- Corriger manuellement les artefacts si necessaire.
- Garder cette etape exceptionnelle et documentee.

### 6. Polygonisation

- Convertir le raster corrige en polygones vectoriels.

### 7. Reparation des geometries

- Corriger les geometries invalides.
- Supprimer les erreurs topologiques evidentes.

### 8. Suppression des mers, lacs et fleuves

- Retirer les polygones qui ne correspondent pas a des cases jouables.

### 9. Elimination des micro-polygones

- Nettoyer les residus de vectorisation trop petits pour etre utiles.

### 10. Separation des frontieres raster en backup

- Conserver une version raster des frontieres en sauvegarde.
- Utile pour reprise ou comparaison ulterieure.

### 11. Export final en GeoPackage et GeoJSON

- GeoPackage pour la source de travail.
- GeoJSON pour l'integration web.

## Sorties attendues

- Un fichier source `GeoPackage`.
- Un ou plusieurs exports `GeoJSON`.
- Une convention de nommage stable pour relier les attributs.

## Points d'attention

- Stabiliser `id_case` le plus tot possible.
- Eviter les retouches manuelles non tracees.
- Conserver des backups intermediaires quand une etape est destructive.
