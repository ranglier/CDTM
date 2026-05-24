"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { AdminRole } from "@/admin/roles";
import type {
  AdminStyleUpsertInput,
  DynamicCaseTableCreateInput,
  DynamicCaseTableDefinition,
  DynamicCaseTableFieldCreateInput,
  DynamicCaseTableFieldType,
  ReferenceStyleValue,
  DynamicCaseTableSummary,
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
  normalizeOpacityValue,
  type MapStyleTargetType,
} from "@/map/types";

type TabKey = "references" | "schema" | "accounts";

type EditableRow = {
  localId: string;
  values: Record<string, string>;
  originalPrimaryKey: string;
  saving: boolean;
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

const FEATURED_NOMENCLATURE_GROUPS = new Set([
  "terrain_cat",
  "terrain_type",
  "relief",
  "controle_type",
  "peuple_majoritaire",
]);

const NOMENCLATURE_LABELS: Record<string, string> = {
  terrain_cat: "Categories de terrain",
  terrain_type: "Types de terrain",
  relief: "Reliefs",
  controle_type: "Types de controle",
  peuple_majoritaire: "Peuples majoritaires",
};

const STYLE_FIELDS = ["fill", "stroke", "opacity"] as const;
type StyleFieldName = (typeof STYLE_FIELDS)[number];
const DEFAULT_STYLE_STROKE = "#000000";
const REFERENCE_TECHNICAL_FIELDS = new Set([
  "group_key",
  "entry_key",
  "id_entry",
  "id_faction",
  "id_controleur",
  "updated_by_user_id",
  "created_at",
  "updated_at",
]);

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

function formatOpacityValue(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function createStylePreview(fill: string, stroke: string, opacity: string) {
  const normalizedFill = normalizeHexColor(fill);
  const normalizedStroke = normalizeHexColor(stroke) ?? DEFAULT_STYLE_STROKE;
  const normalizedOpacity = normalizeOpacityValue(opacity);
  const effectiveOpacity = normalizedOpacity ?? (normalizedFill ? 1 : 0);

  return {
    fill: normalizedFill ?? "#5f6b7a",
    stroke: normalizedStroke,
    opacity: effectiveOpacity,
  };
}

function isHexColorInputValid(value: string): boolean {
  return value.trim().length === 0 || normalizeHexColor(value) !== null;
}

function isOpacityInputValid(value: string): boolean {
  return value.trim().length === 0 || normalizeOpacityValue(value) !== null;
}

function StylePreview({
  fill,
  stroke,
  opacity,
}: {
  fill: string;
  stroke: string;
  opacity: string;
}) {
  const preview = createStylePreview(fill, stroke, opacity);

  return (
    <div
      className="h-10 w-16 rounded-[12px] border"
      style={{
        backgroundColor: normalizeHexColor(fill)
          ? `${preview.fill}${Math.round(preview.opacity * 255)
              .toString(16)
              .padStart(2, "0")}`
          : "transparent",
        borderColor: preview.stroke,
      }}
      aria-hidden="true"
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
  const normalizedOpacity = values.opacity?.trim() || "";

  if (
    normalizedFill.length === 0 &&
    (normalizedStroke.length === 0 || normalizedStroke.toLowerCase() === DEFAULT_STYLE_STROKE) &&
    (normalizedOpacity.length === 0 || normalizedOpacity === "0")
  ) {
    return null;
  }

  return {
    target_type: targetType,
    target_id: targetId,
    fill: normalizedFill || null,
    stroke: normalizedStroke || null,
    opacity: normalizedOpacity || null,
  };
}

function formatNomenclatureGroupLabel(groupKey: string): string {
  const predefined = NOMENCLATURE_LABELS[groupKey];

  if (predefined) {
    return predefined;
  }

  return groupKey
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  return {
    localId: `${definition.key}:${row[definition.primary_key] ?? crypto.randomUUID()}`,
    values: Object.fromEntries(
      definition.fields.map((field) => [field.name, rowValueToInputValue(row[field.name] ?? null)]),
    ),
    originalPrimaryKey: rowValueToInputValue(row[definition.primary_key] ?? null),
    saving: false,
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
      opacity: style?.opacity !== null && style?.opacity !== undefined
        ? formatOpacityValue(style.opacity)
        : style?.fill
          ? "1"
          : "0",
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
  onChange,
}: {
  field: TechFieldDefinition;
  value: string;
  disabled: boolean;
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
    case "sort_order":
      return "Ordre";
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
    case "rule_key":
      return "Identifiant regle";
    case "rule_label":
      return "Nom de la regle";
    case "value_text":
      return "Valeur texte";
    case "value_integer":
      return "Valeur numerique";
    default:
      return fieldName;
  }
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
      ],
    });

    addSection({
      id: "peuples",
      title: "Peuples",
      views: [
        {
          id: "nomenclatures:peuple_majoritaire",
          tableKey: "nomenclatures",
          title: "Peuples majoritaires",
          groupKey: "peuple_majoritaire",
          rowCount: nomenclatureGroupCounts.peuple_majoritaire ?? 0,
        },
      ],
    });

    const otherNomenclatureViews = Object.keys(nomenclatureGroupCounts)
      .filter((groupKey) => !FEATURED_NOMENCLATURE_GROUPS.has(groupKey))
      .sort()
      .map<ReferenceView>((groupKey) => ({
        id: `nomenclatures:${groupKey}`,
        tableKey: "nomenclatures",
        title: formatNomenclatureGroupLabel(groupKey),
        groupKey,
        rowCount: nomenclatureGroupCounts[groupKey] ?? 0,
      }));

    addSection({
      id: "autres-listes",
      title: "Autres listes",
      views: otherNomenclatureViews,
    });

    const otherTables = referenceStatuses
      .filter((table) => table.definition.key !== "nomenclatures" && table.definition.key !== "styles")
      .map<ReferenceView>((table) => ({
        id: table.definition.key,
        tableKey: table.definition.key,
        title: table.definition.title,
        groupKey: null,
        rowCount: table.row_count,
        styleTargetType:
          table.definition.key === "factions"
            ? "faction"
            : table.definition.key === "controleurs"
              ? "controleur"
              : null,
      }));

    addSection({
      id: "autres-referentiels",
      title: "Autres referentiels",
      views: otherTables,
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
        setSelectedReferenceRowId((current) =>
          current && nextRows.some((row) => row.localId === current)
            ? current
            : nextRows[0]?.localId ?? null,
        );
      } catch (error) {
        setReferenceError(error instanceof Error ? error.message : "Chargement des lignes impossible.");
        setReferenceRows([]);
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
              const nextValues = {
                ...row.values,
                [fieldName]: value,
              };

              if (fieldName === "fill" || fieldName === "stroke") {
                const hasChosenColor =
                  nextValues.fill.trim().length > 0 ||
                  (nextValues.stroke.trim().length > 0 &&
                    nextValues.stroke.trim().toLowerCase() !== DEFAULT_STYLE_STROKE);

                if (!hasChosenColor) {
                  nextValues.opacity = "0";
                } else if (nextValues.opacity.trim().length === 0 || nextValues.opacity.trim() === "0") {
                  nextValues.opacity = "1";
                }
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
                opacity: "0",
              }
            : {}),
        },
        originalPrimaryKey: "",
        saving: false,
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

      if (!isOpacityInputValid(row.values.opacity ?? "")) {
        setReferenceRows((current) =>
          current.map((item) =>
            item.localId === row.localId
              ? { ...item, error: "Opacite invalide." }
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
            opacity: row.values.opacity ?? "",
          },
        };
        const stylePayload = buildStylePayload(activeReferenceView ?? null, nextBaseRow.values);

        if (stylePayload) {
          await fetchJson("/api/admin/tech/styles", {
            method: "POST",
            body: JSON.stringify(stylePayload),
          });
        }

        const nextRow = nextBaseRow;
        setReferenceRows((current) =>
          current.map((item) => (item.localId === row.localId ? nextRow : item)),
        );
        setSelectedReferenceRowId(nextRow.localId);
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
      loadReferenceStatuses,
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
        const stylePayload = buildStylePayload(activeReferenceView ?? null, row.values);
        await fetchJson(
          `/api/admin/tech/references/${activeReference.definition.key}?pk=${encodeURIComponent(
            row.originalPrimaryKey,
          )}`,
          {
            method: "DELETE",
          },
        );
        if (stylePayload) {
          await fetchJson("/api/admin/tech/styles", {
            method: "POST",
            body: JSON.stringify({
              ...stylePayload,
              fill: null,
              stroke: null,
              opacity: null,
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
      await loadSchemaSummaries();
    } catch (error) {
      setSchemaMetaError(error instanceof Error ? error.message : "Mise a jour impossible.");
    } finally {
      setSchemaMetaPending(false);
    }
  }, [activeSchemaDefinition, loadSchemaSummaries, schemaMetaDraft]);

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
      await loadSchemaSummaries();
    } catch (error) {
      setCreateFieldError(error instanceof Error ? error.message : "Ajout de champ impossible.");
    } finally {
      setCreateFieldPending(false);
    }
  }, [activeSchemaDefinition, createFieldDraft, loadSchemaSummaries]);

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
      await loadStaffAccounts();
      setActiveAccountId(createdAccount.id);
      await hydrateSession();
    } catch (error) {
      setCreateAccountError(error instanceof Error ? error.message : "Creation de compte impossible.");
    } finally {
      setCreateAccountPending(false);
    }
  }, [createAccountDraft, hydrateSession, loadStaffAccounts]);

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
      const nextSession = await hydrateSession();

      if (nextSession.is_tech_admin) {
        await loadStaffAccounts();
      }
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
    loadStaffAccounts,
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
          navigationItems={[{ href: "/", label: "Carte" }]}
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
          { href: "/", label: "Carte" },
          ...(session.is_tech_admin ? [{ href: "/admin/tech", label: "Technique", current: true }] : []),
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

          <div className="mt-6 grid gap-3">
            <Button
              type="button"
              variant={activeTab === "references" ? "secondary" : "outline"}
              size="sm"
              className="w-full"
              onClick={() => setActiveTab("references")}
            >
              Listes de valeurs
            </Button>
            <Button
              type="button"
              variant={activeTab === "schema" ? "secondary" : "outline"}
              size="sm"
              className="w-full"
              onClick={() => setActiveTab("schema")}
            >
              Champs personnalises
            </Button>
            <Button
              type="button"
              variant={activeTab === "accounts" ? "secondary" : "outline"}
              size="sm"
              className="w-full"
              onClick={() => setActiveTab("accounts")}
            >
              Comptes staff
            </Button>
          </div>

          {globalError ? <p className="mt-4 text-sm text-destructive">{globalError}</p> : null}

          {activeTab === "references" ? (
            <div className="mt-6 space-y-4">
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleAddReferenceRow}
                  disabled={!activeReferenceView}
                >
                  Ajouter une valeur
                </Button>
              </div>
              {referenceViewSections.map((section) => (
                <div key={section.id} className="space-y-2">
                  <p className="px-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {section.title}
                  </p>
                  {section.views.map((view) => (
                    <button
                      key={view.id}
                      type="button"
                      className={`w-full rounded-[18px] border px-4 py-4 text-left transition ${
                        view.id === activeReferenceViewId
                          ? "border-primary/45 bg-primary/10"
                          : "border-border/70 bg-background/35 hover:border-primary/25 hover:bg-background/50"
                      }`}
                      onClick={() => setActiveReferenceViewId(view.id)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">{view.title}</p>
                        {view.rowCount !== null ? (
                          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            {view.rowCount}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : activeTab === "schema" ? (
            <div className="mt-6 space-y-4">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant={showCreateTableForm ? "secondary" : "outline"}
                  onClick={() => setShowCreateTableForm((current) => !current)}
                >
                  {showCreateTableForm ? "Fermer" : "Creer une categorie"}
                </Button>
              </div>
              {showCreateTableForm ? (
                <div className="rounded-[20px] border border-border/70 bg-background/35 p-4">
                  <p className="text-sm font-semibold text-foreground">Nouvelle categorie</p>
                  <div className="mt-4 space-y-3">
                    <input
                      className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                      placeholder="ex : Informations militaires"
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
                      placeholder="ex : Garnisons, fortifications et menaces connues"
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
                        placeholder="ex : informations_militaires"
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
                    <div className="rounded-[16px] border border-border/60 bg-background/30 p-4">
                      <p className="text-sm font-medium text-foreground">Resume</p>
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                        <p>
                          <span className="text-foreground">Titre :</span>{" "}
                          {createTableDraft.title.trim() || "Non renseigne"}
                        </p>
                        <p>
                          <span className="text-foreground">Description :</span>{" "}
                          {createTableDraft.description.trim() || "Aucune description"}
                        </p>
                        <p>
                          <span className="text-foreground">Nom interne :</span>{" "}
                          {createTableDraft.table_key.trim() || "Non genere"}
                        </p>
                      </div>
                    </div>
                    {createTableError ? <p className="text-sm text-destructive">{createTableError}</p> : null}
                    <Button
                      type="button"
                      onClick={() => void handleCreateSchemaTable()}
                      disabled={createTablePending || !canCreateTable}
                    >
                      {createTablePending ? "Creation..." : "Creer la categorie"}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                {schemaSummaries.map((table) => (
                  <button
                    key={table.table_key}
                    type="button"
                    className={`w-full rounded-[18px] border px-4 py-4 text-left transition ${
                      table.table_key === activeSchemaKey
                        ? "border-primary/45 bg-primary/10"
                        : "border-border/70 bg-background/35 hover:border-primary/25 hover:bg-background/50"
                    }`}
                    onClick={() => setActiveSchemaKey(table.table_key)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">{table.title}</p>
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {table.field_count} information(s)
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant={showCreateAccountForm ? "secondary" : "outline"}
                  onClick={() => setShowCreateAccountForm((current) => !current)}
                >
                  {showCreateAccountForm ? "Fermer" : "Creer un compte"}
                </Button>
              </div>
              {showCreateAccountForm ? (
                <div className="rounded-[20px] border border-border/70 bg-background/35 p-4">
                  <p className="text-sm font-semibold text-foreground">Nouveau compte</p>
                  <div className="mt-4 space-y-3">
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
                      placeholder="Mot de passe temporaire"
                      type="password"
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
                    <Button
                      type="button"
                      disabled={createAccountPending || !canCreateAccount}
                      onClick={() => void handleCreateAccount()}
                    >
                      {createAccountPending ? "Creation..." : "Creer le compte"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {accountsError ? <p className="text-sm text-destructive">{accountsError}</p> : null}

              <div className="space-y-3">
                {staffAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun compte staff enregistre.</p>
                ) : (
                  staffAccounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      className={`w-full rounded-[18px] border px-4 py-4 text-left transition ${
                        account.id === activeAccountId
                          ? "border-primary/45 bg-primary/10"
                          : "border-border/70 bg-background/35 hover:border-primary/25 hover:bg-background/50"
                      }`}
                      onClick={() => setActiveAccountId(account.id)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">{account.username}</p>
                        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {account.is_active ? "actif" : "inactif"}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </SectionPanel>

        <SectionPanel className="p-5 sm:p-6">
          {activeTab === "references" ? (
            activeReference ? (
              <>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <h2 className="text-2xl font-semibold text-foreground">
                    {activeReferenceView?.title ?? activeReference.definition.title}
                  </h2>

                <div className="flex flex-col gap-3 sm:flex-row">
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
                                      opacity={row.values.opacity ?? ""}
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
                                      {activeReferenceView?.groupKey === "terrain_type"
                                        ? terrainParentLabel
                                        : displayFields
                                            .map((field) => row.values[field.name])
                                            .find((value) => value && value.trim().length > 0) ||
                                          "Aucun detail visible"}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-3">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={row.saving}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      void handleDeleteReferenceRow(row);
                                    }}
                                  >
                                    Supprimer
                                  </Button>
                                  <Button type="button" size="sm" disabled={row.saving}>
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
                                        disabled={row.saving}
                                        onChange={(value) =>
                                          handleReferenceRowValueChange(row.localId, field.name, value)
                                        }
                                      />
                                    )}
                                  </div>
                                ))}

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
                                        Opacite
                                      </p>
                                      <input
                                        className={`w-full rounded-[14px] border bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30 ${
                                          isOpacityInputValid(row.values.opacity ?? "")
                                            ? "border-border/70"
                                            : "border-destructive/70"
                                        }`}
                                        type="number"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={row.values.opacity ?? ""}
                                        disabled={row.saving}
                                        onChange={(event) =>
                                          handleReferenceRowValueChange(row.localId, "opacity", event.target.value)
                                        }
                                      />
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
                                            disabled={row.saving}
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
                                  disabled={row.saving}
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
                                  disabled={row.saving}
                                  onClick={() => void handleSaveReferenceRow(row)}
                                >
                                  {row.saving ? "Enregistrement..." : "Enregistrer"}
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
            activeSchemaDefinition ? (
              <>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
            <p className="text-sm text-muted-foreground">Aucune categorie d&apos;informations selectionnee.</p>
          )
          ) : activeStaffAccount ? (
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
            <p className="text-sm text-muted-foreground">Aucun compte staff selectionne.</p>
          )}
        </SectionPanel>
      </section>
    </AppShell>
  );
}
