# Editor API

## Role requis

Toutes les routes d'edition cartographique sont reservees a `tech_admin`.

## Fond de carte

### `GET /api/map/background`

Retourne le manifeste public du fond actif. Si aucun fond uploade pret n'est
actif, la route retourne le fond par defaut et ses tuiles generees au build.

### `GET /uploads/map-backgrounds/[id]/tiles/[z]/[x]/[y].webp`

Retourne une tuile WebP issue d'un fond uploade. Les reponses sont cachees
longuement car l'identifiant du fond est immuable.

### `GET /api/admin/tech/map-backgrounds`

Retourne l'historique admin des fonds importes.

### `POST /api/admin/tech/map-backgrounds`

Upload multipart reserve a `tech_admin`. Le champ `file` est obligatoire et le
champ `label` est optionnel. Le serveur valide le fichier, genere les tuiles,
puis active le fond uniquement si la generation est complete.

### `PATCH /api/admin/tech/map-backgrounds/[id]`

Reactive un fond existant uniquement si son statut est `ready` et si toutes ses
tuiles sont presentes.

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
  "force_slot_override": false,
  "description": "Port fluvial"
}
```

`depends_on_locality_id` est un lien optionnel entre instances de localites dans l'editeur.
Il ne definit pas les chaines d'amelioration V1. Les chaines d'amelioration sont portees par `upgrades_from_type_id` dans `reference_locality_types`.
Lorsqu'une localite active reference explicitement une localite qu'elle ameliore, l'ancienne localite n'est plus comptee dans les emplacements consommes.
L'API verifie que le type de la dependance correspond a `upgrades_from_type_id`, que la dependance n'est pas archivee, et que l'amelioration reste sur la meme case.

Si le type consomme des emplacements, l'API refuse par defaut une creation qui depasse la capacite calculee de la case.
Le champ optionnel `force_slot_override: true` autorise le forcage admin.
`slot_override_reason` peut etre fourni avec le forcage, mais il reste informatif en V1.

### `GET /api/admin/editor/localities/[id]`

### `PATCH /api/admin/editor/localities/[id]`

### `DELETE /api/admin/editor/localities/[id]`

`PATCH` accepte un objet partiel.

Contraintes :

- l'identifiant ne peut pas etre modifie ;
- `PATCH {}` est invalide ;
- seuls les champs fournis sont modifies ;
- une chaine vide sur un champ nullable devient `null`.
- `x` et `y`, s'ils sont fournis, doivent etre des nombres finis ;
- `null`, `""` et les chaines blanches sont refuses pour `x` / `y` ;
- `status`, s'il est fourni, doit etre strictement `draft`, `published` ou `archived` ;
- `force_slot_override`, s'il vaut `true`, autorise un depassement d'emplacements ;
- `slot_override_reason` est accepte avec le forcage, sans stockage dedie en V1 ;
- `depends_on_locality_id`, s'il est fourni, doit pointer vers une localite du type attendu par `upgrades_from_type_id`.

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
Les landmarks dont le type consomme des emplacements suivent la meme validation et le meme forcage admin.

`PATCH` suit les memes regles : objet partiel, id non modifiable, body vide refuse.

## Forces

### `GET /api/admin/editor/forces`

### `POST /api/admin/editor/forces`

### `GET /api/admin/editor/forces/[id]`

### `PATCH /api/admin/editor/forces/[id]`

### `DELETE /api/admin/editor/forces/[id]`

Les champs suivent le modele des localites sans `depends_on_locality_id`.
Les forces ne consomment pas d'emplacements en V1.

`PATCH` suit les memes regles : objet partiel, id non modifiable, body vide refuse.

## Routes

### `GET /api/admin/editor/routes`

Filtres supportes :

- `status`
- `type_key` utilise comme alias de `route_type`
- `faction`
- `controleur`
- `search`
- `limit`

### `POST /api/admin/editor/routes`

Payload minimal :

```json
{
  "name": "Route de la Foret Noire",
  "route_type": "route_terrestre",
  "points": [
    [1200, 800],
    [1400, 920]
  ],
  "geometry_mode": "curved",
  "stroke_style": "solid",
  "stroke_width": 3,
  "stroke_color": "#d7b35f",
  "faction": null,
  "controleur": null,
  "status": "draft",
  "description": "Axe principal"
}
```

### `GET /api/admin/editor/routes/[id]`

### `PATCH /api/admin/editor/routes/[id]`

### `DELETE /api/admin/editor/routes/[id]`

`PATCH` accepte un objet partiel.

Contraintes :

- l'identifiant ne peut pas etre modifie ;
- `PATCH {}` est invalide ;
- `points`, s'ils sont fournis, doivent contenir au moins deux couples `[x, y]` finis ;
- `geometry_mode` accepte `straight` ou `curved` ;
- `stroke_style` accepte `solid`, `dashed` ou `dotted` ;
- `stroke_width` doit rester entre `1` et `12` ;
- `stroke_color` accepte `#rgb`, `#rrggbb` ou `""` pour revenir a `null`.

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
Si un SVG valide ne s'affiche pas, verifier la CSP retournee par la route de fichier dans la console navigateur.
