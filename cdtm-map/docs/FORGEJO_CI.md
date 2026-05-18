# Forgejo CI

## Objectif

Fournir une baseline CI minimale, lisible et peu couteuse pour `cdtm-map` sur Forgejo prive.

## Source de vérité

Le dépôt prive Forgejo `jules/CDTM` est la source de vérité de travail.
Le dépôt GitHub public `ranglier/CDTM` reste un miroir public.
La CI visée s'exécute donc côté Forgejo.

## Workflow

Le workflow principal est :

```text
.forgejo/workflows/cdtm-ci.yml
```

## Comment le lancer

Dans Forgejo :

1. ouvrir le dépôt `jules/CDTM` ;
2. aller dans `Actions` ;
3. choisir `CDTM CI` ;
4. cliquer sur `Run workflow`.

Le workflow s'exécute aussi sur `push` quand des changements touchent `cdtm-map/` ou le workflow lui-même.

## Ce que la CI valide

- `npm ci`
- `npm run validate:data`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Ce que la CI ne fait pas

- aucun déploiement ;
- aucune publication de conteneur ;
- aucune gestion de secret ;
- aucun reverse proxy ;
- aucune release.

## En cas d'échec

Regarder en priorité :

- l'étape exacte qui casse ;
- la sortie de `npm ci` si le problème vient du lockfile ou des dépendances ;
- `validate:data` si la régression touche les jeux de données ;
- `lint`, `typecheck` ou `build` si la régression vient du code applicatif ;
- la disponibilité du label runner `node20` côté Forgejo si le job reste en attente.
