# Nomenclatures

Valeurs contrôlées initiales pour les attributs du projet cartographique CDTM.

Les nomenclatures sont séparées en deux familles :

- les valeurs liées à la couche géographique stable `cases` ;
- les valeurs métier futures, conservées comme base de travail mais non stockées directement dans `cases`.

## Règles générales

- Les valeurs techniques sont en minuscules.
- Les valeurs techniques n'utilisent ni accents, ni espaces.
- Les noms affichés peuvent conserver les accents dans les tables de référence.
- Ne pas multiplier les synonymes : une notion = une valeur technique.
- Une donnée susceptible d'évoluer avec les règles RP ne doit pas être placée dans la table stable `cases`.

## Couche stable `cases`

### Champs stables

La couche `cases` doit rester limitée aux champs suivants :

- `id_case`
- `region`
- `sous_region`
- `cote`
- `lac_majeur`
- `cours_eau_majeur`
- géométrie

### Booléens d'eau

Les champs suivants acceptent uniquement `true`, `false` ou `null` :

- `cote`
- `lac_majeur`
- `cours_eau_majeur`

La condition métier `eau_majeure` n'est pas stockée. Elle peut être dérivée par les règles métier :

```txt
eau_majeure = cote || lac_majeur || cours_eau_majeur
```

## Champs métier réservés

Les champs suivants sont réservés aux futures tables métier et ne doivent plus être stockés directement dans `cases` :

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

## Nomenclatures métier provisoires

Les listes ci-dessous sont conservées comme base de travail pour de futures tables métier. Elles ne constituent pas le schéma de la couche stable `cases`.

### `terrain_cat`

- `plaine`
- `desert`
- `marais`
- `foret`
- `montagne`
- `inconnu`

### `terrain_type`

#### `plaine`

- `prairie`
- `plaine_aride`
- `plaine_boisee`
- `toundra`

#### `desert`

- `desert_glace`
- `desert_sable`
- `terre_desolee`

#### `marais`

- `marais`

#### `foret`

- `foret`
- `taiga`
- `foret_luxuriante`

#### `montagne`

- `montagne`
- `montagne_riche`

#### `inconnu`

- `inconnu`

### `relief`

- `colline`

### `controle_type`

- `aucun`
- `total`
- `partiel`
- `conteste`
- `occupe`
- `vassalise`
- `inconnu`

### `peuple_majoritaire`

#### Hommes de l'Ouest

- `gondoriens`

#### Hommes du Nord

- `eotheods`
- `daliens`
- `esgarothiens`
- `hommes_de_vertbois`

#### Hommes du Milieu

- `dunlandais`
- `enedwaithrim`
- `druedain`
- `hommes_sauvages`

#### Hommes de l'Est

- `orientaux`

#### Hommes du Sud

- `corsaires`
- `umbareens`
- `haradrim`
- `variags`

#### Héritiers de Númenor

- `dunedain_du_nord`
- `numenoreens_noirs`

#### Elfes

- `noldor`
- `sindar`
- `nandor`
- `avari`

#### Orcs

- `snagas`
- `uruk_hai`
- `gobelins`

#### Nains

- `longues_barbes`
- `barbes_de_feu`
- `ventrus`
- `poignes_de_fer`
- `barbes_raides`
- `pieds_de_pierre`
- `cheveux_noirs`

#### Autres peuples

- `hobbits`
- `lossoth`

#### Valeurs transversales

- `mixte`
- `inconnu`

### `bonus_special`

- `ancien_bonus_empire_desert_glace`
- `ancien_bonus_empire_montagne`

### `localite_niveau`

- `hameau`
- `village`
- `bourg`
- `ville`
- `cite`

### `localite_type`

- `avant_poste`
- `fort`
- `domaine`
- `ruine`

### `visibilite`

- `publique`
- `staff`
- `secrete`
- `incertaine`

### `statut_note`

- `brouillon`
- `a_valider`
- `valide`
- `archive`

### `faction`

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
