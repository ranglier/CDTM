# Audit et feuille de route cdtm-map

## Perimetre

Audit documentaire et technique du sous-projet `cdtm-map`.

Le depot GitHub public est traite comme miroir de consultation. Le README racine indique que le depot prive Forgejo reste la source de verite de travail. Toute modification faite cote GitHub doit donc etre reprise ou synchronisee cote Forgejo avant d'etre consideree definitive.

## Etat constate

L'application contient aujourd'hui :

- une application `Next.js` / `React` / `TypeScript` ;
- une carte publique `OpenLayers` ;
- une couche stable `public/data/cases.geojson` ;
- une base `PostgreSQL` / `PostGIS` pour les donnees staff ;
- une authentification staff par sessions persistantes en base ;
- une admin V1 pour consulter et modifier les cases ;
- une edition de masse pour les champs principaux ;
- des referentiels globaux modifiables depuis l'admin technique ;
- des tables metier dynamiques rattachees aux cases ;
- une CI Forgejo avec validation des donnees, lint, typecheck et build ;
- un deploiement Docker Compose vers `osgiliath`.

## Points solides

- La couche stable reste separee des donnees staff.
- Les champs metier sensibles ne sont pas attendus dans le GeoJSON public.
- Les routes admin verifient l'existence de la base et l'authentification staff.
- Les mots de passe staff sont derives avec un sel et les sessions sont stockees sous forme de hash.
- Les operations d'ecriture importantes utilisent des transactions.
- Les identifiants SQL dynamiques sont limites a un format `snake_case` simple avant d'etre injectes comme identifiants.
- Le deploiement ne depend plus de variables `ADMIN_*` obligatoires.
- Le conteneur applicatif tourne avec un utilisateur non-root.

## Risques prioritaires

### P0 - Healthcheck incomplet

`/api/health` indique seulement que l'application repond et que `DATABASE_URL` existe. Il ne prouve pas que PostgreSQL est joignable ni que le schema admin est pret.

Action recommandee : ajouter un test de readiness base, par exemple une route interne ou un mode etendu executant une requete legere `SELECT 1` apres initialisation.

### P0 - Migrations absentes

Le schema est cree et complete au runtime applicatif. C'est pratique en V1, mais fragile quand le modele evolue.

Actions recommandees :

- introduire une table de version de schema ;
- extraire les changements SQL dans des migrations idempotentes ;
- documenter la procedure de rollback ;
- tester les migrations sur une copie de base avant production.

### P0 - Droits admin non separes

Un compte staff donne acces a l'admin fonctionnelle et a l'admin technique. L'admin technique peut creer des tables et ajouter des colonnes.

Actions recommandees :

- separer au minimum les roles `staff` et `tech_admin` ;
- limiter les routes de creation de tables/champs au role technique ;
- ajouter une confirmation explicite cote UI pour les operations structurelles ;
- journaliser les changements de schema.

### P1 - Validation des doublons de cases

La validation des `id_case` doit garantir l'unicite globale. Le script de validation doit conserver un registre commun quand plusieurs fichiers de cases sont valides ensemble.

Action recommandee : deplacer le `Set` des identifiants vus au niveau global de la validation.

### P1 - Tests automatises insuffisants

La CI execute validation de donnees, lint, typecheck et build. Il manque encore des tests unitaires ou d'integration pour les validations, les repositories et les routes API.

Actions recommandees :

- ajouter des tests sur `admin-validation` ;
- ajouter des tests sur `validate-data.mjs` ;
- tester les regles `terrain_cat` / `terrain_type` ;
- tester les routes publiques sans base configuree ;
- tester les routes admin sans session, avec session invalide et avec session valide.

### P1 - Sauvegardes et exports non documentes

Le volume PostgreSQL est persistant, mais la politique de sauvegarde, restauration et export n'est pas encore documentee.

Actions recommandees :

- documenter un dump `pg_dump` ;
- documenter une restauration de test ;
- prevoir un export public des donnees publiables ;
- exclure explicitement les donnees staff des exports publics.

### P1 - Gestion d'erreurs publique incomplete

Certaines routes publiques ont une gestion d'erreur minimale. L'objectif est d'eviter les reponses incoherentes et de conserver un contrat API stable.

Action recommandee : uniformiser les reponses d'erreur publiques et admin.

### P2 - Page principale trop chargee

La page principale porte beaucoup de logique : selection, session admin, drafts, edition de masse, chargement et sauvegarde.

Actions recommandees :

- extraire des hooks dedies ;
- isoler la logique de draft admin ;
- isoler la logique de selection de cases ;
- reduire le couplage entre carte, panel et persistence.

### P2 - Nomenclatures et styles carte

Les referentiels existent, mais les styles metier ne semblent pas encore pleinement relies a l'affichage cartographique.

Actions recommandees :

- definir la priorite de style : selection, faction, controle, terrain ;
- connecter `reference_styles` a la couche carte ;
- documenter les styles par defaut et les cas sans style.

## Proposition de prochain lot

Ordre conseille :

1. renforcer le healthcheck avec un vrai test base ;
2. corriger la validation globale des doublons `id_case` ;
3. ajouter une premiere suite de tests sur validation et API ;
4. documenter sauvegarde/restauration PostgreSQL ;
5. introduire une separation de roles avant de pousser plus loin l'admin technique ;
6. extraire progressivement la logique de `page.tsx` en hooks et modules testables.

## Questions ouvertes

- Veut-on que l'admin technique reste dans la meme interface que l'admin fonctionnelle ?
- Les tables dynamiques doivent-elles etre considerees comme schema durable ou comme experimentation V1 ?
- Quelle est la strategie cible pour publier les donnees publiques : lecture directe DB, export statique, ou les deux ?
- Faut-il conserver GitHub comme simple miroir ou y ouvrir aussi les PR documentaires avant synchronisation Forgejo ?
