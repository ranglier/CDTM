# Data model

## Principes

- Les géométries cartographiques et les données RP doivent rester séparées.
- `id_case` est la clé stable permettant de relier les tables, les exports et les futures données métier.
- La table de base des cases doit contenir uniquement des informations géographiques stables dans le temps.
- Les informations dépendantes des règles ou de l'état du RP doivent être stockées dans des tables métier séparées.
- Les valeurs techniques sont écrites en minuscules, sans accents et sans espaces.
- Les champs de notes doivent distinguer clairement ce qui est public de ce qui est réservé au staff.

## Table `cases`

La table `cases` décrit la couche géographique stable des cases territoriales.

Elle contient :

- l'identifiant stable de chaque case ;
- son rattachement géographique général ;
- ses liens stables à l'eau ;
- sa géométrie.

Elle ne contient pas les règles de terrain, les emplacements, le contrôle politique, les peuples, les notes RP ou les données staff. Ces informations seront gérées par des tables métier séparées.

### Champs prévus

- `id_case`
- `region`
- `sous_region`
- `cote`
- `lac_majeur`
- `cours_eau_majeur`
- géométrie de la case

Ne pas ajouter dans `cases` :

- `terrain_cat`
- `terrain_type`
- `relief`
- `terrain_secondaire`
- `faction`
- `peuple_majoritaire`
- `bonus_speciaux`
- `empl_base`
- `empl_max`
- `controleur`
- `controle_type`
- `note_publique`
- `note_staff`

Ces champs ne sont pas supprimés du projet. Ils sont simplement sortis de la couche stable et seront replacés dans des tables métier dédiées.

### Champs obligatoires

Une case doit toujours avoir :

- `id_case`

Les autres champs peuvent rester vides si l'information n'est pas encore connue ou non applicable.

### `id_case`

Identifiant unique et stable de la case.

Exemple :

```txt
case_0001
```

Cet identifiant sert de clé de liaison avec les autres tables, notamment les futures tables métier de terrain, contrôle, emplacements, localités, notes et historique.

### `region`

Grande région géographique dans laquelle se trouve la case.

Exemples :

```txt
calenardhon
anorien
ithilien
rhovanion
```

Ce champ doit rester géographique. Il ne doit pas servir à stocker une possession politique ou un état de contrôle.

Bon exemple :

```txt
region = anorien
```

Mauvais exemple :

```txt
region = territoire_de_deorl
```

La nomenclature exacte des régions reste à stabiliser.

### `sous_region`

Subdivision géographique plus précise de `region`.

Exemples :

```txt
eastfold
wold
cair_andros
terres_brunes
```

Ce champ peut rester vide si aucune sous-région pertinente n'est définie.

### `cote`, `lac_majeur`, `cours_eau_majeur`

Booléens indiquant si la case touche une eau importante :

- `cote` : côte maritime ;
- `lac_majeur` : lac important ;
- `cours_eau_majeur` : fleuve ou rivière majeure.

Valeurs attendues :

```txt
true
false
null
```

La condition métier `eau_majeure` n'est pas stockée dans `cases`. Elle peut être dérivée plus tard par les tables métier :

```txt
eau_majeure = cote || lac_majeur || cours_eau_majeur
```

### Géométrie

La géométrie décrit le contour exact de la case sur la carte.

Dans un GeoJSON, elle se trouve dans `feature.geometry`.

Dans PostGIS, elle sera portée par une colonne géométrique.

La géométrie n'est pas un champ métier à saisir manuellement. Elle est produite par QGIS et sert à afficher la case sur la carte.

## Futures tables métier

Les champs retirés de `cases` doivent être déplacés vers des tables métier spécialisées.

### Future table `case_terrain`

Usage :

- stocker les informations de terrain ;
- permettre l'évolution des règles sans modifier la couche géographique stable.

Champs possibles :

- `id_case`
- `terrain_cat`
- `terrain_type`
- `relief`
- `regle_version`
- `statut_validation`
- `note`

### Future table `case_emplacements`

Usage :

- stocker les calculs ou validations d'emplacements ;
- conserver la version des règles utilisée ;
- permettre de recalculer les valeurs si les règles changent.

Champs possibles :

- `id_case`
- `peuple_majoritaire`
- `bonus_speciaux`
- `empl_base`
- `empl_max`
- `regle_version`
- `calcule_le`
- `valide_par`

### Future table `case_controle`

Usage :

- stocker le contrôle politique ou militaire d'une case ;
- historiser les changements de contrôle.

Champs possibles :

- `id_case`
- `faction`
- `controleur`
- `controle_type`
- `date_debut`
- `date_fin`
- `source`
- `note`

### Future table `case_notes`

Usage :

- stocker les notes publiques, staff, secrètes ou temporaires ;
- éviter d'exposer accidentellement une note staff dans la couche publique.

Champs possibles :

- `id_case`
- `visibilite`
- `statut_note`
- `contenu`
- `auteur`
- `date_creation`
- `date_mise_a_jour`

### Future table `localites`

Usage :

- référencer des villes, forts, ports, domaines, ruines ou autres points d'intérêt ;
- relier chaque localité à une case via `id_case` ;
- permettre plusieurs localités ou structures dans une même case sans alourdir la table `cases`.

Champs possibles :

- `id_localite`
- `id_case`
- `nom`
- `niveau`
- `type`
- `empl`
- `visibilite`
- `note_publique`
- `note_staff`

### Future table `historique_controle`

Usage :

- tracer les changements de contrôle dans le temps ;
- conserver une lecture historique du RP.

Champs possibles :

- `id_evenement`
- `id_case`
- `date_label`
- `ancien_controleur`
- `nouveau_controleur`
- `note`

## TODO

- Valider la nomenclature exacte des régions et sous-régions.
- Définir si les booléens d'eau sont calculés automatiquement depuis QGIS ou saisis manuellement.
- Définir la première table métier à implémenter après stabilisation de la carte QGIS.
