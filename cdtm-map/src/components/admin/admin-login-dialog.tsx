"use client";

import { Shield, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type AdminLoginDialogProps = {
  open: boolean;
  username: string;
  password: string;
  pending: boolean;
  error: string | null;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

const fieldClassName =
  "w-full rounded-[18px] border border-border/80 bg-background/55 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/40";

export function AdminLoginDialog({
  open,
  username,
  password,
  pending,
  error,
  onUsernameChange,
  onPasswordChange,
  onClose,
  onSubmit,
}: AdminLoginDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/72 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[32px] border border-border/70 bg-panel/95 p-6 shadow-[0_32px_80px_hsl(var(--shadow)/0.55)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-primary">
              <Shield className="size-4" />
              Staff
            </div>
            <h2 className="font-chronicle text-3xl tracking-[0.04em] text-foreground">
              Connexion admin
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Connecte-toi avec les identifiants staff pour activer l&apos;edition integree.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
            <X />
          </Button>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Identifiant
            </span>
            <input
              type="text"
              autoComplete="username"
              className={fieldClassName}
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
              disabled={pending}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Mot de passe
            </span>
            <input
              type="password"
              autoComplete="current-password"
              className={fieldClassName}
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              disabled={pending}
            />
          </label>

          {error ? (
            <div className="rounded-[20px] border border-destructive/60 bg-destructive/15 px-4 py-3 text-sm text-foreground">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Fermer
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Connexion..." : "Se connecter"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
