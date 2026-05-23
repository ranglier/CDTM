# Forgejo CI/CD

## Workflow

Le deploiement repose sur `.forgejo/workflows/cdtm-ci.yml`.

Le workflow contient :

- `ci` : validation du projet
- `deploy-production` : deploiement sur `osgiliath`

## Verifications CI

- `npm ci`
- `npm run validate:data`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Secrets requis

- `OSGILIATH_SSH_HOST`
- `OSGILIATH_SSH_PORT`
- `OSGILIATH_SSH_USER`
- `OSGILIATH_SSH_PRIVATE_KEY`
- `OSGILIATH_DEPLOY_PATH`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`

Le deploiement standard ne requiert pas de secrets `ADMIN_*`.

## Runtime de production

Le workflow genere un `.env` runtime pour l'application et la base.

Par defaut :

- `ADMIN_SESSION_TTL_HOURS=168`
- `ADMIN_USERNAME` n'est pas ecrit
- `ADMIN_PASSWORD` n'est pas ecrit

Sans `ADMIN_USERNAME` et `ADMIN_PASSWORD`, aucun compte staff n'est bootstrappe automatiquement.
`POSTGRES_PASSWORD` ne doit pas etre reutilise comme mot de passe admin applicatif.
Si un compte est bootstrappe via `ADMIN_USERNAME` / `ADMIN_PASSWORD`, il devient `tech_admin`.

## Note

Pour les details de l'admin V1, voir `docs/ADMIN.md`.
