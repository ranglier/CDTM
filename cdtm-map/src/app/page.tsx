"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminLoginDialog } from "@/components/admin/admin-login-dialog";
import { AppShell } from "@/components/layout/app-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { CaseInfoPanel } from "@/components/map/case-info-panel";
import { CasesMap } from "@/components/map/cases-map";
import {
  createEmptyAdminBulkEditDraft,
  createEmptyAdminCaseDraft,
  toAdminCaseDraft,
  type AdminBulkEditDraft,
  type AdminBulkPatch,
  type AdminBulkUpdateResult,
  type AdminCaseDraft,
  type AdminCaseRecord,
  type AdminSession,
  type PublicCaseIndexResponse,
  type PublicCaseProperties,
} from "@/admin/types";
import { loadJsonData } from "@/data/loaders";
import { getBaseLayers } from "@/map/layers";
import {
  type CaseSelectionIntent,
  createEmptyPublicMapStyles,
  type MapDisplayMode,
  type PublicMapStyles,
  type StableCaseFeatureCollection,
  type StableCaseProperties,
  isStableCaseFeatureCollection,
} from "@/map/types";

type LoginPayload = {
  username: string;
  password: string;
};

type AdminPanelMode = "read" | "edit";
type StaticAdminDraftSection = Exclude<keyof AdminCaseDraft, "dynamic">;

function resolveCaseSearchMatch(
  stableCases: StableCaseProperties[],
  rawQuery: string,
): StableCaseProperties | null {
  const query = rawQuery.trim().toLowerCase();

  if (query.length === 0) {
    return null;
  }

  const exactMatch =
    stableCases.find((stableCase) => stableCase.id_case.toLowerCase() === query) ?? null;

  if (exactMatch) {
    return exactMatch;
  }

  const prefixMatches = stableCases.filter((stableCase) =>
    stableCase.id_case.toLowerCase().startsWith(query),
  );

  return prefixMatches.length === 1 ? prefixMatches[0] : null;
}

function createLoggedOutSession(): AdminSession {
  return {
    authenticated: false,
    username: null,
    role: null,
    is_tech_admin: false,
  };
}

function getDraftSnapshot(draft: AdminCaseDraft): string {
  return JSON.stringify(draft);
}

function normalizeDraftValue(value: string | null | undefined): string {
  return typeof value === "string" ? value : "";
}

function normalizeDraftBooleanValue(value: boolean | null | undefined): string {
  if (value === true) {
    return "true";
  }

  if (value === false) {
    return "false";
  }

  return "";
}

function parseDraftBooleanValue(value: string): boolean | null {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

function getRegistryCaseId(stableCase: StableCaseProperties): string {
  return stableCase.registry_id_case ?? stableCase.id_case;
}

function mergeStableCases(
  baseCases: StableCaseProperties[],
  publicCases: PublicCaseProperties[],
): StableCaseProperties[] {
  const publicCasesByRegistryId = new Map(
    publicCases.map((publicCase) => [publicCase.registry_id_case, publicCase]),
  );

  return baseCases.map((stableCase) => {
    const registryId = getRegistryCaseId(stableCase);
    const publicCase = publicCasesByRegistryId.get(registryId);

    if (!publicCase) {
      return stableCase;
    }

    return {
      registry_id_case: registryId,
      id_case: publicCase.id_case,
      region: publicCase.region,
      sous_region: publicCase.sous_region,
      cote: publicCase.cote,
      lac_majeur: publicCase.lac_majeur,
      cours_eau_majeur: publicCase.cours_eau_majeur,
      terrain_cat: publicCase.terrain_cat,
      terrain_type: publicCase.terrain_type,
      relief: publicCase.relief,
      faction: publicCase.faction,
      controleur: publicCase.controleur,
      controle_type: publicCase.controle_type,
    };
  });
}

function applyPersistedRecordToStableCase(
  stableCase: StableCaseProperties,
  record: AdminCaseRecord,
): StableCaseProperties {
  return {
    registry_id_case: getRegistryCaseId(stableCase),
    id_case: record.public.id_case,
    region: record.public.region,
    sous_region: record.public.sous_region,
    cote: record.public.cote,
    lac_majeur: record.public.lac_majeur,
    cours_eau_majeur: record.public.cours_eau_majeur,
    terrain_cat: record.public.terrain_cat,
    terrain_type: record.public.terrain_type,
    relief: record.public.relief,
    faction: record.public.faction,
    controleur: record.public.controleur,
    controle_type: record.public.controle_type,
  };
}

function mergePersistedRecordsIntoStableCases(
  stableCases: StableCaseProperties[],
  records: AdminCaseRecord[],
): StableCaseProperties[] {
  const recordsByRegistryId = new Map(records.map((record) => [record.id_case, record]));

  return stableCases.map((stableCase) => {
    const record = recordsByRegistryId.get(getRegistryCaseId(stableCase));
    return record ? applyPersistedRecordToStableCase(stableCase, record) : stableCase;
  });
}

function hasBulkDraftChanges(draft: AdminBulkEditDraft): boolean {
  return [
    draft.public.region,
    draft.public.sous_region,
    draft.public.cote,
    draft.public.lac_majeur,
    draft.public.cours_eau_majeur,
    draft.notes.note_publique,
    draft.notes.note_staff,
    draft.terrain.terrain_cat,
    draft.terrain.terrain_type,
    draft.terrain.relief,
    draft.control.faction,
    draft.control.controleur,
    draft.control.controle_type,
  ].some((fieldState) => fieldState.touched);
}

function buildBulkFieldState(values: Array<string | null | undefined>) {
  const normalizedValues = values.map((value) => normalizeDraftValue(value).trim());
  const uniqueValues = Array.from(new Set(normalizedValues));

  return {
    value: uniqueValues.length === 1 ? uniqueValues[0] : "",
    touched: false,
    mixed: uniqueValues.length > 1,
  };
}

function buildBulkEditDraft(records: AdminCaseRecord[]): AdminBulkEditDraft {
  if (records.length === 0) {
    return createEmptyAdminBulkEditDraft();
  }

  return {
    public: {
      region: buildBulkFieldState(records.map((record) => record.public.region)),
      sous_region: buildBulkFieldState(records.map((record) => record.public.sous_region)),
      cote: buildBulkFieldState(records.map((record) => normalizeDraftBooleanValue(record.public.cote))),
      lac_majeur: buildBulkFieldState(
        records.map((record) => normalizeDraftBooleanValue(record.public.lac_majeur)),
      ),
      cours_eau_majeur: buildBulkFieldState(
        records.map((record) => normalizeDraftBooleanValue(record.public.cours_eau_majeur)),
      ),
    },
    notes: {
      note_publique: buildBulkFieldState(records.map((record) => record.notes.note_publique)),
      note_staff: buildBulkFieldState(records.map((record) => record.notes.note_staff)),
    },
    terrain: {
      terrain_cat: buildBulkFieldState(records.map((record) => record.terrain.terrain_cat)),
      terrain_type: buildBulkFieldState(records.map((record) => record.terrain.terrain_type)),
      relief: buildBulkFieldState(records.map((record) => record.terrain.relief)),
    },
    control: {
      faction: buildBulkFieldState(records.map((record) => record.control.faction)),
      controleur: buildBulkFieldState(records.map((record) => record.control.controleur)),
      controle_type: buildBulkFieldState(records.map((record) => record.control.controle_type)),
    },
  };
}

function buildBulkPatch(draft: AdminBulkEditDraft): AdminBulkPatch {
  const patch: AdminBulkPatch = {};

  if (
    draft.public.region.touched ||
    draft.public.sous_region.touched ||
    draft.public.cote.touched ||
    draft.public.lac_majeur.touched ||
    draft.public.cours_eau_majeur.touched
  ) {
    patch.public = {};

    if (draft.public.region.touched) {
      patch.public.region =
        draft.public.region.value.trim().length > 0 ? draft.public.region.value.trim() : null;
    }

    if (draft.public.sous_region.touched) {
      patch.public.sous_region =
        draft.public.sous_region.value.trim().length > 0
          ? draft.public.sous_region.value.trim()
          : null;
    }

    if (draft.public.cote.touched) {
      patch.public.cote = parseDraftBooleanValue(draft.public.cote.value);
    }

    if (draft.public.lac_majeur.touched) {
      patch.public.lac_majeur = parseDraftBooleanValue(draft.public.lac_majeur.value);
    }

    if (draft.public.cours_eau_majeur.touched) {
      patch.public.cours_eau_majeur = parseDraftBooleanValue(
        draft.public.cours_eau_majeur.value,
      );
    }
  }

  if (draft.notes.note_publique.touched || draft.notes.note_staff.touched) {
    patch.notes = {};

    if (draft.notes.note_publique.touched) {
      patch.notes.note_publique =
        draft.notes.note_publique.value.trim().length > 0
          ? draft.notes.note_publique.value.trim()
          : null;
    }

    if (draft.notes.note_staff.touched) {
      patch.notes.note_staff =
        draft.notes.note_staff.value.trim().length > 0 ? draft.notes.note_staff.value.trim() : null;
    }
  }

  if (
    draft.terrain.terrain_cat.touched ||
    draft.terrain.terrain_type.touched ||
    draft.terrain.relief.touched
  ) {
    patch.terrain = {};

    if (draft.terrain.terrain_cat.touched) {
      patch.terrain.terrain_cat =
        draft.terrain.terrain_cat.value.trim().length > 0
          ? draft.terrain.terrain_cat.value.trim()
          : null;
    }

    if (draft.terrain.terrain_type.touched) {
      patch.terrain.terrain_type =
        draft.terrain.terrain_type.value.trim().length > 0
          ? draft.terrain.terrain_type.value.trim()
          : null;
    }

    if (draft.terrain.relief.touched) {
      patch.terrain.relief =
        draft.terrain.relief.value.trim().length > 0 ? draft.terrain.relief.value.trim() : null;
    }
  }

  if (
    draft.control.faction.touched ||
    draft.control.controleur.touched ||
    draft.control.controle_type.touched
  ) {
    patch.control = {};

    if (draft.control.faction.touched) {
      patch.control.faction =
        draft.control.faction.value.trim().length > 0 ? draft.control.faction.value.trim() : null;
    }

    if (draft.control.controleur.touched) {
      patch.control.controleur =
        draft.control.controleur.value.trim().length > 0
          ? draft.control.controleur.value.trim()
          : null;
    }

    if (draft.control.controle_type.touched) {
      patch.control.controle_type =
        draft.control.controle_type.value.trim().length > 0
          ? draft.control.controle_type.value.trim()
          : null;
    }
  }

  return patch;
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

export default function HomePage() {
  const [totalCases, setTotalCases] = useState(0);
  const [, casesLayer] = getBaseLayers();
  const [casesVisible, setCasesVisible] = useState(true);
  const [panelVisible, setPanelVisible] = useState(true);
  const [stableCases, setStableCases] = useState<StableCaseProperties[]>([]);
  const [publicMapStyles, setPublicMapStyles] = useState<PublicMapStyles>(createEmptyPublicMapStyles());
  const [mapDisplayMode, setMapDisplayMode] = useState<MapDisplayMode>("neutral");
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [focusCaseId, setFocusCaseId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [adminSession, setAdminSession] = useState<AdminSession>(createLoggedOutSession());
  const [adminModeEnabled, setAdminModeEnabled] = useState(false);
  const [adminPanelMode, setAdminPanelMode] = useState<AdminPanelMode>("read");
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [adminRecordsById, setAdminRecordsById] = useState<Record<string, AdminCaseRecord>>({});
  const [singleDraft, setSingleDraft] = useState<AdminCaseDraft>(createEmptyAdminCaseDraft());
  const [singleSnapshot, setSingleSnapshot] = useState(
    getDraftSnapshot(createEmptyAdminCaseDraft()),
  );
  const [bulkDraft, setBulkDraft] = useState<AdminBulkEditDraft>(createEmptyAdminBulkEditDraft());
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const stableCasesById = useMemo(
    () => new Map(stableCases.map((item) => [getRegistryCaseId(item), item])),
    [stableCases],
  );
  const stableCasesByRegistryId = useMemo(
    () =>
      Object.fromEntries(
        stableCases.map((item) => [getRegistryCaseId(item), item]),
      ) as Record<string, StableCaseProperties>,
    [stableCases],
  );
  const availableCaseIds = useMemo(() => stableCases.map((item) => item.id_case), [stableCases]);
  const activeCase = useMemo(
    () => (activeCaseId ? stableCasesById.get(activeCaseId) ?? null : null),
    [activeCaseId, stableCasesById],
  );
  const selectedCases = useMemo(
    () =>
      selectedCaseIds
        .map((idCase) => stableCasesById.get(idCase))
        .filter((value): value is StableCaseProperties => Boolean(value)),
    [selectedCaseIds, stableCasesById],
  );
  const selectedAdminRecords = useMemo(
    () =>
      selectedCaseIds
        .map((idCase) => adminRecordsById[idCase])
        .filter((value): value is AdminCaseRecord => Boolean(value)),
    [adminRecordsById, selectedCaseIds],
  );
  const activeAdminRecord = useMemo(
    () => (activeCaseId ? adminRecordsById[activeCaseId] ?? null : null),
    [activeCaseId, adminRecordsById],
  );
  const isMultiSelection = selectedCaseIds.length > 1;
  const adminDirty =
    adminPanelMode === "edit"
      ? isMultiSelection
        ? hasBulkDraftChanges(bulkDraft)
        : getDraftSnapshot(singleDraft) !== singleSnapshot
      : false;

  const resetSingleAdminEditor = useCallback(
    (record: AdminCaseRecord | null, stableCase: StableCaseProperties | null) => {
      const nextDraft = toAdminCaseDraft(record);

      if (stableCase) {
        nextDraft.public = {
          id_case: stableCase.id_case,
          region: stableCase.region ?? "",
          sous_region: stableCase.sous_region ?? "",
          cote: normalizeDraftBooleanValue(stableCase.cote),
          lac_majeur: normalizeDraftBooleanValue(stableCase.lac_majeur),
          cours_eau_majeur: normalizeDraftBooleanValue(stableCase.cours_eau_majeur),
        };
      }

    setSingleDraft(nextDraft);
    setSingleSnapshot(getDraftSnapshot(nextDraft));
    },
    [],
  );

  const resetBulkAdminEditor = useCallback((records: AdminCaseRecord[]) => {
    setBulkDraft(buildBulkEditDraft(records));
  }, []);

  const applySelectionState = useCallback(
    (nextActiveCaseId: string | null, nextSelectedCaseIds: string[]) => {
      setActiveCaseId(nextActiveCaseId);
      setSelectedCaseIds(nextSelectedCaseIds);
      setSearchError(null);
      setAdminError(null);
      setAdminPanelMode("read");
    },
    [],
  );

  const confirmDiscardChanges = useCallback(
    (message: string) => {
      if (adminPanelMode !== "edit" || !adminDirty) {
        return true;
      }

      return window.confirm(message);
    },
    [adminDirty, adminPanelMode],
  );

  const fetchAdminRecords = useCallback(async (idCases: string[]): Promise<AdminCaseRecord[]> => {
    return Promise.all(
      idCases.map((idCase) => fetchJson<AdminCaseRecord>(`/api/admin/cases/${idCase}`)),
    );
  }, []);

  const refreshAdminRecords = useCallback(
    async (idCases: string[]) => {
      const records = await fetchAdminRecords(idCases);

      setAdminRecordsById((current) => {
        const next = { ...current };

        for (const record of records) {
          next[record.id_case] = record;
        }

        return next;
      });

      return records;
    },
    [fetchAdminRecords],
  );

  const handleCasesVisibilityChange = useCallback(
    (visible: boolean) => {
      if (
        !visible &&
        !confirmDiscardChanges(
          "Masquer les cases fermera la selection courante et abandonnera le brouillon non enregistre. Continuer ?",
        )
      ) {
        return;
      }

      setCasesVisible(visible);

      if (!visible) {
        applySelectionState(null, []);
        resetSingleAdminEditor(null, null);
        resetBulkAdminEditor([]);
      }
    },
    [applySelectionState, confirmDiscardChanges, resetBulkAdminEditor, resetSingleAdminEditor],
  );

  const handleCaseSelectionChange = useCallback(
    (
      selectedCase: StableCaseProperties | null,
      intent: CaseSelectionIntent,
    ) => {
      const nextCaseId = selectedCase ? getRegistryCaseId(selectedCase) : null;

      if (
        intent === "replace" &&
        ((nextCaseId === null && selectedCaseIds.length === 0 && activeCaseId === null) ||
          (nextCaseId !== null &&
            activeCaseId === nextCaseId &&
            selectedCaseIds.length === 1 &&
            selectedCaseIds[0] === nextCaseId))
      ) {
        return;
      }

      const selectionWillChange =
        intent === "replace"
          ? nextCaseId !== activeCaseId || selectedCaseIds.length > (nextCaseId ? 1 : 0)
          : Boolean(nextCaseId);

      if (
        selectionWillChange &&
        !confirmDiscardChanges(
          "Changer de selection abandonnera le brouillon non enregistre. Continuer ?",
        )
      ) {
        return;
      }

      if (intent === "replace") {
        applySelectionState(nextCaseId, nextCaseId ? [nextCaseId] : []);
        return;
      }

      if (!nextCaseId) {
        return;
      }

      setSelectedCaseIds((current) => {
        const alreadySelected = current.includes(nextCaseId);
        const nextSelectedCaseIds = alreadySelected
          ? current.filter((idCase) => idCase !== nextCaseId)
          : [...current, nextCaseId];
        const nextActiveCaseId = alreadySelected
          ? activeCaseId === nextCaseId
            ? nextSelectedCaseIds.at(-1) ?? null
            : activeCaseId
          : nextCaseId;

        setActiveCaseId(nextActiveCaseId);
        setSearchError(null);
        setAdminError(null);
        setAdminPanelMode("read");

        return nextSelectedCaseIds;
      });
    },
    [activeCaseId, applySelectionState, confirmDiscardChanges, selectedCaseIds],
  );

  const focusOnCase = useCallback(
    (query: string) => {
      const stableCase = resolveCaseSearchMatch(stableCases, query);

      if (!stableCase) {
        setSearchError("Aucune case ne correspond a cet id_case.");
        return;
      }

      if (
        !confirmDiscardChanges(
          "Changer de selection abandonnera le brouillon non enregistre. Continuer ?",
        )
      ) {
        return;
      }

      setCasesVisible(true);
      setPanelVisible(true);
      setSearchValue(stableCase.id_case);
      setFocusCaseId(getRegistryCaseId(stableCase));
      setFocusRequest((value) => value + 1);
      applySelectionState(getRegistryCaseId(stableCase), [getRegistryCaseId(stableCase)]);
    },
    [applySelectionState, confirmDiscardChanges, stableCases],
  );

  const handleLoginSubmit = useCallback(async (payload: LoginPayload) => {
    setLoginPending(true);
    setLoginError(null);

    try {
      const session = await fetchJson<AdminSession>("/api/admin/session", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setAdminSession(session);
      setAdminModeEnabled(true);
      setLoginOpen(false);
      setLoginUsername("");
      setLoginPassword("");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Connexion impossible.");
    } finally {
      setLoginPending(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    if (
      !confirmDiscardChanges(
        "Se deconnecter abandonnera le brouillon non enregistre. Continuer ?",
      )
    ) {
      return;
    }

    try {
      const session = await fetchJson<AdminSession>("/api/admin/session", {
        method: "DELETE",
        body: JSON.stringify({}),
      });

      setAdminSession(session);
    } catch {
      setAdminSession(createLoggedOutSession());
    } finally {
      setAdminModeEnabled(false);
      setAdminPanelMode("read");
      setAdminError(null);
      resetSingleAdminEditor(null, null);
      resetBulkAdminEditor([]);
    }
  }, [confirmDiscardChanges, resetBulkAdminEditor, resetSingleAdminEditor]);

  const handleAdminModeAction = useCallback(() => {
    if (!adminSession.authenticated) {
      setLoginError(null);
      setLoginOpen(true);
      return;
    }

    if (
      !confirmDiscardChanges(
        "Quitter le mode admin abandonnera le brouillon non enregistre. Continuer ?",
      )
    ) {
      return;
    }

    setAdminModeEnabled((value) => !value);
    setAdminError(null);
    setAdminPanelMode("read");
  }, [adminSession.authenticated, confirmDiscardChanges]);

  const handleSearchSubmit = useCallback(() => {
    focusOnCase(searchValue.trim());
  }, [focusOnCase, searchValue]);

  const handleSingleAdminFieldChange = useCallback(
    (section: StaticAdminDraftSection, field: string, value: string) => {
      setSingleDraft((current) => {
        const nextDraft = {
          ...current,
          [section]: {
            ...current[section],
            [field]: value,
          },
        } as AdminCaseDraft;

        if (section === "terrain" && field === "terrain_cat") {
          nextDraft.terrain = {
            ...nextDraft.terrain,
            terrain_type: "",
          };
        }

        return nextDraft;
      });
    },
    [],
  );

  const handleDynamicAdminFieldChange = useCallback(
    (tableKey: string, field: string, value: string) => {
      setSingleDraft((current) => ({
        ...current,
        dynamic: {
          ...current.dynamic,
          [tableKey]: {
            ...(current.dynamic[tableKey] ?? {}),
            [field]: value,
          },
        },
      }));
    },
    [],
  );

  const handleBulkAdminFieldChange = useCallback(
    (
      section: keyof AdminBulkEditDraft,
      field: string,
      value: string,
    ) => {
      setBulkDraft((current) => {
        const nextDraft = {
          ...current,
          [section]: {
            ...current[section],
            [field]: {
              ...(current[section] as Record<string, { value: string; touched: boolean; mixed: boolean }>)[field],
              value,
              touched: true,
              mixed: false,
            },
          },
        } as AdminBulkEditDraft;

        if (section === "terrain" && field === "terrain_cat") {
          nextDraft.terrain.terrain_type = {
            ...nextDraft.terrain.terrain_type,
            value: "",
            touched: true,
            mixed: false,
          };
        }

        if (section === "terrain" && field === "terrain_type" && !nextDraft.terrain.terrain_cat.touched) {
          nextDraft.terrain.terrain_cat = {
            ...nextDraft.terrain.terrain_cat,
            touched: true,
            mixed: false,
          };
        }

        return nextDraft;
      });
    },
    [],
  );

  const handleEnterEditMode = useCallback(() => {
    if (!adminModeEnabled || !adminSession.authenticated) {
      setLoginError(null);
      setLoginOpen(true);
      return;
    }

    if (isMultiSelection && selectedAdminRecords.length !== selectedCaseIds.length) {
      return;
    }

    if (!isMultiSelection && !activeAdminRecord) {
      return;
    }

    if (isMultiSelection) {
      resetBulkAdminEditor(selectedAdminRecords);
    } else {
      resetSingleAdminEditor(activeAdminRecord, activeCase);
    }

    setAdminError(null);
    setAdminPanelMode("edit");
  }, [
    activeCase,
    activeAdminRecord,
    adminModeEnabled,
    adminSession.authenticated,
    selectedCaseIds.length,
    isMultiSelection,
    resetBulkAdminEditor,
    resetSingleAdminEditor,
    selectedAdminRecords,
  ]);

  const handleCancelEdit = useCallback(() => {
    if (isMultiSelection) {
      resetBulkAdminEditor(selectedAdminRecords);
    } else {
      resetSingleAdminEditor(activeAdminRecord, activeCase);
    }

    setAdminError(null);
    setAdminPanelMode("read");
  }, [
    activeAdminRecord,
    activeCase,
    isMultiSelection,
    resetBulkAdminEditor,
    resetSingleAdminEditor,
    selectedAdminRecords,
  ]);

  const handleAdminSave = useCallback(async () => {
    if (!adminSession.authenticated || selectedCaseIds.length === 0) {
      return;
    }

    setAdminSaving(true);
    setAdminError(null);

    try {
      if (isMultiSelection) {
        const patch = buildBulkPatch(bulkDraft);

        await fetchJson<AdminBulkUpdateResult>("/api/admin/cases/bulk", {
          method: "PATCH",
          body: JSON.stringify({
            id_cases: selectedCaseIds,
            patch,
          }),
        });

        const refreshedRecords = await refreshAdminRecords(selectedCaseIds);
        setStableCases((current) => mergePersistedRecordsIntoStableCases(current, refreshedRecords));

        resetBulkAdminEditor(refreshedRecords);
      } else {
        const currentCaseId = activeCaseId;

        if (!currentCaseId) {
          return;
        }

        const record = await fetchJson<AdminCaseRecord>(`/api/admin/cases/${currentCaseId}`, {
          method: "PUT",
          body: JSON.stringify(singleDraft),
        });

        setAdminRecordsById((current) => ({
          ...current,
          [record.id_case]: record,
        }));
        setStableCases((current) => mergePersistedRecordsIntoStableCases(current, [record]));
        setSearchValue(record.public.id_case);
        resetSingleAdminEditor(
          record,
          activeCase ? applyPersistedRecordToStableCase(activeCase, record) : record.public,
        );
      }

      setAdminPanelMode("read");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setAdminSaving(false);
    }
  }, [
    activeCase,
    activeCaseId,
    adminSession.authenticated,
    bulkDraft,
    isMultiSelection,
    refreshAdminRecords,
    resetBulkAdminEditor,
    resetSingleAdminEditor,
    selectedCaseIds,
    singleDraft,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadStableCases() {
      try {
        const [collection, publicCases] = await Promise.all([
          loadJsonData<StableCaseFeatureCollection>(casesLayer.sourcePath),
          fetchJson<PublicCaseIndexResponse>("/api/cases/public-index").catch(() => ({
            cases: [] as PublicCaseProperties[],
            styles: createEmptyPublicMapStyles(),
          })),
        ]);

        if (!isStableCaseFeatureCollection(collection)) {
          throw new Error("Le GeoJSON des cases ne respecte pas le contrat attendu.");
        }

        if (!cancelled) {
          const baseCases = collection.features.map((feature) => ({
            ...feature.properties,
            registry_id_case: feature.properties.id_case,
          }));

          setStableCases(mergeStableCases(baseCases, publicCases.cases));
          setPublicMapStyles(publicCases.styles);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Impossible de charger l'index des cases.", error);
        }
      }
    }

    void loadStableCases();

    return () => {
      cancelled = true;
    };
  }, [casesLayer.sourcePath]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      try {
        const session = await fetchJson<AdminSession>("/api/admin/session");

        if (!cancelled) {
          setAdminSession(session);
        }
      } catch {
        if (!cancelled) {
          setAdminSession(createLoggedOutSession());
        }
      }
    }

    void hydrateSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!adminModeEnabled || !adminSession.authenticated || selectedCaseIds.length === 0) {
      return;
    }

    const idsToLoad = selectedCaseIds.filter((idCase) => !adminRecordsById[idCase]);

    if (idsToLoad.length === 0) {
      return;
    }

    let cancelled = false;

    async function loadAdminCases() {
      setAdminLoading(true);
      setAdminError(null);

      try {
        const records = await fetchAdminRecords(idsToLoad);

        if (!cancelled) {
          setAdminRecordsById((current) => {
            const next = { ...current };

            for (const record of records) {
              next[record.id_case] = record;
            }

            return next;
          });
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "Chargement admin impossible.";

          setAdminError(message);

          if (message.includes("non autorise")) {
            setAdminSession(createLoggedOutSession());
            setAdminModeEnabled(false);
          }
        }
      } finally {
        if (!cancelled) {
          setAdminLoading(false);
        }
      }
    }

    void loadAdminCases();

    return () => {
      cancelled = true;
    };
  }, [
    adminModeEnabled,
    adminRecordsById,
    adminSession.authenticated,
    fetchAdminRecords,
    selectedCaseIds,
  ]);

  return (
    <AppShell>
      <SiteHeader
        adminAuthenticated={adminSession.authenticated}
        adminModeEnabled={adminModeEnabled}
        navigationItems={[
          { href: "#carte", label: "Carte", current: true },
          ...(adminSession.is_tech_admin
            ? [{ href: "/admin/tech", label: "Technique" }]
            : []),
        ]}
        onAdminAction={handleAdminModeAction}
        onAdminLogout={handleLogout}
      />
      <section
        id="carte"
        className={
          panelVisible
            ? "grid min-h-[calc(100svh-6rem)] flex-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_24rem]"
            : "grid min-h-[calc(100svh-6rem)] flex-1 gap-6"
        }
        aria-label="Carte publique des cases"
      >
        <CasesMap
          dataUrl={casesLayer.sourcePath}
          activeCaseId={activeCaseId}
          selectedCaseIds={selectedCaseIds}
          casePropertiesById={stableCasesByRegistryId}
          publicMapStyles={publicMapStyles}
          displayMode={mapDisplayMode}
          focusCaseId={focusCaseId}
          focusRequest={focusRequest}
          casesVisible={casesVisible}
          panelVisible={panelVisible}
          onDisplayModeChange={setMapDisplayMode}
          onCaseSelectionChange={handleCaseSelectionChange}
          onCasesVisibilityChange={handleCasesVisibilityChange}
          onPanelVisibilityChange={setPanelVisible}
          onFeaturesLoad={setTotalCases}
        />
        {panelVisible ? (
          <CaseInfoPanel
            activeCase={activeCase}
            selectedCases={selectedCases}
            selectedCaseIds={selectedCaseIds}
            totalCases={totalCases}
            casesVisible={casesVisible}
            adminModeEnabled={adminModeEnabled}
            adminPanelMode={adminPanelMode}
            activeAdminRecord={activeAdminRecord}
            selectedAdminRecords={selectedAdminRecords}
            singleDraft={singleDraft}
            bulkDraft={bulkDraft}
            adminLoading={adminLoading}
            adminSaving={adminSaving}
            adminError={adminError}
            adminDirty={adminDirty}
            searchValue={searchValue}
            searchError={searchError}
            availableCaseIds={availableCaseIds}
            onSearchValueChange={(value) => {
              setSearchValue(value);
              setSearchError(null);
            }}
            onSearchSubmit={handleSearchSubmit}
            onSingleFieldChange={handleSingleAdminFieldChange}
            onDynamicFieldChange={handleDynamicAdminFieldChange}
            onBulkFieldChange={handleBulkAdminFieldChange}
            onEnterEditMode={handleEnterEditMode}
            onCancelEdit={handleCancelEdit}
            onSave={handleAdminSave}
          />
        ) : null}
      </section>
      <AdminLoginDialog
        open={loginOpen}
        username={loginUsername}
        password={loginPassword}
        pending={loginPending}
        error={loginError}
        onUsernameChange={setLoginUsername}
        onPasswordChange={setLoginPassword}
        onClose={() => {
          setLoginOpen(false);
          setLoginError(null);
        }}
        onSubmit={() =>
          void handleLoginSubmit({
            username: loginUsername,
            password: loginPassword,
          })
        }
      />
    </AppShell>
  );
}
