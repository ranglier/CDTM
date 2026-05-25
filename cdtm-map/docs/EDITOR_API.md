# Editor API

## Role requis

Toutes les routes d'edition cartographique sont reservees a `tech_admin`.

## Referentiels

### `GET /api/admin/editor/reference-data`

Retourne :

- `locality_types`
- `landmark_types`
- `force_types`
- `map_icons`
- `factions`
- `controleurs`

Chaque option suit la forme :

```json
{ "value": "cle", "label": "Libelle" }
```

## Localites

### `GET /api/admin/editor/localities`

Filtres supportes :

- `status`
- `type_key`
- `faction`
- `controleur`
- `search`
- `limit`

### `POST /api/admin/editor/localities`

`POST` attend un objet complet minimal.

Payload :

```json
{
  "name": "Esgaroth",
  "type_key": "ville_non_fortifiee",
  "icon_key": null,
  "x": 1200,
  "y": 800,
  "id_case_detected": "case_0420",
  "faction": "hommes_libres",
  "controleur": null,
  "status": "draft",
  "depends_on_locality_id": null,
  "description": "Port fluvial"
}
```

### `GET /api/admin/editor/localities/[id]`
### `PATCH /api/admin/editor/localities/[id]`
### `DELETE /api/admin/editor/localities/[id]`

`PATCH` accepte un objet partiel.

Contraintes :
- l'identifiant ne peut pas etre modifie ;
- `PATCH {}` est invalide ;
- seuls les champs fournis sont modifies ;
- une chaine vide sur un champ nullable devient `null`.

Exemples :

Deplacement :

```json
{
  "x": 1234.5,
  "y": 6789.5,
  "id_case_detected": "case_0012"
}
```

Publication :

```json
{
  "status": "published"
}
```

Changement de description :

```json
{
  "description": "Capitale fortifiee"
}
```

Retrait d'icone :

```json
{
  "icon_key": ""
}
```

## Landmarks

### `GET /api/admin/editor/landmarks`
### `POST /api/admin/editor/landmarks`
### `GET /api/admin/editor/landmarks/[id]`
### `PATCH /api/admin/editor/landmarks/[id]`
### `DELETE /api/admin/editor/landmarks/[id]`

Les champs suivent le modele des localites sans `depends_on_locality_id`.

`PATCH` suit les memes regles : objet partiel, id non modifiable, body vide refuse.

## Forces

### `GET /api/admin/editor/forces`
### `POST /api/admin/editor/forces`
### `GET /api/admin/editor/forces/[id]`
### `PATCH /api/admin/editor/forces/[id]`
### `DELETE /api/admin/editor/forces/[id]`

Les champs suivent le modele des localites sans `depends_on_locality_id`.

`PATCH` suit les memes regles : objet partiel, id non modifiable, body vide refuse.

## Statuts

Les objets cartographiques utilisent uniquement :

- `draft`
- `published`
- `archived`

## Uploads d'icones

Les icones de carte acceptent :

- `image/png`
- `image/webp`
- `image/svg+xml`

Le SVG reste autorise, mais il est valide defensivement cote serveur avant sauvegarde.

Les SVG sont servis via une route applicative avec headers defensifs :
- `Content-Type: image/svg+xml; charset=utf-8`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Content-Security-Policy` restrictive

Les SVG contenant scripts, evenements inline, liens externes, `foreignObject`, `DOCTYPE` ou `ENTITY` sont refuses.
