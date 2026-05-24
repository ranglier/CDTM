# Data model

## Principes

- Les geometries cartographiques et les donnees RP doivent rester separees.
- `id_case` est la cle stable permettant de relier les tables, les exports et les donnees metier.
- La couche stable des cases contient uniquement des informations geographiques stables dans le temps.
- Les informations dependantes des regles ou de l'etat du RP sont stockees dans des tables metier separees.
- Toutes les donnees de case exposees par l'application sont publiques en lecture.
- Les modifications de donnees de case sont reservees au staff authentifie.
- Les valeurs techniques sont ecrites en minuscules, sans accents et sans espaces.
- Les champs de notes ne font plus partie du contrat applicatif courant.

## Lecture publique et ecriture staff

Le modele cible est :

- lecture publique : carte, identifiants publics, region, sous-region, eau majeure, terrain, controle ;
- ecriture staff : toute modification de ces donnees passe par les routes admin authentifiees ;
- pas de champ note dans les endpoints publics ni dans l'interface de case.

Les anciennes colonnes ou tables de notes peuvent rester presentes en base pendant la transition, mais elles ne doivent plus etre utilisees par l'interface courante. Leur suppression definitive devra passer par une migration explicite apres sauvegarde.

## Couche stable `cases.geojson`

La couche stable de cases decrit :

- l'identifiant stable de chaque case ;
- son rattachement geographique general ;
- ses liens stables a l'eau ;
- sa geometrie.

Elle ne contient pas les regles de terrain, les emplacements, le controle politique, les peuples ou les notes. Ces informations sont gerees par des tables metier separees.

### Champs stables prevus

- `id_case`
- `region`
- `sous_region`
- `cote`
- `lac_majeur`
- `cours_eau_majeur`
- geometrie de la case

Ne pas ajouter dans `cases.geojson` :

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

Ces champs ne sont pas supprimes du projet quand ils sont encore utiles. Ils sont simplement sortis de la couche stable et places dans des tables metier dediees.

## Donnees publiques de case

L'endpoint public principal est `GET /api/cases/public-index`.

Il expose l'index public des cases, compose depuis :

- la couche stable `cases.geojson` ;
- les surcharges publiques de `case_public_current` ;
- les donnees de terrain de `case_terrain_current` ;
- les donnees de controle de `case_control_current`.

Il expose aussi les styles publics de carte utilises pour l'affichage, sans melanger ces informations avec les tables metier de case.

Les routes publiques ne doivent pas exposer de notes.

## Styles cartographiques

Les styles de carte sont separes des donnees metier.

Ils sont stockes dans `reference_styles`, avec une cible fonctionnelle :

- `faction`
- `controleur`
- `terrain_cat`
- `terrain_type`
- `relief`

Chaque style peut definir :

- `fill`
- `stroke`
- `opacity`

Les couleurs sont administrees dans l'admin technique, mais restent lisibles publiquement pour permettre le rendu de la carte.

Priorites d'affichage :

- mode politique : `controleur` > `faction` > style neutre ;
- mode topographique : `terrain_type` > `terrain_cat` > `relief` eventuel > style neutre.

## Donnees staff

Les routes admin servent a modifier les donnees publiques de case et les donnees metier associees. Elles restent reservees a une session staff.

Les routes admin gerent notamment :

- les surcharges publiques de case ;
- le terrain ;
- le controle ;
- les tables dynamiques ;
- les referentiels techniques.

## Tables metier actuelles

### `case_public_current`

Stocke les surcharges publiques par case :

- `public_id_case`
- `region`
- `sous_region`
- `cote`
- `lac_majeur`
- `cours_eau_majeur`

### `case_terrain_current`

Stocke le terrain courant :

- `terrain_cat`
- `terrain_type`
- `relief`

### `case_control_current`

Stocke le controle courant :

- `faction`
- `controleur`
- `controle_type`

### `case_emplacements_current`

Prepare les futurs calculs ou validations d'emplacements :

- `peuple_majoritaire`
- `bonus_speciaux`
- `empl_base`
- `empl_max`
- `regle_version`
- `calcule_le`
- `valide_par`

## Notes

Les champs de notes sont retires du contrat applicatif courant.

Decision actuelle :

- ne plus afficher de notes dans le panneau de case ;
- ne plus maintenir d'endpoint public de note ;
- ne pas supprimer brutalement les colonnes existantes sans migration ;
- prevoir une migration ulterieure pour retirer ou archiver proprement les anciennes donnees de notes.

## TODO

- Valider la nomenclature exacte des regions et sous-regions.
- Definir si les booleens d'eau sont calcules automatiquement depuis QGIS ou saisis manuellement.
- Ajouter des migrations schema avant toute suppression de table ou colonne.
- Ajouter des tests sur le contrat public `GET /api/cases/public-index`.
- Brancher les styles cartographiques sur les donnees publiques terrain/controle.
