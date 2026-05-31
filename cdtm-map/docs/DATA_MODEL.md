# Data Model

## Cases

La geometrie canonique reste dans `public/data/cases.geojson`.

Les champs publics de base sont :

- `id_case`
- `region`
- `sous_region`
- `cote`
- `lac`
- `fluvial`

Les champs metier persistés par case sont separes en tables dediees :

- `case_public_current`
- `case_terrain_current`
- `case_control_current`
- `case_emplacements_current`

`case_emplacements_current` reste une table metier de case. Elle ne sert pas a modeliser les objets cartographiques libres de l'editeur.
Elle porte uniquement le resultat courant du calcul V1 des emplacements.

Le champ fonctionnel attendu pour le peuple de la case est `case_control_current.peuple`.
`peuple_majoritaire` est un heritage migre puis supprime.

Les attributs geographiques V1 stockes sur les cases sont `cote`, `lac`, `fluvial` et `colline`.
`colline` est un booleen de `case_terrain_current`; le champ `relief` ne porte plus la logique de colline.

Les emplacements V1 sont recalcules depuis :

- le terrain principal et son `emplacements_base` dans `reference_nomenclature_values`;
- le peuple de la case et `reference_peuple_modificateurs`;
- les bonus appliques dans `case_bonus_contextuels`;
- les localites et landmarks qui consomment des emplacements.

## Referentiels

Les referentiels actifs sont :

- `reference_nomenclature_values`
- `reference_factions`
- `reference_controleurs`
- `reference_styles`
- `reference_map_icons`
- `reference_locality_types`
- `reference_landmark_types`
- `reference_force_types`
- `reference_races`
- `reference_peuples`
- `reference_peuple_modificateurs`
- `bonus_contextuel`

Le tri manuel `sort_order` n'est plus utilise. Le tri attendu est alphabetique stable.

## Objets cartographiques

Le modele cible ne repose plus sur une table generique `map_points`.

Les tables cibles sont :

- `map_localities`
- `map_landmarks`
- `map_forces`
- `map_routes`

Les types associes sont eux aussi separes :

- `reference_locality_types`
- `reference_landmark_types`
- `reference_force_types`

`reference_locality_types` ne porte pas de categorie fonctionnelle.
Il porte les champs V1 de consommation d'emplacements :

- `consumes_slot`
- `emp_requis`
- `upgrades_from_type_id`

`upgrades_from_type_id` decrit la chaine metier entre types de localites, par exemple `village` ameliore `hameau`.
Il remplace `depends_on_locality_id` pour definir les chaines d'amelioration.
`depends_on_locality_id`, lorsqu'il existe encore sur une instance `map_localities`, reste un lien entre instances.
Le calcul V1 ne l'utilise que comme indice de remplacement actif lorsqu'une localite publiee reference explicitement la localite qu'elle ameliore.

`reference_landmark_types` porte un champ `category` reserve aux landmarks :

- `landmark` pour les points remarquables generiques
- `unique` pour les lieux nommes ou exceptionnels
  Les landmarks peuvent aussi porter `consumes_slot` et `emp_requis` au cas par cas.

Les lieux uniques restent stockes dans `map_landmarks`.
Ils utilisent le type technique `type_key = 'lieu_unique'`.

`map_routes` stocke les routes comme des points de controle dans `points_json`.
L'API d'edition expose ce champ sous la forme `points: Array<[number, number]>`.

Les champs de rendu actifs pour les routes sont :

- `geometry_mode`: `straight` | `curved`
- `stroke_style`: `solid` | `dashed` | `dotted`
- `stroke_width`
- `stroke_color`

La courbure n'est jamais stockee en base : elle est calculee cote client a l'affichage.

Le statut des objets cartographiques est limite a :

- `draft`
- `published`
- `archived`

L'API d'edition cible ces tables separees directement. `map_points` et `reference_map_point_types` ne font plus partie du modele actif et ne subsistent que comme heritage de migration.

La carte publique ne lit jamais ces tables via les routes admin. Elle consomme :

- `/api/cases/public-index` pour les cases et leurs styles publics ;
- `/api/map/objects` pour les objets cartographiques publies uniquement.

Les objets visibles sur la carte publique sont limites aux statuts `published` :

- localites publiees ;
- landmarks et lieux uniques publies ;
- routes publiees.

Dans l'editeur cartographique, la creation de point distingue :

- `Localite`, stockee dans `map_localities`
- `Landmark`, stocke dans `map_landmarks`
- `Lieu unique`, egalement stocke dans `map_landmarks`

Les localites utilisent par defaut l'icone definie sur leur type, mais peuvent aussi definir une icone specifique via `icon_key`.
Les landmarks utilisent par defaut l'icone definie sur leur type.
Les lieux uniques peuvent choisir manuellement une icone de `reference_map_icons`.

## Supprime

Les concepts suivants ne font plus partie du modele actif :

- `case_notes_current`
- `note_publique`
- `note_staff`
- `visibilite`
- `reference_emplacements_rules`
- `sort_order` comme ordre manuel
- `map_points` comme modele cible
