# Spec carte interactive CDTM

## Objectif

La carte interactive doit permettre de consulter le découpage territorial du RP, case par case, avec une vue publique et une vue réservée au staff.

## Principes retenus

- La géométrie des cases est produite hors application, dans QGIS.
- Les exports web utiliseront des données GeoJSON / JSON pendant les phases d'import, de test et de snapshot.
- `id_case` est la clé stable reliant la géométrie aux données RP.
- La couche `cases` reste légère : les localités, historiques, contrôleurs et données détaillées peuvent être stockés dans des tables séparées.
- La carte publique ne doit jamais charger les données staff.

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
- `relief`
- `cote`
- `lac_majeur`
- `cours_eau_majeur`
- `faction`
- `peuple_majoritaire`
- `bonus_speciaux`
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
plaine   → prairie, plaine_aride, plaine_boisee, toundra
desert   → desert_glace, desert_sable, terre_desolee
marais   → marais
foret    → foret, taiga, foret_luxuriante
montagne → montagne, montagne_riche
inconnu  → inconnu
```

`relief` est optionnel et peut actuellement valoir :

```txt
colline
```

Une colline forestière est donc représentée comme :

```txt
terrain_cat = foret
terrain_type = foret
relief = colline
```

Le champ `terrain_secondaire` est déprécié et ne doit plus être utilisé.

## Eau majeure

Les contacts avec une eau importante sont décrits par trois booléens :

- `cote`
- `lac_majeur`
- `cours_eau_majeur`

La condition `eau_majeure` est dérivée :

```txt
eau_majeure = cote || lac_majeur || cours_eau_majeur
```

Elle sert aux règles d'emplacements des Sindar et des Umbaréens.

## Emplacements

`empl_base` est déterminé par le type de terrain et le relief :

```txt
empl_base = base_by_terrain_type + relief_modifiers
```

Bases actuelles :

```txt
prairie           → 5
plaine_aride      → 5
plaine_boisee     → 4
toundra           → 3
foret             → 3
taiga             → 3
foret_luxuriante  → 2
montagne          → 3
montagne_riche    → 3
marais            → 2
desert_glace      → 2
desert_sable      → 2
terre_desolee     → 2
```

Relief actuel :

```txt
colline → -1
```

`empl_max` applique les bonus de peuple et les bonus spéciaux dans une limite comprise entre 1 et 5 :

```txt
empl_max = clamp(empl_base + bonus peuple + bonus spéciaux, 1, 5)
```

Les bonus multiples d'un même peuple se cumulent si leurs conditions sont toutes remplies.

Les règles détaillées sont stockées dans :

```txt
data/reference/emplacements_rules.json
```

## Bonus spéciaux

Les bonus spéciaux remplacent l'ancien modèle de bonus lié automatiquement à une faction.

Ils sont stockés explicitement dans :

```txt
bonus_speciaux
```

Une case ne doit contenir qu'un bonus spécial applicable à ses conditions.

## Popup au clic

La popup publique doit afficher au minimum :

- case ;
- région ;
- sous-région ;
- terrain ;
- relief si présent ;
- caractère côtier si pertinent ;
- lac majeur si pertinent ;
- cours d'eau majeur si pertinent ;
- faction ;
- peuple majoritaire ;
- emplacements ;
- contrôleur si présent ;
- type de contrôle ;
- note publique.

Par défaut, `bonus_speciaux` n'est pas affiché dans la popup publique, sauf si le staff décide qu'il s'agit d'une information publiable.

La vue staff peut également afficher `note_staff` et les champs de travail internes.

## Filtres futurs

- Filtre par catégorie de terrain.
- Filtre par type de terrain.
- Filtre par relief.
- Filtre par faction.
- Filtre par peuple majoritaire.
- Filtre par type de contrôle.
- Filtre par région ou sous-région.
- Filtre par case côtière.
- Filtre par lac majeur.
- Filtre par cours d'eau majeur.

## Calques futurs

- Fond de carte.
- Cases territoriales.
- Contours des cases.
- Politique / factions.
- Terrain.
- Relief.
- Localités.
- Données staff.
- Frontières raster de référence.

## Notes

- Cette spec reste volontairement initiale.
- Les règles précises d'affichage pourront évoluer avec les besoins du RP.
- Les régions et sous-régions restent à stabiliser.
