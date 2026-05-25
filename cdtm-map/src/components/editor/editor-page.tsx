"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { AdminSession } from "@/admin/types";
import type { EditorMapLocality, MapObjectStatus } from "@/editor/types";
import {
  countLocalitiesByStatus,
  getEditorOptionLabel,
  getEditorReferenceOptions,
  sortEditorLocalitiesByName,
  type EditorLocalityStatusFilter,
} from "@/editor/ui";
import { EditorMapCanvas } from "@/components/editor/editor-map-canvas";
import { useEditorData } from "@/components/editor/use-editor-data";
import { AppShell } from "@/components/layout/app-shell";
import { SectionPanel } from "@/components/layout/section-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";

function createLoggedOutSession(): AdminSession {
  return {
    authenticated: false,
    username: null,
    role: null,
    is_tech_admin: false,
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

export function EditorPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocalityId, setSelectedLocalityId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<EditorLocalityStatusFilter>("all");
  const [listFilter, setListFilter] = useState("");
  const [focusLocalityId, setFocusLocalityId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [showInfluenceOverlay, setShowInfluenceOverlay] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
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
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      const nextSession = await fetchJson<AdminSession>("/api/admin/session", {
        method: "DELETE",
      });
      setSession(nextSession);
      window.location.href = "/";
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Deconnexion impossible.");
    }
  }, []);

  const {
    referenceData,
    localities,
    stableCaseCollection,
    casePropertiesById,
    publicMapStyles,
    influenceOverlayMessage,
    loading,
    error: dataError,
    reload,
  } = useEditorData(session?.is_tech_admin ?? false);

  const statusCounts = useMemo(() => countLocalitiesByStatus(localities), [localities]);

  const filteredLocalities = useMemo(() => {
    const byStatus =
      statusFilter === "all"
        ? localities
        : localities.filter((locality) => locality.status === statusFilter);

    return sortEditorLocalitiesByName(byStatus);
  }, [localities, statusFilter]);

  const visibleLocalities = useMemo(() => {
    const search = listFilter.trim().toLocaleLowerCase();

    if (!search) {
      return filteredLocalities;
    }

    return filteredLocalities.filter((locality) => {
      const haystack = [
        locality.name,
        locality.id_locality,
        locality.type_key,
        locality.id_case_detected ?? "",
        locality.faction ?? "",
        locality.controleur ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase();

      return haystack.includes(search);
    });
  }, [filteredLocalities, listFilter]);

  const selectedLocality = useMemo(
    () => localities.find((locality) => locality.id_locality === selectedLocalityId) ?? null,
    [localities, selectedLocalityId],
  );
  const effectiveSelectedLocalityId = selectedLocality?.id_locality ?? null;

  const handleSelectLocality = useCallback((localityId: string | null, shouldFocus = false) => {
    setSelectedLocalityId(localityId);

    if (localityId && shouldFocus) {
      setFocusLocalityId(localityId);
      setFocusRequest((current) => current + 1);
    }
  }, []);

  const handleRefocusSelected = useCallback(() => {
    if (!selectedLocalityId) {
      return;
    }

    setFocusLocalityId(selectedLocalityId);
    setFocusRequest((current) => current + 1);
  }, [selectedLocalityId]);

  const renderStatusLabel = useCallback((status: MapObjectStatus) => {
    if (status === "draft") return "Brouillon";
    if (status === "published") return "Publie";
    return "Archive";
  }, []);

  if (!session) {
    return (
      <AppShell>
        <SectionPanel className="p-6">
          <p className="text-sm text-muted-foreground">Chargement de l’editeur...</p>
        </SectionPanel>
      </AppShell>
    );
  }

  if (!session.is_tech_admin) {
    return (
      <AppShell>
        <SiteHeader
          adminAuthenticated={session.authenticated}
          adminModeEnabled={session.authenticated}
          navigationItems={[{ href: "/?admin=1", label: "Carte" }]}
          showAdminAction={false}
          onAdminAction={() => {}}
          onAdminLogout={() => void handleLogout()}
        />
        <SectionPanel className="p-6">
          <h1 className="font-chronicle text-3xl text-foreground">Editeur</h1>
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
          { href: "/editeur", label: "Editeur", current: true },
          { href: "/admin/tech", label: "Administration" },
        ]}
        showAdminAction={false}
        onAdminAction={() => {}}
        onAdminLogout={() => void handleLogout()}
      />

      <section className="grid flex-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_24rem]">
        <div className="min-w-0">
          {loading ? (
            <SectionPanel className="flex min-h-[calc(100svh-2rem)] items-center justify-center p-6 xl:min-h-full">
              <p className="text-sm text-muted-foreground">Chargement des localites et des referentiels...</p>
            </SectionPanel>
          ) : dataError ? (
            <SectionPanel className="p-6">
              <h1 className="font-chronicle text-3xl tracking-[0.04em] text-foreground">Editeur</h1>
              <p className="mt-4 text-sm text-destructive">{dataError}</p>
              <div className="mt-6">
                <Button type="button" onClick={reload}>
                  Reessayer
                </Button>
              </div>
            </SectionPanel>
          ) : (
            <EditorMapCanvas
              localities={filteredLocalities}
              stableCaseCollection={stableCaseCollection}
              casePropertiesById={casePropertiesById}
              publicMapStyles={publicMapStyles}
              showInfluenceOverlay={showInfluenceOverlay}
              influenceOverlayMessage={showInfluenceOverlay ? influenceOverlayMessage : null}
              selectedLocalityId={effectiveSelectedLocalityId}
              focusLocalityId={focusLocalityId}
              focusRequest={focusRequest}
              onSelectLocality={(localityId) => handleSelectLocality(localityId, false)}
            />
          )}
        </div>

        <SectionPanel className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-chronicle text-3xl tracking-[0.04em] text-foreground">Editeur</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Lecture seule des localites existantes.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={reload} disabled={loading}>
              Rafraichir
            </Button>
          </div>

          <section className="mt-6 rounded-[20px] border border-border/70 bg-background/35 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Affichage carte</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Affiche ou masque les zones d&apos;influence en arriere-plan.
                </p>
              </div>
              <Button
                type="button"
                variant={showInfluenceOverlay ? "default" : "outline"}
                size="sm"
                onClick={() => setShowInfluenceOverlay((current) => !current)}
              >
                {showInfluenceOverlay ? "Influence active" : "Afficher influence"}
              </Button>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              Overlay influence : {showInfluenceOverlay ? "actif" : "inactif"}.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Affiche les cases colorees selon les controleurs, avec fallback sur les factions.
            </p>
            {showInfluenceOverlay ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {influenceOverlayMessage ?? "Les zones d’influence sont visibles sous les localites."}
              </p>
            ) : null}
          </section>

          <section className="mt-6 rounded-[20px] border border-border/70 bg-background/35 p-4">
            <h2 className="text-lg font-semibold text-foreground">Filtre des localites</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Filtre uniquement les marqueurs de localites. Les zones d&apos;influence ne sont pas affectees.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  { value: "all", label: "Tous" },
                  { value: "draft", label: "Brouillons" },
                  { value: "published", label: "Publies" },
                  { value: "archived", label: "Archives" },
                ] as const
              ).map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={statusFilter === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </section>

          {selectedLocality ? (
            <section className="mt-6 rounded-[20px] border border-border/70 bg-background/35 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{selectedLocality.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedLocality.id_locality}</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={handleRefocusSelected}>
                  Recentrer
                </Button>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <p className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Type</span>
                  <span className="text-right text-foreground">
                    {getEditorOptionLabel(
                      getEditorReferenceOptions(referenceData, "locality_types"),
                      selectedLocality.type_key,
                    )}
                  </span>
                </p>
                <p className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Statut</span>
                  <span className="text-right text-foreground">{renderStatusLabel(selectedLocality.status)}</span>
                </p>
                <p className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Faction</span>
                  <span className="text-right text-foreground">
                    {getEditorOptionLabel(
                      getEditorReferenceOptions(referenceData, "factions"),
                      selectedLocality.faction,
                    )}
                  </span>
                </p>
                <p className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Controleur</span>
                  <span className="text-right text-foreground">
                    {getEditorOptionLabel(
                      getEditorReferenceOptions(referenceData, "controleurs"),
                      selectedLocality.controleur,
                    )}
                  </span>
                </p>
                <p className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Case detectee</span>
                  <span className="text-right text-foreground">{selectedLocality.id_case_detected ?? "—"}</span>
                </p>
                <p className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Icone</span>
                  <span className="text-right text-foreground">
                    {getEditorOptionLabel(
                      getEditorReferenceOptions(referenceData, "map_icons"),
                      selectedLocality.icon_key,
                    )}
                  </span>
                </p>
                <p className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Depend de</span>
                  <span className="text-right text-foreground">
                    {selectedLocality.depends_on_locality_id ?? "—"}
                  </span>
                </p>
                <p className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Mise a jour</span>
                  <span className="text-right text-foreground">
                    {new Date(selectedLocality.updated_at).toLocaleString("fr-FR")}
                  </span>
                </p>
                <div className="border-t border-border/60 pt-3">
                  <p className="text-muted-foreground">Description</p>
                  <p className="mt-2 text-foreground">{selectedLocality.description ?? "Aucune description."}</p>
                </div>
              </div>
            </section>
          ) : (
            <section className="mt-6 rounded-[20px] border border-border/70 bg-background/35 p-4">
              <h2 className="text-lg font-semibold text-foreground">Vue d&apos;ensemble</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[16px] border border-border/60 bg-background/35 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Total</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{localities.length}</p>
                </div>
                <div className="rounded-[16px] border border-border/60 bg-background/35 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Brouillons</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{statusCounts.draft}</p>
                </div>
                <div className="rounded-[16px] border border-border/60 bg-background/35 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Publies</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{statusCounts.published}</p>
                </div>
                <div className="rounded-[16px] border border-border/60 bg-background/35 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Archives</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{statusCounts.archived}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Clique une localite sur la carte pour inspecter ses informations.
              </p>
            </section>
          )}

          <section className="mt-6 rounded-[20px] border border-border/70 bg-background/35 p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">Localites</h2>
                <span className="text-sm text-muted-foreground">{visibleLocalities.length}</span>
              </div>
              <input
                className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
                placeholder="Filtrer les localites"
                value={listFilter}
                onChange={(event) => setListFilter(event.target.value)}
              />
            </div>

            <div className="mt-4 space-y-2">
              {visibleLocalities.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune localite pour ce filtre.</p>
              ) : (
                visibleLocalities.map((locality: EditorMapLocality) => (
                  <button
                    key={locality.id_locality}
                    type="button"
                    className={`w-full rounded-[16px] border px-4 py-3 text-left transition ${
                      effectiveSelectedLocalityId === locality.id_locality
                        ? "border-primary/45 bg-primary/10"
                        : "border-border/70 bg-background/30 hover:border-primary/25 hover:bg-background/50"
                    }`}
                    onClick={() => handleSelectLocality(locality.id_locality, true)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">{locality.name}</span>
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {renderStatusLabel(locality.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {getEditorOptionLabel(
                        getEditorReferenceOptions(referenceData, "locality_types"),
                        locality.type_key,
                      )}
                    </p>
                  </button>
                ))
              )}
            </div>
          </section>

          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </SectionPanel>
      </section>
    </AppShell>
  );
}
