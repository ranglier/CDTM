"use client";

import { Button } from "@/components/ui/button";
import type { MapBackgroundAdminRecord } from "@/map/background";

type MapBackgroundAdminPanelProps = {
  backgrounds: MapBackgroundAdminRecord[];
  loading: boolean;
  error: string | null;
  uploadLabel: string;
  setUploadLabel: (value: string) => void;
  uploading: boolean;
  uploadError: string | null;
  activatingId: string | null;
  deletingId: string | null;
  onUpload: (file: File | null) => Promise<void>;
  onActivate: (idBackground: string) => Promise<void>;
  onDelete: (idBackground: string) => Promise<void>;
  onRefresh: () => Promise<void>;
};

const statusLabels: Record<MapBackgroundAdminRecord["generation_status"], string> =
  {
    generating: "Generation",
    ready: "Pret",
    failed: "Echec",
  };

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "-";
  }

  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: value >= 1024 * 1024 ? 1 : 0,
  }).format(value / (1024 * 1024)).concat(" Mo");
}

function StatusBadge({
  status,
  active,
}: {
  status: MapBackgroundAdminRecord["generation_status"];
  active: boolean;
}) {
  const tone =
    status === "ready"
      ? active
        ? "border-primary/50 bg-primary/10 text-primary"
        : "border-emerald-500/35 bg-emerald-500/10 text-emerald-700"
      : status === "failed"
        ? "border-destructive/35 bg-destructive/10 text-destructive"
        : "border-amber-500/35 bg-amber-500/10 text-amber-700";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] ${tone}`}
    >
      {active ? "Actif" : statusLabels[status]}
    </span>
  );
}

function BackgroundSummary({ item }: { item: MapBackgroundAdminRecord }) {
  return (
    <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
      <div>
        <dt className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Dimensions
        </dt>
        <dd className="mt-1 text-foreground">
          {item.width} x {item.height}
        </dd>
      </div>
      <div>
        <dt className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Tuiles
        </dt>
        <dd className="mt-1 text-foreground">
          {item.tile_size}px, z{item.min_zoom}-z{item.max_zoom}
        </dd>
      </div>
      <div>
        <dt className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Fichier
        </dt>
        <dd className="mt-1 text-foreground">
          {item.mime_type} - {formatBytes(item.size_bytes)}
        </dd>
      </div>
      <div>
        <dt className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Active le
        </dt>
        <dd className="mt-1 text-foreground">{formatDate(item.activated_at)}</dd>
      </div>
    </dl>
  );
}

export function MapBackgroundAdminPanel({
  backgrounds,
  loading,
  error,
  uploadLabel,
  setUploadLabel,
  uploading,
  uploadError,
  activatingId,
  deletingId,
  onUpload,
  onActivate,
  onDelete,
  onRefresh,
}: MapBackgroundAdminPanelProps) {
  const activeBackground = backgrounds.find((item) => item.is_active) ?? null;

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Fond de carte
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            PNG ou WebP, 3200 x 4000 px, 25 Mo maximum. Le fond devient actif
            uniquement apres generation complete des tuiles.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={loading || uploading}
          onClick={() => void onRefresh()}
        >
          Actualiser
        </Button>
      </div>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      <section className="mt-6 rounded-[20px] border border-border/70 bg-background/35 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Fond actif
            </p>
            <p className="mt-1 break-all text-sm text-muted-foreground">
              {activeBackground
                ? activeBackground.label
                : "Fond par defaut public/maps/CTM.png"}
            </p>
          </div>
          {activeBackground ? (
            <StatusBadge
              status={activeBackground.generation_status}
              active={activeBackground.is_active}
            />
          ) : null}
        </div>
        {activeBackground ? (
          <div className="mt-4">
            <BackgroundSummary item={activeBackground} />
          </div>
        ) : null}
      </section>

      <section className="mt-4 rounded-[20px] border border-border/70 bg-background/35 p-4">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="min-w-0">
            <span className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Libelle
            </span>
            <input
              className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30"
              placeholder="Fond de carte"
              value={uploadLabel}
              disabled={uploading}
              onChange={(event) => setUploadLabel(event.target.value)}
            />
          </label>
          <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.35)_inset,0_18px_40px_hsl(var(--primary)/0.18)] transition-colors hover:bg-primary/90 has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50">
            {uploading ? "Generation..." : "Importer"}
            <input
              className="sr-only"
              type="file"
              accept=".png,.webp,image/png,image/webp"
              disabled={uploading}
              onChange={(event) => {
                const input = event.currentTarget;
                void onUpload(input.files?.[0] ?? null).finally(() => {
                  input.value = "";
                });
              }}
            />
          </label>
        </div>
        {uploadError ? (
          <p className="mt-3 text-sm text-destructive">{uploadError}</p>
        ) : null}
      </section>

      <section className="mt-4 rounded-[20px] border border-border/70 bg-background/35 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">Historique</p>
          <p className="text-sm text-muted-foreground">
            {backgrounds.length} fond(s)
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : backgrounds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun fond importe.
            </p>
          ) : (
            backgrounds.map((item) => (
              <article
                key={item.id_background}
                className="rounded-[16px] border border-border/60 bg-background/30 px-4 py-3"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                      <p className="break-words text-sm font-semibold text-foreground">
                        {item.label}
                      </p>
                      <StatusBadge
                        status={item.generation_status}
                        active={item.is_active}
                      />
                    </div>
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      {item.id_background}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={item.is_active ? "secondary" : "outline"}
                      disabled={
                        item.is_active ||
                        item.generation_status !== "ready" ||
                        uploading ||
                        activatingId !== null ||
                        deletingId !== null
                      }
                      onClick={() => void onActivate(item.id_background)}
                    >
                      {activatingId === item.id_background
                        ? "Activation..."
                        : item.is_active
                          ? "Actif"
                          : "Activer"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        item.is_active ||
                        uploading ||
                        activatingId !== null ||
                        deletingId !== null
                      }
                      onClick={() => void onDelete(item.id_background)}
                    >
                      {deletingId === item.id_background
                        ? "Suppression..."
                        : "Supprimer"}
                    </Button>
                  </div>
                </div>

                <div className="mt-4">
                  <BackgroundSummary item={item} />
                </div>
                {item.generation_error ? (
                  <p className="mt-3 break-words text-sm text-destructive">
                    {item.generation_error}
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">
                  Cree le {formatDate(item.created_at)} - Genere le{" "}
                  {formatDate(item.generated_at)}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  );
}
