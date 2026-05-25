# Admin Architecture

## Objectif

L'administration technique est volontairement separee en blocs simples :
- navigation laterale
- listes de valeurs
- champs personnalises
- comptes staff

Le panneau lateral sert uniquement a naviguer. Les actions de creation, edition et suppression restent dans le panneau principal.

## Composants

Les composants techniques de l'administration sont regroupes sous `src/components/admin/tech/` :

- `collapsible-sidebar-section.tsx`
  - bloc repliable reutilisable pour la navigation laterale
- `tech-admin-sidebar.tsx`
  - compose le panneau lateral a partir des categories et entrees actives
- `reference-admin-panel.tsx`
  - gere l'affichage et l'edition des listes de valeurs
- `reference-field-editor.tsx`
  - rendu des champs de formulaires des referentiels
- `style-preview.tsx`
  - apercu compact des styles cartographiques
- `image-preview.tsx`
  - apercu des icones importees
- `reference-utils.ts`
  - helpers purs pour auto-remplissage, payloads, resumes et styles
- `types.ts`
  - types UI locaux a cette zone

Le composant `technical-admin-page.tsx` reste le point d'orchestration :
- chargement des donnees
- gestion des etats React
- branchement des callbacks
- composition des panneaux

## Regles de structure

- Les helpers purs doivent rester hors du composant principal.
- Les composants de rendu ne doivent pas porter la logique API.
- Les vues `referentiels`, `schema` et `comptes` partagent le meme shell visuel.
- Les categories laterales memorisent leur etat ouvert/ferme cote client.

## Emplacements de case

`case_emplacements_current` reste une table metier liee aux cases.

Elle ne fait pas partie du modele des objets cartographiques libres :
- ce n'est pas `map_localities`
- ce n'est pas `map_landmarks`
- ce n'est pas `map_forces`
- ce n'est pas `map_routes`

Son role actuel est de porter des attributs metier de case. Les futurs besoins d'edition cartographique ne doivent pas la reutiliser comme substitut aux objets de carte.
