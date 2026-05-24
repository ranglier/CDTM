# Administration

## Roles

- `staff` : edition des cases
- `tech_admin` : edition des cases, referentiels globaux, tables dynamiques et comptes

## Page d'administration technique

Le panneau lateral est un outil de navigation. Il est organise par categories repliables :
- Terrains
- Controle
- Peuples
- Objets cartographiques
- Champs personnalises
- Comptes staff

Le bouton `Ajouter une valeur` apparait dans l'en-tete du panneau principal, uniquement pour les `Listes de valeurs`.

## Referentiels actifs

- Categories de terrain
- Types de terrain
- Reliefs
- Types de controle
- Factions
- Controleurs
- Races
- Peuples
- Icones de carte
- Types de localites
- Types de landmarks
- Types de forces

Certaines vues partagent une meme table technique :
- les nomenclatures utilisent `reference_nomenclature_values`
- l'interface les separe en vues metier comme `Terrains` et `Controle`

## Champs retires

Les concepts suivants ne sont plus edites dans l'application :
- notes
- visibilite
- regles d'emplacements

Les commentaires ou annotations de jeu restent hors de la carte.

## Objets cartographiques

Le modele cible est separe :
- `map_localities`
- `map_landmarks`
- `map_forces`

Les types associes sont :
- `reference_locality_types`
- `reference_landmark_types`
- `reference_force_types`

## Peuples

Le modele canonique repose sur :
- `reference_races`
- `reference_peuples`

La vieille nomenclature `peuple` n'est plus une source de verite.
