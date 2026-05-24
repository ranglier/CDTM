# Nomenclatures

La table technique unique est `reference_nomenclature_values`, mais l'interface la presente par groupes metier.

## Groupes actifs

- `terrain_cat`
- `terrain_type`
- `relief`
- `controle_type`
- `bonus_special`
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

`relief` fait partie du groupe fonctionnel `Terrains`, mais reste un groupe de nomenclature autonome.

## Supprime

Les groupes suivants ne doivent plus etre consideres comme actifs :
- `peuple`
- `peuple_majoritaire`
- `visibilite`
- `statut_note`
