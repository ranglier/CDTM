# Data model

## Principes

- Les géométries cartographiques et les données RP doivent rester séparées.
- `id_case` est la clé stable permettant de relier les tables et les exports.
- Les modèles ci-dessous sont volontairement simples pour permettre une évolution progressive.
- Les valeurs techniques sont écrites en minuscules, sans accents et sans espaces.
- Les champs de notes doivent distinguer clairement ce qui est public de ce qui est réservé au staff.

## Table `cases`

La table `cases` décrit les cases territoriales de la carte.

Elle contient la géométrie de chaque case et les informations minimales nécessaires à l'affichage, au filtrage et à la popup de consultation.

### Champs prévus

- `id_case`
- `region`
- `sous_region`
- `terrain_cat`
- `terrain_type`
- `relief`
- `cote`
- `lac_majeur`
- `cours_eau_majeur`
- `faction`
- `peuple_majoritaire`
- `bonus_speciaux`
- `empl_base`
- `empl_max`
- `controleur`
- `controle_type`
- `note_publique`
- `note_staff`

### Champs obligatoires

Une case doit toujours avoir :

- `id_case`
- `terrain_cat`
- `terrain_type`

Les autres champs peuvent rester vides si l'information n'est pas encore connue ou non applicable.

### `id_case`

Identifiant unique et stable de la case.

Exemple :

```txt
case_0001
```

Cet identifiant sert de clé de liaison avec les autres tables, notamment `localites`, `historique_controle` et les futurs fichiers de données RP.

### `region`

Grande région géographique ou politique dans laquelle se trouve la case.

Exemples :

```txt
calenardhon
anorien
ithilien
rhovanion
```

La nomenclature exacte des régions reste à stabiliser.

### `sous_region`

Subdivision plus précise de `region`.

Exemples :

```txt
eastfold
wold
cair_andros
terres_brunes
```

Ce champ peut rester vide si aucune sous-région pertinente n'est définie.

### `terrain_cat`

Catégorie mécanique principale du terrain.

Valeurs prévues :

```txt
plaine
desert
marais
foret
montagne
inconnu
```

### `terrain_type`

Type de terrain dominant dans une case.

Valeurs autorisées par catégorie :

```txt
plaine   : prairie, plaine_aride, plaine_boisee, toundra
desert   : desert_glace, desert_sable, terre_desolee
marais   : marais
foret    : foret, taiga, foret_luxuriante
montagne : montagne, montagne_riche
inconnu  : inconnu
```

Une case doit toujours avoir un `terrain_type` compatible avec son `terrain_cat`.

### `relief`

Modificateur local de relief.

Valeurs prévues :

```txt
colline
null
```

Une colline forestière doit donc être modélisée comme une forêt avec relief de colline :

```txt
terrain_cat = foret
terrain_type = foret
relief = colline
```

Le champ historique `terrain_secondaire` est déprécié et ne doit plus être utilisé.

### `cote`, `lac_majeur`, `cours_eau_majeur`

Booléens indiquant si la case touche une eau importante :

- `cote` : côte maritime ;
- `lac_majeur` : lac important ;
- `cours_eau_majeur` : fleuve ou rivière majeure.

Valeurs attendues :

```txt
true
false
null
```

La condition métier `eau_majeure` n'est pas stockée. Elle est dérivée :

```txt
eau_majeure = cote || lac_majeur || cours_eau_majeur
```

### `faction`

Faction, royaume ou puissance politique associée à la case.

Ce champ peut être vide si la case est neutre, inconnue ou non revendiquée.

### `peuple_majoritaire`

Peuple ou population majoritaire associée à la case. Ce champ est optionnel et peut être vide.

Le champ décrit la population ou le peuple dominant de la case, pas nécessairement le peuple personnel du contrôleur.

### `bonus_speciaux`

Liste optionnelle de bonus spéciaux appliqués explicitement à la case.

Ce champ remplace l'ancien modèle de bonus automatiquement lié à une faction.

Exemple :

```json
["ancien_bonus_empire_desert_glace"]
```

Un bonus spécial doit être listé dans `data/reference/emplacements_rules.json` et ne s'applique que si ses conditions sont remplies.

### `empl_base`

Nombre d'emplacements de base après application du terrain et du relief, mais avant bonus de peuple ou bonus spéciaux.

Calcul :

```txt
empl_base = base_by_terrain_type + relief_modifiers
```

Exemples :

```txt
prairie = 5
foret = 3
foret + colline = 2
marais = 2
desert_sable = 2
```

### `empl_max`

Nombre maximal d'emplacements disponibles dans la case après application des règles pertinentes.

Calcul :

```txt
empl_max = clamp(empl_base + bonus peuple + bonus spéciaux, 1, 5)
```

Les bonus multiples d'un même peuple se cumulent si plusieurs conditions sont remplies.

Exemple :

```txt
Noldor + forêt + colline
= forêt 3 - colline 1 + Noldor forêt 1 + Noldor colline 1
= 4
```

Les règles détaillées sont documentées dans :

```txt
data/reference/emplacements_rules.json
```

### `controleur`

Personnage, autorité ou entité nommée administrant concrètement la case.

Ce champ est optionnel.

### `controle_type`

Statut du contrôle de la case.

Valeurs envisagées :

```txt
aucun
total
partiel
conteste
occupe
vassalise
inconnu
```

### `note_publique`

Note visible dans l'interface publique.

Elle ne doit contenir que des informations diffusables aux joueurs.

### `note_staff`

Note réservée au staff.

Elle peut contenir des informations internes, incertaines, secrètes ou préparatoires.

Ce champ ne doit pas être exposé dans les exports publics.

## Future table `peuples`

Usage :

- Référencer les différents peuples pouvant occuper les cases.
- Documenter leurs noms affichés, descriptions et éventuels bonus ou malus d'emplacements.

Champs possibles :

- `id_peuple`
- `nom`
- `description_courte`

## Future table `localites`

Usage :

- Référencer des villes, forts, ports, domaines, ruines ou autres points d'intérêt.
- Relier chaque localité à une case via `id_case`.
- Permettre plusieurs localités ou structures dans une même case sans alourdir la table `cases`.

Champs possibles :

- `id_localite`
- `id_case`
- `nom`
- `niveau`
- `type`
- `empl`
- `visibilite`
- `note_publique`
- `note_staff`

## Future table `factions`

Usage :

- Centraliser les informations minimales sur les factions.
- Fournir un nom affichable, une couleur ou un statut sans répéter ces informations dans chaque case.

## Future table `controleurs`

Usage :

- Décrire les entités nommées pouvant contrôler une case.
- Permettre de savoir si un contrôleur nommé est un PNJ.

## Future table `styles`

Usage :

- Associer des règles visuelles aux factions, types de terrain ou couches.

## Future table `historique_controle`

Usage :

- Tracer les changements de contrôle dans le temps.

## TODO

- Valider la nomenclature exacte des régions et sous-régions.
- Stabiliser les bonus spéciaux réellement utilisés en production.
- Vérifier avec le staff si certains cours d'eau ou lacs doivent être explicitement listés en référence.
