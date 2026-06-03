"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createLoggedOutSession,
  mergePublicCasesIntoStableCases,
} from "@/admin/case-editing";
import type {
  AdminCaseRecord,
  AdminSession,
  PublicCaseIndexResponse,
  PublicCaseProperties,
} from "@/admin/types";
import { AdminLoginDialog } from "@/components/admin/admin-login-dialog";
import { buildAppNavigationItems } from "@/components/layout/admin-navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { CaseInfoPanel } from "@/components/map/case-info-panel";
import { CasesMap } from "@/components/map/cases-map";
import { loadJsonData } from "@/data/loaders";
import { getRegistryCaseId } from "@/map/case-data";
import type { PublicMapObjectsResponse } from "@/map/public-objects";
import {
  buildCaseSearchTargets,
  buildPublicObjectSearchTargets,
  resolveMapSearchTarget,
  type MapSearchTarget,
} from "@/map/search";
import {
  CASES_DATA_URL,
  type CaseSelectionIntent,
  createEmptyPublicMapStyles,
  isStableCaseFeatureCollection,
  normalizeMapDisplayMode,
  toStableCaseProperties,
  type MapDisplayMode,
  type PublicMapStyles,
  type StableCaseFeatureCollection,
  type StableCaseProperties,
} from "@/map/types";

type LoginPayload = {
  username: string;
  password: string;
};

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

function buildEditorHref(
  activeCaseId: string | null,
  selectedCaseIds: string[],
  displayMode: MapDisplayMode,
): string | null {
  const params = new URLSearchParams();

  if (selectedCaseIds.length === 1) {
    params.set("case", activeCaseId ?? selectedCaseIds[0]);
  } else if (selectedCaseIds.length > 1) {
    params.set("cases", selectedCaseIds.join(","));

    if (activeCaseId) {
      params.set("case", activeCaseId);
    }
  }

  params.set("mode", displayMode);

  return `/editeur?${params.toString()}`;
}

function areCaseSelectionsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((idCase, index) => idCase === right[index]);
}

export default function HomePage() {
  const [totalCases, setTotalCases] = useState(0);
  const [casesVisible, setCasesVisible] = useState(true);
  const [panelVisible, setPanelVisible] = useState(true);
  const [stableCases, setStableCases] = useState<StableCaseProperties[]>([]);
  const [publicMapStyles, setPublicMapStyles] = useState<PublicMapStyles>(
    createEmptyPublicMapStyles(),
  );
  const [mapDisplayMode, setMapDisplayMode] =
    useState<MapDisplayMode>("faction");
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [focusCaseId, setFocusCaseId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [focusCaseIds, setFocusCaseIds] = useState<string[]>([]);
  const [focusCaseIdsRequest, setFocusCaseIdsRequest] = useState(0);
  const [focusSearchTarget, setFocusSearchTarget] =
    useState<MapSearchTarget | null>(null);
  const [focusSearchRequest, setFocusSearchRequest] = useState(0);
  const [clearMapHoverRequest, setClearMapHoverRequest] = useState(0);
  const [publicObjects, setPublicObjects] =
    useState<PublicMapObjectsResponse | null>(null);
  const [adminSession, setAdminSession] = useState<AdminSession>(
    createLoggedOutSession(),
  );
  const [adminModeEnabled, setAdminModeEnabled] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [adminRecordsById, setAdminRecordsById] = useState<
    Record<string, AdminCaseRecord>
  >({});
  const [adminLoading, setAdminLoading] = useState(false);
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
  const searchOptions = useMemo(
    () => [
      ...buildCaseSearchTargets(stableCases),
      ...buildPublicObjectSearchTargets({
        localities: publicObjects?.localities ?? [],
        landmarks: publicObjects?.landmarks ?? [],
        routes: publicObjects?.routes ?? [],
      }),
    ],
    [publicObjects, stableCases],
  );
  const activeCase = useMemo(
    () => (activeCaseId ? (stableCasesById.get(activeCaseId) ?? null) : null),
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
    () => (activeCaseId ? (adminRecordsById[activeCaseId] ?? null) : null),
    [activeCaseId, adminRecordsById],
  );
  const editorHref = useMemo(
    () => buildEditorHref(activeCaseId, selectedCaseIds, mapDisplayMode),
    [activeCaseId, mapDisplayMode, selectedCaseIds],
  );

  const handleDisplayModeChange = useCallback((mode: unknown) => {
    setMapDisplayMode(normalizeMapDisplayMode(mode));
  }, []);

  const applySelectionState = useCallback(
    (nextActiveCaseId: string | null, nextSelectedCaseIds: string[]) => {
      setActiveCaseId((currentActiveCaseId) =>
        currentActiveCaseId === nextActiveCaseId
          ? currentActiveCaseId
          : nextActiveCaseId,
      );
      setSelectedCaseIds((currentSelectedCaseIds) =>
        areCaseSelectionsEqual(currentSelectedCaseIds, nextSelectedCaseIds)
          ? currentSelectedCaseIds
          : nextSelectedCaseIds,
      );
      setSearchError(null);
      setAdminError(null);
    },
    [],
  );

  const fetchAdminRecords = useCallback(
    async (idCases: string[]): Promise<AdminCaseRecord[]> => {
      return Promise.all(
        idCases.map((idCase) =>
          fetchJson<AdminCaseRecord>(`/api/admin/cases/${idCase}`),
        ),
      );
    },
    [],
  );

  const handleCasesVisibilityChange = useCallback(
    (visible: boolean) => {
      setCasesVisible(visible);

      if (!visible) {
        applySelectionState(null, []);
      }
    },
    [applySelectionState],
  );

  const handleCaseSelectionChange = useCallback(
    (
      selectedCase: StableCaseProperties | null,
      intent: CaseSelectionIntent,
    ) => {
      const nextCaseId = selectedCase ? getRegistryCaseId(selectedCase) : null;

      if (intent === "replace") {
        const nextSelectedCaseIds = nextCaseId ? [nextCaseId] : [];

        if (
          activeCaseId === nextCaseId &&
          areCaseSelectionsEqual(selectedCaseIds, nextSelectedCaseIds)
        ) {
          return;
        }

        applySelectionState(nextCaseId, nextSelectedCaseIds);
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
            ? (nextSelectedCaseIds.at(-1) ?? null)
            : activeCaseId
          : nextCaseId;

        setActiveCaseId(nextActiveCaseId);
        setSearchError(null);
        setAdminError(null);

        return nextSelectedCaseIds;
      });
    },
    [activeCaseId, applySelectionState, selectedCaseIds],
  );

  const focusOnCase = useCallback(
    (query: string) => {
      const searchTarget = resolveMapSearchTarget(searchOptions, query);

      if (searchTarget?.kind === "cases") {
        const matchedCaseIds = searchTarget.ids.filter((idCase) =>
          stableCasesById.has(idCase),
        );

        if (matchedCaseIds.length === 0) {
          setSearchError(
            "Aucune case ou objet ne correspond a cette recherche.",
          );
          return;
        }

        setCasesVisible(true);
        setPanelVisible(true);
        setSearchValue(searchTarget.value);
        setSearchError(null);
        setFocusSearchTarget(null);
        setFocusCaseId(null);
        setFocusCaseIds(matchedCaseIds);
        setFocusCaseIdsRequest((value) => value + 1);
        applySelectionState(matchedCaseIds[0], matchedCaseIds);
        return;
      }

      if (searchTarget && searchTarget.kind !== "case") {
        setCasesVisible(true);
        setPanelVisible(true);
        setSearchValue(searchTarget.value);
        setSearchError(null);
        setFocusCaseId(null);
        setFocusCaseIds([]);
        setFocusSearchTarget(searchTarget);
        setFocusSearchRequest((value) => value + 1);

        if (
          "id_case_detected" in searchTarget &&
          searchTarget.id_case_detected &&
          stableCasesById.has(searchTarget.id_case_detected)
        ) {
          applySelectionState(searchTarget.id_case_detected, [
            searchTarget.id_case_detected,
          ]);
        }

        return;
      }

      const stableCase =
        searchTarget?.kind === "case"
          ? (stableCasesById.get(searchTarget.id) ?? null)
          : null;

      if (!stableCase) {
        setSearchError("Aucune case ou objet ne correspond a cette recherche.");
        return;
      }

      const registryId = getRegistryCaseId(stableCase);

      setCasesVisible(true);
      setPanelVisible(true);
      setSearchValue(stableCase.id_case);
      setFocusCaseIds([]);
      setFocusCaseId(registryId);
      setFocusRequest((value) => value + 1);
      applySelectionState(registryId, [registryId]);
    },
    [applySelectionState, searchOptions, stableCasesById],
  );

  const handleLoginSubmit = useCallback(
    async (payload: LoginPayload) => {
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
        window.location.href = editorHref ?? `/editeur?mode=${mapDisplayMode}`;
      } catch (error) {
        setLoginError(
          error instanceof Error ? error.message : "Connexion impossible.",
        );
      } finally {
        setLoginPending(false);
      }
    },
    [editorHref, mapDisplayMode],
  );

  const handleLogout = useCallback(async () => {
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
      setAdminError(null);
      setAdminRecordsById({});
    }
  }, []);

  const handleAdminModeAction = useCallback(() => {
    if (!adminSession.authenticated) {
      setLoginError(null);
      setLoginOpen(true);
      return;
    }

    setAdminModeEnabled((value) => !value);
    setAdminError(null);
  }, [adminSession.authenticated]);

  const handleSearchSubmit = useCallback(() => {
    focusOnCase(searchValue.trim());
  }, [focusOnCase, searchValue]);

  useEffect(() => {
    let cancelled = false;

    async function loadStableCases() {
      try {
        const [collection, publicCases] = await Promise.all([
          loadJsonData<StableCaseFeatureCollection>(CASES_DATA_URL),
          fetchJson<PublicCaseIndexResponse>("/api/cases/public-index").catch(
            () => ({
              cases: [] as PublicCaseProperties[],
              styles: createEmptyPublicMapStyles(),
            }),
          ),
        ]);

        if (!isStableCaseFeatureCollection(collection)) {
          throw new Error(
            "Le GeoJSON des cases ne respecte pas le contrat attendu.",
          );
        }

        if (!cancelled) {
          const baseCases = collection.features
            .map((feature) =>
              toStableCaseProperties({
                ...feature.properties,
                registry_id_case: feature.properties.id_case,
              }),
            )
            .filter(
              (stableCase): stableCase is StableCaseProperties =>
                stableCase !== null,
            );

          setStableCases(
            mergePublicCasesIntoStableCases(baseCases, publicCases.cases),
          );
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPublicObjects() {
      try {
        const data =
          await fetchJson<PublicMapObjectsResponse>("/api/map/objects");

        if (!cancelled) {
          setPublicObjects(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Impossible de charger l'index des objets publics.",
            error,
          );
        }
      }
    }

    void loadPublicObjects();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      try {
        const session = await fetchJson<AdminSession>("/api/admin/session");

        if (!cancelled) {
          setAdminSession(session);
          if (
            session.authenticated &&
            typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).get("admin") === "1"
          ) {
            setAdminModeEnabled(true);
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.delete("admin");
            window.history.replaceState({}, "", nextUrl.toString());
          }
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
    if (
      !adminModeEnabled ||
      !adminSession.authenticated ||
      selectedCaseIds.length === 0
    ) {
      return;
    }

    const idsToLoad = selectedCaseIds.filter(
      (idCase) => !adminRecordsById[idCase],
    );

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
            error instanceof Error
              ? error.message
              : "Chargement admin impossible.";

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
          ...buildAppNavigationItems({
            session: adminSession,
            currentPage: "public",
            editorHref: editorHref ?? `/editeur?mode=${mapDisplayMode}`,
            publicHref: "#carte",
          }),
        ]}
        onAdminAction={handleAdminModeAction}
        onAdminLogout={handleLogout}
      />
      <section
        id="carte"
        className={
          panelVisible
            ? "grid min-h-[calc(100svh-6rem)] flex-1 items-stretch gap-6 [overflow-anchor:none] xl:h-[calc(100svh-6rem)] xl:min-h-0 xl:grid-cols-[minmax(0,1.65fr)_24rem]"
            : "grid min-h-[calc(100svh-6rem)] flex-1 items-stretch gap-6 [overflow-anchor:none] xl:h-[calc(100svh-6rem)] xl:min-h-0"
        }
        aria-label="Carte publique des cases"
      >
        <CasesMap
          dataUrl={CASES_DATA_URL}
          activeCaseId={activeCaseId}
          selectedCaseIds={selectedCaseIds}
          casePropertiesById={stableCasesByRegistryId}
          publicMapStyles={publicMapStyles}
          displayMode={mapDisplayMode}
          focusCaseId={focusCaseId}
          focusRequest={focusRequest}
          focusCaseIds={focusCaseIds}
          focusCaseIdsRequest={focusCaseIdsRequest}
          focusSearchTarget={focusSearchTarget}
          focusSearchRequest={focusSearchRequest}
          clearHoverRequest={clearMapHoverRequest}
          casesVisible={casesVisible}
          panelVisible={panelVisible}
          onDisplayModeChange={handleDisplayModeChange}
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
            activeAdminRecord={activeAdminRecord}
            selectedAdminRecords={selectedAdminRecords}
            adminLoading={adminLoading}
            adminError={adminError}
            editorHref={editorHref}
            searchValue={searchValue}
            searchError={searchError}
            onSearchValueChange={(value) => {
              setSearchValue(value);
              setSearchError(null);
            }}
            onSearchSubmit={handleSearchSubmit}
            onPanelPointerEnter={() =>
              setClearMapHoverRequest((value) => value + 1)
            }
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
