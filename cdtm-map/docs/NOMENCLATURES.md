# Nomenclatures

Valeurs contrôlées initiales pour les attributs métier de la carte CDTM.

Ces listes restent provisoires et devront être validées avec le staff avant production.

## Règles générales

- Les valeurs techniques sont en minuscules.
- Les valeurs techniques n'utilisent ni accents, ni espaces.
- Les noms affichés peuvent conserver les accents dans les tables de référence.
- Ne pas multiplier les synonymes : une notion = une valeur technique.

## `terrain_cat`

Catégorie mécanique principale du terrain.

- `plaine`
- `desert`
- `marais`
- `foret`
- `montagne`
- `inconnu`

## `terrain_type`

Type de terrain dominant dans une case.

### `plaine`

- `prairie`
- `plaine_aride`
- `plaine_boisee`
- `toundra`

### `desert`

- `desert_glace`
- `desert_sable`
- `terre_desolee`

### `marais`

- `marais`

### `foret`

- `foret`
- `taiga`
- `foret_luxuriante`

### `montagne`

- `montagne`
- `montagne_riche`

### `inconnu`

- `inconnu`

## `relief`

Modificateur local de relief.

Ce champ est optionnel.

Valeur actuelle :

- `colline`

Une colline forestière doit donc être représentée ainsi :

```txt
terrain_cat = foret
terrain_type = foret
relief = colline
```

Le champ déprécié `terrain_secondaire` ne doit plus être utilisé.

## Eau majeure

Trois booléens décrivent les contacts avec une eau importante :

- `cote` : côte maritime ;
- `lac_majeur` : lac important ;
- `cours_eau_majeur` : fleuve ou rivière majeure.

La condition métier `eau_majeure` est dérivée :

```txt
eau_majeure = cote || lac_majeur || cours_eau_majeur
```

Elle sert notamment aux Sindar et aux Umbaréens.

## `controle_type`

Statut du contrôle territorial.

- `aucun`
- `total`
- `partiel`
- `conteste`
- `occupe`
- `vassalise`
- `inconnu`

## `peuple_majoritaire`

Valeurs techniques fondées sur la liste des peuples jouables ou référencés par les règles d'emplacements.

### Hommes de l'Ouest

- `gondoriens`

### Hommes du Nord

- `eotheods`
- `daliens`
- `esgarothiens`
- `hommes_de_vertbois`

### Hommes du Milieu

- `dunlandais`
- `enedwaithrim`
- `druedain`
- `hommes_sauvages`

### Hommes de l'Est

- `orientaux`

### Hommes du Sud

- `corsaires`
- `umbareens`
- `haradrim`
- `variags`

### Héritiers de Númenor

- `dunedain_du_nord`
- `numenoreens_noirs`

### Elfes

- `noldor`
- `sindar`
- `nandor`
- `avari`

### Orcs

- `snagas`
- `uruk_hai`
- `gobelins`

### Nains

- `longues_barbes`
- `barbes_de_feu`
- `ventrus`
- `poignes_de_fer`
- `barbes_raides`
- `pieds_de_pierre`
- `cheveux_noirs`

### Autres peuples

- `hobbits`
- `lossoth`

### Valeurs transversales

- `mixte`
- `inconnu`

## `bonus_special`

Bonus appliqué explicitement à une case, indépendamment d'une faction active.

Valeurs initiales :

- `ancien_bonus_empire_desert_glace`
- `ancien_bonus_empire_montagne`

Ces valeurs remplacent l'ancien modèle `bonus_by_faction`.

## `localite_niveau`

Niveau de développement urbain d'une localité.

- `hameau`
- `village`
- `bourg`
- `ville`
- `cite`

## `localite_type`

Type fonctionnel ou narratif d'une localité ou structure.

- `avant_poste`
- `fort`
- `domaine`
- `ruine`

## `visibilite`

Visibilité d'une donnée dans l'application.

- `publique`
- `staff`
- `secrete`
- `incertaine`

## `statut_note`

Statut de travail d'une note.

- `brouillon`
- `a_valider`
- `valide`
- `archive`

## `faction`

Les factions devront être centralisées dans un futur fichier `factions.json`.

Valeurs initiales envisagées :

- `royaume_des_hommes`
- `gondor`
- `eotheods`
- `mordor`
- `empire`
- `harad`
- `umbar`
- `rhun`
- `lindon`
- `arnor`
- `nouvelle_numenor`
- `neutre`
- `inconnu`

## Rappel

Ces nomenclatures servent de base de travail. Les valeurs définitives devront être revues avant production, notamment avec les besoins du staff et la carte finale.
