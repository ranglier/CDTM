"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { AdminSession } from "@/admin/types";
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
        <SectionPanel className="p-6">
          <h1 className="font-chronicle text-3xl tracking-[0.04em] text-foreground">Editeur</h1>
          <div className="mt-6 rounded-[24px] border border-dashed border-border/70 bg-background/25 p-6">
            <p className="text-sm font-semibold text-foreground">Fondation de l’editeur cartographique</p>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Cette premiere version prepare la page de travail sans encore integrer toute l’edition
              OpenLayers avancee.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[18px] border border-border/60 bg-background/35 p-4">
                <p className="text-sm font-medium text-foreground">Points libres</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Localites, landmarks et forces places en coordonnees libres x/y.
                </p>
              </div>
              <div className="rounded-[18px] border border-border/60 bg-background/35 p-4">
                <p className="text-sm font-medium text-foreground">Routes</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Traces lineaires libres composes de plusieurs points.
                </p>
              </div>
              <div className="rounded-[18px] border border-border/60 bg-background/35 p-4">
                <p className="text-sm font-medium text-foreground">Detection de case</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Rattachement des points aux cases et futures intersections de routes.
                </p>
              </div>
              <div className="rounded-[18px] border border-border/60 bg-background/35 p-4">
                <p className="text-sm font-medium text-foreground">Validation d’emplacements</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Preparation des controles d’occupation et des bornes entre 1 et 5.
                </p>
              </div>
            </div>
          </div>
        </SectionPanel>

        <SectionPanel className="p-6">
          <h2 className="text-xl font-semibold text-foreground">Prochaines etapes</h2>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>La page evoluera ensuite vers :</p>
            <p>- placement direct de points sur la carte ;</p>
            <p>- tracage de routes par polylignes ;</p>
            <p>- detection automatique des cases ;</p>
            <p>- preparation des publications sans depassement d’emplacements.</p>
          </div>
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </SectionPanel>
      </section>
    </AppShell>
  );
}
