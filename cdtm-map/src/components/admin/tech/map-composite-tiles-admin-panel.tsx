"use client";

import { Button } from "@/components/ui/button";
import {
  MAP_COMPOSITE_TILE_PROFILES,
  type MapCompositeTileAdminStatus,
  type MapCompositeTileGenerationStatus,
  type MapCompositeTileProfile,
  type MapCompositeTileProfileAdminStatus,
  type MapCompositeTileSetAdminRecord,
} from "@/map/composite-tiles";

type MapCompositeTilesAdminPanelProps = {
  status: MapCompositeTileAdminStatus | null;
  loading: boolean;
  error: string | null;
  regeneratingProfile: MapCompositeTileProfile | null;
  regenerateError: string | null;
  onRefresh: () => Promise<void>;
  onRegenerate: (profile: MapCompositeTileProfile) => Promise<void>;
};

const generationStatusLabels: Record<MapCompositeTileGenerationStatus, string> =
  {
    generating: "Generation",
    ready: "Pret",
    failed: "Echec",
  };

const profileLabels: Record<MapCompositeTileProfile, string> = {
  mobile: "Mobile",
  desktop: "PC",
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
  status: MapCompositeTileGenerationStatus;
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
  item: MapCompositeTileSetAdminRecord;
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
          Sources
        </dt>
        <dd className="mt-1 break-all text-foreground">
          {item.background_id} / {item.case_tile_set_id.slice(0, 8)}
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

function ProfileSection({
  profileStatus,
  loading,
  regeneratingProfile,
  onRegenerate,
}: {
  profileStatus: MapCompositeTileProfileAdminStatus;
  loading: boolean;
  regeneratingProfile: MapCompositeTileProfile | null;
  onRegenerate: (profile: MapCompositeTileProfile) => Promise<void>;
}) {
  const active = profileStatus.active;
  const regenerating = regeneratingProfile === profileStatus.profile;

  return (
    <section className="rounded-[20px] border border-border/70 bg-background/35 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-foreground">
              Profil {profileLabels[profileStatus.profile]}
            </h3>
            {active ? (
              <StatusBadge
                status={active.generation_status}
                active={active.is_active}
                stale={profileStatus.stale}
              />
            ) : null}
          </div>
          <p className="mt-1 break-all text-sm text-muted-foreground">
            {active
              ? active.id_tile_set
              : "Aucun jeu pret : fallback legacy public"}
          </p>
        </div>
        <Button
          type="button"
          disabled={loading || regeneratingProfile !== null}
          onClick={() => void onRegenerate(profileStatus.profile)}
        >
          {regenerating ? "Generation..." : "Regenerer"}
        </Button>
      </div>

      {active ? (
        <div className="mt-4">
          <TileSetSummary
            item={active}
            currentHash={profileStatus.current_state_hash}
          />
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Tuiles attendues
          </p>
          <p className="mt-1 text-foreground">
            {profileStatus.expected_tile_count}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Hash courant
          </p>
          <p className="mt-1 break-all text-foreground">
            {shortHash(profileStatus.current_state_hash)}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Etat
          </p>
          <p className="mt-1 text-foreground">
            {loading
              ? "Chargement"
              : profileStatus.stale
                ? "A regenerer"
                : active
                  ? "A jour"
                  : "Fallback legacy"}
          </p>
        </div>
      </div>

      {active?.generation_error ? (
        <p className="mt-3 break-words text-sm text-destructive">
          {active.generation_error}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">
            Historique recent
          </p>
          <p className="text-sm text-muted-foreground">
            {profileStatus.latest.length} jeu(x)
          </p>
        </div>

        {profileStatus.latest.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun jeu genere.</p>
        ) : (
          profileStatus.latest.map((item) => (
            <article
              key={item.id_tile_set}
              className="rounded-[16px] border border-border/60 bg-background/30 px-4 py-3"
            >
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
                      profileStatus.current_state_hash &&
                        item.state_hash !== profileStatus.current_state_hash,
                    )
                  }
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Cree le {formatDate(item.created_at)}
              </p>
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
  );
}

export function MapCompositeTilesAdminPanel({
  status,
  loading,
  error,
  regeneratingProfile,
  regenerateError,
  onRefresh,
  onRegenerate,
}: MapCompositeTilesAdminPanelProps) {
  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            Tuiles composees
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Les profils publics peuvent utiliser une seule couche raster qui
            precompose fond, cases, motifs et contours. Le mode legacy reste
            disponible par variable d&apos;environnement.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={loading || regeneratingProfile !== null}
          onClick={() => void onRefresh()}
        >
          Actualiser
        </Button>
      </div>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      {regenerateError ? (
        <p className="mt-4 text-sm text-destructive">{regenerateError}</p>
      ) : null}

      <div className="mt-6 space-y-4">
        {status ? (
          MAP_COMPOSITE_TILE_PROFILES.map((profile) => (
            <ProfileSection
              key={profile}
              profileStatus={status.profiles[profile]}
              loading={loading}
              regeneratingProfile={regeneratingProfile}
              onRegenerate={onRegenerate}
            />
          ))
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun statut disponible.
          </p>
        )}
      </div>
    </>
  );
}
