# Sauvegarde PostgreSQL

## Objectif

Cette note pose une procedure minimale pour sauvegarder et restaurer les donnees admin de `cdtm-map`.

Elle ne remplace pas une politique de sauvegarde serveur complete, mais elle fixe le minimum a documenter avant d'utiliser l'admin comme source de donnees durable.

## Donnees concernees

La base contient notamment :

- les comptes staff ;
- les sessions staff ;
- le registre des cases ;
- les notes publiques et staff ;
- les champs terrain et controle ;
- les referentiels ;
- les tables metier dynamiques ;
- les futures donnees d'emplacements, localites et historique de controle.

## Sauvegarde manuelle depuis le serveur

Depuis le dossier de deploiement contenant `docker-compose.prod.yml` et `.env` :

```bash
docker compose --env-file .env -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
  > cdtm-map-$(date +%Y%m%d-%H%M%S).dump
```

Verifier que le fichier produit n'est pas vide :

```bash
ls -lh cdtm-map-*.dump
```

## Restauration de test

La restauration doit d'abord etre testee sur une base separee, jamais directement sur la production sans sauvegarde recente.

Exemple de principe :

```bash
createdb cdtm_restore_test
pg_restore --dbname cdtm_restore_test cdtm-map-YYYYMMDD-HHMMSS.dump
```

Si la restauration est faite dans un conteneur, adapter la commande au contexte Docker Compose local.

## Points a automatiser

- dump planifie ;
- retention des sauvegardes ;
- copie hors serveur ;
- test periodique de restauration ;
- chiffrement ou restriction d'acces aux dumps ;
- export public separe excluant les donnees staff.

## Donnees publiques et staff

Un dump complet PostgreSQL contient des donnees staff. Il ne doit pas etre publie.

Pour partager des donnees publiques, il faudra creer un export dedie qui ne contient que :

- les identifiants publics de cases ;
- les champs publics ;
- les notes explicitement publiques ;
- les donnees validees pour exposition.
