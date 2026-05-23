"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import type { AdminRole } from "@/admin/roles";
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
  StaffAccountCreateInput,
  StaffAccountSummary,
  TechFieldDefinition,
} from "@/admin/tech-types";
import type { AdminSession } from "@/admin/types";
import { AppShell } from "@/components/layout/app-shell";
import { SectionPanel } from "@/components/layout/section-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";

type TabKey = "references" | "schema" | "accounts";

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

function InfoCallout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-primary/20 bg-primary/8 px-4 py-3 text-sm leading-6 text-muted-foreground">
      {children}
    </div>
  );
}

function TechnicalDetails({
  lines,
  title = "Details techniques",
}: {
  lines: string[];
  title?: string;
}) {
  return (
    <details className="mt-3 rounded-[16px] border border-border/60 bg-background/30 px-4 py-3">
      <summary className="cursor-pointer text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </summary>
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </details>
  );
}

export function TechnicalAdminPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("references");
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [referenceStatuses, setReferenceStatuses] = useState<ReferenceTableStatus[]>([]);
  const [activeReferenceKey, setActiveReferenceKey] = useState<ReferenceTableKey | null>(null);
  const [referenceRows, setReferenceRows] = useState<EditableRow[]>([]);
  const [referenceSearchInput, setReferenceSearchInput] = useState("");
  const [referenceSearch, setReferenceSearch] = useState("");
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [referenceRowsLoading, setReferenceRowsLoading] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);

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
  const [createFieldKeyEdited, setCreateFieldKeyEdited] = useState(false);
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
  const [accountUpdateRole, setAccountUpdateRole] = useState<AdminRole>("staff");
  const [accountUpdateIsActive, setAccountUpdateIsActive] = useState(true);
  const [accountUpdatePending, setAccountUpdatePending] = useState(false);
  const [accountUpdateError, setAccountUpdateError] = useState<string | null>(null);

  const activeReference = useMemo(
    () => referenceStatuses.find((table) => table.definition.key === activeReferenceKey) ?? null,
    [activeReferenceKey, referenceStatuses],
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
    void loadSchemaSummaries();
    void loadStaffAccounts();
  }, [loadReferenceStatuses, loadSchemaSummaries, loadStaffAccounts, session?.is_tech_admin]);

  useEffect(() => {
    if (!session?.is_tech_admin || !activeReferenceKey) {
      return;
    }

    void loadReferenceRows(activeReferenceKey, referenceSearch);
  }, [activeReferenceKey, loadReferenceRows, referenceSearch, session?.is_tech_admin]);

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
      setCreateTableKeyEdited(false);
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
          <h1 className="font-chronicle text-3xl text-foreground">Administration des donnees</h1>
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
          <h1 className="font-chronicle text-3xl text-foreground">Administration des donnees</h1>
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
            Administration des donnees
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Cette page aide a maintenir les listes de choix et les informations
            supplementaires disponibles pour toutes les cases.
          </p>

          <div className="mt-6 flex gap-3">
            <Button
              type="button"
              variant={activeTab === "references" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setActiveTab("references")}
            >
              Listes de valeurs
            </Button>
            <Button
              type="button"
              variant={activeTab === "schema" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setActiveTab("schema")}
            >
              Champs personnalises
            </Button>
            <Button
              type="button"
              variant={activeTab === "accounts" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setActiveTab("accounts")}
            >
              Comptes staff
            </Button>
          </div>

          {globalError ? <p className="mt-4 text-sm text-destructive">{globalError}</p> : null}

          {activeTab === "references" ? (
            <div className="mt-6 space-y-3">
              <InfoCallout>
                Ces listes servent a proposer des choix coherents dans les formulaires :
                terrains, factions, types de controle, styles, etc.
              </InfoCallout>
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
          ) : activeTab === "schema" ? (
            <div className="mt-6 space-y-4">
              <InfoCallout>
                Ces categories permettent d&apos;ajouter de nouvelles informations sur
                toutes les cases sans modifier la carte.
              </InfoCallout>
              <div className="rounded-[20px] border border-border/70 bg-background/35 p-4">
                <p className="text-sm font-semibold text-foreground">
                  Nouvelle categorie d&apos;informations
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Cree une nouvelle rubrique qui apparaitra dans le panneau de
                  modification des cases.
                </p>
                <div className="mt-4">
                  <InfoCallout>
                    Ces changements modifient la structure des informations disponibles
                    pour toutes les cases. A utiliser avec prudence.
                  </InfoCallout>
                </div>
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
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Il est propose automatiquement a partir du titre. Tu peux le corriger si besoin.
                    </p>
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
                    <p className="text-sm font-medium text-foreground">Resume avant creation</p>
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
                      <p>Cette categorie sera disponible pour toutes les cases.</p>
                      <p>Verifie ce resume avant de creer.</p>
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
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {table.description || "Aucune description"}
                    </p>
                    <TechnicalDetails
                      title="Nom interne"
                      lines={[
                        `identifiant_automatique : ${table.table_key}`,
                        `physical_name : ${table.physical_name}`,
                      ]}
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <InfoCallout>
                Ces comptes donnent acces au mode admin de la carte. Seuls les comptes
                `tech_admin` peuvent ouvrir et modifier cette page.
              </InfoCallout>
              <div className="rounded-[20px] border border-border/70 bg-background/35 p-4">
                <p className="text-sm font-semibold text-foreground">Nouveau compte staff</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Cree un compte avec un mot de passe temporaire, puis transmets-le de maniere sure.
                </p>
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
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {getRoleLabel(account.role)}
                        {session.username === account.username ? " • compte courant" : ""}
                      </p>
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
                  <div>
                    <h2 className="text-2xl font-semibold text-foreground">
                      {activeReference.definition.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {activeReference.definition.description}
                    </p>
                    <TechnicalDetails
                      title="Details techniques"
                      lines={[
                        `nom interne : ${activeReference.definition.key}`,
                        `stockage : ${activeReference.definition.physical_name}`,
                      ]}
                    />
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
                        placeholder="Filtrer cette liste"
                        value={referenceSearchInput}
                        onChange={(event) => setReferenceSearchInput(event.target.value)}
                      />
                      <Button type="submit" variant="outline">
                        Filtrer
                      </Button>
                    </form>

                    <Button type="button" onClick={handleAddReferenceRow}>
                      Ajouter une valeur
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
                                {getFriendlyFieldLabel(field.label)}
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
              <p className="text-sm text-muted-foreground">Aucune liste de valeurs selectionnee.</p>
            )
          ) : activeTab === "schema" ? (
            activeSchemaDefinition ? (
            <>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">{activeSchemaDefinition.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {activeSchemaDefinition.description || "Aucune description pour cette categorie."}
                  </p>
                  <TechnicalDetails
                    title="Details techniques"
                    lines={[
                      `identifiant_automatique : ${activeSchemaDefinition.table_key}`,
                      `physical_name : ${activeSchemaDefinition.physical_name}`,
                    ]}
                  />
                </div>
                <div className="rounded-full border border-border/70 px-3 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {activeSchemaDefinition.is_active ? "Visible dans les cases" : "Masquee dans les cases"}
                </div>
              </div>

              {schemaError ? <p className="mt-4 text-sm text-destructive">{schemaError}</p> : null}

              <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <section className="rounded-[20px] border border-border/70 bg-background/35 p-4">
                  <p className="text-sm font-semibold text-foreground">Presentation</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Modifie le nom visible, le texte d&apos;aide et l&apos;affichage de cette
                    categorie.
                  </p>
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
                  <p className="text-sm font-semibold text-foreground">Ajouter une information</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Ajoute un champ a renseigner pour chaque case dans cette categorie.
                  </p>
                  <div className="mt-4">
                    <InfoCallout>
                      Ces changements modifient la structure des informations disponibles
                      pour toutes les cases. A utiliser avec prudence.
                    </InfoCallout>
                  </div>
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
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Il est propose automatiquement a partir du libelle. Garde-le simple et stable.
                      </p>
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
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Ce type de champ ne laisse pas une saisie libre. Il proposera un choix
                          issu d&apos;une liste deja maintenue dans l&apos;onglet Listes de valeurs.
                        </p>
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
                          <>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                              Choisis ensuite la famille exacte a utiliser dans cette liste.
                            </p>
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
                          </>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="rounded-[16px] border border-border/60 bg-background/30 p-4">
                      <p className="text-sm font-medium text-foreground">Resume avant creation</p>
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
                        <p>Verifie ce resume avant de creer.</p>
                      </div>
                    </div>

                    {createFieldError ? <p className="text-sm text-destructive">{createFieldError}</p> : null}
                    <Button
                      type="button"
                      disabled={createFieldPending || !canCreateField}
                      onClick={() => void handleCreateField()}
                    >
                      {createFieldPending ? "Ajout..." : "Ajouter l'information"}
                    </Button>
                  </div>
                </section>
              </div>

              <section className="mt-6 rounded-[20px] border border-border/70 bg-background/35 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Informations ({activeSchemaFieldCount})</p>
                  <p className="text-sm text-muted-foreground">Ajouts progressifs uniquement</p>
                </div>

                <div className="mt-4 space-y-3">
                  {activeSchemaDefinition.fields.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune information personnalisee pour cette categorie.</p>
                  ) : (
                    activeSchemaDefinition.fields.map((field) => (
                      <div
                        key={field.field_key}
                        className="rounded-[16px] border border-border/70 bg-background/45 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-foreground">{field.label}</p>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            {getFieldTypeLabel(field.field_type)}
                          </p>
                        </div>
                        <TechnicalDetails
                          title="Details techniques"
                          lines={[
                            `identifiant_du_champ : ${field.field_key}`,
                            ...(field.reference_table_key
                              ? [
                                  `liste reliee : ${field.reference_table_key}${
                                    field.reference_group_key
                                      ? ` / ${field.reference_group_key}`
                                      : ""
                                  }`,
                                ]
                              : []),
                          ]}
                        />
                      </div>
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
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">{activeStaffAccount.username}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {getRoleLabel(activeStaffAccount.role)}
                    {session.username === activeStaffAccount.username ? " • compte courant" : ""}
                  </p>
                  <TechnicalDetails
                    title="Details techniques"
                    lines={[
                      `identifiant : ${activeStaffAccount.id}`,
                      `cree le : ${new Date(activeStaffAccount.created_at).toLocaleString("fr-FR")}`,
                      `derniere connexion : ${
                        activeStaffAccount.last_login_at
                          ? new Date(activeStaffAccount.last_login_at).toLocaleString("fr-FR")
                          : "jamais"
                      }`,
                    ]}
                  />
                </div>
                <div className="rounded-full border border-border/70 px-3 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {activeStaffAccount.is_active ? "Compte actif" : "Compte desactive"}
                </div>
              </div>

              <div className="mt-6 rounded-[20px] border border-border/70 bg-background/35 p-4">
                <p className="text-sm font-semibold text-foreground">Acces et statut</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Change le role du compte ou desactive-le sans suppression physique.
                </p>
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
                  <Button
                    type="button"
                    disabled={accountUpdatePending}
                    onClick={() => void handleUpdateAccount()}
                  >
                    {accountUpdatePending ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun compte staff selectionne.</p>
          )}
        </SectionPanel>
      </section>
    </AppShell>
  );
}
