# Admin V1

## Role

L'admin V1 ajoute un acces staff a la carte pour :

- se connecter ;
- consulter et modifier `notes`, `terrain` et `controle` ;
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
- `note_publique` peut etre exposee publiquement
- `note_staff` reste reservee aux routes admin

## Admin technique

L'admin technique sert a maintenir les structures partagees par toutes les cases.

On y trouve deux espaces :

- `Listes de valeurs` : listes de choix reutilisees dans les formulaires, par exemple les terrains, factions, types de controle ou styles ;
- `Champs personnalises` : categories d'informations supplementaires qui peuvent apparaitre sur toutes les cases.

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

Une section `Comptes staff` permet aussi de :

- lister les comptes existants ;
- creer un compte `staff` ou `tech_admin` ;
- changer le role d'un compte ;
- desactiver un compte sans le supprimer.

Un compte `staff` connecte ne voit pas le lien `Technique` et ne peut pas ouvrir `/admin/tech`.

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

- pas d'historisation
- pas de versioning metier
- seulement des tables `*_current`
- pas d'edition des geometries
