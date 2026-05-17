# Nomenclatures

Valeurs contrôlées initiales pour les attributs métier.

Ces listes sont provisoires et devront être validées avec le staff avant production.

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
- `bocage`

### `desert`

- `desert_chaud`
- `desert_gele`
- `terre_desolee`

### `marais`

- `marais`

### `foret`

- `foret`
- `foret_luxuriante`
- `taiga`

### `montagne`

- `colline`
- `montagne`
- `montagne_riche`
- `paturage`

## `terrain_secondaire`

Type secondaire ou modificateur local.

Ce champ peut rester vide.

Si `terrain_type = colline`, `terrain_secondaire` peut contenir un type de plaine, de forêt ou de désert.

- `prairie`
- `plaine_aride`
- `bocage`
- `desert_chaud`
- `desert_gele`
- `terre_desolee`
- `foret`
- `foret_luxuriante`
- `taiga`
- `inconnu`

## `cote`

Booléen indiquant si la case est côtière.

- `true`
- `false`

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

Valeurs techniques fondées sur la liste des peuples jouables ou référencés par les règles de création de personnage et les règles d'emplacements.

### Hommes de l'Ouest

- `gondoriens`

### Hommes du Nord

- `eotheods`
- `daliens`
- `esgarothiens`

### Hommes du Milieu

- `dunlandais`
- `hommes_sauvages`

### Hommes de l'Est

- `orientaux`

### Hommes du Sud

- `corsaires`
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
