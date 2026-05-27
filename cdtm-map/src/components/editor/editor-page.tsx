"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { AdminSession } from "@/admin/types";
import { EditorMapCanvas } from "@/components/editor/editor-map-canvas";
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
          <h1 className="font-chronicle text-3xl text-foreground">Editeur cartographique</h1>
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

      <SectionPanel className="p-6">
        <h1 className="font-chronicle text-3xl tracking-[0.04em] text-foreground">
          Editeur cartographique
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
          Ce premier lot reactive uniquement le fond de carte dans l’editeur. Les couches de cases,
          les objets cartographiques et les outils d’edition reviendront dans les lots suivants.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/">Retour a la carte</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/tech">Administration technique</Link>
          </Button>
        </div>
        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      </SectionPanel>

      <EditorMapCanvas />
    </AppShell>
  );
}
