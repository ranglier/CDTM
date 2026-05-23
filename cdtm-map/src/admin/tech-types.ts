export type TechFieldType = "text" | "textarea" | "boolean" | "integer" | "datetime";

export type TechFieldDefinition = {
  name: string;
  label: string;
  type: TechFieldType;
  required?: boolean;
  readOnly?: boolean;
  searchable?: boolean;
};

export type TechTableKey =
  | "case_notes_current"
  | "case_terrain_current"
  | "case_control_current"
  | "case_emplacements_current"
  | "localites"
  | "historique_controle";

export type TechTableDefinition = {
  key: TechTableKey;
  logical_name: string;
  physical_name: string;
  title: string;
  description: string;
  primary_key: string;
  auto_primary_key?: boolean;
  fields: TechFieldDefinition[];
};

export type TechTableStatus = {
  definition: TechTableDefinition;
  row_count: number;
};

export type TechTableRowValue = string | number | boolean | null;

export type TechTableRow = Record<string, TechTableRowValue>;

export type TechTableRowsResponse = {
  definition: TechTableDefinition;
  rows: TechTableRow[];
  total_count: number;
  returned_count: number;
  search: string;
};

export const techTableDefinitions: TechTableDefinition[] = [
  {
    key: "case_notes_current",
    logical_name: "case_notes",
    physical_name: "case_notes_current",
    title: "Notes de case",
    description: "Etat courant des notes publiques et staff par case.",
    primary_key: "id_case",
    fields: [
      { name: "id_case", label: "id_case", type: "text", required: true, searchable: true },
      { name: "note_publique", label: "note_publique", type: "textarea", searchable: true },
      { name: "note_staff", label: "note_staff", type: "textarea", searchable: true },
      { name: "updated_by_user_id", label: "updated_by_user_id", type: "integer", readOnly: true },
      { name: "created_at", label: "created_at", type: "datetime", readOnly: true },
      { name: "updated_at", label: "updated_at", type: "datetime", readOnly: true },
    ],
  },
  {
    key: "case_terrain_current",
    logical_name: "case_terrain",
    physical_name: "case_terrain_current",
    title: "Terrain de case",
    description: "Etat courant des champs de terrain relies aux cases.",
    primary_key: "id_case",
    fields: [
      { name: "id_case", label: "id_case", type: "text", required: true, searchable: true },
      { name: "terrain_cat", label: "terrain_cat", type: "text", searchable: true },
      { name: "terrain_type", label: "terrain_type", type: "text", searchable: true },
      { name: "relief", label: "relief", type: "text", searchable: true },
      { name: "updated_by_user_id", label: "updated_by_user_id", type: "integer", readOnly: true },
      { name: "created_at", label: "created_at", type: "datetime", readOnly: true },
      { name: "updated_at", label: "updated_at", type: "datetime", readOnly: true },
    ],
  },
  {
    key: "case_control_current",
    logical_name: "case_controle",
    physical_name: "case_control_current",
    title: "Controle de case",
    description: "Etat courant du controle politique ou militaire des cases.",
    primary_key: "id_case",
    fields: [
      { name: "id_case", label: "id_case", type: "text", required: true, searchable: true },
      { name: "faction", label: "faction", type: "text", searchable: true },
      { name: "controleur", label: "controleur", type: "text", searchable: true },
      { name: "controle_type", label: "controle_type", type: "text", searchable: true },
      { name: "updated_by_user_id", label: "updated_by_user_id", type: "integer", readOnly: true },
      { name: "created_at", label: "created_at", type: "datetime", readOnly: true },
      { name: "updated_at", label: "updated_at", type: "datetime", readOnly: true },
    ],
  },
  {
    key: "case_emplacements_current",
    logical_name: "case_emplacements",
    physical_name: "case_emplacements_current",
    title: "Emplacements de case",
    description: "Calculs et validations d'emplacements associes aux cases.",
    primary_key: "id_case",
    fields: [
      { name: "id_case", label: "id_case", type: "text", required: true, searchable: true },
      { name: "peuple_majoritaire", label: "peuple_majoritaire", type: "text", searchable: true },
      { name: "bonus_speciaux", label: "bonus_speciaux", type: "textarea", searchable: true },
      { name: "empl_base", label: "empl_base", type: "integer" },
      { name: "empl_max", label: "empl_max", type: "integer" },
      { name: "regle_version", label: "regle_version", type: "text", searchable: true },
      { name: "calcule_le", label: "calcule_le", type: "datetime" },
      { name: "valide_par", label: "valide_par", type: "text", searchable: true },
      { name: "updated_by_user_id", label: "updated_by_user_id", type: "integer", readOnly: true },
      { name: "created_at", label: "created_at", type: "datetime", readOnly: true },
      { name: "updated_at", label: "updated_at", type: "datetime", readOnly: true },
    ],
  },
  {
    key: "localites",
    logical_name: "localites",
    physical_name: "localites",
    title: "Localites",
    description: "Villes, forts, ports, domaines, ruines et autres points d'interet.",
    primary_key: "id_localite",
    fields: [
      { name: "id_localite", label: "id_localite", type: "text", required: true, searchable: true },
      { name: "id_case", label: "id_case", type: "text", required: true, searchable: true },
      { name: "nom", label: "nom", type: "text", searchable: true },
      { name: "niveau", label: "niveau", type: "text", searchable: true },
      { name: "type", label: "type", type: "text", searchable: true },
      { name: "empl", label: "empl", type: "integer" },
      { name: "visibilite", label: "visibilite", type: "text", searchable: true },
      { name: "note_publique", label: "note_publique", type: "textarea", searchable: true },
      { name: "note_staff", label: "note_staff", type: "textarea", searchable: true },
      { name: "updated_by_user_id", label: "updated_by_user_id", type: "integer", readOnly: true },
      { name: "created_at", label: "created_at", type: "datetime", readOnly: true },
      { name: "updated_at", label: "updated_at", type: "datetime", readOnly: true },
    ],
  },
  {
    key: "historique_controle",
    logical_name: "historique_controle",
    physical_name: "historique_controle",
    title: "Historique du controle",
    description: "Evenements de changement de controle des cases.",
    primary_key: "id_evenement",
    auto_primary_key: true,
    fields: [
      { name: "id_evenement", label: "id_evenement", type: "integer", readOnly: true, searchable: true },
      { name: "id_case", label: "id_case", type: "text", required: true, searchable: true },
      { name: "date_label", label: "date_label", type: "text", searchable: true },
      { name: "ancien_controleur", label: "ancien_controleur", type: "text", searchable: true },
      { name: "nouveau_controleur", label: "nouveau_controleur", type: "text", searchable: true },
      { name: "note", label: "note", type: "textarea", searchable: true },
      { name: "updated_by_user_id", label: "updated_by_user_id", type: "integer", readOnly: true },
      { name: "created_at", label: "created_at", type: "datetime", readOnly: true },
      { name: "updated_at", label: "updated_at", type: "datetime", readOnly: true },
    ],
  },
];

export function getTechTableDefinition(key: string): TechTableDefinition | null {
  return techTableDefinitions.find((definition) => definition.key === key) ?? null;
}
