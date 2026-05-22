# CDTM

Dépôt Git du projet **Les Chroniques de la Terre du Milieu**.

## Carte interactive

Le projet de carte interactive se trouve dans le dossier :

```txt
cdtm-map/
```

Voir : [`cdtm-map/README.md`](cdtm-map/README.md)

## Forgejo

Le dépôt privé Forgejo est la source de vérité de travail.
Le dépôt GitHub public `ranglier/CDTM` reste un miroir public.

Pour la CI/CD Forgejo et le déploiement automatique vers `osgiliath` du sous-projet `cdtm-map`, voir :
[`cdtm-map/docs/FORGEJO_CI.md`](cdtm-map/docs/FORGEJO_CI.md)

## Note d'organisation

La racine du dépôt sert uniquement de point d'entrée. L'arborescence applicative et documentaire de la carte est centralisée dans `cdtm-map/` afin d'éviter les doublons entre la racine et le sous-projet.
