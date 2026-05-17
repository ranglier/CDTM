# Data model

## Principes

- Les geometries cartographiques et les donnees RP doivent rester separees.
- `id_case` est la cle stable permettant de relier les tables et les exports.
- Les modeles ci-dessous sont volontairement simples pour permettre une evolution progressive.

## Table `cases`

Champs prevus :

- `id_case`
- `region`
- `sous_region`
- `terrain_cat`
- `terrain_type`
- `faction`
- `race`
- `empl_base`
- `empl_max`
- `controleur`
- `controleur_type`
- `controle_type`
- `note_publique`
- `note_staff`

### Notes

- `id_case` doit etre unique et stable dans le temps.
- `terrain_cat` vise une nomenclature controlee.
- `terrain_type` peut rester plus libre si besoin.
- `controleur` reference une entite RP ou politique.
- `note_publique` et `note_staff` doivent rester clairement distinctes.

## Future table `localites`

Usage :

- Referencer des villes, forts, ports ou autres points d'interet.

Champs possibles :

- `id_localite`
- `id_case`
- `nom`
- `type`
- `visibilite`
- `note_publique`
- `note_staff`

## Future table `factions`

Usage :

- Centraliser les informations minimales sur les factions.

Champs possibles :

- `id_faction`
- `nom`
- `description_courte`
- `statut`

## Future table `controleurs`

Usage :

- Decrire les entites pouvant controler une case.

Champs possibles :

- `id_controleur`
- `nom`
- `controleur_type`
- `faction`
- `actif`

## Future table `styles`

Usage :

- Associer des regles visuelles aux factions, types de terrain ou couches.

Champs possibles :

- `id_style`
- `cible_type`
- `cible_id`
- `fill`
- `stroke`
- `opacity`

## Future table `historique_controle`

Usage :

- Tracer les changements de controle dans le temps.

Champs possibles :

- `id_evenement`
- `id_case`
- `date_label`
- `ancien_controleur`
- `nouveau_controleur`
- `note`

## TODO

- Decider quels champs doivent etre obligatoires en production.
- Definir les cles secondaires et references exactes entre fichiers.
