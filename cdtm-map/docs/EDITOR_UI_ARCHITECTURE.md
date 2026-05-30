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
- enrichit `reference-data` avec les metadonnees d'icones utiles aux localites ;
- affiche une icone si `icon_key` est defini sur la localite ;
- sinon utilise `default_icon_key` du type de localite si disponible ;
- sinon garde le fallback rond actuel ;
- conserve hover, selection, edition et drag des localites ;
- ne traite toujours pas landmarks, uniques ou forces.

Le rendu actuel des localites ajoute aussi :
- un mode `Icones` / `Points` dans l'editeur ;
- des SVG qui remplacent les points en mode icones ;
- une taille d'icone liee au zoom, plus grande de pres et reduite au dezoom ;
- la suppression du diagnostic d'icone dans l'UI.

Le lot courant ajoute :
- la lecture seule des landmarks au-dessus des cases et des localites ;
- une creation unifiee `Creer un point` avec trois familles :
  - `Localite`
  - `Landmark`
  - `Lieu unique`
- le stockage des lieux uniques dans `map_landmarks` avec `type_key = 'lieu_unique'` ;
- un champ `category` reserve a `reference_landmark_types` pour distinguer `landmark` et `unique` ;
- l'utilisation de l'icone du type par defaut pour les localites et landmarks ;
- un choix manuel d'icone pour les lieux uniques ;
- une couche OpenLayers unifiee pour `localites` et `landmarks` ;
- la possibilite de surcharger l'icone d'une localite, tout en gardant par defaut l'icone de son type.

Le lot routes 1 ajoute :
- le chargement de `/api/admin/editor/routes` dans l'editeur ;
- une couche OpenLayers lecture seule dediee aux routes, placee sous les points ;
- le rendu `straight` ou `curved` a partir des points de controle ;
- les styles `solid`, `dashed`, `dotted` ;
- un bouton pour afficher ou masquer les routes ;
- un hover route prioritaire sur les cases mais sous les points ;
- aucune creation ou edition interactive de route dans l'UI a ce stade.

Le lot ne fait toujours pas :
- de gestion des forces ;
- de creation interactive de routes ;
- d'edition de sommets de routes.

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
- `map_routes`

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
- garder des tables et APIs separees par famille, meme si l'affichage OpenLayers mutualise la couche des points

## Priorites de reprise

1. ecran d'accueil editeur simple et stable
2. retour d'un canevas cartographique minimal
3. lecture seule des localites
4. creation et edition progressive des objets
5. landmarks, forces, puis creation/edition des routes
