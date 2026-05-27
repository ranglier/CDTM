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

Le lot 3 :
- retire le bloc explicatif au-dessus de la carte pour les `tech_admin` ;
- ajoute une selection simple de case par clic ;
- affiche seulement l'identifiant de la case selectionnee ;
- n'ajoute pas encore de panneau detail ni d'edition.

Le lot 4 :
- charge les styles publics et les proprietes publiques des cases ;
- affiche l'editeur en mode influence ;
- ajoute le tooltip de survol identique a la carte publique ;
- ne charge toujours aucun objet cartographique ;
- ne permet toujours aucune edition.

Le lot 5 :
- charge les localites depuis `/api/admin/editor/localities` ;
- les affiche en lecture seule au-dessus des cases ;
- ajoute un bouton pour afficher ou masquer les localites ;
- ajoute un hover localite simple ;
- ne permet pas encore de creer, modifier ou deplacer les localites.

Le lot 6 :
- ajoute un mode minimal `Creer une localite` ;
- permet de cliquer sur la carte pour choisir une position ;
- affiche un petit formulaire de creation ;
- envoie un `POST /api/admin/editor/localities` ;
- affiche immediatement la localite creee sur la carte ;
- ne permet toujours pas d'editer, supprimer ou deplacer une localite.

Le lot 7 :
- ajoute la selection de localite ;
- ajoute l'edition simple de nom, type, statut, description ;
- utilise `PATCH /api/admin/editor/localities/[id]` ;
- ne permet pas encore deplacer, supprimer, drag-and-drop ou icones reelles.

Le lot 8 :
- ajoute le deplacement direct des localites par drag-and-drop ;
- sauvegarde uniquement au relachement via `PATCH /api/admin/editor/localities/[id]` ;
- envoie seulement `x`, `y`, `id_case_detected` pour ce deplacement ;
- ne sauvegarde rien pendant le mouvement ;
- restaure la position precedente si la sauvegarde echoue ;
- ne concerne toujours pas landmarks, forces ou routes.

Le lot 9 :
- enrichit les referentiels editeur avec les metadonnees d'icones utiles au rendu ;
- affiche les icones sur les localites quand elles sont disponibles ;
- utilise `icon_key`, puis `default_icon_key` du type, puis un fallback rond ;
- conserve hover, selection, edition et drag ;
- ne permet pas encore de choisir manuellement une icone dans le formulaire.

Le lot 10 :
- conserve `map_landmarks` comme table des landmarks et des lieux uniques ;
- ajoute une categorie `landmark` ou `unique` sur `reference_landmark_types` ;
- prepare le type `lieu_unique` pour des lieux nommes comme Barad-dur ou Fondcombe ;
- ne change pas encore l'affichage OpenLayers ni la creation des landmarks.

Il n'ajoute toujours :
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

Les types de landmarks restent centralises dans `reference_landmark_types`, avec :
- `category = landmark` pour les points remarquables generiques ;
- `category = unique` pour les lieux uniques nommes.

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
