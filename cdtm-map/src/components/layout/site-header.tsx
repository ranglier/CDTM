"use client";

import { Lock, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";

type SiteHeaderProps = {
  adminAuthenticated: boolean;
  adminModeEnabled: boolean;
  onAdminAction: () => void;
};

export function SiteHeader({
  adminAuthenticated,
  adminModeEnabled,
  onAdminAction,
}: SiteHeaderProps) {
  return (
    <header
      id="top"
      className="sticky top-4 z-30 rounded-[28px] border border-border/70 bg-panel/88 px-4 py-3 shadow-[0_24px_60px_hsl(var(--shadow)/0.45)] backdrop-blur-xl sm:px-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <a href="#carte" className="block">
            <h1 className="font-chronicle text-3xl leading-none tracking-[0.04em] text-foreground sm:text-4xl">
              Chroniques de la Terre du Milieu
            </h1>
          </a>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
          <nav aria-label="Navigation principale" className="flex items-center gap-2">
            <Button asChild type="button" variant="ghost" size="sm">
              <a href="#carte" aria-current="page">
                Carte
              </a>
            </Button>
          </nav>

          <Button
            type="button"
            variant={adminModeEnabled ? "secondary" : "outline"}
            size="sm"
            onClick={onAdminAction}
            aria-pressed={adminModeEnabled}
          >
            {adminAuthenticated ? <Shield /> : <Lock />}
            Admin
          </Button>
        </div>
      </div>
    </header>
  );
}
