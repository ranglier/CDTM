# Workflow QGIS — Vectorisation des cases

Ce document décrit le workflow de production d’une couche vectorielle de cases à partir des cartes fournies par le staff.

## Fichiers sources attendus

- carte de fond vierge ;
- carte avec cases visibles ;
- idéalement carte avec contours seuls.

## Étapes générales

### 1. Préparer les fichiers

Créer un projet QGIS dédié et conserver les images sources dans un dossier `sources/`.

### 2. Créer un masque de contours

Dans QGIS, utiliser la calculatrice raster pour comparer la carte avec cases et la carte vierge.

Objectif : obtenir un raster noir/blanc où les frontières de cases sont isolées.

### 3. Filtrer les contours

Privilégier les pixels devenus plus sombres et proches du gris/noir pour éviter de détecter les variations du fond.

### 4. Corriger le masque

Ouvrir le masque dans GIMP ou Krita si nécessaire.

Corriger manuellement :

- les taches parasites ;
- les interruptions de frontières ;
- les segments effacés.

### 5. Polygoniser

Dans QGIS :

```txt
Traitement → Boîte à outils → Polygoniser raster vers vecteur
```

Créer une couche brute.

### 6. Réparer les géométries

Utiliser :

```txt
Réparer les géométries
```

### 7. Nettoyer les entités parasites

Supprimer ou isoler :

- mers ;
- lacs ;
- fleuves ;
- rivières ;
- fond extérieur ;
- anciens traits raster.

### 8. Sauvegarder les frontières raster en backup

Les entités issues des anciens traits raster peuvent être exportées séparément dans un GeoPackage de référence.

Elles ne doivent pas rester dans la couche principale `cases`.

### 9. Éliminer les micro-polygones

Sélectionner les artefacts par surface :

```qgis
area($geometry) < 20
```

Puis utiliser :

```txt
Éliminer les polygones sélectionnés
```

Méthode recommandée : plus grande frontière commune.

### 10. Convertir en parties uniques

Utiliser :

```txt
De morceaux multiples à morceaux uniques
```

### 11. Export final

Exporter la couche principale sous :

```txt
cases_cdtm_base_vX_Y.gpkg
```

Couche interne :

```txt
cases
```

### 12. Ajouter les champs métier

Ajouter les champs définis dans `docs/DATA_MODEL.md`.

## Règle de sécurité

Toujours conserver :

- les sources ;
- le masque corrigé ;
- la polygonisation brute ;
- la couche nettoyée ;
- le backup des frontières raster.

Ne jamais écraser la dernière couche propre sans versionner.
