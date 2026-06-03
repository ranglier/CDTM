"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { AdminSession } from "@/admin/types";
import { EditorMapCanvas } from "@/components/editor/editor-map-canvas";
import { buildAppNavigationItems } from "@/components/layout/admin-navigation";
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
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Deconnexion impossible.",
      );
    }
  }, []);

  if (!session) {
    return (
      <AppShell>
        <SectionPanel className="p-6">
          <p className="text-sm text-muted-foreground">
            Chargement de l’editeur...
          </p>
        </SectionPanel>
      </AppShell>
    );
  }

  if (!session.authenticated) {
    return (
      <AppShell>
        <SiteHeader
          adminAuthenticated={session.authenticated}
          adminModeEnabled={session.authenticated}
          navigationItems={buildAppNavigationItems({
            session,
            currentPage: "editor",
          })}
          showAdminAction={false}
          onAdminAction={() => {}}
          onAdminLogout={() => void handleLogout()}
        />
        <SectionPanel className="p-6">
          <h1 className="font-chronicle text-3xl text-foreground">
            Editeur cartographique
          </h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Cette page est reservee aux comptes staff connectes.
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
        navigationItems={buildAppNavigationItems({
          session,
          currentPage: "editor",
        })}
        showAdminAction={false}
        onAdminAction={() => {}}
        onAdminLogout={() => void handleLogout()}
      />
      {error ? (
        <SectionPanel className="p-6">
          <p className="text-sm text-destructive">{error}</p>
        </SectionPanel>
      ) : null}
      <EditorMapCanvas canEditMapObjects={session.is_tech_admin} />
    </AppShell>
  );
}
