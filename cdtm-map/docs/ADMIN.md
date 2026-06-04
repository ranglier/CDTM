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

L'architecture interne de cette page est detaillee dans `docs/ADMIN_ARCHITECTURE.md`.

## Referentiels actifs

- Categories de terrain
- Types de terrain
- Reliefs
- Types de controle
- Factions
- Controleurs
- Races
- Peuples
- Modificateurs de peuples
- Bonus contextuels
- Icones de carte
- Types de localites
- Types de landmarks
- Types de forces

Certaines vues partagent une meme table technique :

- les nomenclatures utilisent `reference_nomenclature_values`
- l'interface les separe en vues metier comme `Terrains` et `Controle`

## Bonus contextuels de case

Les bonus disponibles sont definis dans le referentiel `bonus_contextuel`.
L'API admin de case expose les bonus appliques dans `bonus_contextuels` et les options disponibles dans `reference_data.bonus_contextuel_options`.

Pour remplacer les bonus d'une case, envoyer `bonus_contextuels` comme tableau de slugs dans `PUT /api/admin/cases/[id_case]`.
Pour une edition de masse, envoyer le meme tableau dans `PATCH /api/admin/cases/bulk` sous `patch.bonus_contextuels`.
Un tableau vide supprime tous les bonus contextuels de la case ou de la selection.

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
- `map_routes`

Les types associes sont :

- `reference_locality_types`
- `reference_landmark_types`
- `reference_force_types`

Les routes API d'edition cartographique sont reservees a `tech_admin`.

### Fond de carte

L'admin technique expose une entree `Fond de carte` dans la section `Objets cartographiques`.

Un `tech_admin` peut importer un fond PNG ou WebP si le fichier respecte toutes les contraintes :

- dimensions exactes `3200 x 4000` ;
- taille maximale 25 Mo ;
- extension et type MIME coherents ;
- signature PNG/WebP valide ;
- image non animee.

Apres validation, le serveur genere les tuiles WebP dans le volume persistant
`/app/uploads/map-backgrounds/{id}/tiles`. Le nouveau fond n'est active qu'apres
generation complete. Les anciens fonds restent listes dans l'historique et
peuvent etre reactives si leur statut est `ready`.

Un fond inactif peut etre supprime depuis l'historique. Le fond actif ne peut
pas etre supprime : il faut d'abord reactiver un autre fond pret.

## Uploads d'icones

Les formats acceptes sont :

- `PNG`
- `WebP`
- `SVG`

Le SVG reste autorise car il est central pour beaucoup d'icones, mais il est valide defensivement cote serveur avant sauvegarde. Les uploads d'icones restent reserves aux utilisateurs autorises.

Les SVG sont servis via une route applicative avec des headers defensifs :

- `Content-Type: image/svg+xml; charset=utf-8`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Content-Security-Policy` restrictive

La CSP actuellement servie reste compatible avec l'affichage des SVG importes dans l'admin. Si un SVG valide ne s'affiche pas, verifier en priorite la console navigateur et la CSP de la reponse `/uploads/map-icons/...`.

Les fichiers suivants sont refuses a l'upload :

- scripts
- evenements inline
- liens externes
- `foreignObject`
- `DOCTYPE`
- `ENTITY`

## Peuples

Le modele canonique repose sur :

- `reference_races`
- `reference_peuples`

La vieille nomenclature `peuple` n'est plus une source de verite.
