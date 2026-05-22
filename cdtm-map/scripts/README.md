# scripts

Scripts utilitaires lies aux donnees, a leur maintenance et au deploiement.

- `validate-data.mjs` : validation des fichiers `cases*.json` et `cases*.geojson`.
- `create-admin-user.mjs` : creation ou mise a jour d'un compte admin en base.
- `deploy-osgiliath.sh` : synchronisation SSH vers `osgiliath` puis `docker compose up -d --build`.
