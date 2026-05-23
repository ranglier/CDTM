import {
  controlTypeOptions,
  factionOptions,
  getTerrainTypesForCategory,
  reliefOptions,
  terrainCategories,
} from "@/admin/options";
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

function hasOwnProperty(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function assertAllowedOption(
  fieldLabel: string,
  value: string | null,
  allowedValues: readonly string[],
): void {
  if (value && !allowedValues.includes(value)) {
    throw new Error(`La valeur du champ ${fieldLabel} est invalide.`);
  }
}

export function parseAdminCaseDraft(value: unknown): AdminCaseDraft {
  const payload = ensurePlainObject(value);
  const emptyDraft = createEmptyAdminCaseDraft();
  const publicFields = ensurePlainObject(payload.public ?? emptyDraft.public);
  const notes = ensurePlainObject(payload.notes ?? emptyDraft.notes);
  const terrain = ensurePlainObject(payload.terrain ?? emptyDraft.terrain);
  const control = ensurePlainObject(payload.control ?? emptyDraft.control);

  const draft: AdminCaseDraft = {
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
  };

  const terrainCategory = normalizeNullableText(draft.terrain.terrain_cat);
  const terrainType = normalizeNullableText(draft.terrain.terrain_type);
  const relief = normalizeNullableText(draft.terrain.relief);
  const faction = normalizeNullableText(draft.control.faction);
  const controleType = normalizeNullableText(draft.control.controle_type);

  assertAllowedOption("terrain_cat", terrainCategory, terrainCategories);
  assertAllowedOption("relief", relief, reliefOptions);
  assertAllowedOption("faction", faction, factionOptions);
  assertAllowedOption("controle_type", controleType, controlTypeOptions);

  if (terrainType && !terrainCategory) {
    throw new Error("terrain_type requiert un terrain_cat.");
  }

  if (terrainType && terrainCategory) {
    const allowedTerrainTypes = getTerrainTypesForCategory(terrainCategory);
    assertAllowedOption("terrain_type", terrainType, allowedTerrainTypes);
  }

  return draft;
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
      publicPatch.cote = parseNullableBooleanFromDraft(
        normalizeBooleanDraftValue(publicFields.cote),
      );
    }

    if (hasOwnProperty(publicFields, "lac_majeur")) {
      publicPatch.lac_majeur = parseNullableBooleanFromDraft(
        normalizeBooleanDraftValue(publicFields.lac_majeur),
      );
    }

    if (hasOwnProperty(publicFields, "cours_eau_majeur")) {
      publicPatch.cours_eau_majeur = parseNullableBooleanFromDraft(
        normalizeBooleanDraftValue(publicFields.cours_eau_majeur),
      );
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
      const hasTerrainCategory = hasOwnProperty(terrainPatch, "terrain_cat");
      const hasTerrainType = hasOwnProperty(terrainPatch, "terrain_type");

      if (hasTerrainCategory !== hasTerrainType) {
        throw new Error(
          "terrain_cat et terrain_type doivent etre modifies ensemble en edition de masse.",
        );
      }

      assertAllowedOption("terrain_cat", terrainPatch.terrain_cat ?? null, terrainCategories);
      assertAllowedOption("relief", terrainPatch.relief ?? null, reliefOptions);

      if (terrainPatch.terrain_type && terrainPatch.terrain_cat) {
        const allowedTerrainTypes = getTerrainTypesForCategory(terrainPatch.terrain_cat);
        assertAllowedOption("terrain_type", terrainPatch.terrain_type, allowedTerrainTypes);
      }

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
      assertAllowedOption("faction", controlPatch.faction ?? null, factionOptions);
      assertAllowedOption(
        "controle_type",
        controlPatch.controle_type ?? null,
        controlTypeOptions,
      );
      result.control = controlPatch;
    }
  }

  if (Object.keys(result).length === 0) {
    throw new Error("Aucun champ modifie n'a ete fourni pour l'edition de masse.");
  }

  return result;
}
