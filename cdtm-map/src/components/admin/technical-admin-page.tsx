"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type {
  TechFieldDefinition,
  TechTableKey,
  TechTableRow,
  TechTableRowsResponse,
  TechTableStatus,
} from "@/admin/tech-types";
import type { AdminSession } from "@/admin/types";
import { AppShell } from "@/components/layout/app-shell";
import { SectionPanel } from "@/components/layout/section-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";

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

function createEmptyRowValues(status: TechTableStatus): Record<string, string> {
  return Object.fromEntries(
    status.definition.fields.map((field) => [field.name, ""]),
  );
}

function toEditableRow(status: TechTableStatus, row: TechTableRow): EditableRow {
  return {
    localId: `${status.definition.key}:${row[status.definition.primary_key] ?? crypto.randomUUID()}`,
    values: Object.fromEntries(
      status.definition.fields.map((field) => [
        field.name,
        rowValueToInputValue(row[field.name] ?? null),
      ]),
    ),
    originalPrimaryKey: rowValueToInputValue(row[status.definition.primary_key] ?? null),
    saving: false,
    error: null,
    isNew: false,
  };
}

function buildRowPayload(status: TechTableStatus, row: EditableRow): Record<string, string> {
  return Object.fromEntries(
    status.definition.fields
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
      type={field.type === "integer" ? "number" : "text"}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function TechnicalAdminPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [tables, setTables] = useState<TechTableStatus[]>([]);
  const [activeTableKey, setActiveTableKey] = useState<TechTableKey | null>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [tableSearchInput, setTableSearchInput] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [loadingTables, setLoadingTables] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [reloadingStatus, setReloadingStatus] = useState(false);
  const activeTable = useMemo(
    () => tables.find((table) => table.definition.key === activeTableKey) ?? null,
    [activeTableKey, tables],
  );

  const loadTableStatuses = useCallback(async () => {
    setReloadingStatus(true);
    setGlobalError(null);

    try {
      const nextTables = await fetchJson<TechTableStatus[]>("/api/admin/tech/tables");
      setTables(nextTables);
      setActiveTableKey((current) => current ?? nextTables[0]?.definition.key ?? null);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Chargement des tables impossible.");
    } finally {
      setReloadingStatus(false);
      setLoadingTables(false);
    }
  }, []);

  const loadTableRows = useCallback(
    async (tableKey: TechTableKey, search: string) => {
      setTableLoading(true);
      setTableError(null);

      try {
        const searchParams = new URLSearchParams({
          limit: "100",
        });

        if (search.trim().length > 0) {
          searchParams.set("search", search.trim());
        }

        const response = await fetchJson<TechTableRowsResponse>(
          `/api/admin/tech/tables/${tableKey}?${searchParams.toString()}`,
        );
        const tableStatus = tables.find((table) => table.definition.key === tableKey);

        if (!tableStatus) {
          return;
        }

        setRows(response.rows.map((row) => toEditableRow(tableStatus, row)));
      } catch (error) {
        setTableError(error instanceof Error ? error.message : "Chargement des lignes impossible.");
        setRows([]);
      } finally {
        setTableLoading(false);
      }
    },
    [tables],
  );

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
    void loadTableStatuses();

    return () => {
      cancelled = true;
    };
  }, [loadTableStatuses]);

  useEffect(() => {
    if (!activeTableKey || tables.length === 0) {
      return;
    }

    void loadTableRows(activeTableKey, tableSearch);
  }, [activeTableKey, loadTableRows, tableSearch, tables.length]);

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

  const handleRowValueChange = useCallback((localId: string, fieldName: string, value: string) => {
    setRows((current) =>
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

  const handleAddRow = useCallback(() => {
    if (!activeTable) {
      return;
    }

    setRows((current) => [
      {
        localId: crypto.randomUUID(),
        values: createEmptyRowValues(activeTable),
        originalPrimaryKey: "",
        saving: false,
        error: null,
        isNew: true,
      },
      ...current,
    ]);
  }, [activeTable]);

  const handleSaveRow = useCallback(
    async (row: EditableRow) => {
      if (!activeTable) {
        return;
      }

      setRows((current) =>
        current.map((item) =>
          item.localId === row.localId
            ? {
                ...item,
                saving: true,
                error: null,
              }
            : item,
        ),
      );

      try {
        const savedRow = await fetchJson<TechTableRow>(`/api/admin/tech/tables/${activeTable.definition.key}`, {
          method: "POST",
          body: JSON.stringify({
            row: buildRowPayload(activeTable, row),
          }),
        });

        const nextRow = toEditableRow(activeTable, savedRow);

        setRows((current) =>
          current.map((item) => (item.localId === row.localId ? nextRow : item)),
        );
        await loadTableStatuses();
      } catch (error) {
        setRows((current) =>
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
    [activeTable, loadTableStatuses],
  );

  const handleDeleteRow = useCallback(
    async (row: EditableRow) => {
      if (!activeTable) {
        return;
      }

      if (row.isNew || row.originalPrimaryKey.length === 0) {
        setRows((current) => current.filter((item) => item.localId !== row.localId));
        return;
      }

      if (!window.confirm("Supprimer cette ligne ?")) {
        return;
      }

      try {
        await fetchJson(`/api/admin/tech/tables/${activeTable.definition.key}?pk=${encodeURIComponent(row.originalPrimaryKey)}`, {
          method: "DELETE",
        });
        setRows((current) => current.filter((item) => item.localId !== row.localId));
        await loadTableStatuses();
      } catch (error) {
        setRows((current) =>
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
    [activeTable, loadTableStatuses],
  );

  if (!session || loadingTables) {
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

      <section className="grid flex-1 gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <SectionPanel className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-chronicle text-3xl tracking-[0.04em] text-foreground">
                Tables metier
              </h1>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Edition technique des tables documentees dans le projet.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadTableStatuses()}>
              {reloadingStatus ? "..." : "Recharger"}
            </Button>
          </div>

          {globalError ? <p className="mt-4 text-sm text-destructive">{globalError}</p> : null}

          <div className="mt-6 space-y-3">
            {tables.map((table) => (
              <button
                key={table.definition.key}
                type="button"
                className={`w-full rounded-[18px] border px-4 py-4 text-left transition ${
                  table.definition.key === activeTableKey
                    ? "border-primary/45 bg-primary/10"
                    : "border-border/70 bg-background/35 hover:border-primary/25 hover:bg-background/50"
                }`}
                onClick={() => setActiveTableKey(table.definition.key)}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{table.definition.logical_name}</p>
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {table.row_count}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{table.definition.physical_name}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{table.definition.description}</p>
              </button>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel className="p-5 sm:p-6">
          {activeTable ? (
            <>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">{activeTable.definition.logical_name}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Table physique : {activeTable.definition.physical_name}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <form
                    className="flex gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setTableSearch(tableSearchInput.trim());
                    }}
                  >
                    <input
                      className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30 sm:w-72"
                      placeholder="Filtrer les lignes"
                      value={tableSearchInput}
                      onChange={(event) => setTableSearchInput(event.target.value)}
                    />
                    <Button type="submit" variant="outline">
                      Filtrer
                    </Button>
                  </form>

                  <Button type="button" onClick={handleAddRow}>
                    Ajouter une ligne
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <p>{activeTable.row_count} ligne(s) en base.</p>
                {tableSearch ? <p>Filtre actif : {tableSearch}</p> : null}
              </div>

              {tableError ? <p className="mt-4 text-sm text-destructive">{tableError}</p> : null}

              <div className="mt-6 space-y-4">
                {tableLoading ? (
                  <p className="text-sm text-muted-foreground">Chargement des lignes...</p>
                ) : rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune ligne pour cette vue.</p>
                ) : (
                  rows.map((row) => (
                    <section
                      key={row.localId}
                      className="rounded-[20px] border border-border/70 bg-background/35 p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {row.values[activeTable.definition.primary_key] || "Nouvelle ligne"}
                          </p>
                          {row.error ? (
                            <p className="mt-1 text-sm text-destructive">{row.error}</p>
                          ) : null}
                        </div>

                        <div className="flex gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={row.saving}
                            onClick={() => void handleDeleteRow(row)}
                          >
                            Supprimer
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={row.saving}
                            onClick={() => void handleSaveRow(row)}
                          >
                            {row.saving ? "Enregistrement..." : "Enregistrer"}
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        {activeTable.definition.fields.map((field) => (
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
                              onChange={(value) => handleRowValueChange(row.localId, field.name, value)}
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
            <p className="text-sm text-muted-foreground">Aucune table selectionnee.</p>
          )}
        </SectionPanel>
      </section>
    </AppShell>
  );
}
