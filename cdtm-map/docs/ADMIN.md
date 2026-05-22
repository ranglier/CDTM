# Admin V1

## Objectif

La brique admin V1 ajoute une interface staff integree a la carte existante pour :

- se connecter avec un login simple `username/password` ;
- consulter et modifier des donnees admin liees a `id_case` ;
- enregistrer les blocs `notes`, `terrain` et `controle` dans PostgreSQL.

La geometrie et les champs stables des cases restent servis depuis `public/data/cases.geojson`.
Les donnees admin sont stockees a part et rattachees aux cases via `id_case`.

## Variables runtime

Les variables suivantes doivent etre presentes dans l'environnement runtime :

- `DATABASE_URL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_TTL_HOURS`

Valeur par defaut actuelle :

```text
ADMIN_SESSION_TTL_HOURS=168
```

## Bootstrap du compte staff

Au demarrage, l'application peut creer ou mettre a jour un compte staff a partir de :

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

Le bootstrap actuel cree ou met a jour le compte dont le `username` correspond a `ADMIN_USERNAME`.

Attention :

- si `ADMIN_USERNAME` et `ADMIN_PASSWORD` restent definis, redemarrer l'application reinitialise ce compte avec ces valeurs ;
- ce mecanisme est pratique pour la V1 mais ne constitue pas encore une gestion complete des comptes.

## Donnees stockees

Les donnees admin V1 sont stockees dans PostgreSQL, separement de la couche GeoJSON stable.

Blocs actuellement geres :

- `case_notes_current`
- `case_terrain_current`
- `case_control_current`

Ces tables representent uniquement l'etat courant.

## Visibilite publique / staff

- `note_publique` peut etre exposee publiquement ;
- `note_staff` reste reservee aux routes admin ;
- la vue publique ne doit jamais exposer les donnees staff.

## Limites actuelles

La V1 n'inclut pas encore :

- d'historisation ;
- de versioning metier ;
- de tables autres que les tables `*_current` pour l'etat courant ;
- d'edition des geometries ou des exports cartographiques.
