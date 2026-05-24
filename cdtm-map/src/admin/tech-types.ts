import type { AdminRole } from "@/admin/roles";

export type TechFieldType =
  | "text"
  | "textarea"
  | "boolean"
  | "integer"
  | "number"
  | "datetime"
  | "reference";

export type TechFieldDefinition = {
  name: string;
  label: string;
  type: TechFieldType;
  required?: boolean;
  readOnly?: boolean;
  searchable?: boolean;
  reference_table_key?: ReferenceTableKey;
  reference_group_key?: string | null;
};

export type ReferenceOption = {
  value: string;
  label: string;
};

export type ReferenceTableKey =
  | "nomenclatures"
  | "factions"
  | "controleurs"
  | "styles"
  | "emplacements_rules";

export type ReferenceTableDefinition = {
  key: ReferenceTableKey;
  title: string;
  description: string;
  physical_name: string;
  primary_key: string;
  fields: TechFieldDefinition[];
};

export type ReferenceTableRowValue = string | number | boolean | null;
export type ReferenceTableRow = Record<string, ReferenceTableRowValue>;

export type ReferenceTableStatus = {
  definition: ReferenceTableDefinition;
  row_count: number;
  group_counts?: Array<{
    group_key: string;
    row_count: number;
  }>;
};

export type ReferenceTableRowsResponse = {
  definition: ReferenceTableDefinition;
  rows: ReferenceTableRow[];
  total_count: number;
  returned_count: number;
  search: string;
};

export type DynamicCaseTableFieldType =
  | "text"
  | "textarea"
  | "boolean"
  | "integer"
  | "datetime"
  | "reference";

export type DynamicCaseTableFieldDefinition = {
  field_key: string;
  label: string;
  field_type: DynamicCaseTableFieldType;
  reference_table_key: ReferenceTableKey | null;
  reference_group_key: string | null;
  sort_order: number;
};

export type DynamicCaseTableDefinition = {
  table_key: string;
  physical_name: string;
  title: string;
  description: string | null;
  is_active: boolean;
  fields: DynamicCaseTableFieldDefinition[];
};

export type DynamicCaseTableSummary = {
  table_key: string;
  physical_name: string;
  title: string;
  description: string | null;
  is_active: boolean;
  field_count: number;
};

export type DynamicCaseTableCreateInput = {
  table_key: string;
  title: string;
  description: string;
};

export type DynamicCaseTableUpdateInput = {
  title?: string;
  description?: string | null;
  is_active?: boolean;
};

export type DynamicCaseTableFieldCreateInput = {
  field_key: string;
  label: string;
  field_type: DynamicCaseTableFieldType;
  reference_table_key?: ReferenceTableKey | null;
  reference_group_key?: string | null;
};

export type DynamicCaseTableCreateResult = {
  definition: DynamicCaseTableDefinition;
  provisioned_case_rows: number;
};

export type DynamicCaseTableFieldCreateResult = {
  definition: DynamicCaseTableDefinition;
  added_field: DynamicCaseTableFieldDefinition;
};

export type StaffAccountSummary = {
  id: number;
  username: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
};

export type StaffAccountCreateInput = {
  username: string;
  password: string;
  role: AdminRole;
};

export type StaffAccountUpdateInput = {
  role?: AdminRole;
  is_active?: boolean;
  password?: string;
};

export const referenceTableDefinitions: ReferenceTableDefinition[] = [
  {
    key: "nomenclatures",
    title: "Listes generales",
    description: "Listes de choix communes, y compris les familles de valeurs organisees.",
    physical_name: "reference_nomenclature_values",
    primary_key: "id_entry",
    fields: [
      { name: "id_entry", label: "id_entry", type: "text", required: true, searchable: true },
      { name: "group_key", label: "group_key", type: "text", required: true, searchable: true },
      { name: "entry_key", label: "entry_key", type: "text", required: true, searchable: true },
      { name: "label", label: "label", type: "text", searchable: true },
      { name: "parent_entry_key", label: "parent_entry_key", type: "text", searchable: true },
      { name: "sort_order", label: "sort_order", type: "integer" },
      { name: "updated_by_user_id", label: "updated_by_user_id", type: "integer", readOnly: true },
      { name: "created_at", label: "created_at", type: "datetime", readOnly: true },
      { name: "updated_at", label: "updated_at", type: "datetime", readOnly: true },
    ],
  },
  {
    key: "factions",
    title: "Factions",
    description: "Liste des factions proposees dans les formulaires.",
    physical_name: "reference_factions",
    primary_key: "id_faction",
    fields: [
      { name: "id_faction", label: "id_faction", type: "text", required: true, searchable: true },
      { name: "nom", label: "nom", type: "text", searchable: true },
      { name: "description_courte", label: "description_courte", type: "textarea", searchable: true },
      { name: "statut", label: "statut", type: "text", searchable: true },
      { name: "updated_by_user_id", label: "updated_by_user_id", type: "integer", readOnly: true },
      { name: "created_at", label: "created_at", type: "datetime", readOnly: true },
      { name: "updated_at", label: "updated_at", type: "datetime", readOnly: true },
    ],
  },
  {
    key: "controleurs",
    title: "Controleurs",
    description: "Liste des entites ou personnages pouvant controler une case.",
    physical_name: "reference_controleurs",
    primary_key: "id_controleur",
    fields: [
      { name: "id_controleur", label: "id_controleur", type: "text", required: true, searchable: true },
      { name: "nom", label: "nom", type: "text", searchable: true },
      { name: "pnj", label: "pnj", type: "boolean" },
      { name: "updated_by_user_id", label: "updated_by_user_id", type: "integer", readOnly: true },
      { name: "created_at", label: "created_at", type: "datetime", readOnly: true },
      { name: "updated_at", label: "updated_at", type: "datetime", readOnly: true },
    ],
  },
  {
    key: "styles",
    title: "Styles",
    description: "Liste des styles reutilisables pour l'affichage cartographique.",
    physical_name: "reference_styles",
    primary_key: "id_style",
    fields: [
      { name: "id_style", label: "id_style", type: "text", required: true, searchable: true },
      { name: "cible_type", label: "cible_type", type: "text", searchable: true },
      { name: "cible_id", label: "cible_id", type: "text", searchable: true },
      { name: "fill", label: "fill", type: "text", searchable: true },
      { name: "stroke", label: "stroke", type: "text", searchable: true },
      { name: "opacity", label: "opacity", type: "number" },
      { name: "updated_by_user_id", label: "updated_by_user_id", type: "integer", readOnly: true },
      { name: "created_at", label: "created_at", type: "datetime", readOnly: true },
      { name: "updated_at", label: "updated_at", type: "datetime", readOnly: true },
    ],
  },
  {
    key: "emplacements_rules",
    title: "Regles d'emplacements",
    description: "Parametres communs utilises pour les calculs et validations d'emplacements.",
    physical_name: "reference_emplacements_rules",
    primary_key: "rule_key",
    fields: [
      { name: "rule_key", label: "rule_key", type: "text", required: true, searchable: true },
      { name: "rule_label", label: "rule_label", type: "text", searchable: true },
      { name: "value_text", label: "value_text", type: "textarea", searchable: true },
      { name: "value_integer", label: "value_integer", type: "integer" },
      { name: "description", label: "description", type: "textarea", searchable: true },
      { name: "updated_by_user_id", label: "updated_by_user_id", type: "integer", readOnly: true },
      { name: "created_at", label: "created_at", type: "datetime", readOnly: true },
      { name: "updated_at", label: "updated_at", type: "datetime", readOnly: true },
    ],
  },
];

export function getReferenceTableDefinition(key: string): ReferenceTableDefinition | null {
  return referenceTableDefinitions.find((definition) => definition.key === key) ?? null;
}
