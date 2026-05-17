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
- `terrain_type_colline`
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
- `region`
- `sous_region`
- `terrain_cat` définit la categorie du terrain de la case parmi : plaine, desert, marais, foret, montagne
- `terrain_type` définit un type de terrain spécifique dans une categorie :
    - plaine : prairie, plaine aride, boccage
    - desert : desert gele, toundra, desert, terre desolee
    - marais : marais
    - foret : foret, foret luxuriante, taiga
    - montagne : colline, montagne, montagne riche, paturage
- `terrain_type_colline` par defaut vide, si la case est une colline elle peut posseder un second type de terrain. cf les types dans `terrain_type` excluant les types pour les cases montagnes.
- `faction` par defaut vide. Definit la faction controlant la case, ex : modor, royaume des hommes.
- `race`
- `empl_base`
- `empl_max`
- `controleur` par defaut vide. Reference une entite RP, un PJ ou PNJ.
- `controleur_type`
- `controle_type`
- `note_publique` et `note_staff` doivent rester clairement distinctes.

## Future table `races`

Usage :

- Referencer les differentes peuple pouvant occuper les cases.

Champs possibles :

- `id_race`
- `nom`
- `description_courte`

## Future table `localites`

Usage :

- Referencer des villes, forts, ports ou autres points d'interet.

Champs possibles :

- `id_localite`
- `id_case`
- `nom`
- `type`
- `empl`
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
- `pnj`

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
