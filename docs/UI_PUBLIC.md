# Interface publique

## Objectif

La vue publique permet aux joueurs de consulter la carte stratégique sans exposer les informations staff.

## Éléments prévus

- fond de carte ;
- cases territoriales ;
- contours visibles ou masquables ;
- coloration par faction ;
- popup au clic ;
- légende ;
- filtres simples.

## Popup publique

La popup publique peut afficher :

- `id_case` ;
- `region` ;
- `sous_region` ;
- `terrain_cat` ;
- `terrain_type` ;
- `faction` ;
- `race` ;
- `empl_base` ;
- `empl_max` ;
- `controleur` ;
- `controleur_type` ;
- `controle_type` ;
- `note_publique`.

Elle ne doit jamais afficher `note_staff`.

## Filtres publics envisagés

- région ;
- faction ;
- terrain ;
- race ;
- type de contrôle.

## Options d’affichage

- afficher / masquer les contours ;
- afficher / masquer les couleurs de faction ;
- afficher le fond seul ;
- afficher les cases contestées.
