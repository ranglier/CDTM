"use client";

import { Button } from "@/components/ui/button";
import type {
  MapCaseTileAdminStatus,
  MapCaseTileGenerationStatus,
  MapCaseTileSetAdminRecord,
} from "@/map/case-tiles";

type MapCaseTilesAdminPanelProps = {
  status: MapCaseTileAdminStatus | null;
  loading: boolean;
  error: string | null;
  regenerating: boolean;
  regenerateError: string | null;
  deletingId: string | null;
  onRefresh: () => Promise<void>;
  onRegenerate: () => Promise<void>;
  onDelete: (idTileSet: string) => Promise<void>;
};

const generationStatusLabels: Record<MapCaseTileGenerationStatus, string> = {
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

function shortHash(value: string | null): string {
  return value ? value.slice(0, 12) : "-";
}

function StatusBadge({
  status,
  active,
  stale,
}: {
  status: MapCaseTileGenerationStatus;
  active: boolean;
  stale?: boolean;
}) {
  const tone = stale
    ? "border-amber-500/35 bg-amber-500/10 text-amber-700"
    : status === "ready"
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
      {stale ? "A regenerer" : active ? "Actif" : generationStatusLabels[status]}
    </span>
  );
}

function TileSetSummary({
  item,
  currentHash,
}: {
  item: MapCaseTileSetAdminRecord;
  currentHash: string | null;
}) {
  return (
    <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
      <div>
        <dt className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Hash actif
        </dt>
        <dd className="mt-1 break-all text-foreground">
          {shortHash(item.state_hash)}
        </dd>
      </div>
      <div>
        <dt className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Hash courant
        </dt>
        <dd className="mt-1 break-all text-foreground">
          {shortHash(currentHash)}
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
          Genere le
        </dt>
        <dd className="mt-1 text-foreground">{formatDate(item.generated_at)}</dd>
      </div>
    </dl>
  );
}

export function MapCaseTilesAdminPanel({
  status,
  loading,
  error,
  regenerating,
  regenerateError,
  deletingId,
  onRefresh,
  onRegenerate,
  onDelete,
}: MapCaseTilesAdminPanelProps) {
  const active = status?.active ?? null;

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Tuiles de cases
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            La vue publique peut afficher les cases et motifs depuis des tuiles
            WebP transparentes. L&apos;editeur conserve son rendu vectoriel
            complet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading || regenerating || deletingId !== null}
            onClick={() => void onRefresh()}
          >
            Actualiser
          </Button>
          <Button
            type="button"
            disabled={loading || regenerating || deletingId !== null}
            onClick={() => void onRegenerate()}
          >
            {regenerating ? "Generation..." : "Regenerer"}
          </Button>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      {regenerateError ? (
        <p className="mt-4 text-sm text-destructive">{regenerateError}</p>
      ) : null}

      <section className="mt-6 rounded-[20px] border border-border/70 bg-background/35 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Jeu actif
            </p>
            <p className="mt-1 break-all text-sm text-muted-foreground">
              {active
                ? active.id_tile_set
                : "Aucun jeu pret : fallback vectoriel public"}
            </p>
          </div>
          {active ? (
            <StatusBadge
              status={active.generation_status}
              active={active.is_active}
              stale={status?.stale}
            />
          ) : null}
        </div>
        {active ? (
          <div className="mt-4">
            <TileSetSummary
              item={active}
              currentHash={status?.current_state_hash ?? null}
            />
          </div>
        ) : null}
        {status?.fallback ? (
          <p className="mt-4 text-sm text-muted-foreground">
            La carte publique utilise encore le rendu vectoriel des cases.
          </p>
        ) : null}
      </section>

      <section className="mt-4 rounded-[20px] border border-border/70 bg-background/35 p-4">
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Tuiles attendues
            </p>
            <p className="mt-1 text-foreground">
              {status?.expected_tile_count ?? 855}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Hash courant
            </p>
            <p className="mt-1 break-all text-foreground">
              {shortHash(status?.current_state_hash ?? null)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Etat
            </p>
            <p className="mt-1 text-foreground">
              {loading
                ? "Chargement"
                : status?.stale
                  ? "A regenerer"
                  : active
                    ? "A jour"
                    : "Fallback vectoriel"}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-[20px] border border-border/70 bg-background/35 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">
            Historique recent
          </p>
          <p className="text-sm text-muted-foreground">
            {status?.latest.length ?? 0} jeu(x)
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : !status || status.latest.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun jeu genere.
            </p>
          ) : (
            status.latest.map((item) => (
              <article
                key={item.id_tile_set}
                className="rounded-[16px] border border-border/60 bg-background/30 px-4 py-3"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                      <p className="break-all text-sm font-semibold text-foreground">
                        {item.id_tile_set}
                      </p>
                      <StatusBadge
                        status={item.generation_status}
                        active={item.is_active}
                        stale={
                          item.is_active &&
                          Boolean(
                            status.current_state_hash &&
                              item.state_hash !== status.current_state_hash,
                          )
                        }
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cree le {formatDate(item.created_at)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                      item.is_active ||
                      item.generation_status === "generating" ||
                      loading ||
                      regenerating ||
                      deletingId !== null
                    }
                    onClick={() => void onDelete(item.id_tile_set)}
                  >
                    {deletingId === item.id_tile_set
                      ? "Suppression..."
                      : "Supprimer"}
                  </Button>
                </div>

                <div className="mt-4">
                  <TileSetSummary
                    item={item}
                    currentHash={status.current_state_hash}
                  />
                </div>
                {item.generation_error ? (
                  <p className="mt-3 break-words text-sm text-destructive">
                    {item.generation_error}
                  </p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </>
  );
}
