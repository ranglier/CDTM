"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminLoginDialog } from "@/components/admin/admin-login-dialog";
import { AppShell } from "@/components/layout/app-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { CaseInfoPanel } from "@/components/map/case-info-panel";
import { CasesMap } from "@/components/map/cases-map";
import {
  createEmptyAdminCaseDraft,
  toAdminCaseDraft,
  type AdminCaseDraft,
  type AdminCaseRecord,
  type AdminSession,
  type PublicCaseSupplement,
} from "@/admin/types";
import { loadJsonData } from "@/data/loaders";
import { getBaseLayers } from "@/map/layers";
import {
  type StableCaseFeatureCollection,
  type StableCaseProperties,
  isStableCaseFeatureCollection,
} from "@/map/types";

type LoginPayload = {
  username: string;
  password: string;
};

function createLoggedOutSession(): AdminSession {
  return {
    authenticated: false,
    username: null,
  };
}

function getDraftSnapshot(draft: AdminCaseDraft): string {
  return JSON.stringify(draft);
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
  const [selectedCase, setSelectedCase] = useState<StableCaseProperties | null>(null);
  const [totalCases, setTotalCases] = useState(0);
  const [, casesLayer] = getBaseLayers();
  const [casesVisible, setCasesVisible] = useState(true);
  const [panelVisible, setPanelVisible] = useState(true);
  const [stableCases, setStableCases] = useState<StableCaseProperties[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [focusCaseId, setFocusCaseId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [publicSupplement, setPublicSupplement] = useState<PublicCaseSupplement | null>(null);
  const [publicSupplementPending, setPublicSupplementPending] = useState(false);
  const [adminSession, setAdminSession] = useState<AdminSession>(createLoggedOutSession());
  const [adminModeEnabled, setAdminModeEnabled] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [adminRecord, setAdminRecord] = useState<AdminCaseRecord | null>(null);
  const [adminDraft, setAdminDraft] = useState<AdminCaseDraft>(createEmptyAdminCaseDraft());
  const [adminSnapshot, setAdminSnapshot] = useState(getDraftSnapshot(createEmptyAdminCaseDraft()));
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const stableCasesById = useMemo(
    () => new Map(stableCases.map((item) => [item.id_case, item])),
    [stableCases],
  );
  const availableCaseIds = useMemo(() => stableCases.map((item) => item.id_case), [stableCases]);
  const adminDirty = getDraftSnapshot(adminDraft) !== adminSnapshot;

  function handleCasesVisibilityChange(visible: boolean) {
    if (!visible && adminModeEnabled && adminDirty) {
      const confirmed = window.confirm(
        "Masquer les cases fermera la selection courante et abandonnera le brouillon non enregistre. Continuer ?",
      );

      if (!confirmed) {
        return;
      }
    }

    setCasesVisible(visible);

    if (!visible) {
      setSelectedCase(null);
      setPublicSupplement(null);
      setPublicSupplementPending(false);
      setAdminRecord(null);
      setAdminError(null);
      resetAdminEditor(null);
    }
  }

  function applySelectedCase(nextCase: StableCaseProperties | null) {
    if (
      adminModeEnabled &&
      adminDirty &&
      selectedCase?.id_case &&
      nextCase?.id_case &&
      selectedCase.id_case !== nextCase.id_case
    ) {
      const confirmed = window.confirm(
        "Changer de case abandonnera le brouillon non enregistre. Continuer ?",
      );

      if (!confirmed) {
        return;
      }
    }

    setSelectedCase(nextCase);
    setSearchValue(nextCase?.id_case ?? "");
    setSearchError(null);
    setPublicSupplement(null);
    setPublicSupplementPending(Boolean(nextCase));
    setAdminRecord(null);
    setAdminError(null);

    if (adminModeEnabled) {
      resetAdminEditor(null);
    }
  }

  function focusOnCase(caseId: string) {
    const stableCase = stableCasesById.get(caseId);

    if (!stableCase) {
      setSearchError("Aucune case ne correspond a cet id_case.");
      return;
    }

    setCasesVisible(true);
    setPanelVisible(true);
    setFocusCaseId(caseId);
    setFocusRequest((value) => value + 1);
    applySelectedCase(stableCase);
  }

  const resetAdminEditor = useCallback((record: AdminCaseRecord | null) => {
    const nextDraft = toAdminCaseDraft(record);
    setAdminDraft(nextDraft);
    setAdminSnapshot(getDraftSnapshot(nextDraft));
  }, []);

  async function handleLoginSubmit(payload: LoginPayload) {
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
  }

  async function handleLogout() {
    if (adminDirty) {
      const confirmed = window.confirm(
        "Se deconnecter abandonnera le brouillon non enregistre. Continuer ?",
      );

      if (!confirmed) {
        return;
      }
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
      setAdminRecord(null);
      setAdminError(null);
      resetAdminEditor(null);
    }
  }

  function handleAdminModeAction() {
    if (!adminSession.authenticated) {
      setLoginError(null);
      setLoginOpen(true);
      return;
    }

    if (adminModeEnabled && adminDirty) {
      const confirmed = window.confirm(
        "Quitter le mode admin abandonnera le brouillon non enregistre. Continuer ?",
      );

      if (!confirmed) {
        return;
      }
    }

    setAdminModeEnabled((value) => !value);
    setAdminError(null);
    setSearchError(null);

    if (adminModeEnabled) {
      setAdminRecord(null);
      resetAdminEditor(null);
    }
  }

  function handleSearchSubmit() {
    focusOnCase(searchValue.trim());
  }

  function handleAdminFieldChange(
    section: keyof AdminCaseDraft,
    field: string,
    value: string,
  ) {
    setAdminDraft((current) => {
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
  }

  async function handleAdminSave() {
    if (!selectedCase) {
      return;
    }

    setAdminSaving(true);
    setAdminError(null);

    try {
      const record = await fetchJson<AdminCaseRecord>(`/api/admin/cases/${selectedCase.id_case}`, {
        method: "PUT",
        body: JSON.stringify(adminDraft),
      });

      setAdminRecord(record);
      resetAdminEditor(record);
      setPublicSupplement({
        id_case: record.id_case,
        note_publique: record.notes.note_publique,
      });
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setAdminSaving(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadStableCases() {
      try {
        const collection = await loadJsonData<StableCaseFeatureCollection>(casesLayer.sourcePath);

        if (!isStableCaseFeatureCollection(collection)) {
          throw new Error("Le GeoJSON des cases ne respecte pas le contrat attendu.");
        }

        if (!cancelled) {
          setStableCases(collection.features.map((feature) => feature.properties));
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
    if (!selectedCase) {
      return;
    }

    const selectedCaseId = selectedCase.id_case;
    let cancelled = false;

    async function loadPublicSupplement() {
      setPublicSupplementPending(true);

      try {
        const supplement = await fetchJson<PublicCaseSupplement>(`/api/cases/${selectedCaseId}/public`);

        if (!cancelled) {
          setPublicSupplement(supplement);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Impossible de charger la note publique.", error);
          setPublicSupplement({
            id_case: selectedCaseId,
            note_publique: null,
          });
        }
      } finally {
        if (!cancelled) {
          setPublicSupplementPending(false);
        }
      }
    }

    void loadPublicSupplement();

    return () => {
      cancelled = true;
    };
  }, [selectedCase]);

  useEffect(() => {
    if (!selectedCase || !adminModeEnabled || !adminSession.authenticated) {
      return;
    }

    const selectedCaseId = selectedCase.id_case;
    let cancelled = false;

    async function loadAdminCase() {
      setAdminLoading(true);
      setAdminError(null);

      try {
        const record = await fetchJson<AdminCaseRecord>(`/api/admin/cases/${selectedCaseId}`);

        if (!cancelled) {
          setAdminRecord(record);
          resetAdminEditor(record);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "Chargement admin impossible.";

          setAdminError(message);

          if (message.includes("non autorise")) {
            setAdminSession(createLoggedOutSession());
            setAdminModeEnabled(false);
          } else {
            setAdminRecord(null);
            resetAdminEditor(null);
          }
        }
      } finally {
        if (!cancelled) {
          setAdminLoading(false);
        }
      }
    }

    void loadAdminCase();

    return () => {
      cancelled = true;
    };
  }, [adminModeEnabled, adminSession.authenticated, resetAdminEditor, selectedCase]);

  return (
    <AppShell>
      <SiteHeader
        totalCases={totalCases}
        casesVisible={casesVisible}
        adminAuthenticated={adminSession.authenticated}
        adminModeEnabled={adminModeEnabled}
        adminUsername={adminSession.username}
        onAdminAction={handleAdminModeAction}
      />
      <section
        className={
          panelVisible
            ? "grid min-h-[calc(100svh-2rem)] flex-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_24rem]"
            : "grid min-h-[calc(100svh-2rem)] flex-1 gap-6"
        }
        aria-label="Carte publique des cases"
      >
        <CasesMap
          dataUrl={casesLayer.sourcePath}
          selectedCaseId={selectedCase?.id_case ?? null}
          focusCaseId={focusCaseId}
          focusRequest={focusRequest}
          casesVisible={casesVisible}
          panelVisible={panelVisible}
          onCaseSelect={applySelectedCase}
          onCasesVisibilityChange={handleCasesVisibilityChange}
          onPanelVisibilityChange={setPanelVisible}
          onFeaturesLoad={setTotalCases}
        />
        {panelVisible ? (
          <CaseInfoPanel
            selectedCase={selectedCase}
            totalCases={totalCases}
            casesVisible={casesVisible}
            publicSupplement={publicSupplement}
            publicSupplementPending={publicSupplementPending}
            adminAuthenticated={adminSession.authenticated}
            adminModeEnabled={adminModeEnabled}
            adminUsername={adminSession.username}
            adminDraft={adminDraft}
            adminRecord={adminRecord}
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
            onAdminFieldChange={handleAdminFieldChange}
            onAdminReset={() => {
              resetAdminEditor(adminRecord);
              setAdminError(null);
            }}
            onAdminSave={handleAdminSave}
            onAdminLogout={handleLogout}
            onOpenAdminLogin={() => {
              setLoginError(null);
              setLoginOpen(true);
            }}
            onToggleAdminMode={handleAdminModeAction}
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
