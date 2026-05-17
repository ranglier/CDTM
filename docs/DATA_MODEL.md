# Modèle de données

## Principe général

Le champ central du projet est `id_case`.

Il sert de clé stable pour relier :

- la géométrie des cases ;
- les données de contrôle ;
- les futures localités ;
- les notes ;
- l’historique ;
- les styles d’affichage.

## Table `cases`

La table `cases` contient la géométrie des cases et les données essentielles à l’affichage.

Champs retenus pour la V0.1 :

| Champ | Type conseillé | Description |
|---|---|---|
| `id_case` | texte | Identifiant stable unique de la case. |
| `region` | texte | Grande région géographique. |
| `sous_region` | texte | Sous-région ou zone locale. |
| `terrain_cat` | texte | Catégorie mécanique du terrain. |
| `terrain_type` | texte | Type descriptif plus précis du terrain. |
| `faction` | texte | Faction, royaume ou puissance politique associée à la case. |
| `race` | texte | Race ou peuple majoritaire. |
| `empl_base` | entier | Nombre d’emplacements de base selon le terrain. |
| `empl_max` | entier | Nombre maximal d’emplacements après limite et modificateurs. |
| `controleur` | texte | Personnage, autorité ou entité contrôlant concrètement la case. |
| `controleur_type` | texte | Type de contrôleur : PJ, PNJ, faction, royaume, neutre, inconnu. |
| `controle_type` | texte | Statut du contrôle : total, partiel, contesté, occupé, etc. |
| `note_publique` | texte | Note visible en vue publique. |
| `note_staff` | texte | Note réservée au staff. |

## Tables futures

### `localites`

Une ligne par localité, fort, domaine ou dépendance.

Champs envisagés :

- `id_localite`
- `id_case`
- `nom`
- `niveau`
- `type`
- `faction`
- `controleur`
- `race`
- `fortifie`
- `note_publique`
- `note_staff`

### `factions`

Informations sur les factions et royaumes.

### `controleurs`

Personnages, PNJ ou autorités pouvant contrôler une case.

### `styles`

Couleurs et styles d’affichage.

### `historique_controle`

Historique temporel des changements de contrôle.

## Règle de conception

La géométrie ne doit pas devenir un tableur complet de gestion RP.

Les informations qui évoluent souvent ou qui peuvent exister en plusieurs exemplaires par case doivent être déplacées dans des tables séparées.
