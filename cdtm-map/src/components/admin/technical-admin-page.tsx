"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  DynamicCaseTableCreateInput,
  DynamicCaseTableDefinition,
  DynamicCaseTableFieldCreateInput,
  DynamicCaseTableFieldType,
  DynamicCaseTableSummary,
  DynamicCaseTableUpdateInput,
  ReferenceTableDefinition,
  ReferenceTableKey,
  ReferenceTableRow,
  ReferenceTableRowsResponse,
  ReferenceTableStatus,
  TechFieldDefinition,
} from "@/admin/tech-types";
import type { AdminSession } from "@/admin/types";
import { AppShell } from "@/components/layout/app-shell";
import { SectionPanel } from "@/components/layout/section-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";

type TabKey = "references" | "schema";

type EditableRow = {
  localId: string;
  values: Record<string, string>;
  originalPrimaryKey: string;
  saving: boolean;
  error: string | null;
  isNew: boolean;
};

function createLoggedOutSession(): AdminSession {
  return {
    authenticated: false,
    username: null,
  };
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
  { value: "text", label: "Texte" },
  { value: "textarea", label: "Texte long" },
  { value: "boolean", label: "Booleen" },
  { value: "integer", label: "Entier" },
  { value: "datetime", label: "Date/heure" },
  { value: "reference", label: "Reference" },
];

export function TechnicalAdminPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("references");
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [referenceStatuses, setReferenceStatuses] = useState<ReferenceTableStatus[]>([]);
  const [activeReferenceKey, setActiveReferenceKey] = useState<ReferenceTableKey | null>(null);
  const [referenceRows, setReferenceRows] = useState<EditableRow[]>([]);
  const [referenceSearchInput, setReferenceSearchInput] = useState("");
  const [referenceSearch, setReferenceSearch] = useState("");
  const [referencesLoading, setReferencesLoading] = useState(true);
  const [referenceRowsLoading, setReferenceRowsLoading] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);

  const [schemaSummaries, setSchemaSummaries] = useState<DynamicCaseTableSummary[]>([]);
  const [activeSchemaKey, setActiveSchemaKey] = useState<string | null>(null);
  const [activeSchemaDefinition, setActiveSchemaDefinition] = useState<DynamicCaseTableDefinition | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [createTableDraft, setCreateTableDraft] = useState<DynamicCaseTableCreateInput>({
    table_key: "",
    title: "",
    description: "",
  });
  const [createTablePending, setCreateTablePending] = useState(false);
  const [createTableError, setCreateTableError] = useState<string | null>(null);
  const [schemaMetaDraft, setSchemaMetaDraft] = useState<DynamicCaseTableUpdateInput>({
    title: "",
    description: "",
    is_active: true,
  });
  const [schemaMetaPending, setSchemaMetaPending] = useState(false);
  const [schemaMetaError, setSchemaMetaError] = useState<string | null>(null);
  const [createFieldDraft, setCreateFieldDraft] = useState<DynamicCaseTableFieldCreateInput>({
    field_key: "",
    label: "",
    field_type: "text",
    reference_table_key: null,
    reference_group_key: null,
  });
  const [createFieldPending, setCreateFieldPending] = useState(false);
  const [createFieldError, setCreateFieldError] = useState<string | null>(null);
  const [nomenclatureGroups, setNomenclatureGroups] = useState<string[]>([]);

  const activeReference = useMemo(
    () => referenceStatuses.find((table) => table.definition.key === activeReferenceKey) ?? null,
    [activeReferenceKey, referenceStatuses],
  );

  const loadReferenceStatuses = useCallback(async () => {
    setReferencesLoading(true);
    setGlobalError(null);

    try {
      const nextStatuses = await fetchJson<ReferenceTableStatus[]>("/api/admin/tech/references");
      setReferenceStatuses(nextStatuses);
      setActiveReferenceKey((current) => current ?? nextStatuses[0]?.definition.key ?? null);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Chargement des referentiels impossible.");
    } finally {
      setReferencesLoading(false);
    }
  }, []);

  const loadReferenceRows = useCallback(
    async (tableKey: ReferenceTableKey, search: string) => {
      setReferenceRowsLoading(true);
      setReferenceError(null);

      try {
        const params = new URLSearchParams({ limit: "250" });

        if (search.trim().length > 0) {
          params.set("search", search.trim());
        }

        const response = await fetchJson<ReferenceTableRowsResponse>(
          `/api/admin/tech/references/${tableKey}?${params.toString()}`,
        );
        setReferenceRows(response.rows.map((row) => toEditableRow(response.definition, row)));

        if (tableKey === "nomenclatures") {
          const nextGroups = Array.from(
            new Set(
              response.rows
                .map((row) => (typeof row.group_key === "string" ? row.group_key : ""))
                .filter((value) => value.length > 0),
            ),
          ).sort();
          setNomenclatureGroups(nextGroups);
        }
      } catch (error) {
        setReferenceError(error instanceof Error ? error.message : "Chargement des lignes impossible.");
        setReferenceRows([]);
      } finally {
        setReferenceRowsLoading(false);
      }
    },
    [],
  );

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

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      try {
        const nextSession = await fetchJson<AdminSession>("/api/admin/session");

        if (!cancelled) {
          setSession(nextSession);
        }
      } catch {
        if (!cancelled) {
          setSession(createLoggedOutSession());
        }
      }
    }

    void hydrateSession();
    void loadReferenceStatuses();
    void loadSchemaSummaries();

    return () => {
      cancelled = true;
    };
  }, [loadReferenceStatuses, loadSchemaSummaries]);

  useEffect(() => {
    if (!activeReferenceKey) {
      return;
    }

    void loadReferenceRows(activeReferenceKey, referenceSearch);
  }, [activeReferenceKey, loadReferenceRows, referenceSearch]);

  useEffect(() => {
    if (!activeSchemaKey) {
      setActiveSchemaDefinition(null);
      return;
    }

    void loadSchemaDefinition(activeSchemaKey);
  }, [activeSchemaKey, loadSchemaDefinition]);

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
          ? {
              ...row,
              values: {
                ...row.values,
                [fieldName]: value,
              },
              error: null,
            }
          : row,
      ),
    );
  }, []);

  const handleAddReferenceRow = useCallback(() => {
    if (!activeReference) {
      return;
    }

    setReferenceRows((current) => [
      {
        localId: crypto.randomUUID(),
        values: createEmptyRowValues(activeReference.definition),
        originalPrimaryKey: "",
        saving: false,
        error: null,
        isNew: true,
      },
      ...current,
    ]);
  }, [activeReference]);

  const handleSaveReferenceRow = useCallback(
    async (row: EditableRow) => {
      if (!activeReference) {
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

        const nextRow = toEditableRow(activeReference.definition, savedRow);
        setReferenceRows((current) =>
          current.map((item) => (item.localId === row.localId ? nextRow : item)),
        );
        await loadReferenceStatuses();
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
    [activeReference, loadReferenceStatuses],
  );

  const handleDeleteReferenceRow = useCallback(
    async (row: EditableRow) => {
      if (!activeReference) {
        return;
      }

      if (row.isNew || row.originalPrimaryKey.length === 0) {
        setReferenceRows((current) => current.filter((item) => item.localId !== row.localId));
        return;
      }

      if (!window.confirm("Supprimer cette ligne ?")) {
        return;
      }

      try {
        await fetchJson(
          `/api/admin/tech/references/${activeReference.definition.key}?pk=${encodeURIComponent(
            row.originalPrimaryKey,
          )}`,
          {
            method: "DELETE",
          },
        );
        setReferenceRows((current) => current.filter((item) => item.localId !== row.localId));
        await loadReferenceStatuses();
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
    [activeReference, loadReferenceStatuses],
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
      await loadSchemaSummaries();
    } catch (error) {
      setCreateFieldError(error instanceof Error ? error.message : "Ajout de champ impossible.");
    } finally {
      setCreateFieldPending(false);
    }
  }, [activeSchemaDefinition, createFieldDraft, loadSchemaSummaries]);

  const activeSchemaFieldCount = activeSchemaDefinition?.fields.length ?? 0;

  if (!session || referencesLoading || schemaLoading) {
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
          <h1 className="font-chronicle text-3xl text-foreground">Admin technique</h1>
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

  return (
    <AppShell>
      <SiteHeader
        adminAuthenticated
        adminModeEnabled
        navigationItems={[
          { href: "/", label: "Carte" },
          { href: "/admin/tech", label: "Technique", current: true },
        ]}
        showAdminAction={false}
        onAdminAction={() => {}}
        onAdminLogout={() => void handleLogout()}
      />

      <section className="grid flex-1 gap-6 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <SectionPanel className="p-5 sm:p-6">
          <h1 className="font-chronicle text-3xl tracking-[0.04em] text-foreground">
            Admin technique
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Referentiels globaux et tables metier appliquees a l&apos;ensemble des cases.
          </p>

          <div className="mt-6 flex gap-3">
            <Button
              type="button"
              variant={activeTab === "references" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setActiveTab("references")}
            >
              Referentiels
            </Button>
            <Button
              type="button"
              variant={activeTab === "schema" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setActiveTab("schema")}
            >
              Schema / Tables
            </Button>
          </div>

          {globalError ? <p className="mt-4 text-sm text-destructive">{globalError}</p> : null}

          {activeTab === "references" ? (
            <div className="mt-6 space-y-3">
              {referenceStatuses.map((table) => (
                <button
                  key={table.definition.key}
                  type="button"
                  className={`w-full rounded-[18px] border px-4 py-4 text-left transition ${
                    table.definition.key === activeReferenceKey
                      ? "border-primary/45 bg-primary/10"
                      : "border-border/70 bg-background/35 hover:border-primary/25 hover:bg-background/50"
                  }`}
                  onClick={() => setActiveReferenceKey(table.definition.key)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{table.definition.title}</p>
                    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {table.row_count}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {table.definition.description}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="rounded-[20px] border border-border/70 bg-background/35 p-4">
                <p className="text-sm font-semibold text-foreground">Nouvelle table metier</p>
                <div className="mt-4 space-y-3">
                  <input
                    className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                    placeholder="nom_logique"
                    value={createTableDraft.table_key}
                    onChange={(event) =>
                      setCreateTableDraft((current) => ({
                        ...current,
                        table_key: event.target.value,
                      }))
                    }
                  />
                  <input
                    className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                    placeholder="Titre"
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
                  {createTableError ? <p className="text-sm text-destructive">{createTableError}</p> : null}
                  <Button type="button" onClick={() => void handleCreateSchemaTable()} disabled={createTablePending}>
                    {createTablePending ? "Creation..." : "Creer la table"}
                  </Button>
                </div>
              </div>

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
                        {table.field_count} champ(s)
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{table.physical_name}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {table.description || "Aucune description"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </SectionPanel>

        <SectionPanel className="p-5 sm:p-6">
          {activeTab === "references" ? (
            activeReference ? (
              <>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-foreground">
                      {activeReference.definition.title}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {activeReference.definition.physical_name}
                    </p>
                  </div>

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
                        placeholder="Filtrer"
                        value={referenceSearchInput}
                        onChange={(event) => setReferenceSearchInput(event.target.value)}
                      />
                      <Button type="submit" variant="outline">
                        Filtrer
                      </Button>
                    </form>

                    <Button type="button" onClick={handleAddReferenceRow}>
                      Ajouter une ligne
                    </Button>
                  </div>
                </div>

                {referenceError ? <p className="mt-4 text-sm text-destructive">{referenceError}</p> : null}

                <div className="mt-6 space-y-4">
                  {referenceRowsLoading ? (
                    <p className="text-sm text-muted-foreground">Chargement des lignes...</p>
                  ) : referenceRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune ligne pour cette vue.</p>
                  ) : (
                    referenceRows.map((row) => (
                      <section
                        key={row.localId}
                        className="rounded-[20px] border border-border/70 bg-background/35 p-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {row.values[activeReference.definition.primary_key] || "Nouvelle ligne"}
                            </p>
                            {row.error ? <p className="mt-1 text-sm text-destructive">{row.error}</p> : null}
                          </div>

                          <div className="flex gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={row.saving}
                              onClick={() => void handleDeleteReferenceRow(row)}
                            >
                              Supprimer
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
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          {activeReference.definition.fields.map((field) => (
                            <div
                              key={`${row.localId}:${field.name}`}
                              className={field.type === "textarea" ? "lg:col-span-2" : ""}
                            >
                              <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                {field.label}
                              </p>
                              <FieldEditor
                                field={field}
                                value={row.values[field.name] ?? ""}
                                disabled={row.saving}
                                onChange={(value) =>
                                  handleReferenceRowValueChange(row.localId, field.name, value)
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </section>
                    ))
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun referentiel selectionne.</p>
            )
          ) : activeSchemaDefinition ? (
            <>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">{activeSchemaDefinition.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {activeSchemaDefinition.physical_name}
                  </p>
                </div>
                <div className="rounded-full border border-border/70 px-3 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {activeSchemaDefinition.is_active ? "Active" : "Inactive"}
                </div>
              </div>

              {schemaError ? <p className="mt-4 text-sm text-destructive">{schemaError}</p> : null}

              <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <section className="rounded-[20px] border border-border/70 bg-background/35 p-4">
                  <p className="text-sm font-semibold text-foreground">Metadonnees</p>
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
                      Table active dans le panneau case
                    </label>
                    {schemaMetaError ? <p className="text-sm text-destructive">{schemaMetaError}</p> : null}
                    <Button
                      type="button"
                      disabled={schemaMetaPending}
                      onClick={() => void handleSaveSchemaMeta()}
                    >
                      {schemaMetaPending ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                  </div>
                </section>

                <section className="rounded-[20px] border border-border/70 bg-background/35 p-4">
                  <p className="text-sm font-semibold text-foreground">Ajouter un champ</p>
                  <div className="mt-4 space-y-3">
                    <input
                      className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                      placeholder="nom_champ"
                      value={createFieldDraft.field_key}
                      onChange={(event) =>
                        setCreateFieldDraft((current) => ({
                          ...current,
                          field_key: event.target.value,
                        }))
                      }
                    />
                    <input
                      className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                      placeholder="Libelle"
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

                    {createFieldDraft.field_type === "reference" ? (
                      <>
                        <select
                          className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
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
                          <option value="">Choisir une table globale</option>
                          {referenceStatuses.map((table) => (
                            <option key={table.definition.key} value={table.definition.key}>
                              {table.definition.title}
                            </option>
                          ))}
                        </select>

                        {createFieldDraft.reference_table_key === "nomenclatures" ? (
                          <select
                            className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                            value={createFieldDraft.reference_group_key ?? ""}
                            onChange={(event) =>
                              setCreateFieldDraft((current) => ({
                                ...current,
                                reference_group_key: event.target.value,
                              }))
                            }
                          >
                            <option value="">Choisir un groupe de nomenclature</option>
                            {nomenclatureGroups.map((groupKey) => (
                              <option key={groupKey} value={groupKey}>
                                {groupKey}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </>
                    ) : null}

                    {createFieldError ? <p className="text-sm text-destructive">{createFieldError}</p> : null}
                    <Button type="button" disabled={createFieldPending} onClick={() => void handleCreateField()}>
                      {createFieldPending ? "Ajout..." : "Ajouter le champ"}
                    </Button>
                  </div>
                </section>
              </div>

              <section className="mt-6 rounded-[20px] border border-border/70 bg-background/35 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Champs ({activeSchemaFieldCount})</p>
                  <p className="text-sm text-muted-foreground">Mode guide, uniquement additif</p>
                </div>

                <div className="mt-4 space-y-3">
                  {activeSchemaDefinition.fields.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun champ custom pour cette table.</p>
                  ) : (
                    activeSchemaDefinition.fields.map((field) => (
                      <div
                        key={field.field_key}
                        className="rounded-[16px] border border-border/70 bg-background/45 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-foreground">{field.label}</p>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            {field.field_type}
                          </p>
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          <p>{field.field_key}</p>
                          {field.reference_table_key ? (
                            <p>
                              reference: {field.reference_table_key}
                              {field.reference_group_key ? ` / ${field.reference_group_key}` : ""}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune table metier selectionnee.</p>
          )}
        </SectionPanel>
      </section>
    </AppShell>
  );
}
