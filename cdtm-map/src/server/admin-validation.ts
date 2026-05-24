import {
  createEmptyAdminCaseDraft,
  type AdminBulkPatch,
  type AdminCaseDraft,
} from "@/admin/types";

const booleanDraftOptions = ["", "true", "false"] as const;

function ensurePlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Le corps de requete admin est invalide.");
  }

  return value as Record<string, unknown>;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeBooleanDraftValue(value: unknown): string {
  const normalized = normalizeText(value);

  if ((booleanDraftOptions as readonly string[]).includes(normalized)) {
    return normalized;
  }

  throw new Error("La valeur d'un champ booleen est invalide.");
}

function parseNullableBooleanFromDraft(value: string | null): boolean | null {
  if (value === null || value.length === 0) {
    return null;
  }

  return value === "true";
}

function parseNullableBooleanPatchValue(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return parseNullableBooleanFromDraft(normalizeBooleanDraftValue(value));
}

function hasOwnProperty(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function parseAdminCaseDraft(value: unknown): AdminCaseDraft {
  const payload = ensurePlainObject(value);
  const emptyDraft = createEmptyAdminCaseDraft();
  const publicFields = ensurePlainObject(payload.public ?? emptyDraft.public);
  const notes = ensurePlainObject(payload.notes ?? emptyDraft.notes);
  const terrain = ensurePlainObject(payload.terrain ?? emptyDraft.terrain);
  const control = ensurePlainObject(payload.control ?? emptyDraft.control);
  const dynamicSections = payload.dynamic ? ensurePlainObject(payload.dynamic) : {};

  return {
    public: {
      id_case: normalizeText(publicFields.id_case),
      region: normalizeText(publicFields.region),
      sous_region: normalizeText(publicFields.sous_region),
      cote: normalizeBooleanDraftValue(publicFields.cote),
      lac_majeur: normalizeBooleanDraftValue(publicFields.lac_majeur),
      cours_eau_majeur: normalizeBooleanDraftValue(publicFields.cours_eau_majeur),
    },
    notes: {
      note_publique: normalizeText(notes.note_publique),
      note_staff: normalizeText(notes.note_staff),
    },
    terrain: {
      terrain_cat: normalizeText(terrain.terrain_cat),
      terrain_type: normalizeText(terrain.terrain_type),
      relief: normalizeText(terrain.relief),
    },
    control: {
      faction: normalizeText(control.faction),
      controleur: normalizeText(control.controleur),
      controle_type: normalizeText(control.controle_type),
    },
    dynamic: Object.fromEntries(
      Object.entries(dynamicSections)
        .filter((entry): entry is [string, Record<string, unknown>] => {
          const [tableKey, section] = entry;
          return (
            typeof tableKey === "string" &&
            tableKey.trim().length > 0 &&
            typeof section === "object" &&
            section !== null &&
            !Array.isArray(section)
          );
        })
        .map(([tableKey, section]) => [
          tableKey,
          Object.fromEntries(
            Object.entries(section).map(([fieldKey, fieldValue]) => [
              fieldKey,
              typeof fieldValue === "string" ? fieldValue : "",
            ]),
          ),
        ]),
    ),
  };
}

export function parseAdminBulkPatch(value: unknown): AdminBulkPatch {
  const payload = ensurePlainObject(value);
  const patch = ensurePlainObject(payload.patch ?? payload);
  const publicFields = patch.public ? ensurePlainObject(patch.public) : null;
  const notes = patch.notes ? ensurePlainObject(patch.notes) : null;
  const terrain = patch.terrain ? ensurePlainObject(patch.terrain) : null;
  const control = patch.control ? ensurePlainObject(patch.control) : null;
  const result: AdminBulkPatch = {};

  if (publicFields) {
    const publicPatch: NonNullable<AdminBulkPatch["public"]> = {};

    if (hasOwnProperty(publicFields, "region")) {
      publicPatch.region = normalizeNullableText(publicFields.region);
    }

    if (hasOwnProperty(publicFields, "sous_region")) {
      publicPatch.sous_region = normalizeNullableText(publicFields.sous_region);
    }

    if (hasOwnProperty(publicFields, "cote")) {
      publicPatch.cote = parseNullableBooleanPatchValue(publicFields.cote);
    }

    if (hasOwnProperty(publicFields, "lac_majeur")) {
      publicPatch.lac_majeur = parseNullableBooleanPatchValue(publicFields.lac_majeur);
    }

    if (hasOwnProperty(publicFields, "cours_eau_majeur")) {
      publicPatch.cours_eau_majeur = parseNullableBooleanPatchValue(publicFields.cours_eau_majeur);
    }

    if (Object.keys(publicPatch).length > 0) {
      result.public = publicPatch;
    }
  }

  if (notes) {
    const notesPatch: NonNullable<AdminBulkPatch["notes"]> = {};

    if (hasOwnProperty(notes, "note_publique")) {
      notesPatch.note_publique = normalizeNullableText(notes.note_publique);
    }

    if (hasOwnProperty(notes, "note_staff")) {
      notesPatch.note_staff = normalizeNullableText(notes.note_staff);
    }

    if (Object.keys(notesPatch).length > 0) {
      result.notes = notesPatch;
    }
  }

  if (terrain) {
    const terrainPatch: NonNullable<AdminBulkPatch["terrain"]> = {};

    if (hasOwnProperty(terrain, "terrain_cat")) {
      terrainPatch.terrain_cat = normalizeNullableText(terrain.terrain_cat);
    }

    if (hasOwnProperty(terrain, "terrain_type")) {
      terrainPatch.terrain_type = normalizeNullableText(terrain.terrain_type);
    }

    if (hasOwnProperty(terrain, "relief")) {
      terrainPatch.relief = normalizeNullableText(terrain.relief);
    }

    if (Object.keys(terrainPatch).length > 0) {
      result.terrain = terrainPatch;
    }
  }

  if (control) {
    const controlPatch: NonNullable<AdminBulkPatch["control"]> = {};

    if (hasOwnProperty(control, "faction")) {
      controlPatch.faction = normalizeNullableText(control.faction);
    }

    if (hasOwnProperty(control, "controleur")) {
      controlPatch.controleur = normalizeNullableText(control.controleur);
    }

    if (hasOwnProperty(control, "controle_type")) {
      controlPatch.controle_type = normalizeNullableText(control.controle_type);
    }

    if (Object.keys(controlPatch).length > 0) {
      result.control = controlPatch;
    }
  }

  if (Object.keys(result).length === 0) {
    throw new Error("Aucun champ modifie n'a ete fourni pour l'edition de masse.");
  }

  return result;
}
