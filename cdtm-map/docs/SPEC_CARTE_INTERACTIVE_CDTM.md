# Spec carte interactive CDTM

## Objectif

La carte interactive doit permettre de consulter le découpage territorial du RP, case par case, avec une vue publique et une vue réservée au staff.

## Principes retenus

- La géométrie des cases est produite hors application, dans QGIS.
- Les exports web utiliseront des données GeoJSON / JSON.
- `id_case` est la clé stable reliant la géométrie aux données RP.
- La couche `cases` reste légère : les localités, historiques, contrôleurs et données détaillées peuvent être stockés dans des tables séparées.

## Vues prévues

### Vue publique

- Consultation simple des cases et des calques visibles.
- Affichage uniquement des champs publics.

### Vue staff

- Consultation des champs publics et internes.
- Calques internes et outils de travail à définir plus tard.
- Possibilité future d'édition ou de validation des données.

## Affichage des cases

- Chaque case est représentée par une géométrie polygonale.
- Les cases doivent pouvoir être stylisées selon des attributs métier.
- L'identifiant stable d'une case est `id_case`.
- Les contours noirs des cases doivent pouvoir être affichés afin de conserver la lisibilité de la grille.
- Les anciennes frontières raster peuvent exister comme calque de référence, mais ne doivent pas être utilisées comme couche principale de gameplay.

## Champs principaux des cases

La V0.1 s'appuie sur les champs suivants :

- `id_case`
- `region`
- `sous_region`
- `terrain_cat`
- `terrain_type`
- `terrain_secondaire`
- `cote`
- `faction`
- `peuple_majoritaire`
- `empl_base`
- `empl_max`
- `controleur`
- `controle_type`
- `note_publique`
- `note_staff`

Les champs obligatoires sont :

- `id_case`
- `terrain_cat`
- `terrain_type`

## Règles de terrain

Une case doit toujours avoir une catégorie et un type de terrain.

Chaque catégorie autorise certains types :

```txt
plaine   → prairie, plaine_aride, bocage
desert   → desert_chaud, desert_gele, terre_desolee
marais   → marais
foret    → foret, foret_luxuriante, taiga
montagne → colline, montagne, montagne_riche, paturage
```

`terrain_secondaire` est optionnel et sert principalement aux cases dont `terrain_type = colline`.

Pour les cases côtières, utiliser :

```txt
cote = true
```

Ne pas utiliser `terrain_secondaire = cote`.

## Emplacements

Les emplacements de base sont déterminés par `terrain_cat` :

```txt
plaine   → 5
desert   → 3
montagne → 3
foret    → 3
marais   → 2
```

`empl_max` applique les bonus et malus pertinents dans une limite comprise entre 1 et 5.

Les règles détaillées sont stockées dans :

```txt
data/reference/emplacements_rules.json
```

L'hypothèse actuelle est que les bonus/malus se cumulent avant plafonnement. Cette hypothèse reste à confirmer par le staff.

## Popup au clic

La popup publique doit afficher au minimum :

- case ;
- région ;
- sous-région ;
- terrain ;
- terrain secondaire si présent ;
- caractère côtier si pertinent ;
- faction ;
- peuple majoritaire ;
- emplacements ;
- contrôleur si présent ;
- type de contrôle ;
- note publique.

La vue staff peut également afficher `note_staff`.

## Filtres futurs

- Filtre par catégorie de terrain.
- Filtre par type de terrain.
- Filtre par faction.
- Filtre par peuple majoritaire.
- Filtre par type de contrôle.
- Filtre par région ou sous-région.
- Filtre par case côtière.

## Calques futurs

- Fond de carte.
- Cases territoriales.
- Contours des cases.
- Politique / factions.
- Terrain.
- Localités.
- Données staff.
- Frontières raster de référence.

## Notes

- Cette spec reste volontairement initiale.
- Les règles précises d'affichage pourront évoluer avec les besoins du RP.
- Les régions et sous-régions restent à stabiliser.
