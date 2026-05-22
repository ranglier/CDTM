import {
  controlTypeOptions,
  factionOptions,
  getTerrainTypesForCategory,
  reliefOptions,
  terrainCategories,
} from "@/admin/options";
import { createEmptyAdminCaseDraft, type AdminCaseDraft } from "@/admin/types";

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
  const notes = ensurePlainObject(payload.notes ?? emptyDraft.notes);
  const terrain = ensurePlainObject(payload.terrain ?? emptyDraft.terrain);
  const control = ensurePlainObject(payload.control ?? emptyDraft.control);

  const draft: AdminCaseDraft = {
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
