"use client";

import { Compass, Lock, MountainSnow, ScrollText, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SiteHeaderProps = {
  totalCases: number;
  casesVisible: boolean;
  adminAuthenticated: boolean;
  adminModeEnabled: boolean;
  adminUsername: string | null;
  onAdminAction: () => void;
};

export function SiteHeader({
  totalCases,
  casesVisible,
  adminAuthenticated,
  adminModeEnabled,
  adminUsername,
  onAdminAction,
}: SiteHeaderProps) {
  return (
    <header className="grid gap-5 rounded-[32px] border border-border/60 bg-panel/92 px-6 py-6 shadow-[0_32px_80px_hsl(var(--shadow)/0.5)] backdrop-blur-xl lg:grid-cols-[minmax(0,1.2fr)_auto] lg:items-end">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge>Chroniques de la Terre du Milieu</Badge>
          <Badge variant="secondary">Fond CTM statique</Badge>
          <Badge variant="outline">Projection locale CDTM-LOCAL</Badge>
          {adminAuthenticated ? <Badge variant="secondary">Staff connecte</Badge> : null}
        </div>
        <div className="space-y-3">
          <h1 className="max-w-4xl font-chronicle text-4xl leading-none tracking-[0.04em] text-foreground sm:text-5xl lg:text-6xl">
            Table de guerre et console staff
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            Carte publique et mode admin integre pour enrichir les cases sans reintroduire
            de champs metier dans la couche GeoJSON stable.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-border/70 bg-background/40 px-4 py-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <ScrollText className="size-4" />
            <span>Couche stable</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">{totalCases || "..."}</p>
          <p className="text-sm text-muted-foreground">cases chargees</p>
        </div>
        <div className="rounded-[24px] border border-border/70 bg-background/40 px-4 py-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <Compass className="size-4" />
            <span>Etat des contours</span>
          </div>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {casesVisible ? "Visibles" : "Masques"}
          </p>
          <p className="text-sm text-muted-foreground">affichage utilisateur</p>
        </div>
        <div className="rounded-[24px] border border-border/70 bg-background/40 px-4 py-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <MountainSnow className="size-4" />
            <span>Fond de carte</span>
          </div>
          <p className="mt-2 text-lg font-semibold text-foreground">CTM.png</p>
          <p className="text-sm text-muted-foreground">ImageStatic [0, -4000, 3200, 0]</p>
        </div>
        <div className="rounded-[24px] border border-border/70 bg-background/40 px-4 py-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {adminAuthenticated ? <Shield className="size-4" /> : <Lock className="size-4" />}
            <span>Mode admin</span>
          </div>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {adminAuthenticated
              ? adminModeEnabled
                ? "Actif"
                : "Pret"
              : "Connecte-toi"}
          </p>
          <p className="text-sm text-muted-foreground">
            {adminAuthenticated ? adminUsername ?? "staff" : "edition reservee au staff"}
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onAdminAction}>
            {adminAuthenticated
              ? adminModeEnabled
                ? "Quitter l'admin"
                : "Activer l'admin"
              : "Connexion staff"}
          </Button>
        </div>
      </div>
    </header>
  );
}
