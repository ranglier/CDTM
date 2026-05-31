# Nomenclatures

La table technique unique est `reference_nomenclature_values`, mais l'interface la presente par groupes metier.

## Groupes actifs

- `terrain_cat`
- `terrain_type`
- `case_attribute`
- `controle_type`
- `localite_niveau`
- `localite_type`

## Groupes hors nomenclatures

Les notions suivantes ont leur propre referentiel et ne doivent plus vivre dans `reference_nomenclature_values` :

- peuples : `reference_peuples`
- races : `reference_races`
- factions : `reference_factions`
- controleurs : `reference_controleurs`

## Parentage

Le groupe `terrain_type` peut utiliser `parent_entry_key` pour rattacher un type a une categorie de terrain.

Le groupe `case_attribute` expose les attributs stylables de case. En V1, il contient `colline` pour permettre le choix du motif topographique applique aux cases en colline.

## Supprime

Les groupes suivants ne doivent plus etre consideres comme actifs :

- `peuple`
- `peuple_majoritaire`
- `bonus_special`
- `visibilite`
- `statut_note`
- `relief`
