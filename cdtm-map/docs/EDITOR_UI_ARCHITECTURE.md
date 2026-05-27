# Editor UI Architecture

## Etat actuel

L'interface cartographique de `/editeur` est en reconstruction progressive.

Le lot 1 reintroduit seulement :
- un noyau OpenLayers commun avec la carte publique ;
- le fond de carte dans `/editeur`.

Le lot 2 ajoute ensuite :
- le chargement de `cases.geojson` dans l'editeur ;
- la couche des cases en lecture seule ;
- un bouton simple pour afficher ou masquer les cases.

Il n'ajoute toujours :
- aucune selection de case ;
- aucune localite ;
- aucun landmark ;
- aucune force.

## Ce qui reste en place

Les fondations serveur et donnees sont conservees :
- `src/editor/types.ts`
- `src/server/editor-repository.ts`
- `/api/admin/editor/reference-data`
- `/api/admin/editor/localities`
- `/api/admin/editor/landmarks`
- `/api/admin/editor/forces`

Le modele reste separe par famille d'objets :
- `map_localities`
- `map_landmarks`
- `map_forces`
- `map_routes` plus tard

Les statuts restent :
- `draft`
- `published`
- `archived`

## Intention pour la reconstruction

L'editeur UI devra etre reconstruit a partir de zero, par petits lots valides
en conditions reelles.

Principes gardes pour la suite :
- ne pas reintroduire un modele generique `map_points`
- ne pas coupler fortement l'editeur a `TechnicalAdminPage`
- repartir d'une UI minimale avant de remettre une carte OpenLayers
- rebrancher les couches cartographiques seulement quand le cycle de vie OpenLayers
  est stable et verifie

## Priorites de reprise

1. ecran d'accueil editeur simple et stable
2. retour d'un canevas cartographique minimal
3. lecture seule des localites
4. creation et edition progressive des objets
5. landmarks, forces, puis routes
