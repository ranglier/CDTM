"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { AdminRole } from "@/admin/roles";
import type {
  DynamicCaseTableCreateInput,
  DynamicCaseTableDefinition,
  DynamicCaseTableFieldCreateInput,
  DynamicCaseTableFieldType,
  ReferenceOption,
  DynamicCaseTableSummary,
  MapIconUploadMetadata,
  DynamicCaseTableUpdateInput,
  ReferenceTableKey,
  ReferenceTableRow,
  ReferenceTableRowsResponse,
  ReferenceTableStatus,
  StaffAccountCreateInput,
  StaffAccountSummary,
} from "@/admin/tech-types";
import type { AdminSession } from "@/admin/types";
import { ReferenceAdminPanel } from "@/components/admin/tech/reference-admin-panel";
import { TechAdminSidebar } from "@/components/admin/tech/tech-admin-sidebar";
import type {
  EditableRow,
  ReferenceView,
  ReferenceViewSection,
  SidebarSection,
  TabKey,
} from "@/components/admin/tech/types";
import {
  applyReferenceAutoFill,
  buildRowPayload,
  buildStylePayload,
  createEmptyRowValues,
  createLoggedOutSession,
  DEFAULT_PATTERN_COLOR,
  DEFAULT_STYLE_STROKE,
  getFieldTypeLabel,
  getStyleTargetIdForRow,
  isHexColorInputValid,
  isPatternTypeInputValid,
  rowValueToInputValue,
  SIDEBAR_SECTION_STORAGE_KEY,
  toEditableRow,
  toSnakeCaseIdentifier,
  withStyleValues,
} from "@/components/admin/tech/reference-utils";
import { AppShell } from "@/components/layout/app-shell";
import { SectionPanel } from "@/components/layout/section-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";

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

export function TechnicalAdminPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("references");
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [referenceStatuses, setReferenceStatuses] = useState<ReferenceTableStatus[]>([]);
  const [activeSidebarRootId, setActiveSidebarRootId] = useState<string | null>(null);
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
  const activeReferenceSection = useMemo(
    () =>
      activeTab === "references" && activeSidebarRootId
        ? referenceViewSections.find((section) => section.id === activeSidebarRootId) ?? null
        : null,
    [activeSidebarRootId, activeTab, referenceViewSections],
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
    if (activeTab === "references" && activeReferenceViewId) {
      const owningSection = referenceViewSections.find((section) =>
        section.views.some((view) => view.id === activeReferenceViewId),
      );

      if (owningSection) {
        setActiveSidebarRootId(owningSection.id);
      }
    }
  }, [activeReferenceViewId, activeTab, referenceViewSections]);

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

          <TechAdminSidebar
            sidebarSections={sidebarSections}
            activeTab={activeTab}
            activeSidebarRootId={activeSidebarRootId}
            activeReferenceViewId={activeReferenceViewId}
            activeSchemaKey={activeSchemaKey}
            activeAccountId={activeAccountId}
            activeSidebarSectionIds={activeSidebarSectionIds}
            sidebarSectionOpenState={sidebarSectionOpenState}
            setSidebarSectionOpenState={setSidebarSectionOpenState}
            referenceViewSectionsIds={referenceViewSections.map((section) => section.id)}
            onSelectReferenceRoot={(sectionId) => {
              setActiveSidebarRootId(sectionId);
              setActiveTab("references");
              setActiveReferenceViewId(null);
            }}
            onSelectSchemaRoot={() => {
              setActiveSidebarRootId("schema");
              setActiveTab("schema");
              setActiveSchemaKey(null);
            }}
            onSelectAccountsRoot={() => {
              setActiveSidebarRootId("accounts");
              setActiveTab("accounts");
              setActiveAccountId(null);
            }}
            onSelectReferenceView={(sectionId, viewId) => {
              setActiveTab("references");
              setActiveSidebarRootId(sectionId);
              setActiveReferenceViewId(viewId);
            }}
            onSelectSchemaItem={(itemId) => {
              setActiveTab("schema");
              setActiveSidebarRootId("schema");
              setActiveSchemaKey(itemId === "__schema__" ? null : itemId);
            }}
            onSelectAccountItem={(itemId) => {
              setActiveTab("accounts");
              setActiveSidebarRootId("accounts");
              setActiveAccountId(itemId === "__accounts__" ? null : Number(itemId));
            }}
          />
        </SectionPanel>

        <SectionPanel className="p-5 sm:p-6">
          {activeTab === "references" ? (
            <ReferenceAdminPanel
              activeReference={activeReference}
              activeReferenceSection={activeReferenceSection}
              activeReferenceView={activeReferenceView}
              referenceRowsLoading={referenceRowsLoading}
              referenceRows={referenceRows}
              referenceError={referenceError}
              selectedReferenceRowId={selectedReferenceRowId}
              setSelectedReferenceRowId={setSelectedReferenceRowId}
              referenceSearchInput={referenceSearchInput}
              setReferenceSearchInput={setReferenceSearchInput}
              setReferenceSearch={setReferenceSearch}
              onAddReferenceRow={handleAddReferenceRow}
              onReferenceRowValueChange={handleReferenceRowValueChange}
              onMapIconUpload={handleMapIconUpload}
              onSaveReferenceRow={handleSaveReferenceRow}
              onDeleteReferenceRow={handleDeleteReferenceRow}
              onSelectReferenceView={setActiveReferenceViewId}
              referenceFieldOptions={referenceFieldOptions}
              terrainCategoryOptions={terrainCategoryOptions}
              terrainCategoryLabelByKey={terrainCategoryLabelByKey}
            />
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
                <section className="mt-6 rounded-[20px] border border-border/70 bg-background/35 p-4">
                  <p className="text-sm text-muted-foreground">
                    Selectionne une categorie de champs personnalises dans le panneau lateral.
                  </p>
                  {schemaSummaries.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {schemaSummaries.map((table) => (
                        <button
                          key={table.table_key}
                          type="button"
                          className="w-full rounded-[16px] border border-border/70 bg-background/35 px-4 py-4 text-left transition hover:border-primary/25 hover:bg-background/50"
                          onClick={() => setActiveSchemaKey(table.table_key)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-foreground">{table.title}</span>
                            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              {table.field_count}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>
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
                <section className="mt-6 rounded-[20px] border border-border/70 bg-background/35 p-4">
                  <p className="text-sm text-muted-foreground">
                    Selectionne un utilisateur dans le panneau lateral.
                  </p>
                  {staffAccounts.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {staffAccounts.map((account) => (
                        <button
                          key={account.id}
                          type="button"
                          className="w-full rounded-[16px] border border-border/70 bg-background/35 px-4 py-4 text-left transition hover:border-primary/25 hover:bg-background/50"
                          onClick={() => setActiveAccountId(account.id)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-foreground">{account.username}</span>
                            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              {account.is_active ? "actif" : "inactif"}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>
              )}
            </>
          )}
        </SectionPanel>
      </section>
    </AppShell>
  );
}
