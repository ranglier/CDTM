# Nomenclatures

La table technique unique est `reference_nomenclature_values`, mais l'interface la presente par groupes metier.

## Groupes actifs

- `terrain_cat`
- `terrain_type`
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

`relief` ne porte plus de logique de regles V1. Il peut subsister comme heritage visuel ou donnees historiques, mais le mode topographique public s'appuie sur `terrain_type` et l'attribut `colline`.

## Supprime

Les groupes suivants ne doivent plus etre consideres comme actifs :
- `peuple`
- `peuple_majoritaire`
- `bonus_special`
- `visibilite`
- `statut_note`
