# Spécification — Carte interactive CDTM

## Objectif

Créer une carte interactive de la Terre du Milieu pour le RP **Les Chroniques de la Terre du Milieu**.

La carte doit permettre :

- de visualiser les cases territoriales ;
- d’identifier le terrain et la région ;
- d’afficher le contrôle politique ;
- de distinguer les informations publiques des informations staff ;
- de servir de base à une future interface d’édition.

## Périmètre V0.1

La V0.1 doit rester simple :

- fond de carte statique ;
- couche vectorielle des cases ;
- contours de cases affichables ;
- coloration par faction ;
- popup au clic ;
- chargement des données depuis fichiers statiques JSON / GeoJSON.

## Couches prévues

### Fond de carte

Image raster propre fournie par le staff.

### Cases territoriales

Polygones vectoriels issus de QGIS.

Chaque case doit posséder un identifiant stable : `id_case`.

### Frontières raster backup

Couche optionnelle de référence issue de la polygonisation du masque des contours.

Elle ne doit pas être utilisée comme couche principale de gameplay.

### Localités

Futures données séparées liées aux cases via `id_case`.

Exemples : village, bourg, ville, cité, avant-poste, forteresse, domaine.

### Données staff

Notes privées, statuts secrets, informations sensibles et incertitudes.

Ces informations ne doivent pas être exposées dans la vue publique.

## Vue publique

La vue publique doit afficher :

- le fond de carte ;
- les cases ;
- les contours ;
- les couleurs de faction ;
- les informations publiques dans une popup.

## Vue staff

La vue staff pourra afficher :

- notes staff ;
- calques privés ;
- filtres avancés ;
- contrôle partiel / contesté ;
- données d’édition futures.

## Popup de case

Au clic sur une case, afficher au minimum :

- ID de case ;
- région ;
- sous-région ;
- catégorie de terrain ;
- type de terrain ;
- faction ;
- race dominante ;
- emplacements de base ;
- emplacements maximum ;
- contrôleur ;
- type de contrôleur ;
- type de contrôle ;
- note publique.

En vue staff, afficher aussi `note_staff`.

## Filtres futurs

- faction ;
- terrain ;
- race dominante ;
- type de contrôle ;
- contrôleur ;
- cases contestées ;
- cases occupées ;
- régions.

## Règle importante

La couche `cases` doit rester légère. Les détails évolutifs complexes doivent être stockés dans des tables ou fichiers séparés reliés par `id_case`.
