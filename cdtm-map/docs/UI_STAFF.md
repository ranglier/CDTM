# UI staff

## Objectif

Documenter l'interface reservee au staff et aux administrateurs techniques pour consulter, corriger et enrichir les donnees cartographiques.

## Elements actifs

### Carte staff

- Lecture publique et staff sur la meme carte, avec bascule de mode admin.
- Selection simple ou multiple de cases.
- Edition staff des champs de case prevus par le modele actif.

### Administration technique

- Gestion des referentiels globaux.
- Gestion des tables metier dynamiques.
- Gestion des comptes `staff` et `tech_admin`.

### Editeur cartographique

- Carte OpenLayers reservee aux `tech_admin`.
- Gestion progressive des objets cartographiques :
  - localites
  - landmarks
  - lieux uniques
- Creation, selection, edition et deplacement des points deja pris en charge selon les lots implementes.

### Separation des donnees

- Les routes publiques ne doivent jamais exposer les champs reserves au staff.
- Les routes admin doivent rester protegees par session.
- Les donnees de reference et d'edition doivent rester separees du mode public quand elles ne sont pas utiles au rendu visiteur.

## Evolutions prevues

- Etendre l'editeur aux forces puis aux routes.
- Continuer a simplifier les outils staff sans reintroduire de donnees obsoletes comme les notes internes.
