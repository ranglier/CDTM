"use client";

import Link from "next/link";
import { Eye, Lock, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";

type SiteHeaderProps = {
  adminAuthenticated: boolean;
  adminModeEnabled: boolean;
  onAdminAction: () => void;
  onAdminLogout: () => void;
  navigationItems?: Array<{
    href: string;
    label: string;
    current?: boolean;
  }>;
  showAdminAction?: boolean;
};

export function SiteHeader({
  adminAuthenticated,
  adminModeEnabled,
  onAdminAction,
  onAdminLogout,
  navigationItems = [{ href: "#carte", label: "Carte", current: true }],
  showAdminAction = true,
}: SiteHeaderProps) {
  const adminActionIcon = !adminAuthenticated ? (
    <Lock />
  ) : adminModeEnabled ? (
    <Shield />
  ) : (
    <Eye />
  );
  const adminActionLabel = !adminAuthenticated
    ? "Connexion admin"
    : adminModeEnabled
      ? "Vue admin"
      : "Passer en admin";

  return (
    <header
      id="top"
      className="sticky top-2 z-30 rounded-[20px] border border-border/70 bg-panel/88 px-3 py-2.5 shadow-[0_24px_60px_hsl(var(--shadow)/0.45)] backdrop-blur-xl sm:top-4 sm:rounded-[28px] sm:px-5 sm:py-3"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <a href="#carte" className="block">
            <h1 className="text-balance font-chronicle text-[1.65rem] leading-none tracking-[0.04em] text-foreground sm:text-4xl">
              Chroniques de la Terre du Milieu
            </h1>
          </a>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
          <nav
            aria-label="Navigation principale"
            className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] sm:gap-2 [&::-webkit-scrollbar]:hidden"
          >
            {navigationItems.map((item) => (
              <Button
                key={item.href}
                asChild
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
              >
                {item.href.startsWith("/") ? (
                  <Link
                    href={item.href}
                    aria-current={item.current ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    href={item.href}
                    aria-current={item.current ? "page" : undefined}
                  >
                    {item.label}
                  </a>
                )}
              </Button>
            ))}
          </nav>

          {showAdminAction ? (
            <Button
              type="button"
              variant={adminModeEnabled ? "secondary" : "outline"}
              size="sm"
              className="w-full sm:w-auto"
              onClick={onAdminAction}
              aria-pressed={adminModeEnabled}
            >
              {adminActionIcon}
              {adminActionLabel}
            </Button>
          ) : null}

          {adminAuthenticated ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full sm:w-auto"
              onClick={onAdminLogout}
            >
              Deconnexion
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
