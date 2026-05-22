# UI publique

## Objectif

Définir une interface de consultation simple, lisible et limitée aux informations publiques.

## Éléments prévus

### Carte

- Affichage principal de la carte interactive.
- Navigation de base : zoom, deplacement, recentrage, selection de case.
- Aucun fond OSM ni couche externe dynamique dans la V0.
- Couche publique stable chargee depuis `public/data/cases.geojson`.
- Fond de carte statique charge depuis `public/maps/CTM.png`.
- Fond et cases alignes dans une projection locale applicative, sans reprojection geographique.
- Rendu V0 : interieur des cases transparent et contours noirs visibles.
- L'utilisateur peut afficher ou masquer la couche `cases`.

### Panneau lateral de case

La V0 utilise un panneau lateral plutot qu'une popup. Il affiche uniquement les
informations stables de la couche `cases` :

1. `id_case`
2. `region`
3. `sous_region`
4. `cote`
5. `lac_majeur`
6. `cours_eau_majeur`

Si `region` ou `sous_region` valent `null`, l'interface affiche `Non renseigne`.
Les booleens d'eau sont rendus en `Oui` ou `Non`.

### Filtres et legende

- Pas de filtres dans la V0.
- Pas de legende metier dans la V0.
- Ces elements seront ajoutes plus tard, sans charger de donnees staff dans la vue publique.
- Le fond de carte reste toujours visible dans cette phase.

## Contraintes

- Ne montrer que des informations publiques.
- Garder une interface claire sur desktop et mobile.
- Ne pas charger inutilement les donnees reservees au staff dans la vue publique.
- Ne pas reintroduire de champs metier dans la couche stable servie au navigateur.
- Ne pas projeter le GeoJSON comme s'il etait en longitude/latitude.
- Ne pas utiliser `EPSG:3857` ni un fond cartographique web standard pour cette couche.

## TODO

- Ajouter plus tard les filtres publics utiles.
- Introduire ensuite une legende adaptee aux futures couches metier publiques.
- Conserver un panneau lateral simple tant que la carte reste sur la seule couche stable.
