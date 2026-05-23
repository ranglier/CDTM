import type {
  DynamicCaseTableFieldDefinition,
  ReferenceOption,
} from "@/admin/tech-types";
import type { AdminRole } from "@/admin/roles";

export type PublicCaseProperties = {
  registry_id_case: string;
  id_case: string;
  region: string | null;
  sous_region: string | null;
  cote: boolean | null;
  lac_majeur: boolean | null;
  cours_eau_majeur: boolean | null;
  terrain_cat: string | null;
  terrain_type: string | null;
  relief: string | null;
  faction: string | null;
  controleur: string | null;
  controle_type: string | null;
};

export type AdminBlockMeta = {
  updated_at: string | null;
  updated_by: string | null;
};

export type AdminReferenceData = {
  terrain_categories: ReferenceOption[];
  terrain_types_by_category: Record<string, ReferenceOption[]>;
  relief_options: ReferenceOption[];
  faction_options: ReferenceOption[];
  control_type_options: ReferenceOption[];
};

export type AdminPublicCaseRecord = PublicCaseProperties & {
  meta: AdminBlockMeta;
};

export type AdminNotesRecord = {
  note_publique: string | null;
  note_staff: string | null;
  meta: AdminBlockMeta;
};

export type AdminTerrainRecord = {
  terrain_cat: string | null;
  terrain_type: string | null;
  relief: string | null;
  meta: AdminBlockMeta;
};

export type AdminControlRecord = {
  faction: string | null;
  controleur: string | null;
  controle_type: string | null;
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
  notes: AdminNotesRecord;
  terrain: AdminTerrainRecord;
  control: AdminControlRecord;
  dynamic_sections: AdminDynamicSectionRecord[];
  reference_data: AdminReferenceData;
};

export type AdminCaseDraft = {
  public: {
    id_case: string;
    region: string;
    sous_region: string;
    cote: string;
    lac_majeur: string;
    cours_eau_majeur: string;
  };
  notes: {
    note_publique: string;
    note_staff: string;
  };
  terrain: {
    terrain_cat: string;
    terrain_type: string;
    relief: string;
  };
  control: {
    faction: string;
    controleur: string;
    controle_type: string;
  };
  dynamic: Record<string, Record<string, string>>;
};

export type AdminBulkEditFieldState = {
  value: string;
  touched: boolean;
  mixed: boolean;
};

export type AdminBulkEditDraft = {
  public: {
    region: AdminBulkEditFieldState;
    sous_region: AdminBulkEditFieldState;
    cote: AdminBulkEditFieldState;
    lac_majeur: AdminBulkEditFieldState;
    cours_eau_majeur: AdminBulkEditFieldState;
  };
  notes: {
    note_publique: AdminBulkEditFieldState;
    note_staff: AdminBulkEditFieldState;
  };
  terrain: {
    terrain_cat: AdminBulkEditFieldState;
    terrain_type: AdminBulkEditFieldState;
    relief: AdminBulkEditFieldState;
  };
  control: {
    faction: AdminBulkEditFieldState;
    controleur: AdminBulkEditFieldState;
    controle_type: AdminBulkEditFieldState;
  };
};

export type AdminBulkPatch = {
  public?: {
    region?: string | null;
    sous_region?: string | null;
    cote?: boolean | null;
    lac_majeur?: boolean | null;
    cours_eau_majeur?: boolean | null;
  };
  notes?: {
    note_publique?: string | null;
    note_staff?: string | null;
  };
  terrain?: {
    terrain_cat?: string | null;
    terrain_type?: string | null;
    relief?: string | null;
  };
  control?: {
    faction?: string | null;
    controleur?: string | null;
    controle_type?: string | null;
  };
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
      lac_majeur: "",
      cours_eau_majeur: "",
    },
    notes: {
      note_publique: "",
      note_staff: "",
    },
    terrain: {
      terrain_cat: "",
      terrain_type: "",
      relief: "",
    },
    control: {
      faction: "",
      controleur: "",
      controle_type: "",
    },
    dynamic: {},
  };
}

export function createEmptyAdminBulkEditDraft(): AdminBulkEditDraft {
  return {
    public: {
      region: createEmptyBulkFieldState(),
      sous_region: createEmptyBulkFieldState(),
      cote: createEmptyBulkFieldState(),
      lac_majeur: createEmptyBulkFieldState(),
      cours_eau_majeur: createEmptyBulkFieldState(),
    },
    notes: {
      note_publique: createEmptyBulkFieldState(),
      note_staff: createEmptyBulkFieldState(),
    },
    terrain: {
      terrain_cat: createEmptyBulkFieldState(),
      terrain_type: createEmptyBulkFieldState(),
      relief: createEmptyBulkFieldState(),
    },
    control: {
      faction: createEmptyBulkFieldState(),
      controleur: createEmptyBulkFieldState(),
      controle_type: createEmptyBulkFieldState(),
    },
  };
}

export function toAdminCaseDraft(record: AdminCaseRecord | null): AdminCaseDraft {
  if (!record) {
    return createEmptyAdminCaseDraft();
  }

  return {
    public: {
      id_case: record.public.id_case,
      region: record.public.region ?? "",
      sous_region: record.public.sous_region ?? "",
      cote: booleanToDraftValue(record.public.cote),
      lac_majeur: booleanToDraftValue(record.public.lac_majeur),
      cours_eau_majeur: booleanToDraftValue(record.public.cours_eau_majeur),
    },
    notes: {
      note_publique: record.notes.note_publique ?? "",
      note_staff: record.notes.note_staff ?? "",
    },
    terrain: {
      terrain_cat: record.terrain.terrain_cat ?? "",
      terrain_type: record.terrain.terrain_type ?? "",
      relief: record.terrain.relief ?? "",
    },
    control: {
      faction: record.control.faction ?? "",
      controleur: record.control.controleur ?? "",
      controle_type: record.control.controle_type ?? "",
    },
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
