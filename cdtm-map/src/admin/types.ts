export type PublicCaseSupplement = {
  id_case: string;
  note_publique: string | null;
};

export type AdminBlockMeta = {
  updated_at: string | null;
  updated_by: string | null;
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

export type AdminCaseRecord = {
  id_case: string;
  notes: AdminNotesRecord;
  terrain: AdminTerrainRecord;
  control: AdminControlRecord;
};

export type AdminCaseDraft = {
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
};

export type AdminSession = {
  authenticated: boolean;
  username: string | null;
};

export function createEmptyAdminCaseDraft(): AdminCaseDraft {
  return {
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
  };
}

export function toAdminCaseDraft(record: AdminCaseRecord | null): AdminCaseDraft {
  if (!record) {
    return createEmptyAdminCaseDraft();
  }

  return {
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
  };
}
