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
- `terrain_secondaire`
- `cote`
- `faction`
- `peuple_majoritaire`
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

### Définitions des champs

#### `id_case`

Identifiant unique et stable de la case.

Exemple :

```txt
case_0001
```

Cet identifiant sert de clé de liaison avec les autres tables, notamment `localites`, `historique_controle` et les futurs fichiers de données RP.

#### `region`

Grande région géographique ou politique dans laquelle se trouve la case.

Exemples :

```txt
calenardhon
anorien
ithilien
rhovanion
```

La nomenclature exacte des régions reste à stabiliser.

#### `sous_region`

Subdivision plus précise de `region`.

Exemples :

```txt
eastfold
wold
cair_andros
terres_brunes
```

Ce champ peut rester vide si aucune sous-région pertinente n'est définie.

#### `terrain_cat`

Catégorie mécanique principale du terrain.

Valeurs prévues :

```txt
plaine
desert
marais
foret
montagne
```

Cette catégorie sert notamment au calcul de base des emplacements disponibles dans une case.

#### `terrain_type`

Type de terrain dominant dans une catégorie.

Valeurs autorisées par catégorie :

```txt
plaine : prairie, plaine_aride, bocage
desert : desert_chaud, desert_gele, terre_desolee
marais : marais
foret : foret, foret_luxuriante, taiga
montagne : colline, montagne, montagne_riche, paturage
```

Une case doit toujours avoir un `terrain_type` compatible avec son `terrain_cat`.

#### `terrain_secondaire`

Type de terrain secondaire.

Ce champ est optionnel et sert surtout aux cases de type `colline`.

Si `terrain_type = colline`, `terrain_secondaire` peut indiquer un type de plaine, de forêt ou de désert associé à la colline.

Valeurs envisagées :

```txt
prairie
plaine_aride
bocage
desert_chaud
desert_gele
terre_desolee
foret
foret_luxuriante
taiga
```

Pour les cases côtières, ne pas utiliser `terrain_secondaire = cote`. Utiliser le champ booléen `cote`.

#### `cote`

Booléen indiquant si la case se trouve sur une côte.

Valeurs attendues :

```txt
true
false
```

Ce champ sert notamment aux règles d'emplacements des Corsaires.

#### `faction`

Faction, royaume ou puissance politique associée à la case.

Ce champ peut être vide si la case est neutre, inconnue ou non revendiquée.

Exemples :

```txt
royaume_des_hommes
mordor
empire
rhun
harad
umbar
```

Une case peut avoir une faction sans contrôleur nommé.

#### `peuple_majoritaire`

Peuple ou population majoritaire associée à la case. Ce champ est optionnel et peut être vide.

Le champ décrit la population ou le peuple dominant de la case, pas nécessairement le peuple personnel du contrôleur.

Valeurs initiales envisagées :

```txt
gondoriens
eotheods
daliens
esgarothiens
dunlandais
orientaux
corsaires
haradrim
variags
dunedain_du_nord
numenoreens_noirs
noldor
sindar
nandor
avari
snagas
uruk_hai
gobelins
longues_barbes
barbes_de_feu
ventrus
poignes_de_fer
barbes_raides
pieds_de_pierre
cheveux_noirs
hobbits
lossoth
hommes_sauvages
mixte
inconnu
```

#### `empl_base`

Nombre d'emplacements de base fourni par le terrain brut de la case.

Ce champ découle de `terrain_cat`.

Règles officielles :

```txt
plaine   → 5
desert   → 3
montagne → 3
foret    → 3
marais   → 2
```

#### `empl_max`

Nombre maximal d'emplacements disponibles dans la case après application des règles pertinentes.

Ce champ peut tenir compte de modificateurs liés au peuple, à la faction, au terrain secondaire ou à une règle validée par le staff.

Règles générales :

```txt
empl_max ne peut pas dépasser 5
empl_max ne peut pas descendre sous 1
```

Les règles détaillées sont documentées dans :

```txt
data/reference/emplacements_rules.json
```

#### `controleur`

Personnage, autorité ou entité nommée administrant concrètement la case.

Ce champ est optionnel.

Une case peut avoir une `faction` sans `controleur` nommé.

Exemples :

```txt
deorl
moggash
seigneur_local
```

Le statut PNJ ou non d'un contrôleur est stocké dans la table `controleurs`, pas directement dans `cases`.

#### `controle_type`

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

Ce champ sert à l'affichage politique, aux filtres et à la représentation des cases contestées ou partiellement contrôlées.

#### `note_publique`

Note visible dans l'interface publique.

Elle ne doit contenir que des informations diffusables aux joueurs.

#### `note_staff`

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

### `niveau`

Niveau de développement de la localité.

Valeurs envisagées :

```txt
hameau
village
bourg
ville
cite
```

Ce champ peut rester vide pour les structures qui ne suivent pas l'échelle de développement urbaine.

### `type`

Type fonctionnel ou narratif de la localité.

Valeurs demandées :

```txt
avant_poste
fort
domaine
ruine
```

La liste pourra être complétée plus tard si le staff ajoute d'autres catégories.

### `empl`

Nombre d'emplacements occupés par cette localité ou structure.

Exemples de logique métier :

```txt
hameau       → 1
village      → 1
bourg        → 2
ville        → 3
cite         → 4
avant_poste  → 1
fort         → 2
```

## Future table `factions`

Usage :

- Centraliser les informations minimales sur les factions.
- Fournir un nom affichable, une couleur ou un statut sans répéter ces informations dans chaque case.

Champs possibles :

- `id_faction`
- `nom`
- `description_courte`
- `statut`

## Future table `controleurs`

Usage :

- Décrire les entités nommées pouvant contrôler une case.
- Permettre de savoir si un contrôleur nommé est un PNJ.

Champs possibles :

- `id_controleur`
- `nom`
- `pnj`

### `pnj`

Booléen indiquant si le contrôleur est un PNJ.

Valeurs attendues :

```txt
true
false
```

## Future table `styles`

Usage :

- Associer des règles visuelles aux factions, types de terrain ou couches.

Champs possibles :

- `id_style`
- `cible_type`
- `cible_id`
- `fill`
- `stroke`
- `opacity`

## Future table `historique_controle`

Usage :

- Tracer les changements de contrôle dans le temps.

Champs possibles :

- `id_evenement`
- `id_case`
- `date_label`
- `ancien_controleur`
- `nouveau_controleur`
- `note`

## TODO

- Valider la nomenclature exacte des régions et sous-régions.
- Définir les clés secondaires et références exactes entre fichiers.
- Implémenter la validation conditionnelle `terrain_cat` / `terrain_type` si nécessaire.
