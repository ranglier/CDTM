"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { createLoggedOutSession } from "@/admin/case-editing";
import type {
  AdminCaseRecord,
  AdminSession,
  PublicCaseIndexResponse,
} from "@/admin/types";
import { AdminLoginDialog } from "@/components/admin/admin-login-dialog";
import { buildAppNavigationItems } from "@/components/layout/admin-navigation";
import { AppShell } from "@/components/layout/app-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { CaseInfoPanel } from "@/components/map/case-info-panel";
import { CasesMap } from "@/components/map/cases-map";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import { getRegistryCaseId } from "@/map/case-data";
import type { PublicMapObjectsResponse } from "@/map/public-objects";
import {
  buildCaseSearchTargets,
  buildPublicObjectSearchTargets,
  resolveMapSearchTarget,
  type MapSearchTarget,
} from "@/map/search";
import {
  CASES_INTERACTION_DATA_URL,
  type CaseSelectionIntent,
  createEmptyPublicMapStyles,
  normalizeMapDisplayMode,
  type MapDisplayMode,
  type PublicMapStyles,
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
  const isMobileViewport = useIsMobileViewport();
  const [totalCases, setTotalCases] = useState(0);
  const [casesVisible, setCasesVisible] = useState(true);
  const [panelVisible, setPanelVisible] = useState(true);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
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
  const publicPanelVisible = isMobileViewport ? mobilePanelOpen : panelVisible;

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
        setMobilePanelOpen(false);
      }
    },
    [applySelectionState],
  );

  const handlePanelVisibilityChange = useCallback(
    (visible: boolean) => {
      if (isMobileViewport) {
        setMobilePanelOpen(visible);
        return;
      }

      setPanelVisible(visible);
    },
    [isMobileViewport],
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

        if (nextSelectedCaseIds.length > 0) {
          setMobilePanelOpen(true);
        }

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

        if (nextSelectedCaseIds.length > 0) {
          setMobilePanelOpen(true);
        }

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
        setMobilePanelOpen(true);
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
        setMobilePanelOpen(true);
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
      setMobilePanelOpen(true);
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

    async function loadPublicCaseIndex() {
      try {
        const publicCases = await fetchJson<PublicCaseIndexResponse>(
          "/api/cases/public-index",
        );

        if (!cancelled) {
          setStableCases(publicCases.cases);
          setPublicMapStyles(publicCases.styles);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Impossible de charger l'index des cases.", error);
        }
      }
    }

    void loadPublicCaseIndex();

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
        showAdminAction={!adminSession.authenticated}
        onAdminAction={handleAdminModeAction}
        onAdminLogout={handleLogout}
      />
      <section
        id="carte"
        className={
          isMobileViewport
            ? "relative grid min-h-0 flex-1 items-stretch [overflow-anchor:none]"
            : publicPanelVisible
              ? "grid min-h-[calc(100svh-6rem)] flex-1 items-stretch gap-6 [overflow-anchor:none] xl:h-[calc(100svh-6rem)] xl:min-h-0 xl:grid-cols-[minmax(0,1.65fr)_24rem]"
              : "grid min-h-[calc(100svh-6rem)] flex-1 items-stretch gap-6 [overflow-anchor:none] xl:h-[calc(100svh-6rem)] xl:min-h-0"
        }
        aria-label="Carte publique des cases"
      >
        <CasesMap
          dataUrl={CASES_INTERACTION_DATA_URL}
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
          panelVisible={publicPanelVisible}
          mobileLayout={isMobileViewport}
          hoverTooltipsEnabled={!isMobileViewport}
          onDisplayModeChange={handleDisplayModeChange}
          onCaseSelectionChange={handleCaseSelectionChange}
          onCasesVisibilityChange={handleCasesVisibilityChange}
          onPanelVisibilityChange={handlePanelVisibilityChange}
          onFeaturesLoad={setTotalCases}
        />
        {publicPanelVisible ? (
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
            variant={isMobileViewport ? "bottom-sheet" : "side"}
            onClose={() => handlePanelVisibilityChange(false)}
          />
        ) : null}
        {isMobileViewport && !publicPanelVisible ? (
          <button
            type="button"
            className="fixed inset-x-2 bottom-2 z-40 rounded-[22px] border border-border/80 bg-panel/95 px-4 py-3 text-left shadow-[0_18px_50px_hsl(var(--shadow)/0.55)] backdrop-blur-xl"
            onClick={() => setMobilePanelOpen(true)}
          >
            <span className="mx-auto mb-2 block h-1.5 w-12 rounded-full bg-border/80" />
            <span className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  {selectedCaseIds.length > 0
                    ? `${selectedCaseIds.length} case(s) selectionnee(s)`
                    : "Recherche et informations"}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {activeCase?.id_case ??
                    `${totalCases || "..."} case(s) chargee(s)`}
                </span>
              </span>
              <span className="shrink-0 text-xs uppercase tracking-[0.18em] text-primary">
                Ouvrir
              </span>
            </span>
          </button>
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
