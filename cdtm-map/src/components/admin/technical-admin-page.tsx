"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import type { AdminRole } from "@/admin/roles";
import type {
  AdminStyleUpsertInput,
  DynamicCaseTableCreateInput,
  DynamicCaseTableDefinition,
  DynamicCaseTableFieldCreateInput,
  DynamicCaseTableFieldType,
  ReferenceOption,
  ReferenceStyleValue,
  DynamicCaseTableSummary,
  MapIconUploadMetadata,
  DynamicCaseTableUpdateInput,
  ReferenceTableDefinition,
  ReferenceTableKey,
  ReferenceTableRow,
  ReferenceTableRowsResponse,
  ReferenceTableStatus,
  StaffAccountCreateInput,
  StaffAccountSummary,
  TechFieldDefinition,
} from "@/admin/tech-types";
import type { AdminSession } from "@/admin/types";
import { AppShell } from "@/components/layout/app-shell";
import { SectionPanel } from "@/components/layout/section-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import {
  normalizeHexColor,
  normalizePatternType,
  type MapPatternType,
  type MapStyleTargetType,
} from "@/map/types";

type TabKey = "references" | "schema" | "accounts";

type EditableRow = {
  localId: string;
  values: Record<string, string>;
  originalPrimaryKey: string;
  saving: boolean;
  uploading: boolean;
  error: string | null;
  isNew: boolean;
};

type ReferenceView = {
  id: string;
  tableKey: ReferenceTableKey;
  title: string;
  groupKey: string | null;
  rowCount: number | null;
  styleTargetType?: MapStyleTargetType | null;
  supportsTerrainParentSelect?: boolean;
};

type ReferenceViewSection = {
  id: string;
  title: string;
  views: ReferenceView[];
};

type SidebarSection = {
  id: string;
  title: string;
  items: Array<
    | { kind: "reference"; id: string; label: string; count: number | null }
    | { kind: "schema"; id: string; label: string; count: number | null }
    | { kind: "account"; id: string; label: string; count: number | null }
  >;
};

const SIDEBAR_SECTION_STORAGE_KEY = "cdtm-tech-admin-sidebar-sections";

const STYLE_FIELDS = ["fill", "stroke", "pattern_type", "pattern_color"] as const;
type StyleFieldName = (typeof STYLE_FIELDS)[number];
const DEFAULT_STYLE_STROKE = "#000000";
const DEFAULT_PATTERN_COLOR = "#000000";
const PATTERN_TYPE_OPTIONS: Array<{ value: "none" | MapPatternType; label: string }> = [
  { value: "none", label: "Aucun" },
  { value: "diagonal", label: "Hachures diagonales" },
  { value: "diagonal_reverse", label: "Hachures diagonales inversees" },
  { value: "crosshatch", label: "Hachures croisees" },
  { value: "horizontal", label: "Lignes horizontales" },
  { value: "vertical", label: "Lignes verticales" },
  { value: "dots", label: "Points" },
  { value: "grid", label: "Grille" },
];
const REFERENCE_TECHNICAL_FIELDS = new Set([
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
const LOCKED_REFERENCE_FIELDS = new Set([
  "image_path",
  "image_original_name",
  "image_mime_type",
  "image_size_bytes",
]);

function CollapsibleSidebarSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[18px] border border-border/60 bg-background/25">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={onToggle}
      >
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {open ? "Ouvert" : "Ferme"}
        </span>
      </button>
      {open ? <div className="border-t border-border/50 p-3">{children}</div> : null}
    </div>
  );
}

function getStyleTargetIdForRow(view: ReferenceView | null, values: Record<string, string>): string | null {
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

function getPatternCss(
  patternType: MapPatternType | null,
  patternColor: string,
) {
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

function createStylePreview(
  fill: string,
  stroke: string,
  patternType: string,
  patternColor: string,
) {
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

function isHexColorInputValid(value: string): boolean {
  return value.trim().length === 0 || normalizeHexColor(value) !== null;
}

function isPatternTypeInputValid(value: string): boolean {
  return value.trim().length === 0 || value === "none" || normalizePatternType(value) !== null;
}

function StylePreview({
  fill,
  stroke,
  patternType,
  patternColor,
}: {
  fill: string;
  stroke: string;
  patternType: string;
  patternColor: string;
}) {
  const preview = createStylePreview(fill, stroke, patternType, patternColor);
  const patternCss = getPatternCss(preview.patternType, preview.patternColor);

  return (
    <div
      className="h-10 w-16 rounded-[12px] border"
      style={{
        backgroundColor: normalizeHexColor(fill) ? preview.fill : "transparent",
        ...patternCss,
        borderColor: preview.stroke,
      }}
      aria-hidden="true"
    />
  );
}

function isPreviewImageUrl(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("/uploads/map-icons/");
}

function ImagePreview({ imageUrl, imageAlt }: { imageUrl: string; imageAlt: string }) {
  const [hasError, setHasError] = useState(false);
  const trimmedUrl = imageUrl.trim();

  if (!trimmedUrl) {
    return <p className="text-sm text-muted-foreground">Aucune image renseignee.</p>;
  }

  if (!isPreviewImageUrl(trimmedUrl)) {
    return <p className="text-sm text-muted-foreground">Image non disponible pour l’instant.</p>;
  }

  if (hasError) {
    return <p className="text-sm text-muted-foreground">Impossible de charger l’image pour l’instant.</p>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={trimmedUrl}
      alt={imageAlt.trim() || "Apercu de l’icone"}
      className="max-h-28 max-w-full rounded-[14px] border border-border/60 bg-background/35 p-2"
      onError={() => setHasError(true)}
    />
  );
}

function buildStylePayload(
  view: ReferenceView | null,
  values: Record<string, string>,
): AdminStyleUpsertInput | null {
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2.5 first:pt-0 last:border-b-0 last:pb-0">
      <p className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="text-right text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

function createLoggedOutSession(): AdminSession {
  return {
    authenticated: false,
    username: null,
    role: null,
    is_tech_admin: false,
  };
}

function getRoleLabel(role: AdminRole): string {
  return role === "tech_admin" ? "Admin technique" : "Staff";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = "Requete impossible.";

    try {
      const data = (await response.json()) as { error?: string };

      if (data.error) {
        message = data.error;
      }
    } catch {}

    throw new Error(message);
  }

  return (await response.json()) as T;
}

async function uploadMapIconFile(file: File): Promise<MapIconUploadMetadata> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch("/api/admin/tech/uploads/map-icons", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = "Upload impossible.";

    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) {
        message = data.error;
      }
    } catch {}

    throw new Error(message);
  }

  return (await response.json()) as MapIconUploadMetadata;
}

function rowValueToInputValue(value: string | number | boolean | null): string {
  if (value === null) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

function createEmptyRowValues(definition: ReferenceTableDefinition): Record<string, string> {
  return Object.fromEntries(definition.fields.map((field) => [field.name, ""]));
}

function toEditableRow(definition: ReferenceTableDefinition, row: ReferenceTableRow): EditableRow {
  const updatedByUsername = row["updated_by_username"];

  return {
    localId: `${definition.key}:${row[definition.primary_key] ?? crypto.randomUUID()}`,
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

function withStyleValues(
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

function buildRowPayload(definition: ReferenceTableDefinition, row: EditableRow): Record<string, string> {
  return Object.fromEntries(
    definition.fields
      .filter((field) => !field.readOnly)
      .map((field) => [field.name, row.values[field.name] ?? ""]),
  );
}

function FieldEditor({
  field,
  value,
  disabled,
  options,
  onChange,
}: {
  field: TechFieldDefinition;
  value: string;
  disabled: boolean;
  options?: ReferenceOption[];
  onChange: (value: string) => void;
}) {
  const className =
    "w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60";

  if (field.readOnly) {
    return (
      <div className="rounded-[14px] border border-border/60 bg-background/35 px-3 py-2 text-sm text-muted-foreground">
        {value || "—"}
      </div>
    );
  }

  if (field.reference_table_key && options !== undefined) {
    return (
      <select
        className={className}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Non renseigne</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "boolean") {
    return (
      <select
        className={className}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Non renseigne</option>
        <option value="true">Oui</option>
        <option value="false">Non</option>
      </select>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        className={`${className} min-h-24 resize-y`}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <input
      className={className}
      type={field.type === "integer" || field.type === "number" ? "number" : "text"}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

const dynamicFieldTypeOptions: Array<{
  value: DynamicCaseTableFieldType;
  label: string;
}> = [
  { value: "text", label: "Texte court" },
  { value: "textarea", label: "Texte long" },
  { value: "boolean", label: "Oui / non" },
  { value: "integer", label: "Nombre entier" },
  { value: "datetime", label: "Date / heure" },
  { value: "reference", label: "Choix dans une liste" },
];

function toSnakeCaseIdentifier(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function shouldReplaceAutoValue(currentValue: string, previousSuggestedValue: string): boolean {
  const normalizedCurrent = currentValue.trim();
  return normalizedCurrent.length === 0 || normalizedCurrent === previousSuggestedValue;
}

function applyReferenceAutoFill(
  tableKey: ReferenceTableKey,
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

function getFieldTypeLabel(value: DynamicCaseTableFieldType): string {
  return (
    dynamicFieldTypeOptions.find((option) => option.value === value)?.label ?? value
  );
}

function getFriendlyFieldLabel(fieldName: string): string {
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

function getOptionLabel(options: ReferenceOption[] | undefined, value: string): string {
  return options?.find((option) => option.value === value)?.label ?? value;
}

export function TechnicalAdminPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("references");
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [referenceStatuses, setReferenceStatuses] = useState<ReferenceTableStatus[]>([]);
  const [activeReferenceViewId, setActiveReferenceViewId] = useState<string | null>(null);
  const [referenceRows, setReferenceRows] = useState<EditableRow[]>([]);
  const [selectedReferenceRowId, setSelectedReferenceRowId] = useState<string | null>(null);
  const [referenceSearchInput, setReferenceSearchInput] = useState("");
  const [referenceSearch, setReferenceSearch] = useState("");
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [referenceRowsLoading, setReferenceRowsLoading] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceFieldOptions, setReferenceFieldOptions] = useState<Record<string, ReferenceOption[]>>({});
  const [terrainCategoryOptions, setTerrainCategoryOptions] = useState<Array<{ value: string; label: string }>>([]);

  const [schemaSummaries, setSchemaSummaries] = useState<DynamicCaseTableSummary[]>([]);
  const [activeSchemaKey, setActiveSchemaKey] = useState<string | null>(null);
  const [activeSchemaDefinition, setActiveSchemaDefinition] = useState<DynamicCaseTableDefinition | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [createTableDraft, setCreateTableDraft] = useState<DynamicCaseTableCreateInput>({
    table_key: "",
    title: "",
    description: "",
  });
  const [createTablePending, setCreateTablePending] = useState(false);
  const [createTableError, setCreateTableError] = useState<string | null>(null);
  const [createTableKeyEdited, setCreateTableKeyEdited] = useState(false);
  const [showCreateTableForm, setShowCreateTableForm] = useState(false);
  const [schemaMetaDraft, setSchemaMetaDraft] = useState<DynamicCaseTableUpdateInput>({
    title: "",
    description: "",
    is_active: true,
  });
  const [schemaMetaPending, setSchemaMetaPending] = useState(false);
  const [schemaMetaError, setSchemaMetaError] = useState<string | null>(null);
  const [showEditSchemaMeta, setShowEditSchemaMeta] = useState(false);
  const [createFieldDraft, setCreateFieldDraft] = useState<DynamicCaseTableFieldCreateInput>({
    field_key: "",
    label: "",
    field_type: "text",
    reference_table_key: null,
    reference_group_key: null,
  });
  const [createFieldPending, setCreateFieldPending] = useState(false);
  const [createFieldError, setCreateFieldError] = useState<string | null>(null);
  const [createFieldKeyEdited, setCreateFieldKeyEdited] = useState(false);
  const [showCreateFieldForm, setShowCreateFieldForm] = useState(false);
  const [nomenclatureGroups, setNomenclatureGroups] = useState<string[]>([]);
  const [staffAccounts, setStaffAccounts] = useState<StaffAccountSummary[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<number | null>(null);
  const [sidebarSectionOpenState, setSidebarSectionOpenState] = useState<Record<string, boolean>>({});
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [createAccountDraft, setCreateAccountDraft] = useState<StaffAccountCreateInput>({
    username: "",
    password: "",
    role: "staff",
  });
  const [createAccountPending, setCreateAccountPending] = useState(false);
  const [createAccountError, setCreateAccountError] = useState<string | null>(null);
  const [showCreateAccountForm, setShowCreateAccountForm] = useState(false);
  const [accountUpdateRole, setAccountUpdateRole] = useState<AdminRole>("staff");
  const [accountUpdateIsActive, setAccountUpdateIsActive] = useState(true);
  const [accountUpdatePending, setAccountUpdatePending] = useState(false);
  const [accountUpdateError, setAccountUpdateError] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);

  const nomenclatureStatus = useMemo(
    () => referenceStatuses.find((table) => table.definition.key === "nomenclatures") ?? null,
    [referenceStatuses],
  );
  const nomenclatureGroupCounts = useMemo(
    () =>
      Object.fromEntries(
        (nomenclatureStatus?.group_counts ?? []).map((group) => [group.group_key, group.row_count]),
      ),
    [nomenclatureStatus],
  );
  const referenceViewSections = useMemo<ReferenceViewSection[]>(() => {
    const sections: ReferenceViewSection[] = [];
    const addSection = (section: ReferenceViewSection) => {
      if (section.views.length > 0) {
        sections.push(section);
      }
    };

    addSection({
      id: "terrains",
      title: "Terrains",
      views: [
        {
          id: "nomenclatures:terrain_cat",
          tableKey: "nomenclatures",
          title: "Categories de terrain",
          groupKey: "terrain_cat",
          rowCount: nomenclatureGroupCounts.terrain_cat ?? 0,
        },
        {
          id: "nomenclatures:terrain_type",
          tableKey: "nomenclatures",
          title: "Types de terrain",
          groupKey: "terrain_type",
          rowCount: nomenclatureGroupCounts.terrain_type ?? 0,
          styleTargetType: "terrain_type",
          supportsTerrainParentSelect: true,
        },
        {
          id: "nomenclatures:relief",
          tableKey: "nomenclatures",
          title: "Reliefs",
          groupKey: "relief",
          rowCount: nomenclatureGroupCounts.relief ?? 0,
          styleTargetType: "relief",
        },
      ],
    });

    addSection({
      id: "controle",
      title: "Controle",
      views: [
        {
          id: "nomenclatures:controle_type",
          tableKey: "nomenclatures",
          title: "Types de controle",
          groupKey: "controle_type",
          rowCount: nomenclatureGroupCounts.controle_type ?? 0,
        },
        {
          id: "factions",
          tableKey: "factions",
          title: "Factions",
          groupKey: null,
          rowCount:
            referenceStatuses.find((table) => table.definition.key === "factions")?.row_count ?? 0,
          styleTargetType: "faction",
        },
        {
          id: "controleurs",
          tableKey: "controleurs",
          title: "Controleurs",
          groupKey: null,
          rowCount:
            referenceStatuses.find((table) => table.definition.key === "controleurs")?.row_count ?? 0,
          styleTargetType: "controleur",
        },
      ],
    });

    addSection({
      id: "peuples",
      title: "Peuples",
      views: [
        {
          id: "races",
          tableKey: "races",
          title: "Races",
          groupKey: null,
          rowCount:
            referenceStatuses.find((table) => table.definition.key === "races")?.row_count ?? 0,
        },
        {
          id: "peuples-reference",
          tableKey: "peuples",
          title: "Peuples",
          groupKey: null,
          rowCount:
            referenceStatuses.find((table) => table.definition.key === "peuples")?.row_count ?? 0,
        },
      ],
    });

    addSection({
      id: "objets-cartographiques",
      title: "Objets cartographiques",
      views: [
        {
          id: "map_icons",
          tableKey: "map_icons",
          title: "Icones de carte",
          groupKey: null,
          rowCount:
            referenceStatuses.find((table) => table.definition.key === "map_icons")?.row_count ?? 0,
        },
        {
          id: "locality_types",
          tableKey: "locality_types",
          title: "Types de localites",
          groupKey: null,
          rowCount:
            referenceStatuses.find((table) => table.definition.key === "locality_types")?.row_count ?? 0,
        },
        {
          id: "landmark_types",
          tableKey: "landmark_types",
          title: "Types de landmarks",
          groupKey: null,
          rowCount:
            referenceStatuses.find((table) => table.definition.key === "landmark_types")?.row_count ?? 0,
        },
        {
          id: "force_types",
          tableKey: "force_types",
          title: "Types de forces",
          groupKey: null,
          rowCount:
            referenceStatuses.find((table) => table.definition.key === "force_types")?.row_count ?? 0,
        },
      ],
    });

    return sections;
  }, [nomenclatureGroupCounts, referenceStatuses]);
  const activeReferenceView = useMemo(
    () =>
      referenceViewSections
        .flatMap((section) => section.views)
        .find((view) => view.id === activeReferenceViewId) ?? null,
    [activeReferenceViewId, referenceViewSections],
  );
  const activeReference = useMemo(
    () =>
      activeReferenceView
        ? referenceStatuses.find((table) => table.definition.key === activeReferenceView.tableKey) ?? null
        : null,
    [activeReferenceView, referenceStatuses],
  );
  const sidebarSections = useMemo<SidebarSection[]>(
    () => [
      {
        id: "terrains",
        title: "Terrains",
        items:
          referenceViewSections
            .find((section) => section.id === "terrains")
            ?.views.map((view) => ({
              kind: "reference" as const,
              id: view.id,
              label: view.title,
              count: view.rowCount,
            })) ?? [],
      },
      {
        id: "controle",
        title: "Controle",
        items:
          referenceViewSections
            .find((section) => section.id === "controle")
            ?.views.map((view) => ({
              kind: "reference" as const,
              id: view.id,
              label: view.title,
              count: view.rowCount,
            })) ?? [],
      },
      {
        id: "peuples",
        title: "Peuples",
        items:
          referenceViewSections
            .find((section) => section.id === "peuples")
            ?.views.map((view) => ({
              kind: "reference" as const,
              id: view.id,
              label: view.title,
              count: view.rowCount,
            })) ?? [],
      },
      {
        id: "objets-cartographiques",
        title: "Objets cartographiques",
        items:
          referenceViewSections
            .find((section) => section.id === "objets-cartographiques")
            ?.views.map((view) => ({
              kind: "reference" as const,
              id: view.id,
              label: view.title,
              count: view.rowCount,
            })) ?? [],
      },
      {
        id: "schema",
        title: "Champs personnalises",
        items:
          schemaSummaries.length > 0
            ? schemaSummaries.map((table) => ({
                kind: "schema" as const,
                id: table.table_key,
                label: table.title,
                count: table.field_count,
              }))
            : [{ kind: "schema" as const, id: "__schema__", label: "Tables metier dynamiques", count: null }],
      },
      {
        id: "accounts",
        title: "Comptes staff",
        items:
          staffAccounts.length > 0
            ? staffAccounts.map((account) => ({
                kind: "account" as const,
                id: String(account.id),
                label: account.username,
                count: null,
              }))
            : [{ kind: "account" as const, id: "__accounts__", label: "Utilisateurs", count: null }],
      },
    ],
    [referenceViewSections, schemaSummaries, staffAccounts],
  );
  const activeSidebarSectionIds = useMemo(() => {
    const activeIds: string[] = [];

    if (activeTab === "references" && activeReferenceViewId) {
      const activeSection = referenceViewSections.find((section) =>
        section.views.some((view) => view.id === activeReferenceViewId),
      );

      if (activeSection) {
        activeIds.push(activeSection.id);
      }
    }

    if (activeTab === "schema") {
      activeIds.push("schema");
    }

    if (activeTab === "accounts") {
      activeIds.push("accounts");
    }

    return activeIds;
  }, [activeReferenceViewId, activeTab, referenceViewSections]);
  const selectedReferenceStatus = useMemo(
    () =>
      createFieldDraft.reference_table_key
        ? referenceStatuses.find(
            (table) => table.definition.key === createFieldDraft.reference_table_key,
          ) ?? null
        : null,
    [createFieldDraft.reference_table_key, referenceStatuses],
  );
  const suggestedTableKey = useMemo(
    () => toSnakeCaseIdentifier(createTableDraft.title),
    [createTableDraft.title],
  );
  const suggestedFieldKey = useMemo(
    () => toSnakeCaseIdentifier(createFieldDraft.label),
    [createFieldDraft.label],
  );
  const activeStaffAccount = useMemo(
    () => staffAccounts.find((account) => account.id === activeAccountId) ?? null,
    [activeAccountId, staffAccounts],
  );
  const terrainCategoryLabelByKey = useMemo(
    () =>
      Object.fromEntries(
        terrainCategoryOptions.map((option) => [option.value, option.label]),
      ),
    [terrainCategoryOptions],
  );

  const hydrateSession = useCallback(async () => {
    try {
      const nextSession = await fetchJson<AdminSession>("/api/admin/session");
      setSession(nextSession);
      return nextSession;
    } catch {
      const loggedOut = createLoggedOutSession();
      setSession(loggedOut);
      return loggedOut;
    }
  }, []);

  const loadReferenceStatuses = useCallback(async () => {
    setReferencesLoading(true);
    setGlobalError(null);

    try {
      const nextStatuses = await fetchJson<ReferenceTableStatus[]>("/api/admin/tech/references");
      setReferenceStatuses(nextStatuses);
      const nomenclatureGroups =
        nextStatuses.find((table) => table.definition.key === "nomenclatures")?.group_counts ?? [];
      setNomenclatureGroups(nomenclatureGroups.map((group) => group.group_key).sort());
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Chargement des referentiels impossible.");
    } finally {
      setReferencesLoading(false);
    }
  }, []);

  const loadReferenceRows = useCallback(
    async (
      tableKey: ReferenceTableKey,
      search: string,
      groupKey: string | null = null,
      view: ReferenceView | null = null,
    ) => {
      setReferenceRowsLoading(true);
      setReferenceError(null);

      try {
        const params = new URLSearchParams({ limit: "250" });

        if (search.trim().length > 0) {
          params.set("search", search.trim());
        }

        if (groupKey) {
          params.set("group", groupKey);
        }

        const response = await fetchJson<ReferenceTableRowsResponse>(
          `/api/admin/tech/references/${tableKey}?${params.toString()}`,
        );
        const nextRows = response.rows.map((row) =>
          withStyleValues(toEditableRow(response.definition, row), view, response.styles),
        );
        setReferenceRows(nextRows);
        setReferenceFieldOptions(response.field_options ?? {});
        setSelectedReferenceRowId(null);
      } catch (error) {
        setReferenceError(error instanceof Error ? error.message : "Chargement des lignes impossible.");
        setReferenceRows([]);
        setReferenceFieldOptions({});
        setSelectedReferenceRowId(null);
      } finally {
        setReferenceRowsLoading(false);
      }
    },
    [],
  );

  const loadTerrainCategoryOptions = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        limit: "250",
        group: "terrain_cat",
      });
      const response = await fetchJson<ReferenceTableRowsResponse>(
        `/api/admin/tech/references/nomenclatures?${params.toString()}`,
      );
      setTerrainCategoryOptions(
        response.rows.map((row) => ({
          value: rowValueToInputValue(row.entry_key ?? ""),
          label: rowValueToInputValue(row.label ?? row.entry_key ?? ""),
        })),
      );
    } catch {
      setTerrainCategoryOptions([]);
    }
  }, []);

  const loadSchemaSummaries = useCallback(async () => {
    setSchemaLoading(true);
    setSchemaError(null);

    try {
      const nextSummaries = await fetchJson<DynamicCaseTableSummary[]>("/api/admin/tech/schema/tables");
      setSchemaSummaries(nextSummaries);
      setActiveSchemaKey((current) => current ?? nextSummaries[0]?.table_key ?? null);
    } catch (error) {
      setSchemaError(error instanceof Error ? error.message : "Chargement du schema impossible.");
    } finally {
      setSchemaLoading(false);
    }
  }, []);

  const loadSchemaDefinition = useCallback(async (tableKey: string) => {
    setSchemaError(null);

    try {
      const definition = await fetchJson<DynamicCaseTableDefinition>(
        `/api/admin/tech/schema/tables/${tableKey}`,
      );
      setActiveSchemaDefinition(definition);
      setSchemaMetaDraft({
        title: definition.title,
        description: definition.description ?? "",
        is_active: definition.is_active,
      });
    } catch (error) {
      setSchemaError(error instanceof Error ? error.message : "Lecture de table impossible.");
      setActiveSchemaDefinition(null);
    }
  }, []);

  const loadStaffAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError(null);

    try {
      const nextAccounts = await fetchJson<StaffAccountSummary[]>("/api/admin/tech/staff-users");
      setStaffAccounts(nextAccounts);
      setActiveAccountId((current) => current ?? nextAccounts[0]?.id ?? null);
    } catch (error) {
      setAccountsError(error instanceof Error ? error.message : "Chargement des comptes impossible.");
      setStaffAccounts([]);
      setActiveAccountId(null);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void hydrateSession().then((nextSession) => {
      if (cancelled) {
        return;
      }

      if (!nextSession.is_tech_admin) {
        setReferencesLoading(false);
        setSchemaLoading(false);
        setAccountsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [hydrateSession]);

  useEffect(() => {
    if (!session?.is_tech_admin) {
      return;
    }

    void loadReferenceStatuses();
    void loadTerrainCategoryOptions();
    void loadSchemaSummaries();
    void loadStaffAccounts();
  }, [
    loadReferenceStatuses,
    loadSchemaSummaries,
    loadStaffAccounts,
    loadTerrainCategoryOptions,
    session?.is_tech_admin,
  ]);

  useEffect(() => {
    if (!session?.is_tech_admin || !activeReferenceView) {
      return;
    }

    void loadReferenceRows(
      activeReferenceView.tableKey,
      referenceSearch,
      activeReferenceView.groupKey,
      activeReferenceView,
    );
  }, [activeReferenceView, loadReferenceRows, referenceSearch, session?.is_tech_admin]);

  useEffect(() => {
    const firstViewId = referenceViewSections[0]?.views[0]?.id ?? null;

    setActiveReferenceViewId((current) => {
      if (current && referenceViewSections.some((section) => section.views.some((view) => view.id === current))) {
        return current;
      }

      return firstViewId;
    });
  }, [referenceViewSections]);

  useEffect(() => {
    setReferenceSearch("");
    setReferenceSearchInput("");
  }, [activeReferenceViewId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(SIDEBAR_SECTION_STORAGE_KEY);

      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as Record<string, boolean>;
      setSidebarSectionOpenState((current) => (Object.keys(current).length > 0 ? current : parsed));
    } catch {
      // ignore malformed local storage payloads
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      SIDEBAR_SECTION_STORAGE_KEY,
      JSON.stringify(sidebarSectionOpenState),
    );
  }, [sidebarSectionOpenState]);

  useEffect(() => {
    if (activeSidebarSectionIds.length === 0) {
      return;
    }

    setSidebarSectionOpenState((current) => {
      const nextState = { ...current };

      for (const sectionId of activeSidebarSectionIds) {
        nextState[sectionId] = true;
      }

      return nextState;
    });
  }, [activeSidebarSectionIds]);

  useEffect(() => {
    if (!session?.is_tech_admin || !activeSchemaKey) {
      setActiveSchemaDefinition(null);
      return;
    }

    void loadSchemaDefinition(activeSchemaKey);
  }, [activeSchemaKey, loadSchemaDefinition, session?.is_tech_admin]);

  useEffect(() => {
    if (!createTableKeyEdited) {
      setCreateTableDraft((current) =>
        current.table_key === suggestedTableKey ? current : { ...current, table_key: suggestedTableKey },
      );
    }
  }, [createTableKeyEdited, suggestedTableKey]);

  useEffect(() => {
    if (!createFieldKeyEdited) {
      setCreateFieldDraft((current) =>
        current.field_key === suggestedFieldKey ? current : { ...current, field_key: suggestedFieldKey },
      );
    }
  }, [createFieldKeyEdited, suggestedFieldKey]);

  useEffect(() => {
    if (!activeStaffAccount) {
      return;
    }

    setAccountUpdateRole(activeStaffAccount.role);
    setAccountUpdateIsActive(activeStaffAccount.is_active);
    setAccountUpdateError(null);
  }, [activeStaffAccount]);

  useEffect(() => {
    setShowEditSchemaMeta(false);
    setShowCreateFieldForm(false);
  }, [activeSchemaKey]);

  useEffect(() => {
    setEditingAccountId(null);
  }, [activeAccountId]);

  const handleLogout = useCallback(async () => {
    try {
      await fetchJson<AdminSession>("/api/admin/session", {
        method: "DELETE",
        body: JSON.stringify({}),
      });
    } finally {
      setSession(createLoggedOutSession());
      window.location.href = "/";
    }
  }, []);

  const handleReferenceRowValueChange = useCallback((localId: string, fieldName: string, value: string) => {
    setReferenceRows((current) =>
      current.map((row) =>
        row.localId === localId
          ? (() => {
              const rawNextValues = {
                ...row.values,
                [fieldName]: value,
              };
              const nextValues = activeReference
                ? applyReferenceAutoFill(activeReference.definition.key, row.values, rawNextValues)
                : rawNextValues;

              if (fieldName === "pattern_type" && value === "none") {
                nextValues.pattern_color = "";
              }

              if (
                fieldName === "pattern_type" &&
                value !== "none" &&
                nextValues.pattern_color.trim().length === 0
              ) {
                nextValues.pattern_color = DEFAULT_PATTERN_COLOR;
              }

              return {
                ...row,
                values: nextValues,
                error: null,
              };
            })()
          : row,
      ),
    );
  }, [activeReference]);

  const handleMapIconUpload = useCallback(async (row: EditableRow, file: File | null) => {
    if (!file) {
      return;
    }

    setReferenceRows((current) =>
      current.map((item) =>
        item.localId === row.localId ? { ...item, uploading: true, error: null } : item,
      ),
    );

    try {
      const uploaded = await uploadMapIconFile(file);

      setReferenceRows((current) =>
        current.map((item) =>
          item.localId === row.localId
            ? {
                ...item,
                uploading: false,
                values: applyReferenceAutoFill("map_icons", item.values, {
                  ...item.values,
                  image_path: uploaded.image_path,
                  image_original_name: uploaded.image_original_name,
                  image_mime_type: uploaded.image_mime_type,
                  image_size_bytes: String(uploaded.image_size_bytes),
                  image_alt: item.values.image_alt || item.values.label || file.name,
                }),
              }
            : item,
        ),
      );
    } catch (error) {
      setReferenceRows((current) =>
        current.map((item) =>
          item.localId === row.localId
            ? {
                ...item,
                uploading: false,
                error: error instanceof Error ? error.message : "Upload impossible.",
              }
            : item,
        ),
      );
    }
  }, []);

  const handleAddReferenceRow = useCallback(() => {
    if (!activeReference || !activeReferenceView) {
      return;
    }

    const localId = crypto.randomUUID();
    setReferenceRows((current) => [
      {
        localId,
        values: {
          ...createEmptyRowValues(activeReference.definition),
          ...(activeReferenceView.groupKey ? { group_key: activeReferenceView.groupKey } : {}),
          ...(activeReferenceView.styleTargetType
            ? {
                stroke: DEFAULT_STYLE_STROKE,
                pattern_type: "none",
                pattern_color: "",
              }
            : {}),
        },
        originalPrimaryKey: "",
        saving: false,
        uploading: false,
        error: null,
        isNew: true,
      },
      ...current,
    ]);
    setSelectedReferenceRowId(localId);
  }, [activeReference, activeReferenceView]);

  const handleSaveReferenceRow = useCallback(
    async (row: EditableRow) => {
      if (!activeReference) {
        return;
      }

      if (!isHexColorInputValid(row.values.fill ?? "")) {
        setReferenceRows((current) =>
          current.map((item) =>
            item.localId === row.localId
              ? { ...item, error: "Couleur de fond invalide." }
              : item,
          ),
        );
        return;
      }

      if (!isHexColorInputValid(row.values.stroke ?? "")) {
        setReferenceRows((current) =>
          current.map((item) =>
            item.localId === row.localId
              ? { ...item, error: "Couleur de contour invalide." }
              : item,
          ),
        );
        return;
      }

      if (!isPatternTypeInputValid(row.values.pattern_type ?? "")) {
        setReferenceRows((current) =>
          current.map((item) =>
            item.localId === row.localId
              ? { ...item, error: "Motif invalide." }
              : item,
          ),
        );
        return;
      }

      if (!isHexColorInputValid(row.values.pattern_color ?? "")) {
        setReferenceRows((current) =>
          current.map((item) =>
            item.localId === row.localId
              ? { ...item, error: "Couleur du motif invalide." }
              : item,
          ),
        );
        return;
      }

      setReferenceRows((current) =>
        current.map((item) =>
          item.localId === row.localId ? { ...item, saving: true, error: null } : item,
        ),
      );

      try {
        const savedRow = await fetchJson<ReferenceTableRow>(
          `/api/admin/tech/references/${activeReference.definition.key}`,
          {
            method: "POST",
            body: JSON.stringify({
              row: buildRowPayload(activeReference.definition, row),
            }),
          },
        );

        const nextBaseRow = {
          ...toEditableRow(activeReference.definition, savedRow),
          values: {
            ...toEditableRow(activeReference.definition, savedRow).values,
            fill: row.values.fill ?? "",
            stroke: row.values.stroke ?? "",
            pattern_type: row.values.pattern_type ?? "none",
            pattern_color: row.values.pattern_color ?? "",
          },
        };
        const styleTargetId = getStyleTargetIdForRow(activeReferenceView ?? null, nextBaseRow.values);
        const stylePayload = buildStylePayload(activeReferenceView ?? null, nextBaseRow.values);

        if (activeReferenceView?.styleTargetType && styleTargetId) {
          await fetchJson("/api/admin/tech/styles", {
            method: "POST",
            body: JSON.stringify(
              stylePayload ?? {
                target_type: activeReferenceView.styleTargetType,
                target_id: styleTargetId,
                fill: null,
                stroke: null,
                pattern_type: null,
                pattern_color: null,
              },
            ),
          });
        }

        const nextRow = nextBaseRow;
        setReferenceRows((current) =>
          current.map((item) => (item.localId === row.localId ? nextRow : item)),
        );
        if (activeReferenceView?.groupKey === "terrain_cat") {
          await loadTerrainCategoryOptions();
        }
      } catch (error) {
        setReferenceRows((current) =>
          current.map((item) =>
            item.localId === row.localId
              ? {
                  ...item,
                  saving: false,
                  error: error instanceof Error ? error.message : "Enregistrement impossible.",
                }
              : item,
          ),
        );
      }
    },
    [
      activeReference,
      activeReferenceView,
      loadTerrainCategoryOptions,
    ],
  );

  const handleDeleteReferenceRow = useCallback(
    async (row: EditableRow) => {
      if (!activeReference) {
        return;
      }

      if (row.isNew || row.originalPrimaryKey.length === 0) {
        setReferenceRows((current) => current.filter((item) => item.localId !== row.localId));
        setSelectedReferenceRowId((current) => (current === row.localId ? null : current));
        return;
      }

      if (!window.confirm("Supprimer cette ligne ?")) {
        return;
      }

      try {
        const styleTargetId = getStyleTargetIdForRow(activeReferenceView ?? null, row.values);
        await fetchJson(
          `/api/admin/tech/references/${activeReference.definition.key}?pk=${encodeURIComponent(
            row.originalPrimaryKey,
          )}`,
          {
            method: "DELETE",
          },
        );
        if (activeReferenceView?.styleTargetType && styleTargetId) {
          await fetchJson("/api/admin/tech/styles", {
            method: "POST",
            body: JSON.stringify({
              target_type: activeReferenceView.styleTargetType,
              target_id: styleTargetId,
              fill: null,
              stroke: null,
              pattern_type: null,
              pattern_color: null,
            }),
          });
        }
        setReferenceRows((current) => current.filter((item) => item.localId !== row.localId));
        setSelectedReferenceRowId((current) => (current === row.localId ? null : current));
        await Promise.all([
          loadReferenceStatuses(),
          activeReferenceView?.groupKey === "terrain_cat" ? loadTerrainCategoryOptions() : Promise.resolve(),
        ]);
      } catch (error) {
        setReferenceRows((current) =>
          current.map((item) =>
            item.localId === row.localId
              ? {
                  ...item,
                  error: error instanceof Error ? error.message : "Suppression impossible.",
                }
              : item,
          ),
        );
      }
    },
    [
      activeReference,
      activeReferenceView,
      loadReferenceStatuses,
      loadTerrainCategoryOptions,
    ],
  );

  const handleCreateSchemaTable = useCallback(async () => {
    setCreateTablePending(true);
    setCreateTableError(null);

    try {
      const result = await fetchJson<{ definition: DynamicCaseTableDefinition }>(
        "/api/admin/tech/schema/tables",
        {
          method: "POST",
          body: JSON.stringify(createTableDraft),
        },
      );

      setCreateTableDraft({
        table_key: "",
        title: "",
        description: "",
      });
      setCreateTableKeyEdited(false);
      setShowCreateTableForm(false);
      await loadSchemaSummaries();
      setActiveSchemaKey(result.definition.table_key);
    } catch (error) {
      setCreateTableError(error instanceof Error ? error.message : "Creation impossible.");
    } finally {
      setCreateTablePending(false);
    }
  }, [createTableDraft, loadSchemaSummaries]);

  const handleSaveSchemaMeta = useCallback(async () => {
    if (!activeSchemaDefinition) {
      return;
    }

    setSchemaMetaPending(true);
    setSchemaMetaError(null);

    try {
      const updated = await fetchJson<DynamicCaseTableDefinition>(
        `/api/admin/tech/schema/tables/${activeSchemaDefinition.table_key}`,
        {
          method: "PATCH",
          body: JSON.stringify(schemaMetaDraft),
        },
      );
      setActiveSchemaDefinition(updated);
      setSchemaSummaries((current) =>
        current.map((summary) =>
          summary.table_key === updated.table_key
            ? {
                ...summary,
                title: updated.title,
                description: updated.description,
                is_active: updated.is_active,
                field_count: updated.fields.length,
              }
            : summary,
        ),
      );
    } catch (error) {
      setSchemaMetaError(error instanceof Error ? error.message : "Mise a jour impossible.");
    } finally {
      setSchemaMetaPending(false);
    }
  }, [activeSchemaDefinition, schemaMetaDraft]);

  const handleCreateField = useCallback(async () => {
    if (!activeSchemaDefinition) {
      return;
    }

    setCreateFieldPending(true);
    setCreateFieldError(null);

    try {
      const result = await fetchJson<{ definition: DynamicCaseTableDefinition }>(
        `/api/admin/tech/schema/tables/${activeSchemaDefinition.table_key}/fields`,
        {
          method: "POST",
          body: JSON.stringify(createFieldDraft),
        },
      );
      setActiveSchemaDefinition(result.definition);
      setCreateFieldDraft({
        field_key: "",
        label: "",
        field_type: "text",
        reference_table_key: null,
        reference_group_key: null,
      });
      setCreateFieldKeyEdited(false);
      setShowCreateFieldForm(false);
      setSchemaSummaries((current) =>
        current.map((summary) =>
          summary.table_key === result.definition.table_key
            ? {
                ...summary,
                title: result.definition.title,
                description: result.definition.description,
                is_active: result.definition.is_active,
                field_count: result.definition.fields.length,
              }
            : summary,
        ),
      );
    } catch (error) {
      setCreateFieldError(error instanceof Error ? error.message : "Ajout de champ impossible.");
    } finally {
      setCreateFieldPending(false);
    }
  }, [activeSchemaDefinition, createFieldDraft]);

  const handleCreateAccount = useCallback(async () => {
    setCreateAccountPending(true);
    setCreateAccountError(null);

    try {
      const createdAccount = await fetchJson<StaffAccountSummary>("/api/admin/tech/staff-users", {
        method: "POST",
        body: JSON.stringify(createAccountDraft),
      });

      setCreateAccountDraft({
        username: "",
        password: "",
        role: "staff",
      });
      setShowCreateAccountForm(false);
      setStaffAccounts((current) => [...current, createdAccount]);
      setActiveAccountId(createdAccount.id);
      await hydrateSession();
    } catch (error) {
      setCreateAccountError(error instanceof Error ? error.message : "Creation de compte impossible.");
    } finally {
      setCreateAccountPending(false);
    }
  }, [createAccountDraft, hydrateSession]);

  const handleUpdateAccount = useCallback(async () => {
    if (!activeStaffAccount) {
      return;
    }

    setAccountUpdatePending(true);
    setAccountUpdateError(null);

    try {
      const updatedAccount = await fetchJson<StaffAccountSummary>(
        `/api/admin/tech/staff-users/${activeStaffAccount.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            role: accountUpdateRole,
            is_active: accountUpdateIsActive,
          }),
        },
      );

      setStaffAccounts((current) =>
        current.map((account) => (account.id === updatedAccount.id ? updatedAccount : account)),
      );
      await hydrateSession();
      setEditingAccountId(null);
    } catch (error) {
      setAccountUpdateError(error instanceof Error ? error.message : "Mise a jour impossible.");
    } finally {
      setAccountUpdatePending(false);
    }
  }, [
    accountUpdateIsActive,
    accountUpdateRole,
    activeStaffAccount,
    hydrateSession,
  ]);

  const activeSchemaFieldCount = activeSchemaDefinition?.fields.length ?? 0;
  const selectedReferenceTableKey = createFieldDraft.reference_table_key ?? "";
  const canCreateTable =
    createTableDraft.title.trim().length > 0 && createTableDraft.table_key.trim().length > 0;
  const canCreateField =
    createFieldDraft.label.trim().length > 0 &&
    createFieldDraft.field_key.trim().length > 0 &&
    (createFieldDraft.field_type !== "reference" ||
      (selectedReferenceTableKey.length > 0 &&
        (selectedReferenceTableKey !== "nomenclatures" ||
          (createFieldDraft.reference_group_key ?? "").trim().length > 0)));
  const canCreateAccount =
    createAccountDraft.username.trim().length > 0 &&
    createAccountDraft.password.trim().length > 0;
  void [
    schemaSummaries,
    createTablePending,
    createTableError,
    showCreateTableForm,
    accountsError,
    createAccountPending,
    createAccountError,
    showCreateAccountForm,
    handleCreateSchemaTable,
    handleCreateAccount,
    canCreateTable,
    canCreateAccount,
  ];

  if (
    !session ||
    (session.is_tech_admin && (referencesLoading || schemaLoading || accountsLoading))
  ) {
    return (
      <AppShell>
        <SectionPanel className="p-6">
          <p className="text-sm text-muted-foreground">Chargement de l&apos;admin technique...</p>
        </SectionPanel>
      </AppShell>
    );
  }

  if (!session.authenticated) {
    return (
      <AppShell>
        <SectionPanel className="p-6">
          <h1 className="font-chronicle text-3xl text-foreground">Administration</h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Cette page est reservee au staff connecte.
          </p>
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link href="/">Retour a la carte</Link>
            </Button>
          </div>
        </SectionPanel>
      </AppShell>
    );
  }

  if (!session.is_tech_admin) {
    return (
      <AppShell>
        <SiteHeader
          adminAuthenticated
          adminModeEnabled
          navigationItems={[{ href: "/?admin=1", label: "Carte" }]}
          showAdminAction={false}
          onAdminAction={() => {}}
          onAdminLogout={() => void handleLogout()}
        />
        <SectionPanel className="p-6">
          <h1 className="font-chronicle text-3xl text-foreground">Administration</h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Cette page est reservee aux administrateurs techniques.
          </p>
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link href="/">Retour a la carte</Link>
            </Button>
          </div>
        </SectionPanel>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <SiteHeader
        adminAuthenticated
        adminModeEnabled
        navigationItems={[
          { href: "/?admin=1", label: "Carte" },
          ...(session.is_tech_admin ? [{ href: "/editeur", label: "Editeur" }] : []),
          ...(session.is_tech_admin ? [{ href: "/admin/tech", label: "Administration", current: true }] : []),
        ]}
        showAdminAction={false}
        onAdminAction={() => {}}
        onAdminLogout={() => void handleLogout()}
      />

      <section className="grid flex-1 gap-6 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <SectionPanel className="p-5 sm:p-6">
          <h1 className="font-chronicle text-3xl tracking-[0.04em] text-foreground">
            Administration
          </h1>

          {globalError ? <p className="mt-4 text-sm text-destructive">{globalError}</p> : null}

          <div className="mt-6 space-y-4">
            {sidebarSections.map((section) => (
              <CollapsibleSidebarSection
                key={section.id}
                title={section.title}
                open={sidebarSectionOpenState[section.id] ?? activeSidebarSectionIds.includes(section.id)}
                onToggle={() =>
                  setSidebarSectionOpenState((current) => ({
                    ...current,
                    [section.id]: !(current[section.id] ?? activeSidebarSectionIds.includes(section.id)),
                  }))
                }
              >
                <div className="space-y-2">
                  {section.items.map((item) => {
                    const isActive =
                      item.kind === "reference"
                        ? activeTab === "references" && item.id === activeReferenceViewId
                        : item.kind === "schema"
                          ? activeTab === "schema" && item.id === activeSchemaKey
                          : activeTab === "accounts" && item.id === String(activeAccountId);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`w-full rounded-[16px] border px-4 py-3 text-left transition ${
                          isActive
                            ? "border-primary/45 bg-primary/10"
                            : "border-border/70 bg-background/35 hover:border-primary/25 hover:bg-background/50"
                        }`}
                        onClick={() => {
                          if (item.kind === "reference") {
                            setActiveTab("references");
                            setActiveReferenceViewId(item.id);
                            return;
                          }

                          if (item.kind === "schema") {
                            setActiveTab("schema");
                            setActiveSchemaKey(item.id === "__schema__" ? null : item.id);
                            return;
                          }

                          setActiveTab("accounts");
                          setActiveAccountId(item.id === "__accounts__" ? null : Number(item.id));
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-foreground">{item.label}</span>
                          {item.count !== null ? (
                            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              {item.count}
                            </span>
                          ) : null}
                        </div>
                        {item.kind === "account" ? (
                          <span className="mt-1 block text-xs uppercase tracking-[0.14em] text-muted-foreground">
                            Utilisateur
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </CollapsibleSidebarSection>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel className="p-5 sm:p-6">
          {activeTab === "references" ? (
            activeReference ? (
              <>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-semibold text-foreground">
                        {activeReferenceView?.title ?? activeReference.definition.title}
                      </h2>
                      <Button
                        type="button"
                        onClick={handleAddReferenceRow}
                        disabled={!activeReferenceView}
                      >
                        Ajouter une valeur
                      </Button>
                    </div>

                    <form
                      className="flex gap-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        setReferenceSearch(referenceSearchInput.trim());
                      }}
                    >
                      <input
                        className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30 sm:w-72"
                        placeholder="Filtrer cette liste"
                        value={referenceSearchInput}
                        onChange={(event) => setReferenceSearchInput(event.target.value)}
                      />
                      <Button type="submit" variant="outline">
                        Filtrer
                      </Button>
                    </form>
                  </div>
                </div>

                {referenceError ? <p className="mt-4 text-sm text-destructive">{referenceError}</p> : null}

                <div className="mt-6 space-y-4">
                  {referenceRowsLoading ? (
                    <p className="text-sm text-muted-foreground">Chargement des lignes...</p>
                  ) : referenceRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune ligne pour cette vue.</p>
                  ) : (
                    <section className="rounded-[20px] border border-border/70 bg-background/35 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">Valeurs</p>
                        <p className="text-sm text-muted-foreground">{referenceRows.length} ligne(s)</p>
                      </div>
                      <div className="mt-4 space-y-3">
                        {referenceRows.map((row) => {
                          const displayFields = activeReference.definition.fields.filter(
                            (field) =>
                              !REFERENCE_TECHNICAL_FIELDS.has(field.name) &&
                              !STYLE_FIELDS.includes(field.name as StyleFieldName),
                          );
                          const technicalFields = activeReference.definition.fields.filter((field) =>
                            REFERENCE_TECHNICAL_FIELDS.has(field.name),
                          );
                          const terrainParentLabel =
                            terrainCategoryLabelByKey[row.values.parent_entry_key] ||
                            row.values.parent_entry_key ||
                            "Type sans categorie parente";
                          const showStyles = Boolean(activeReferenceView?.styleTargetType);
                          const hasImageFields =
                            activeReference.definition.fields.some((field) => field.name === "image_path") &&
                            activeReference.definition.fields.some((field) => field.name === "image_alt");
                          const previewAlt =
                            row.values.image_alt ||
                            row.values.label ||
                            row.values.nom ||
                            row.values.icon_key ||
                            "Apercu";
                          const summaryText =
                            activeReference.definition.key === "peuples"
                              ? row.values.race_key
                                ? getOptionLabel(referenceFieldOptions.race_key, row.values.race_key)
                                : "Race non renseignee"
                              : activeReferenceView?.groupKey === "terrain_type"
                                  ? terrainParentLabel
                                  : displayFields
                                      .map((field) => row.values[field.name])
                                      .find((value) => value && value.trim().length > 0) ||
                                    "Aucun detail visible";

                          return (
                            <details
                              key={row.localId}
                              open={selectedReferenceRowId === row.localId}
                              className="rounded-[16px] border border-border/60 bg-background/30 px-4 py-3"
                            >
                              <summary
                                className="flex cursor-pointer list-none flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                                onClick={(event) => {
                                  event.preventDefault();
                                  setSelectedReferenceRowId((current) =>
                                    current === row.localId ? null : row.localId,
                                  );
                                }}
                              >
                                <div className="flex items-center gap-4 text-left">
                                  {showStyles ? (
                                    <StylePreview
                                      fill={row.values.fill ?? ""}
                                      stroke={row.values.stroke ?? ""}
                                      patternType={row.values.pattern_type ?? "none"}
                                      patternColor={row.values.pattern_color ?? ""}
                                    />
                                  ) : null}
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">
                                      {row.values.label ||
                                        row.values.nom ||
                                        row.values.entry_key ||
                                        row.values[activeReference.definition.primary_key] ||
                                        "Nouvelle ligne"}
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      {summaryText}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-3">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={row.saving || row.uploading}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      void handleDeleteReferenceRow(row);
                                    }}
                                  >
                                    Supprimer
                                  </Button>
                                  <Button type="button" size="sm" disabled={row.saving || row.uploading}>
                                    Modifier
                                  </Button>
                                </div>
                              </summary>

                              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                {displayFields.map((field) => (
                                  <div
                                    key={`${row.localId}:${field.name}`}
                                    className={field.type === "textarea" ? "lg:col-span-2" : ""}
                                  >
                                    <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                      {getFriendlyFieldLabel(field.label)}
                                    </p>
                                    {activeReferenceView?.supportsTerrainParentSelect &&
                                    field.name === "parent_entry_key" ? (
                                      <select
                                        className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                                        value={row.values[field.name] ?? ""}
                                        disabled={row.saving}
                                        onChange={(event) =>
                                          handleReferenceRowValueChange(
                                            row.localId,
                                            field.name,
                                            event.target.value,
                                          )
                                        }
                                      >
                                        <option value="">Aucune categorie parente</option>
                                        {terrainCategoryOptions.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <FieldEditor
                                        field={field}
                                        value={row.values[field.name] ?? ""}
                                        disabled={row.saving || row.uploading}
                                        options={referenceFieldOptions[field.name]}
                                        onChange={(value) =>
                                          handleReferenceRowValueChange(row.localId, field.name, value)
                                        }
                                      />
                                    )}
                                  </div>
                                ))}

                                {hasImageFields ? (
                                  <div className="lg:col-span-2">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                        Image importee
                                      </p>
                                      <label className="inline-flex cursor-pointer items-center rounded-full border border-border/70 bg-background/35 px-3 py-1.5 text-sm text-foreground transition hover:border-primary/60">
                                        <input
                                          type="file"
                                          accept=".png,.webp,.svg,image/png,image/webp,image/svg+xml"
                                          className="hidden"
                                          disabled={row.saving || row.uploading}
                                          onChange={(event) => {
                                            const file = event.target.files?.[0] ?? null;
                                            void handleMapIconUpload(row, file);
                                            event.currentTarget.value = "";
                                          }}
                                        />
                                        {row.uploading ? "Import..." : "Importer une image"}
                                      </label>
                                    </div>
                                    <ImagePreview
                                      key={`${row.localId}:${row.values.image_path ?? ""}`}
                                      imageUrl={row.values.image_path ?? ""}
                                      imageAlt={previewAlt}
                                    />
                                  </div>
                                ) : null}

                                {showStyles ? (
                                  <>
                                    <div>
                                      <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                        Couleur de fond
                                      </p>
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="color"
                                          className="h-11 w-14 shrink-0 rounded-[14px] border border-border/70 bg-background/55 p-1"
                                          value={normalizeHexColor(row.values.fill ?? "") ?? "#5f6b7a"}
                                          disabled={row.saving}
                                          onChange={(event) =>
                                            handleReferenceRowValueChange(row.localId, "fill", event.target.value)
                                          }
                                        />
                                        <input
                                          className={`w-full rounded-[14px] border bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30 ${
                                            isHexColorInputValid(row.values.fill ?? "")
                                              ? "border-border/70"
                                              : "border-destructive/70"
                                          }`}
                                          value={row.values.fill ?? ""}
                                          disabled={row.saving}
                                          onChange={(event) =>
                                            handleReferenceRowValueChange(row.localId, "fill", event.target.value)
                                          }
                                        />
                                      </div>
                                    </div>

                                    <div>
                                      <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                        Couleur de contour
                                      </p>
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="color"
                                          className="h-11 w-14 shrink-0 rounded-[14px] border border-border/70 bg-background/55 p-1"
                                          value={normalizeHexColor(row.values.stroke ?? "") ?? DEFAULT_STYLE_STROKE}
                                          disabled={row.saving}
                                          onChange={(event) =>
                                            handleReferenceRowValueChange(row.localId, "stroke", event.target.value)
                                          }
                                        />
                                        <input
                                          className={`w-full rounded-[14px] border bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30 ${
                                            isHexColorInputValid(row.values.stroke ?? "")
                                              ? "border-border/70"
                                              : "border-destructive/70"
                                          }`}
                                          value={row.values.stroke ?? ""}
                                          disabled={row.saving}
                                          onChange={(event) =>
                                            handleReferenceRowValueChange(row.localId, "stroke", event.target.value)
                                          }
                                        />
                                      </div>
                                    </div>

                                    <div>
                                      <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                        Motif
                                      </p>
                                      <select
                                        className={`w-full rounded-[14px] border bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30 ${
                                          isPatternTypeInputValid(row.values.pattern_type ?? "")
                                            ? "border-border/70"
                                            : "border-destructive/70"
                                        }`}
                                        value={row.values.pattern_type ?? "none"}
                                        disabled={row.saving}
                                        onChange={(event) =>
                                          handleReferenceRowValueChange(
                                            row.localId,
                                            "pattern_type",
                                            event.target.value,
                                          )
                                        }
                                      >
                                        {PATTERN_TYPE_OPTIONS.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div>
                                      <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                        Couleur du motif
                                      </p>
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="color"
                                          className="h-11 w-14 shrink-0 rounded-[14px] border border-border/70 bg-background/55 p-1"
                                          value={
                                            normalizeHexColor(row.values.pattern_color ?? "") ??
                                            DEFAULT_PATTERN_COLOR
                                          }
                                          disabled={row.saving || (row.values.pattern_type ?? "none") === "none"}
                                          onChange={(event) =>
                                            handleReferenceRowValueChange(
                                              row.localId,
                                              "pattern_color",
                                              event.target.value,
                                            )
                                          }
                                        />
                                        <input
                                          className={`w-full rounded-[14px] border bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30 ${
                                            isHexColorInputValid(row.values.pattern_color ?? "")
                                              ? "border-border/70"
                                              : "border-destructive/70"
                                          }`}
                                          value={row.values.pattern_color ?? ""}
                                          disabled={row.saving || (row.values.pattern_type ?? "none") === "none"}
                                          onChange={(event) =>
                                            handleReferenceRowValueChange(
                                              row.localId,
                                              "pattern_color",
                                              event.target.value,
                                            )
                                          }
                                        />
                                      </div>
                                    </div>
                                  </>
                                ) : null}
                              </div>

                              {technicalFields.length > 0 ? (
                                <details className="mt-4 rounded-[14px] border border-border/60 bg-background/25 px-4 py-3">
                                  <summary className="cursor-pointer text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                    Details techniques
                                  </summary>
                                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                    {technicalFields.map((field) => (
                                      <div
                                        key={`${row.localId}:tech:${field.name}`}
                                        className={field.type === "textarea" ? "lg:col-span-2" : ""}
                                      >
                                        <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                          {getFriendlyFieldLabel(field.label)}
                                        </p>
                                        {activeReferenceView?.supportsTerrainParentSelect &&
                                        field.name === "parent_entry_key" ? (
                                          <select
                                            className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                                            value={row.values[field.name] ?? ""}
                                            disabled={row.saving || row.uploading}
                                            onChange={(event) =>
                                              handleReferenceRowValueChange(
                                                row.localId,
                                                field.name,
                                                event.target.value,
                                              )
                                            }
                                          >
                                            <option value="">Aucune categorie parente</option>
                                            {terrainCategoryOptions.map((option) => (
                                              <option key={option.value} value={option.value}>
                                                {option.label}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <FieldEditor
                                            field={field}
                                            value={row.values[field.name] ?? ""}
                                            disabled={
                                              row.saving || row.uploading || LOCKED_REFERENCE_FIELDS.has(field.name)
                                            }
                                            options={referenceFieldOptions[field.name]}
                                            onChange={(value) =>
                                              handleReferenceRowValueChange(row.localId, field.name, value)
                                            }
                                          />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              ) : null}

                              {row.error ? <p className="mt-4 text-sm text-destructive">{row.error}</p> : null}

                              <div className="mt-4 flex justify-end gap-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={row.saving || row.uploading}
                                  onClick={() => {
                                    if (row.isNew) {
                                      void handleDeleteReferenceRow(row);
                                      return;
                                    }

                                    setSelectedReferenceRowId(null);
                                  }}
                                >
                                  Annuler
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={row.saving || row.uploading}
                                  onClick={() => void handleSaveReferenceRow(row)}
                                >
                                  {row.saving ? "Enregistrement..." : row.uploading ? "Import..." : "Enregistrer"}
                                </Button>
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    </section>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune liste de valeurs selectionnee.</p>
            )
          ) : activeTab === "schema" ? (
            <>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <h2 className="text-2xl font-semibold text-foreground">
                  {activeSchemaDefinition ? activeSchemaDefinition.title : "Champs personnalises"}
                </h2>
                <Button
                  type="button"
                  variant={showCreateTableForm ? "secondary" : "outline"}
                  onClick={() => setShowCreateTableForm((current) => !current)}
                >
                  {showCreateTableForm ? "Fermer" : "Creer une categorie"}
                </Button>
              </div>

              {showCreateTableForm ? (
                <section className="mt-6 rounded-[20px] border border-border/70 bg-background/35 p-4">
                  <div className="space-y-3">
                    <input
                      className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                      placeholder="Titre de la categorie"
                      value={createTableDraft.title}
                      onChange={(event) =>
                        setCreateTableDraft((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                    <textarea
                      className="min-h-24 w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                      placeholder="Description"
                      value={createTableDraft.description}
                      onChange={(event) =>
                        setCreateTableDraft((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                    <div className="rounded-[16px] border border-border/60 bg-background/30 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">Nom interne</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setCreateTableKeyEdited(false);
                            setCreateTableDraft((current) => ({
                              ...current,
                              table_key: suggestedTableKey,
                            }));
                          }}
                        >
                          Regenerer
                        </Button>
                      </div>
                      <input
                        className="mt-3 w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                        value={createTableDraft.table_key}
                        onChange={(event) => {
                          setCreateTableKeyEdited(true);
                          setCreateTableDraft((current) => ({
                            ...current,
                            table_key: event.target.value,
                          }));
                        }}
                      />
                    </div>
                    {createTableError ? <p className="text-sm text-destructive">{createTableError}</p> : null}
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        disabled={createTablePending || !canCreateTable}
                        onClick={() => void handleCreateSchemaTable()}
                      >
                        {createTablePending ? "Creation..." : "Creer la categorie"}
                      </Button>
                    </div>
                  </div>
                </section>
              ) : null}

              {activeSchemaDefinition ? (
                <>
                <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <h2 className="text-2xl font-semibold text-foreground">
                    {activeSchemaDefinition.title}
                  </h2>
                  <div className="rounded-full border border-border/70 px-3 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {activeSchemaDefinition.is_active ? "Visible dans les cases" : "Masquee dans les cases"}
                  </div>
                </div>

                {schemaError ? <p className="mt-4 text-sm text-destructive">{schemaError}</p> : null}

                <div className="mt-6 space-y-4">
                  <details
                    open={showEditSchemaMeta}
                    className="rounded-[20px] border border-border/70 bg-background/35 p-4"
                  >
                    <summary
                      className="flex cursor-pointer list-none items-center justify-between gap-3"
                      onClick={(event) => {
                        event.preventDefault();
                        setShowEditSchemaMeta((current) => !current);
                      }}
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground">Presentation</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {activeSchemaDefinition.title}
                        </p>
                      </div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {showEditSchemaMeta ? "Ouvert" : "Ferme"}
                      </p>
                    </summary>

                    <div className="mt-4 space-y-3">
                      <input
                        className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                        value={schemaMetaDraft.title ?? ""}
                        onChange={(event) =>
                          setSchemaMetaDraft((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                      />
                      <textarea
                        className="min-h-24 w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                        value={(schemaMetaDraft.description as string) ?? ""}
                        onChange={(event) =>
                          setSchemaMetaDraft((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                      />
                      <label className="flex items-center gap-3 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={Boolean(schemaMetaDraft.is_active)}
                          onChange={(event) =>
                            setSchemaMetaDraft((current) => ({
                              ...current,
                              is_active: event.target.checked,
                            }))
                          }
                        />
                        Categorie visible dans le panneau des cases
                      </label>
                      {schemaMetaError ? <p className="text-sm text-destructive">{schemaMetaError}</p> : null}
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          disabled={schemaMetaPending}
                          onClick={() => void handleSaveSchemaMeta()}
                        >
                          {schemaMetaPending ? "Enregistrement..." : "Enregistrer"}
                        </Button>
                      </div>
                    </div>
                  </details>

                  <details
                    open={showCreateFieldForm}
                    className="rounded-[20px] border border-border/70 bg-background/35 p-4"
                  >
                    <summary
                      className="flex cursor-pointer list-none items-center justify-between gap-3"
                      onClick={(event) => {
                        event.preventDefault();
                        setShowCreateFieldForm((current) => !current);
                      }}
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground">Ajouter une information</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {activeSchemaFieldCount} information(s) existante(s)
                        </p>
                      </div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {showCreateFieldForm ? "Ouvert" : "Ferme"}
                      </p>
                    </summary>

                    <div className="mt-4 space-y-3">
                      <input
                        className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                        placeholder="ex : Niveau de fortification"
                        value={createFieldDraft.label}
                        onChange={(event) =>
                          setCreateFieldDraft((current) => ({
                            ...current,
                            label: event.target.value,
                          }))
                        }
                      />
                      <select
                        className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                        value={createFieldDraft.field_type}
                        onChange={(event) =>
                          setCreateFieldDraft((current) => ({
                            ...current,
                            field_type: event.target.value as DynamicCaseTableFieldType,
                          }))
                        }
                      >
                        {dynamicFieldTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="rounded-[16px] border border-border/60 bg-background/30 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">Nom interne du champ</p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCreateFieldKeyEdited(false);
                              setCreateFieldDraft((current) => ({
                                ...current,
                                field_key: suggestedFieldKey,
                              }));
                            }}
                          >
                            Regenerer
                          </Button>
                        </div>
                        <input
                          className="mt-3 w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                          placeholder="ex : niveau_fortification"
                          value={createFieldDraft.field_key}
                          onChange={(event) => {
                            setCreateFieldKeyEdited(true);
                            setCreateFieldDraft((current) => ({
                              ...current,
                              field_key: event.target.value,
                            }));
                          }}
                        />
                      </div>

                      {createFieldDraft.field_type === "reference" ? (
                        <div className="rounded-[16px] border border-border/60 bg-background/30 p-4">
                          <p className="text-sm font-medium text-foreground">Liste de valeurs</p>
                          <select
                            className="mt-3 w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                            value={createFieldDraft.reference_table_key ?? ""}
                            onChange={(event) =>
                              setCreateFieldDraft((current) => ({
                                ...current,
                                reference_table_key: event.target.value as ReferenceTableKey,
                                reference_group_key:
                                  event.target.value === "nomenclatures"
                                    ? current.reference_group_key
                                    : null,
                              }))
                            }
                          >
                            <option value="">Choisir une liste de valeurs</option>
                            {referenceStatuses.map((table) => (
                              <option key={table.definition.key} value={table.definition.key}>
                                {table.definition.title}
                              </option>
                            ))}
                          </select>

                          {createFieldDraft.reference_table_key === "nomenclatures" ? (
                            <select
                              className="mt-3 w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                              value={createFieldDraft.reference_group_key ?? ""}
                              onChange={(event) =>
                                setCreateFieldDraft((current) => ({
                                  ...current,
                                  reference_group_key: event.target.value,
                                }))
                              }
                            >
                              <option value="">Choisir une famille de valeurs</option>
                              {nomenclatureGroups.map((groupKey) => (
                                <option key={groupKey} value={groupKey}>
                                  {groupKey}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="rounded-[16px] border border-border/60 bg-background/30 p-4">
                        <p className="text-sm font-medium text-foreground">Resume</p>
                        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                          <p>
                            <span className="text-foreground">Libelle :</span>{" "}
                            {createFieldDraft.label.trim() || "Non renseigne"}
                          </p>
                          <p>
                            <span className="text-foreground">Type :</span>{" "}
                            {getFieldTypeLabel(createFieldDraft.field_type)}
                          </p>
                          <p>
                            <span className="text-foreground">Nom interne :</span>{" "}
                            {createFieldDraft.field_key.trim() || "Non genere"}
                          </p>
                          {selectedReferenceStatus ? (
                            <p>
                              <span className="text-foreground">Liste choisie :</span>{" "}
                              {selectedReferenceStatus.definition.title}
                              {createFieldDraft.reference_group_key
                                ? ` / ${createFieldDraft.reference_group_key}`
                                : ""}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {createFieldError ? <p className="text-sm text-destructive">{createFieldError}</p> : null}
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          disabled={createFieldPending || !canCreateField}
                          onClick={() => void handleCreateField()}
                        >
                          {createFieldPending ? "Ajout..." : "Ajouter l'information"}
                        </Button>
                      </div>
                    </div>
                  </details>
                </div>

                <section className="mt-6 rounded-[20px] border border-border/70 bg-background/35 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">
                      Informations ({activeSchemaFieldCount})
                    </p>
                  </div>

                  <div className="mt-4 space-y-3">
                    {activeSchemaDefinition.fields.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Aucune information personnalisee pour cette categorie.
                      </p>
                    ) : (
                      activeSchemaDefinition.fields.map((field) => (
                        <details
                          key={field.field_key}
                          className="rounded-[16px] border border-border/70 bg-background/45 px-4 py-3"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-foreground">{field.label}</p>
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              {getFieldTypeLabel(field.field_type)}
                            </p>
                          </summary>

                          <div className="mt-4">
                            <SummaryRow label="Nom interne" value={field.field_key} />
                            <SummaryRow label="Type" value={getFieldTypeLabel(field.field_type)} />
                            {field.reference_table_key ? (
                              <SummaryRow
                                label="Liste"
                                value={
                                  field.reference_group_key
                                    ? `${field.reference_table_key} / ${field.reference_group_key}`
                                    : field.reference_table_key
                                }
                              />
                            ) : null}
                          </div>
                        </details>
                      ))
                    )}
                  </div>
                </section>
              </>
              ) : (
                <p className="mt-6 text-sm text-muted-foreground">
                  Aucune categorie d&apos;informations selectionnee.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <h2 className="text-2xl font-semibold text-foreground">Comptes staff</h2>
                <Button
                  type="button"
                  variant={showCreateAccountForm ? "secondary" : "outline"}
                  onClick={() => setShowCreateAccountForm((current) => !current)}
                >
                  {showCreateAccountForm ? "Fermer" : "Creer un compte"}
                </Button>
              </div>

              {showCreateAccountForm ? (
                <section className="mt-6 rounded-[20px] border border-border/70 bg-background/35 p-4">
                  <div className="space-y-3">
                    <input
                      className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                      placeholder="Identifiant"
                      value={createAccountDraft.username}
                      onChange={(event) =>
                        setCreateAccountDraft((current) => ({
                          ...current,
                          username: event.target.value,
                        }))
                      }
                    />
                    <input
                      className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                      type="password"
                      placeholder="Mot de passe temporaire"
                      value={createAccountDraft.password}
                      onChange={(event) =>
                        setCreateAccountDraft((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                    />
                    <select
                      className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                      value={createAccountDraft.role}
                      onChange={(event) =>
                        setCreateAccountDraft((current) => ({
                          ...current,
                          role: event.target.value as AdminRole,
                        }))
                      }
                    >
                      <option value="staff">Staff</option>
                      <option value="tech_admin">Admin technique</option>
                    </select>
                    {createAccountError ? <p className="text-sm text-destructive">{createAccountError}</p> : null}
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        disabled={createAccountPending || !canCreateAccount}
                        onClick={() => void handleCreateAccount()}
                      >
                        {createAccountPending ? "Creation..." : "Creer le compte"}
                      </Button>
                    </div>
                  </div>
                </section>
              ) : null}

              {accountsError ? <p className="mt-4 text-sm text-destructive">{accountsError}</p> : null}

              {activeStaffAccount ? (
                <>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <h2 className="text-2xl font-semibold text-foreground">
                  {activeStaffAccount.username}
                </h2>
                <div className="rounded-full border border-border/70 px-3 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {activeStaffAccount.is_active ? "Compte actif" : "Compte desactive"}
                </div>
              </div>

              <details
                open={editingAccountId === activeStaffAccount.id}
                className="mt-6 rounded-[20px] border border-border/70 bg-background/35 p-4"
              >
                <summary
                  className="flex cursor-pointer list-none items-center justify-between gap-3"
                  onClick={(event) => {
                    event.preventDefault();
                    setEditingAccountId((current) =>
                      current === activeStaffAccount.id ? null : activeStaffAccount.id,
                    );
                  }}
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">Acces et statut</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {getRoleLabel(activeStaffAccount.role)}
                      {session.username === activeStaffAccount.username ? " • compte courant" : ""}
                    </p>
                  </div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {editingAccountId === activeStaffAccount.id ? "Ouvert" : "Ferme"}
                  </p>
                </summary>

                <div className="mt-4 space-y-3">
                  <select
                    className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                    value={accountUpdateRole}
                    onChange={(event) => setAccountUpdateRole(event.target.value as AdminRole)}
                  >
                    <option value="staff">Staff</option>
                    <option value="tech_admin">Admin technique</option>
                  </select>
                  <label className="flex items-center gap-3 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={accountUpdateIsActive}
                      onChange={(event) => setAccountUpdateIsActive(event.target.checked)}
                    />
                    Compte actif
                  </label>
                  {accountUpdateError ? <p className="text-sm text-destructive">{accountUpdateError}</p> : null}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      disabled={accountUpdatePending}
                      onClick={() => void handleUpdateAccount()}
                    >
                      {accountUpdatePending ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                  </div>
                </div>
              </details>
                </>
              ) : (
                <p className="mt-6 text-sm text-muted-foreground">Aucun compte staff selectionne.</p>
              )}
            </>
          )}
        </SectionPanel>
      </section>
    </AppShell>
  );
}
