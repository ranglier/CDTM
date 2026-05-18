# Spec carte interactive CDTM

## Objectif

La carte interactive doit permettre de consulter le découpage territorial du RP, case par case, avec une vue publique et une vue réservée au staff.

La direction actuelle est de séparer strictement la couche géographique stable des futures données métier.

## Principes retenus

- La géométrie des cases est produite hors application, dans QGIS.
- Les exports web utiliseront des données GeoJSON / JSON.
- `id_case` est la clé stable reliant la géométrie aux données métier.
- La couche stable `cases` reste volontairement minimale.
- Les données de règles, de terrain, de contrôle, d'emplacements, de peuple et de notes doivent être stockées dans des tables métier séparées.
- Les anciennes frontières raster peuvent exister comme calque de référence, mais ne doivent pas être utilisées comme couche principale de gameplay.

## Vues prévues

### Vue publique

- Consultation simple des cases et des calques visibles.
- Affichage uniquement des champs publics.
- Dans la V0 géographique, affichage des informations stables de la case.

### Vue staff

- Consultation des champs publics et internes.
- Calques internes et outils de travail à définir plus tard.
- Possibilité future d'édition ou de validation des données.

## Affichage des cases

- Chaque case est représentée par une géométrie polygonale.
- L'identifiant stable d'une case est `id_case`.
- Les contours noirs des cases doivent pouvoir être affichés afin de conserver la lisibilité de la grille.
- Les cases peuvent d'abord être stylisées de façon neutre, sans dépendre des règles métier.
- Les styles par terrain, faction ou contrôle viendront plus tard depuis des tables métier.

## Champs principaux des cases

La couche stable `cases` s'appuie sur les champs suivants :

- `id_case`
- `region`
- `sous_region`
- `cote`
- `lac_majeur`
- `cours_eau_majeur`
- géométrie

Le seul champ obligatoire côté attributs est :

- `id_case`

## Champs exclus de la couche stable

Les champs suivants ne doivent plus être stockés directement dans `cases` :

- `terrain_cat`
- `terrain_type`
- `relief`
- `terrain_secondaire`
- `faction`
- `peuple_majoritaire`
- `bonus_speciaux`
- `empl_base`
- `empl_max`
- `controleur`
- `controle_type`
- `note_publique`
- `note_staff`

Ils seront réintroduits plus tard dans des tables métier spécialisées.

## Eau majeure

Les champs d'eau stables sont :

```txt
cote
lac_majeur
cours_eau_majeur
```

Ils acceptent :

```txt
true
false
null
```

La condition métier `eau_majeure` n'est pas stockée. Elle est dérivée :

```txt
eau_majeure = cote || lac_majeur || cours_eau_majeur
```

## Popup au clic

La popup publique V0 doit afficher au minimum :

- case ;
- région ;
- sous-région ;
- caractère côtier si pertinent ;
- lac majeur si pertinent ;
- cours d'eau majeur si pertinent.

Elle ne doit pas afficher :

- `note_staff` ;
- données de contrôle ;
- données de peuple ;
- données d'emplacement ;
- règles de terrain instables.

Ces informations seront ajoutées plus tard lorsque les tables métier seront disponibles.

## Filtres futurs

Filtres stables possibles dès la V0 :

- filtre par région ;
- filtre par sous-région ;
- filtre par case côtière ;
- filtre par lac majeur ;
- filtre par cours d'eau majeur.

Filtres métier futurs :

- filtre par catégorie de terrain ;
- filtre par type de terrain ;
- filtre par faction ;
- filtre par peuple majoritaire ;
- filtre par type de contrôle ;
- filtre par emplacements.

## Calques futurs

- Fond de carte.
- Cases territoriales.
- Contours des cases.
- Frontières raster de référence.
- Localités.
- Calques métier terrain.
- Calques métier politique / factions.
- Calques staff.

## Notes

- Cette spec reste volontairement initiale.
- Les règles précises d'affichage pourront évoluer avec les besoins du RP.
- Les régions et sous-régions restent à stabiliser.
- La priorité actuelle est d'obtenir une couche QGIS exploitable et stable avant de développer les tables métier.
