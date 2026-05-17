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
- `faction`
- `peuple_majoritaire`
- `empl_base`
- `empl_max`
- `controleur`
- `controleur_pnj`
- `controle_type`
- `note_publique`
- `note_staff`

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
anórien
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

Type de terrain plus précis à l'intérieur d'une catégorie.

Valeurs envisagées :

```txt
prairie
plaine_aride
bocage
desert_gele
toundra
desert
terre_desolee
marais
foret
foret_luxuriante
taiga
colline
montagne
montagne_riche
paturage
```

Le champ `terrain_type` décrit le terrain dominant de la case.

#### `terrain_secondaire`

Type de terrain secondaire ou modificateur local.

Ce champ est optionnel.

Il sert notamment pour les cas où une case possède un terrain principal mais aussi un trait secondaire utile pour les règles ou l'affichage.

Exemples :

```txt
colline
cote
foret
paturage
terre_desolee
```

Pour une case de colline ayant un autre caractère dominant, `terrain_type` peut indiquer `colline` et `terrain_secondaire` préciser le contexte local.

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

Peuple ou population majoritaire associée à la case.

Ce champ remplace l'ancien champ `race`.

Valeurs envisagées :

```txt
humains
orcs
nains
elfes
hobbits
haradrim
variags
lossoth
corsaires
mixte
inconnu
```

Le champ décrit la population ou le peuple dominant de la case, pas nécessairement la race personnelle du contrôleur.

#### `empl_base`

Nombre d'emplacements de base fourni par le terrain brut de la case.

Ce champ découle de `terrain_cat`.

Exemple de logique métier :

```txt
plaine   → 5
desert   → 3
montagne → 3
foret    → 3
marais   → 2
```

Ces valeurs devront être confirmées avec les règles staff définitives.

#### `empl_max`

Nombre maximal d'emplacements disponibles dans la case après application des règles pertinentes.

Ce champ peut tenir compte de modificateurs liés au peuple, à la faction, au terrain secondaire ou à une règle validée par le staff.

Il doit rester compris dans les limites du système de jeu.

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

#### `controleur_pnj`

Booléen indiquant si le contrôleur nommé est un PNJ.

Valeurs attendues :

```txt
true
false
```

Ce champ ne doit être renseigné que si `controleur` est renseigné.

Exemples :

```txt
controleur = deorl
controleur_pnj = false

controleur = seigneur_local
controleur_pnj = true
```

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

## Future table `races`

Usage :

- Référencer les différents peuples pouvant occuper les cases.
- Documenter leurs noms affichés, descriptions et éventuels bonus ou malus d'emplacements.

Champs possibles :

- `id_race`
- `nom`
- `description_courte`

Valeurs initiales à prévoir :

```txt
humains
orcs
nains
elfes
hobbits
haradrim
variags
lossoth
corsaires
mixte
inconnu
```

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

- Confirmer les valeurs exactes de `terrain_cat`, `terrain_type` et `terrain_secondaire` avec le staff.
- Confirmer les règles définitives de calcul de `empl_base` et `empl_max`.
- Définir les clés secondaires et références exactes entre fichiers.
- Aligner `NOMENCLATURES.md`, `nomenclatures.json` et `cases.schema.json` sur ce modèle.
