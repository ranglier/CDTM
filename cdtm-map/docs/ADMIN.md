# Admin V1

## Role

L'admin V1 ajoute un acces staff a la carte pour :

- se connecter ;
- consulter et modifier le terrain, le controle et les donnees publiques de case ;
- enregistrer ces donnees en base via `id_case`.

Deux roles existent :

- `staff` : acces au mode admin de la carte et modification des donnees de case ;
- `tech_admin` : tous les droits `staff`, plus l'acces a `/admin/tech`, la gestion des listes techniques, des champs personnalises et des comptes staff.

## Runtime

Variables utilisees :

- `DATABASE_URL`
- `ADMIN_SESSION_TTL_HOURS`

Variables optionnelles pour le bootstrap :

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

Valeur par defaut :

```text
ADMIN_SESSION_TTL_HOURS=168
```

## Bootstrap

Si `ADMIN_USERNAME` et `ADMIN_PASSWORD` sont definis, l'application cree ou met a jour le compte staff correspondant au demarrage.
Ce compte bootstrappe prend automatiquement le role `tech_admin`.

Si ces variables sont absentes :

- aucun compte staff n'est bootstrappe automatiquement ;
- le deploiement standard continue sans erreur.

## Creation manuelle d'un compte admin

Pour creer ou mettre a jour un compte utilisable tout de suite :

```bash
DATABASE_URL=postgresql://... npm run create:admin -- --username superadmin --password '<mot_de_passe>' --role tech_admin
```

La commande :

- cree le compte s'il n'existe pas ;
- met a jour son mot de passe s'il existe deja ;
- peut definir le role `staff` ou `tech_admin` ;
- invalide ses anciennes sessions.

`POSTGRES_PASSWORD` ne doit jamais servir de mot de passe admin applicatif.

## Separation des donnees

- la couche stable reste servie depuis `public/data/cases.geojson`
- les donnees admin sont stockees dans PostgreSQL
- toutes les donnees de case exposees dans l'application sont publiques en lecture
- les champs de notes ne font plus partie du contrat applicatif courant

## Admin technique

L'admin technique sert a maintenir les structures partagees par toutes les cases.

On y trouve notamment :

- `Listes de valeurs` : listes de choix reutilisees dans les formulaires, par exemple les terrains, factions, types de controle ou styles ;
- `Champs personnalises` : categories d'informations supplementaires qui peuvent apparaitre sur toutes les cases ;
- `Comptes staff` : gestion des comptes `staff` et `tech_admin`.

Certaines listes partagees passent techniquement par la meme table `reference_nomenclature_values`, mais l'interface les separe en vues metier distinctes.

Par exemple, l'espace `Listes de valeurs` presente directement des groupes comme :

- `Terrains`
- `Controle`
- `Peuples`
- `Autres listes`

Le groupe fonctionnel `Terrains` rassemble notamment :

- `terrain_cat`
- `terrain_type`
- `relief`

Les reliefs restent donc affiches comme une composante du bloc `Terrains`, meme si les donnees restent stockees dans la table technique commune.

Les couleurs de carte ne sont pas stockees dans les tables metier `factions`, `controleurs` ou `nomenclatures`.

Elles restent dans `reference_styles`, mais l'interface les affiche directement :

- dans `Factions` pour modifier la couleur d'une faction ;
- dans `Controleurs` pour modifier la couleur d'un controleur ;
- dans `Terrains` pour modifier la couleur et les motifs d'un type ou d'un relief.

Pour chaque entree concernee, l'admin technique permet de renseigner :

- la couleur de fond ;
- la couleur de contour ;
- le motif ;
- la couleur du motif ;
- un apercu visuel.

Les categories de terrain n'ont pas de couleur propre.
Les reliefs restent modifies depuis le groupe fonctionnel `Terrains` et servent notamment a definir des hachures ou motifs complementaires.
Les details techniques restent rattaches a `reference_styles`, mais ce n'est plus l'entree principale pour modifier les couleurs.

L'opacite n'est plus reglable.

## Editeur cartographique prevu

Une nouvelle page `/editeur` est prevue pour travailler directement sur la carte.

Objectifs :

- placer librement des localites et landmarks, sans les forcer au centre des cases ;
- tracer et modifier des routes sous forme de lignes libres ;
- afficher et editer des forces ponctuelles comme les armees et flottes ;
- detecter la case sous un point ou les cases traversees par une route ;
- preparer les validations d'emplacements.

L'editeur doit etre protege au minimum par le role `tech_admin` dans sa premiere version.

Les objets ponctuels utiliseront exclusivement des icones Game-icons. Les icones doivent etre gerees dans un catalogue administrable avec :

- cle interne ;
- libelle ;
- URL source ;
- auteur ;
- licence ;
- categorie ;
- statut actif/inactif.

Catalogue initial valide :

| Usage | Icone Game-icons |
| --- | --- |
| Fort | `stone-tower` |
| Ruines | `tower-fall` |
| Ville fortifiee | `castle` |
| Ville non fortifiee | `medieval-village-01` |
| Avant-poste | `watchtower` |
| Port | `anchor` |
| Pont | `stone-bridge` |
| Mine | `bridge` |
| Barad-Dur | `evil-tower` |
| Moria | `arabic-door` |
| Hobbit bourg | `hobbit-dwelling` |
| Hauts-des-Galgals | `tumulus` |
| Armee | `rally-the-troops` |
| Flotte | `caravel` |

Les types d'objets doivent rester separes des icones : un type pointe vers une icone par defaut, mais un objet cartographique peut eventuellement surcharger son icone.

Le type `dependance` doit permettre de representer un lieu dependant d'une cite ou localite voisine.

## Races, peuples et emplacements

Les emplacements doivent etre calcules a partir du sous-type de terrain (`terrain_type`), pas directement depuis la categorie (`terrain_cat`).

Si aucun chiffre n'est defini pour un sous-type, il herite de la valeur de sa categorie parente.

Renommage valide :

- ne plus utiliser `desert_gele` ;
- utiliser `terres_gelees`.

Une table `reference_races` doit regrouper les peuples par grande race :

- `nains`
- `orques`
- `elfes`
- `hommes`
- `hobbits`

Une table `reference_peuples` doit rattacher chaque peuple a une race.

Formule valide :

```text
empl_max = sous_type_terrain + bonus_race + bonus_contextuel
empl_max = min(5, max(1, empl_max))
```

Regles :

- aucune valeur finale ne peut depasser 5 ;
- aucune valeur finale ne peut descendre sous 1 ;
- aucun depassement d'occupation n'est autorise ;
- si les objets occupant une case excedent `empl_max`, la publication doit etre refusee.

## Consultation puis edition

L'admin technique privilegie maintenant la consultation :

- les onglets affichent d'abord des listes compactes ;
- les details techniques restent replies dans des blocs dedies ;
- les formulaires apparaissent seulement apres une action explicite.

Concretement :

- `Listes de valeurs` : selectionne une liste, consulte ses lignes, puis clique sur `Modifier` ou `Ajouter une valeur` ;
- `Champs personnalises` : consulte les categories et leurs champs, puis ouvre `Modifier la presentation` ou `Ajouter une information` si besoin ;
- `Comptes staff` : consulte les comptes, ouvre `Creer un compte` pour en ajouter un, puis `Modifier ce compte` pour changer son role ou son statut.

Dans le panneau de case :

- les champs vides ne sont plus affiches en lecture ;
- les informations sont regroupees par sections ;
- le formulaire complet n'apparait qu'apres clic sur `Modifier`.

Les noms internes sont proposes automatiquement a partir des titres et libelles saisis. En usage normal, il vaut mieux les laisser tels quels et ne les modifier que si tu sais exactement pourquoi.

Exemples :

- `Informations militaires` devient `informations_militaires`
- `Niveau de fortification` devient `niveau_de_fortification`

L'interface affiche parfois ces noms internes pour aider au diagnostic, mais les libelles visibles et les descriptions restent les informations a privilegier pour l'usage courant.

## Limites V1

- pas d'historisation complete
- pas de versioning metier complet
- seulement des tables `*_current`
- edition cartographique encore a implementer
