# Admin V1

## Role

L'admin V1 ajoute un acces staff a la carte pour :

- se connecter ;
- consulter et modifier `notes`, `terrain` et `controle` ;
- enregistrer ces donnees en base via `id_case`.

L'application ne gere pas encore de roles distincts. En pratique, un compte admin cree aujourd'hui dispose de tous les droits staff existants.

## Runtime

Variables utilisees :

- `DATABASE_URL`
- `ADMIN_SESSION_TTL_HOURS`

Variables optionnelles pour le bootstrap :

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

Valeur par defaut :

```text
ADMIN_SESSION_TTL_HOURS=168
```

## Bootstrap

Si `ADMIN_USERNAME` et `ADMIN_PASSWORD` sont definis, l'application cree ou met a jour le compte staff correspondant au demarrage.

Si ces variables sont absentes :

- aucun compte staff n'est bootstrappe automatiquement ;
- le deploiement standard continue sans erreur.

## Creation manuelle d'un compte admin

Pour creer ou mettre a jour un compte utilisable tout de suite :

```bash
DATABASE_URL=postgresql://... npm run create:admin -- --username superadmin --password '<mot_de_passe>'
```

La commande :

- cree le compte s'il n'existe pas ;
- met a jour son mot de passe s'il existe deja ;
- invalide ses anciennes sessions.

`POSTGRES_PASSWORD` ne doit jamais servir de mot de passe admin applicatif.

## Separation des donnees

- la couche stable reste servie depuis `public/data/cases.geojson`
- les donnees admin sont stockees dans PostgreSQL
- `note_publique` peut etre exposee publiquement
- `note_staff` reste reservee aux routes admin

## Limites V1

- pas d'historisation
- pas de versioning metier
- seulement des tables `*_current`
- pas d'edition des geometries
