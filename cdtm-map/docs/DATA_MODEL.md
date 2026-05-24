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

Le champ fonctionnel attendu pour les emplacements est `peuple`.
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

Le statut des objets cartographiques est limite a :
- `draft`
- `published`
- `archived`

## Supprime

Les concepts suivants ne font plus partie du modele actif :
- `case_notes_current`
- `note_publique`
- `note_staff`
- `visibilite`
- `reference_emplacements_rules`
- `sort_order` comme ordre manuel
- `map_points` comme modele cible
