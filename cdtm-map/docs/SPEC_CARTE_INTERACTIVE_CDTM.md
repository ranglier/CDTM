# Spec carte interactive CDTM

## Objectif

La carte interactive doit permettre de consulter visuellement le decoupage territorial du RP, case par case, avec des informations publiques et, a terme, des informations reservees au staff.

## Vues prevues

### Vue publique

- Affichage des informations diffusables uniquement.
- Consultation simple des cases et de quelques calques visibles.

### Vue staff

- Acces a des donnees supplementaires non publiques.
- Calques internes et outils de travail a definir plus tard.

## Affichage des cases

- Chaque case est representee par une geometrie polygonale.
- Les cases doivent pouvoir etre stylisees selon des attributs metier.
- L'identifiant stable d'une case est `id_case`.

## Popup au clic

- Un clic sur une case ouvre un resume des proprietes principales.
- Le contenu exact du popup sera affine apres stabilisation du modele de donnees.

## Filtres futurs

- Filtre par categorie de terrain.
- Filtre par faction.
- Filtre par race.
- Filtre par type de controle.

## Calques futurs

- Terrain
- Politique
- Staff
- Frontieres
- Localites

## Notes

- Cette spec est volontairement initiale.
- Les regles precises d'affichage pourront evoluer avec les besoins du RP.
