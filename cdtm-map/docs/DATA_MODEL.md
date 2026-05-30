# Data Model

## Cases

La geometrie canonique reste dans `public/data/cases.geojson`.

Les champs publics de base sont :
- `id_case`
- `region`
- `sous_region`
- `cote`
- `lac_majeur`
- `cours_eau_majeur`

Les champs metier persistés par case sont separes en tables dediees :
- `case_public_current`
- `case_terrain_current`
- `case_control_current`
- `case_emplacements_current`

`case_emplacements_current` reste une table metier de case. Elle ne sert pas a modeliser les objets cartographiques libres de l'editeur.

Le champ fonctionnel attendu pour cette table est `peuple`.
`peuple_majoritaire` est un heritage migre puis supprime.

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

`reference_landmark_types` porte un champ `category` reserve aux landmarks :
- `landmark` pour les points remarquables generiques
- `unique` pour les lieux nommes ou exceptionnels

Les lieux uniques restent stockes dans `map_landmarks`.
Ils utilisent le type technique `type_key = 'lieu_unique'`.

Le statut des objets cartographiques est limite a :
- `draft`
- `published`
- `archived`

L'API d'edition cible ces tables separees directement. `map_points` et `reference_map_point_types` ne font plus partie du modele actif et ne subsistent que comme heritage de migration.

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
