# Forgejo CI/CD

## Objectif

Fournir une chaine CI/CD simple et lisible pour `cdtm-map` sur Forgejo prive, avec validation sur `aldburg` puis deploiement automatique sur `osgiliath`.

## Source de vérité

Le dépôt prive Forgejo `jules/CDTM` est la source de vérité de travail.
Le dépôt GitHub public `ranglier/CDTM` reste un miroir public.
La CI visée s'exécute donc côté Forgejo.

## Workflow principal

Le workflow principal reste :

```text
.forgejo/workflows/cdtm-ci.yml
```

Il contient deux jobs :

- `ci` : validations `npm` sur le dossier `cdtm-map` ;
- `deploy-production` : synchronisation SSH vers `osgiliath` puis `docker compose up -d --build`.

## Comment le lancer

Dans Forgejo :

1. ouvrir le dépôt `jules/CDTM` ;
2. aller dans `Actions` ;
3. choisir `CDTM CI` ;
4. cliquer sur `Run workflow`.

Le workflow s'exécute aussi sur `push` vers `main` quand des changements touchent `cdtm-map/` ou le workflow lui-même.

## Ce que la CI valide

- `npm ci`
- `npm run validate:data`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Audit rapide du dépôt

- workflow actif : `.forgejo/workflows/cdtm-ci.yml`
- artefacts runtime : `Dockerfile`, `docker-compose.prod.yml`, `.env.example`
- script de deploiement : `scripts/deploy-osgiliath.sh`
- healthcheck : `src/app/api/health/route.ts`
- variables applicatives actuellement lues : `APP_ENV`, `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_TTL_HOURS`
- l'admin V1 depend de ces variables runtime pour bootstrapper le compte staff et ouvrir la console d'edition

## Ce que le deploy fait

- ecrit un fichier runtime `.env` a partir des secrets Forgejo ;
- verifie explicitement au debut du job que tous les secrets obligatoires existent ;
- teste la connectivite SSH et la presence de `docker` / `docker compose` sur `osgiliath` ;
- synchronise `cdtm-map/` vers `${OSGILIATH_DEPLOY_PATH}` ;
- ecrit `${OSGILIATH_DEPLOY_PATH}/.env` avec des droits restrictifs ;
- execute `docker compose --env-file ... -f docker-compose.prod.yml pull || true`, puis `build`, puis `up -d` ;
- verifie `http://127.0.0.1:${APP_PORT}/api/health` sur la VM cible.

## Secrets attendus

- `OSGILIATH_SSH_HOST`
- `OSGILIATH_SSH_PORT` : optionnel, `22` par defaut
- `OSGILIATH_SSH_USER`
- `OSGILIATH_SSH_PRIVATE_KEY`
- `OSGILIATH_DEPLOY_PATH` : optionnel, `/srv/cdtm-map` par defaut
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

Secret optionnel :

- `ADMIN_SESSION_TTL_HOURS` : `168` par defaut si absent

`DATABASE_URL` attendue en reference :

```text
postgresql://cdtm:<password>@postgres:5432/cdtm
```

Le service Compose PostgreSQL/PostGIS de production s'appelle `postgres`.

Le fichier runtime `.env` genere par la CI ecrit aussi :

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_TTL_HOURS`

Pour le fonctionnement de l'admin V1, voir aussi :
`docs/ADMIN.md`

## SSH / known_hosts

Le workflow tente d'abord `ssh-keyscan` sur `OSGILIATH_SSH_HOST:OSGILIATH_SSH_PORT`.
Si cette collecte echoue, le job bascule sur `StrictHostKeyChecking=accept-new` pour eviter tout prompt interactif tout en gardant une verification de la premiere empreinte recue.

## Ce que la chaine ne fait pas encore

- aucune publication d'image dans un registry ;
- aucun orchestrateur type Kubernetes ;
- aucun rollout multi-environnements ;
- aucun provisioning de proxy `cirith-ungol` ;
- aucune gestion de migrations PostGIS applicatives.

## En cas d'échec

Regarder en priorité :

- l'étape exacte qui casse ;
- la sortie de `npm ci` si le problème vient du lockfile ou des dépendances ;
- `validate:data` si la régression touche les jeux de données ;
- `lint`, `typecheck` ou `build` si la régression vient du code applicatif ;
- la disponibilité du label runner `node20` côté Forgejo si le job reste en attente ;
- la résolution SSH vers `osgiliath` si le job de déploiement ne démarre pas ;
- la présence du moteur Docker et du plugin Compose sur la VM cible si `up -d --build` échoue ;
- la réponse du healthcheck `/api/health` si le déploiement semble abouti mais reste rouge.
