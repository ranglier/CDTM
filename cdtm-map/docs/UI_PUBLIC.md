# UI publique

## Objectif

Définir une interface de consultation simple, lisible et limitée aux informations publiques.

## Éléments prévus

### Carte

- Affichage principal de la carte interactive.
- Navigation de base : zoom, déplacement, sélection de case.
- Affichage optionnel des contours des cases.

### Légende

- Explication des couleurs de faction.
- Explication des styles liés au contrôle : total, partiel, contesté, occupé, vassalisé.
- Explication des éventuelles couches affichées.

### Popup de case

La popup publique doit afficher les informations utiles sans donnée staff.

Ordre d'affichage recommandé :

1. `id_case`
2. `region`
3. `sous_region`
4. `terrain_cat`
5. `terrain_type`
6. `relief` si présent
7. `cote` si `true`
8. `lac_majeur` si `true`
9. `cours_eau_majeur` si `true`
10. `faction`
11. `peuple_majoritaire`
12. `empl_base` / `empl_max`
13. `controleur` si présent
14. `controle_type`
15. `note_publique`

`note_staff` ne doit jamais apparaître dans cette vue.

### Filtres simples

- Filtre par région.
- Filtre par catégorie de terrain.
- Filtre par type de terrain.
- Filtre par faction.
- Filtre par peuple majoritaire.
- Filtre par type de contrôle.
- Filtre des cases côtières.
- Filtre par relief.
- Filtre par lac majeur.
- Filtre par cours d'eau majeur.

### Affichage ou masquage des contours

- Option pour afficher ou alléger les bordures des cases.
- Les contours doivent rester disponibles pour conserver la lisibilité du découpage territorial.

## Contraintes

- Ne montrer que des informations publiques.
- Garder une interface claire sur desktop et mobile.
- Ne pas charger inutilement les données réservées au staff dans la vue publique.

## TODO

- Préciser la forme de la légende initiale.
- Définir les couleurs de faction dans `styles_factions`.
- Définir le rendu visuel des contrôles partiels ou contestés.
