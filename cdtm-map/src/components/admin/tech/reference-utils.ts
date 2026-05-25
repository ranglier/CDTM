import type {
  ReferenceOption,
  ReferenceStyleValue,
  ReferenceTableDefinition,
  ReferenceTableRow,
  TechFieldDefinition,
} from "@/admin/tech-types";
import { normalizeHexColor, normalizePatternType, type MapPatternType } from "@/map/types";

import type {
  EditableRow,
  ReferenceAutoFillTableKey,
  ReferenceView,
} from "@/components/admin/tech/types";

export const SIDEBAR_SECTION_STORAGE_KEY = "cdtm-tech-admin-sidebar-sections";

export const STYLE_FIELDS = ["fill", "stroke", "pattern_type", "pattern_color"] as const;
export type StyleFieldName = (typeof STYLE_FIELDS)[number];

export const DEFAULT_STYLE_STROKE = "#000000";
export const DEFAULT_PATTERN_COLOR = "#000000";

export const PATTERN_TYPE_OPTIONS: Array<{ value: "none" | MapPatternType; label: string }> = [
  { value: "none", label: "Aucun" },
  { value: "diagonal", label: "Hachures diagonales" },
  { value: "diagonal_reverse", label: "Hachures diagonales inversees" },
  { value: "crosshatch", label: "Hachures croisees" },
  { value: "horizontal", label: "Lignes horizontales" },
  { value: "vertical", label: "Lignes verticales" },
  { value: "dots", label: "Points" },
  { value: "grid", label: "Grille" },
];

export const REFERENCE_TECHNICAL_FIELDS = new Set([
  "group_key",
  "entry_key",
  "id_entry",
  "id_faction",
  "id_controleur",
  "icon_key",
  "type_key",
  "race_key",
  "peuple_key",
  "image_path",
  "image_original_name",
  "image_mime_type",
  "image_size_bytes",
  "updated_by_user_id",
  "created_at",
  "updated_at",
]);

export const LOCKED_REFERENCE_FIELDS = new Set([
  "image_path",
  "image_original_name",
  "image_mime_type",
  "image_size_bytes",
]);

export function toSnakeCaseIdentifier(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function shouldReplaceAutoValue(currentValue: string, previousSuggestedValue: string): boolean {
  const normalizedCurrent = currentValue.trim();
  return normalizedCurrent.length === 0 || normalizedCurrent === previousSuggestedValue;
}

export function applyReferenceAutoFill(
  tableKey: ReferenceAutoFillTableKey,
  currentValues: Record<string, string>,
  nextValues: Record<string, string>,
): Record<string, string> {
  if (tableKey === "nomenclatures") {
    const previousEntrySuggestion = toSnakeCaseIdentifier(currentValues.label ?? "");
    const nextEntrySuggestion = toSnakeCaseIdentifier(nextValues.label ?? "");

    if (
      nextEntrySuggestion &&
      shouldReplaceAutoValue(currentValues.entry_key ?? "", previousEntrySuggestion)
    ) {
      nextValues.entry_key = nextEntrySuggestion;
    }

    const previousIdSuggestion =
      currentValues.group_key?.trim() && currentValues.entry_key?.trim()
        ? `${currentValues.group_key.trim()}:${currentValues.entry_key.trim()}`
        : "";
    const nextIdSuggestion =
      nextValues.group_key?.trim() && nextValues.entry_key?.trim()
        ? `${nextValues.group_key.trim()}:${nextValues.entry_key.trim()}`
        : "";

    if (
      nextIdSuggestion &&
      shouldReplaceAutoValue(currentValues.id_entry ?? "", previousIdSuggestion)
    ) {
      nextValues.id_entry = nextIdSuggestion;
    }
  }

  if (tableKey === "factions") {
    const previousSuggestion = toSnakeCaseIdentifier(currentValues.nom ?? "");
    const nextSuggestion = toSnakeCaseIdentifier(nextValues.nom ?? "");

    if (
      nextSuggestion &&
      shouldReplaceAutoValue(currentValues.id_faction ?? "", previousSuggestion)
    ) {
      nextValues.id_faction = nextSuggestion;
    }
  }

  if (tableKey === "controleurs") {
    const previousSuggestion = toSnakeCaseIdentifier(currentValues.nom ?? "");
    const nextSuggestion = toSnakeCaseIdentifier(nextValues.nom ?? "");

    if (
      nextSuggestion &&
      shouldReplaceAutoValue(currentValues.id_controleur ?? "", previousSuggestion)
    ) {
      nextValues.id_controleur = nextSuggestion;
    }
  }

  if (tableKey === "map_icons") {
    const previousSuggestion = toSnakeCaseIdentifier(currentValues.label ?? "");
    const nextSuggestion = toSnakeCaseIdentifier(nextValues.label ?? "");

    if (
      nextSuggestion &&
      shouldReplaceAutoValue(currentValues.icon_key ?? "", previousSuggestion)
    ) {
      nextValues.icon_key = nextSuggestion;
    }
  }

  if (tableKey === "locality_types" || tableKey === "landmark_types" || tableKey === "force_types") {
    const previousSuggestion = toSnakeCaseIdentifier(currentValues.label ?? "");
    const nextSuggestion = toSnakeCaseIdentifier(nextValues.label ?? "");

    if (
      nextSuggestion &&
      shouldReplaceAutoValue(currentValues.type_key ?? "", previousSuggestion)
    ) {
      nextValues.type_key = nextSuggestion;
    }
  }

  if (tableKey === "races") {
    const previousSuggestion = toSnakeCaseIdentifier(currentValues.label ?? "");
    const nextSuggestion = toSnakeCaseIdentifier(nextValues.label ?? "");

    if (
      nextSuggestion &&
      shouldReplaceAutoValue(currentValues.race_key ?? "", previousSuggestion)
    ) {
      nextValues.race_key = nextSuggestion;
    }
  }

  if (tableKey === "peuples") {
    const previousSuggestion = toSnakeCaseIdentifier(currentValues.label ?? "");
    const nextSuggestion = toSnakeCaseIdentifier(nextValues.label ?? "");

    if (
      nextSuggestion &&
      shouldReplaceAutoValue(currentValues.peuple_key ?? "", previousSuggestion)
    ) {
      nextValues.peuple_key = nextSuggestion;
    }
  }

  return nextValues;
}

export function getStyleTargetIdForRow(view: ReferenceView | null, values: Record<string, string>): string | null {
  if (!view?.styleTargetType) {
    return null;
  }

  if (view.tableKey === "factions") {
    return values.id_faction?.trim() || null;
  }

  if (view.tableKey === "controleurs") {
    return values.id_controleur?.trim() || null;
  }

  if (view.tableKey === "nomenclatures") {
    return values.entry_key?.trim() || null;
  }

  return null;
}

export function buildStylePayload(
  view: ReferenceView | null,
  values: Record<string, string>,
): {
  target_type: ReferenceView["styleTargetType"];
  target_id: string;
  fill: string | null;
  stroke: string | null;
  pattern_type: MapPatternType | null;
  pattern_color: string | null;
} | null {
  const targetType = view?.styleTargetType ?? null;
  const targetId = getStyleTargetIdForRow(view, values);

  if (!targetType || !targetId) {
    return null;
  }

  const normalizedFill = values.fill?.trim() || "";
  const normalizedStroke = values.stroke?.trim() || "";
  const normalizedPatternType = values.pattern_type?.trim() || "";
  const normalizedPatternColor =
    normalizedPatternType.length > 0 && normalizedPatternType !== "none"
      ? values.pattern_color?.trim() || ""
      : "";
  const parsedPatternType =
    normalizedPatternType.length > 0 && normalizedPatternType !== "none"
      ? normalizePatternType(normalizedPatternType)
      : null;

  if (
    normalizedFill.length === 0 &&
    (normalizedStroke.length === 0 || normalizedStroke.toLowerCase() === DEFAULT_STYLE_STROKE) &&
    (normalizedPatternType.length === 0 || normalizedPatternType === "none") &&
    normalizedPatternColor.length === 0
  ) {
    return null;
  }

  return {
    target_type: targetType,
    target_id: targetId,
    fill: normalizedFill || null,
    stroke: normalizedStroke || null,
    pattern_type: parsedPatternType,
    pattern_color: normalizedPatternColor || null,
  };
}

export function getPatternCss(patternType: MapPatternType | null, patternColor: string) {
  switch (patternType) {
    case "diagonal":
      return {
        backgroundImage: `repeating-linear-gradient(135deg, transparent 0 8px, ${patternColor} 8px 10px)`,
      };
    case "diagonal_reverse":
      return {
        backgroundImage: `repeating-linear-gradient(45deg, transparent 0 8px, ${patternColor} 8px 10px)`,
      };
    case "crosshatch":
      return {
        backgroundImage: [
          `repeating-linear-gradient(135deg, transparent 0 8px, ${patternColor} 8px 10px)`,
          `repeating-linear-gradient(45deg, transparent 0 8px, ${patternColor} 8px 10px)`,
        ].join(", "),
      };
    case "horizontal":
      return {
        backgroundImage: `repeating-linear-gradient(0deg, transparent 0 8px, ${patternColor} 8px 10px)`,
      };
    case "vertical":
      return {
        backgroundImage: `repeating-linear-gradient(90deg, transparent 0 8px, ${patternColor} 8px 10px)`,
      };
    case "dots":
      return {
        backgroundImage: `radial-gradient(circle at 3px 3px, ${patternColor} 0 1.6px, transparent 1.8px)`,
        backgroundSize: "10px 10px",
      };
    case "grid":
      return {
        backgroundImage: [
          `repeating-linear-gradient(0deg, transparent 0 8px, ${patternColor} 8px 10px)`,
          `repeating-linear-gradient(90deg, transparent 0 8px, ${patternColor} 8px 10px)`,
        ].join(", "),
      };
    default:
      return {};
  }
}

export function createStylePreview(fill: string, stroke: string, patternType: string, patternColor: string) {
  const normalizedFill = normalizeHexColor(fill);
  const normalizedStroke = normalizeHexColor(stroke) ?? DEFAULT_STYLE_STROKE;
  const normalizedPatternType = normalizePatternType(patternType);
  const normalizedPatternColor = normalizeHexColor(patternColor) ?? DEFAULT_PATTERN_COLOR;

  return {
    fill: normalizedFill ?? "#5f6b7a",
    stroke: normalizedStroke,
    patternType: normalizedPatternType,
    patternColor: normalizedPatternColor,
  };
}

export function isHexColorInputValid(value: string): boolean {
  return value.trim().length === 0 || normalizeHexColor(value) !== null;
}

export function isPatternTypeInputValid(value: string): boolean {
  return value.trim().length === 0 || value === "none" || normalizePatternType(value) !== null;
}

export function isPreviewImageUrl(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("/uploads/map-icons/");
}

export function rowValueToInputValue(value: string | number | boolean | null): string {
  if (value === null) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

export function createEmptyRowValues(definition: ReferenceTableDefinition): Record<string, string> {
  return Object.fromEntries(definition.fields.map((field) => [field.name, ""]));
}

export function toEditableRow(definition: ReferenceTableDefinition, row: ReferenceTableRow): EditableRow {
  const updatedByUsername = row.updated_by_username;
  const fallbackLocalId =
    globalThis.crypto?.randomUUID?.() ?? `row-${Math.random().toString(36).slice(2)}`;

  return {
    localId: `${definition.key}:${row[definition.primary_key] ?? fallbackLocalId}`,
    values: Object.fromEntries(
      definition.fields.map((field) => [
        field.name,
        field.name === "updated_by_user_id" && typeof updatedByUsername === "string"
          ? updatedByUsername
          : rowValueToInputValue(row[field.name] ?? null),
      ]),
    ),
    originalPrimaryKey: rowValueToInputValue(row[definition.primary_key] ?? null),
    saving: false,
    uploading: false,
    error: null,
    isNew: false,
  };
}

export function withStyleValues(
  row: EditableRow,
  view: ReferenceView | null,
  styles?: Record<string, ReferenceStyleValue>,
): EditableRow {
  const targetId = getStyleTargetIdForRow(view, row.values);
  const style = targetId && styles ? styles[targetId] : null;

  return {
    ...row,
    values: {
      ...row.values,
      fill: style?.fill ?? "",
      stroke: style?.stroke ?? DEFAULT_STYLE_STROKE,
      pattern_type: style?.pattern_type ?? "none",
      pattern_color: style?.pattern_color ?? "",
    },
  };
}

export function buildRowPayload(definition: ReferenceTableDefinition, row: EditableRow): Record<string, string> {
  return Object.fromEntries(
    definition.fields
      .filter((field) => !field.readOnly)
      .map((field) => [field.name, row.values[field.name] ?? ""]),
  );
}

export function getFriendlyFieldLabel(fieldName: string): string {
  switch (fieldName) {
    case "id_entry":
      return "Identifiant interne";
    case "group_key":
      return "Famille de valeurs";
    case "entry_key":
      return "Valeur interne";
    case "parent_entry_key":
      return "Valeur parente";
    case "updated_by_user_id":
      return "Derniere modification par";
    case "created_at":
      return "Creation";
    case "updated_at":
      return "Derniere mise a jour";
    case "id_faction":
      return "Identifiant faction";
    case "id_controleur":
      return "Identifiant controleur";
    case "icon_key":
      return "Cle icone";
    case "category":
      return "Categorie";
    case "image_path":
      return "Chemin image";
    case "image_original_name":
      return "Nom de fichier";
    case "image_mime_type":
      return "Type MIME";
    case "image_size_bytes":
      return "Taille fichier";
    case "image_alt":
      return "Texte alternatif";
    case "is_active":
      return "Actif";
    case "type_key":
      return "Identifiant type";
    case "default_icon_key":
      return "Icone par defaut";
    case "consumes_slot":
      return "Consomme un emplacement";
    case "slot_weight":
      return "Poids d'emplacement";
    case "race_key":
      return "Race";
    case "peuple_key":
      return "Identifiant peuple";
    default:
      return fieldName;
  }
}

export function getOptionLabel(options: ReferenceOption[] | undefined, value: string): string {
  return options?.find((option) => option.value === value)?.label ?? value;
}

export function getFieldTypeLabel(value: string): string {
  switch (value) {
    case "text":
      return "Texte court";
    case "textarea":
      return "Texte long";
    case "boolean":
      return "Oui / non";
    case "integer":
      return "Nombre entier";
    case "datetime":
      return "Date / heure";
    case "reference":
      return "Choix dans une liste";
    default:
      return value;
  }
}

export function getReferenceRowSummary(
  definition: ReferenceTableDefinition,
  view: ReferenceView | null,
  row: EditableRow,
  displayFields: TechFieldDefinition[],
  referenceFieldOptions: Record<string, ReferenceOption[]>,
  terrainCategoryLabelByKey: Record<string, string>,
): string {
  const terrainParentLabel =
    terrainCategoryLabelByKey[row.values.parent_entry_key] ||
    row.values.parent_entry_key ||
    "Type sans categorie parente";

  if (definition.key === "peuples") {
    return row.values.race_key
      ? getOptionLabel(referenceFieldOptions.race_key, row.values.race_key)
      : "Race non renseignee";
  }

  if (view?.groupKey === "terrain_type") {
    return terrainParentLabel;
  }

  return (
    displayFields
      .map((field) => row.values[field.name])
      .find((value) => value && value.trim().length > 0) || "Aucun detail visible"
  );
}

export function buildReferenceRowsSectionTitle(count: number): string {
  return `${count} ligne(s)`;
}

export function createLoggedOutSession() {
  return {
    authenticated: false,
    username: null,
    role: null,
    is_tech_admin: false,
  };
}
