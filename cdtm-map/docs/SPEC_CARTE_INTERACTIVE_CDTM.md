# Specification Carte Interactive CDTM

## Socle actuel

- carte publique en lecture
- edition staff des cases
- administration technique des referentiels
- preparation de l'editeur cartographique

## Modele de case

Les champs publics stables restent dans `cases.geojson`.

Les blocs metier persistants sont :
- public
- terrain
- controle
- emplacements

Il n'y a pas de bloc `notes`.

## Referentiels

Les referentiels actifs sont :
- terrains
- controle
- races
- peuples
- icones de carte
- types de localites
- types de landmarks
- types de forces

`visibilite` et `regles d'emplacements` ne font plus partie du modele cible.

## Objets cartographiques

Le modele cible est separe :
- `map_localities`
- `map_landmarks`
- `map_forces`
- `map_routes`

Le modele generique `map_points` est un heritage de migration, pas la cible produit.
