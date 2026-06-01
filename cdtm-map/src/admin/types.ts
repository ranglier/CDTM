import type {
  DynamicCaseTableFieldDefinition,
  ReferenceOption,
} from "@/admin/tech-types";
import type { AdminRole } from "@/admin/roles";
import type { PublicMapStyles } from "@/map/types";
import type { SlotCalculationResult } from "@/map/rules";

export type PublicCaseProperties = {
  registry_id_case: string;
  id_case: string;
  region: string | null;
  sous_region: string | null;
  cote: boolean | null;
  lac: boolean | null;
  fluvial: boolean | null;
  terrain_cat: string | null;
  terrain_type: string | null;
  colline: boolean | null;
  relief: string | null;
  peuple: string | null;
  faction: string | null;
  controleur: string | null;
  controle_type: string | null;
  controle_principal_type: string | null;
  controle_principal_id: string | null;
  controle_secondaire_type: string | null;
  controle_secondaire_id: string | null;
};

export type PublicCaseIndexResponse = {
  cases: PublicCaseProperties[];
  styles: PublicMapStyles;
};

export type AdminBlockMeta = {
  updated_at: string | null;
  updated_by: string | null;
};

export type AdminReferenceData = {
  terrain_categories: ReferenceOption[];
  terrain_types_by_category: Record<string, ReferenceOption[]>;
  relief_options: ReferenceOption[];
  bonus_contextuel_options: AdminBonusContextuel[];
  peuple_options: ReferenceOption[];
  faction_options: ReferenceOption[];
  controller_options: ReferenceOption[];
  control_type_options: ReferenceOption[];
};

export type AdminBonusContextuel = {
  slug: string;
  label: string;
  valeur: number;
  description: string | null;
};

type AdminPublicCaseRecord = PublicCaseProperties & {
  meta: AdminBlockMeta;
};

type AdminTerrainRecord = {
  terrain_cat: string | null;
  terrain_type: string | null;
  terrain_secondaire: string | null;
  colline: boolean | null;
  relief: string | null;
  meta: AdminBlockMeta;
};

type AdminControlRecord = {
  peuple: string | null;
  faction: string | null;
  controleur: string | null;
  controle_type: string | null;
  controle_principal_type: string | null;
  controle_principal_id: string | null;
  controle_secondaire_type: string | null;
  controle_secondaire_id: string | null;
  meta: AdminBlockMeta;
};

export type AdminDynamicFieldValue = string | number | boolean | null;

export type AdminDynamicFieldDefinition = DynamicCaseTableFieldDefinition & {
  reference_options: ReferenceOption[];
};

export type AdminDynamicSectionRecord = {
  table_key: string;
  title: string;
  description: string | null;
  fields: AdminDynamicFieldDefinition[];
  values: Record<string, AdminDynamicFieldValue>;
  meta: AdminBlockMeta;
};

export type AdminCaseRecord = {
  id_case: string;
  public: AdminPublicCaseRecord;
  terrain: AdminTerrainRecord;
  control: AdminControlRecord;
  emplacements: SlotCalculationResult;
  bonus_contextuels: AdminBonusContextuel[];
  dynamic_sections: AdminDynamicSectionRecord[];
  reference_data: AdminReferenceData;
};

export type AdminCaseDraft = {
  public: {
    id_case: string;
    region: string;
    sous_region: string;
    cote: string;
    lac: string;
    fluvial: string;
  };
  terrain: {
    terrain_cat: string;
    terrain_type: string;
    terrain_secondaire: string;
    colline: string;
    relief: string;
  };
  control: {
    peuple: string;
    faction: string;
    controleur: string;
    controle_type: string;
    controle_principal_type: string;
    controle_principal_id: string;
    controle_secondaire_type: string;
    controle_secondaire_id: string;
  };
  bonus_contextuels?: string[];
  dynamic: Record<string, Record<string, string>>;
};

export type AdminBulkEditFieldState = {
  value: string;
  touched: boolean;
  mixed: boolean;
};

export type AdminBulkEditListState = {
  value: string[];
  touched: boolean;
  mixed: boolean;
};

export type AdminBulkEditDraft = {
  public: {
    region: AdminBulkEditFieldState;
    sous_region: AdminBulkEditFieldState;
    cote: AdminBulkEditFieldState;
    lac: AdminBulkEditFieldState;
    fluvial: AdminBulkEditFieldState;
  };
  terrain: {
    terrain_cat: AdminBulkEditFieldState;
    terrain_type: AdminBulkEditFieldState;
    terrain_secondaire: AdminBulkEditFieldState;
    colline: AdminBulkEditFieldState;
    relief: AdminBulkEditFieldState;
  };
  control: {
    peuple: AdminBulkEditFieldState;
    faction: AdminBulkEditFieldState;
    controleur: AdminBulkEditFieldState;
    controle_type: AdminBulkEditFieldState;
    controle_principal_type: AdminBulkEditFieldState;
    controle_principal_id: AdminBulkEditFieldState;
    controle_secondaire_type: AdminBulkEditFieldState;
    controle_secondaire_id: AdminBulkEditFieldState;
  };
  bonus_contextuels: AdminBulkEditListState;
};

export type AdminBulkPatch = {
  public?: {
    region?: string | null;
    sous_region?: string | null;
    cote?: boolean | null;
    lac?: boolean | null;
    fluvial?: boolean | null;
  };
  terrain?: {
    terrain_cat?: string | null;
    terrain_type?: string | null;
    terrain_secondaire?: string | null;
    colline?: boolean | null;
    relief?: string | null;
  };
  control?: {
    peuple?: string | null;
    faction?: string | null;
    controleur?: string | null;
    controle_type?: string | null;
    controle_principal_type?: string | null;
    controle_principal_id?: string | null;
    controle_secondaire_type?: string | null;
    controle_secondaire_id?: string | null;
  };
  bonus_contextuels?: string[];
};

export type AdminBulkUpdateResult = {
  updated_count: number;
  id_cases: string[];
};

export type AdminSession = {
  authenticated: boolean;
  username: string | null;
  role: AdminRole | null;
  is_tech_admin: boolean;
};

function createEmptyBulkFieldState(): AdminBulkEditFieldState {
  return {
    value: "",
    touched: false,
    mixed: false,
  };
}

function createEmptyBulkListState(): AdminBulkEditListState {
  return {
    value: [],
    touched: false,
    mixed: false,
  };
}

function booleanToDraftValue(value: boolean | null | undefined): string {
  if (value === true) {
    return "true";
  }

  if (value === false) {
    return "false";
  }

  return "";
}

function dynamicValueToDraftValue(value: AdminDynamicFieldValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

export function createEmptyAdminCaseDraft(): AdminCaseDraft {
  return {
    public: {
      id_case: "",
      region: "",
      sous_region: "",
      cote: "",
      lac: "",
      fluvial: "",
    },
    terrain: {
      terrain_cat: "",
      terrain_type: "",
      terrain_secondaire: "",
      colline: "",
      relief: "",
    },
    control: {
      peuple: "",
      faction: "",
      controleur: "",
      controle_type: "",
      controle_principal_type: "",
      controle_principal_id: "",
      controle_secondaire_type: "",
      controle_secondaire_id: "",
    },
    bonus_contextuels: [],
    dynamic: {},
  };
}

export function createEmptyAdminBulkEditDraft(): AdminBulkEditDraft {
  return {
    public: {
      region: createEmptyBulkFieldState(),
      sous_region: createEmptyBulkFieldState(),
      cote: createEmptyBulkFieldState(),
      lac: createEmptyBulkFieldState(),
      fluvial: createEmptyBulkFieldState(),
    },
    terrain: {
      terrain_cat: createEmptyBulkFieldState(),
      terrain_type: createEmptyBulkFieldState(),
      terrain_secondaire: createEmptyBulkFieldState(),
      colline: createEmptyBulkFieldState(),
      relief: createEmptyBulkFieldState(),
    },
    control: {
      peuple: createEmptyBulkFieldState(),
      faction: createEmptyBulkFieldState(),
      controleur: createEmptyBulkFieldState(),
      controle_type: createEmptyBulkFieldState(),
      controle_principal_type: createEmptyBulkFieldState(),
      controle_principal_id: createEmptyBulkFieldState(),
      controle_secondaire_type: createEmptyBulkFieldState(),
      controle_secondaire_id: createEmptyBulkFieldState(),
    },
    bonus_contextuels: createEmptyBulkListState(),
  };
}

export function toAdminCaseDraft(
  record: AdminCaseRecord | null,
): AdminCaseDraft {
  if (!record) {
    return createEmptyAdminCaseDraft();
  }

  return {
    public: {
      id_case: record.public.id_case,
      region: record.public.region ?? "",
      sous_region: record.public.sous_region ?? "",
      cote: booleanToDraftValue(record.public.cote),
      lac: booleanToDraftValue(record.public.lac),
      fluvial: booleanToDraftValue(record.public.fluvial),
    },
    terrain: {
      terrain_cat: record.terrain.terrain_cat ?? "",
      terrain_type: record.terrain.terrain_type ?? "",
      terrain_secondaire: record.terrain.terrain_secondaire ?? "",
      colline: booleanToDraftValue(record.terrain.colline),
      relief: record.terrain.relief ?? "",
    },
    control: {
      peuple: record.control.peuple ?? "",
      faction: record.control.faction ?? "",
      controleur: record.control.controleur ?? "",
      controle_type: record.control.controle_type ?? "",
      controle_principal_type: record.control.controle_principal_type ?? "",
      controle_principal_id: record.control.controle_principal_id ?? "",
      controle_secondaire_type: record.control.controle_secondaire_type ?? "",
      controle_secondaire_id: record.control.controle_secondaire_id ?? "",
    },
    bonus_contextuels: record.bonus_contextuels.map((bonus) => bonus.slug),
    dynamic: Object.fromEntries(
      record.dynamic_sections.map((section) => [
        section.table_key,
        Object.fromEntries(
          section.fields.map((field) => [
            field.field_key,
            dynamicValueToDraftValue(section.values[field.field_key] ?? null),
          ]),
        ),
      ]),
    ),
  };
}
