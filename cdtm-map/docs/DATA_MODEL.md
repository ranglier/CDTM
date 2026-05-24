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
- Les listes de valeurs et referentiels ne portent pas d'ordre d'affichage manuel. L'interface trie les valeurs alphabetiquement par libelle, puis par cle technique si necessaire.

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
- `peuple`
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
- `terrain_type`
- `relief`

Chaque style peut definir :

- `fill`
- `stroke`
- `pattern_type`
- `pattern_color`

Les couleurs sont administrees dans l'admin technique, mais restent lisibles publiquement pour permettre le rendu de la carte.

`terrain_cat` n'est pas une cible de style. Il sert a classifier et decrire les terrains, pas a piloter leur couleur.

Priorites d'affichage :

- mode politique : `controleur` > `faction` > style neutre ;
- mode topographique : fond via `terrain_type`, motif eventuel via `relief`, puis style neutre.

L'opacite ne fait plus partie du modele. Une couleur renseignee est rendue pleinement. Une couleur absente signifie absence de fond ou de contour.

## Objets cartographiques libres

Les objets cartographiques libres ne doivent pas etre modelises comme des champs de case.

Ils sont positionnes avec des coordonnees libres dans la projection pixel de la carte, puis relies aux cases par detection ou calcul.

Trois familles sont prevues :

- points de carte : localites, landmarks, forces ;
- routes : objets lineaires composes de plusieurs points ;
- relations de dependance : un lieu peut dependre d'un autre lieu, meme s'il est positionne sur une case voisine.

### Points de carte

Table cible proposee : `map_points`.

Champs cibles :

- `id_point`
- `name`
- `object_family` : `locality`, `landmark`, `force`
- `type_key`
- `icon_key`
- `x`
- `y`
- `id_case_detected`
- `faction`
- `controleur`
- `status` : `draft`, `published`, `archived`
- `depends_on_point_id`
- `description`

La position `x/y` fait foi pour l'affichage. `id_case_detected` sert aux regles, validations et filtres, mais ne doit pas forcer la position au centre de la case.

Le type `dependance` sert aux lieux dependant d'une cite ou localite voisine. La dependance doit etre portee par `depends_on_point_id`.

### Routes

Table cible proposee : `map_routes`.

Champs cibles :

- `id_route`
- `name`
- `route_type`
- `points_json`
- `status` : `draft`, `published`, `archived`
- `faction`
- `controleur`
- `description`

Une route est une polyligne libre. Les cases traversees doivent etre calculees par intersection avec les polygones de cases, puis stockees ou exposees via une table de relation si necessaire.

Table de relation future possible : `map_route_cases`.

Champs possibles :

- `id_route`
- `id_case`
- `path_order`

`path_order` sert a l'ordre geometrique d'une route, pas a l'ordre d'affichage d'une liste de valeurs.

## Catalogue d'icones Game-icons

Le projet utilise uniquement des icones issues de Game-icons pour les objets cartographiques.

Le catalogue runtime doit rester vide par defaut. Aucune icone Game-icons n'est seedee automatiquement.

Les icones doivent etre ajoutees manuellement depuis l'admin technique avec leurs credits et une image uploadee localement dans l'application.

Chaque icone doit conserver ses informations de credit et d'image :

- `icon_key`
- `label`
- `source_url`
- `author`
- `license`
- `category`
- `image_path`
- `image_original_name`
- `image_mime_type`
- `image_size_bytes`
- `image_alt`
- `is_active`

Licence cible : Creative Commons BY 3.0, avec attribution.

Les types de lieux ou de forces pointent vers une icone par defaut seulement si elle est definie plus tard. `default_icon_key` doit accepter `NULL`.

Les images d'icones sont stockees localement dans un volume persistant. La base ne stocke ni BLOB ni base64, seulement le chemin local public et les metadonnees.

## Types de localites et objets ponctuels

Les types d'objets doivent rester separes des icones.

Tables cibles possibles :

### `reference_map_icons`

Catalogue des icones disponibles.

### `reference_map_point_types`

Types de points affichables sur la carte.

Champs cibles :

- `type_key`
- `object_family`
- `label`
- `description`
- `default_icon_key`
- `consumes_slot`
- `slot_weight`
- `is_active`

Familles de points :

- `locality`
- `landmark`
- `force`

Types initiaux recommandes, sans icone par defaut :

- `fort`
- `ruines`
- `ville_fortifiee`
- `ville_non_fortifiee`
- `avant_poste`
- `port`
- `pont`
- `mine`
- `barad_dur`
- `moria`
- `hobbit_bourg`
- `hauts_des_galgals`
- `armee`
- `flotte`
- `dependance`

## Races, peuples et emplacements

Les emplacements sont calcules depuis le sous-type de terrain, pas depuis la categorie seule.

La categorie sert de parent et de valeur de secours si un sous-type de terrain ne definit pas explicitement sa propre valeur.

Renommage valide :

- ne plus utiliser `desert_gele` ;
- utiliser `terres_gelees`.

### Races et peuples

Une table `reference_races` doit etre introduite pour regrouper les peuples.

Champs cibles :

- `race_key`
- `label`
- `description`
- `is_active`

Une table `reference_peuples` doit rattacher les peuples a une race.

Champs cibles :

- `peuple_key`
- `race_key`
- `label`
- `description`
- `is_active`

`peuple` est la notion canonique. Ne pas creer ou maintenir une notion concurrente `peuple_majoritaire` pour les nouveaux developpements.

Races initiales :

- `nains`
- `orques`
- `elfes`
- `hommes`
- `hobbits`

Peuples initiaux connus :

- `nandor`, `noldor`, `sindar`, `avari` -> `elfes`
- `lossoths`, `enedwaithrim`, `druedain`, `haradrim`, `heritiers_numenor`, `umbareens`, `hommes_vertbois` -> `hommes`
- `nains` -> `nains`
- `orques` -> `orques`
- `hobbits` -> `hobbits`

### Valeurs d'emplacements

Formule valide :

```text
empl_max = sous_type_terrain + bonus_race + bonus_contextuel
empl_max = min(5, max(1, empl_max))
```

Regles :

- aucune valeur finale ne peut depasser 5 ;
- aucune valeur finale ne peut descendre sous 1 ;
- aucun depassement d'occupation n'est autorise ;
- si les objets occupant une case excedent `empl_max`, la publication doit etre refusee ;
- si aucun chiffre n'est precise pour un sous-type de terrain, il herite de la valeur de sa categorie parente.

Base issue de la reunion staff :

- Plaines : 5
  - prairies / plaines temperees : herite 5
  - plaines arides : herite 5
  - plaines arborees / boisees : 4
  - toundras : 3
- Forets : 3
  - taigas : herite 3
  - forets luxuriantes / denses : 2
- Montagnes : 2
  - montagnes riches : herite 2
- Marais : 2
- Deserts : 1
  - terres gelees : herite 1
  - sable : herite 1
  - rocheux / terres desolees : herite 1
- Collines : modificateur de relief `-1`, puis cap final entre 1 et 5.

Bonus de peuple/race connus :

- Nains : montagnes +3 ; collines +1
- Orques : montagnes +2 ; deserts rocheux / terres desolees +4
- Nandor : forets +2
- Noldor : montagnes +1 ; collines +1 ; forets +1
- Sindar : cotes / lacs / cours d'eau majeur +1 ; forets +1
- Avari : forets +2
- Lossoths : terres gelees +2
- Enedwaithrim : collines +1 ; forets +1
- Druedain : forets +2
- Haradrim : deserts sableux +2
- Heritiers de Numenor : collines +1 ; cotes / lacs / cours d'eau majeur +1
- Umbareens : cotes / lacs / cours d'eau majeur +1
- Hommes de Vertbois : forets +1
- Hobbits : collines +2 ; marais +1

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

Prepare les futurs calculs ou validations d'emplacements.

Le champ fonctionnel attendu est `peuple`. Les anciennes mentions de `peuple_majoritaire` sont a considerer comme heritage a migrer.

Champs cibles :

- `peuple`
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
- Etendre la page `/editeur` au-dela du squelette courant.
- Implementer le calcul des emplacements a partir de `terrain_type`, des races/peuples et des bonus contextuels.
