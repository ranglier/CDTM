# scripts

Scripts utilitaires lies aux donnees, a leur maintenance et au deploiement.

- `validate-data.mjs` : validation des fichiers `cases*.json` et `cases*.geojson`.
- `deploy-osgiliath.sh` : synchronisation SSH vers `osgiliath` puis `docker compose up -d --build`.

## TODO

- Ajouter plus tard une validation des schemas.
- Prevoir des commandes de preparation des exports si besoin.
