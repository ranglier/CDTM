import Link from "next/link";

import type { AdminCaseRecord } from "@/admin/types";
import { SectionPanel } from "@/components/layout/section-panel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { SlotCalculationResult } from "@/map/rules";
import type { StableCaseProperties } from "@/map/types";

type CaseInfoPanelProps = {
  activeCase: StableCaseProperties | null;
  selectedCases: StableCaseProperties[];
  selectedCaseIds: string[];
  totalCases?: number;
  casesVisible: boolean;
  adminModeEnabled: boolean;
  activeAdminRecord: AdminCaseRecord | null;
  selectedAdminRecords: AdminCaseRecord[];
  adminLoading: boolean;
  adminError: string | null;
  editorHref?: string | null;
  searchValue: string;
  searchError: string | null;
  onSearchValueChange: (value: string) => void;
  onSearchSubmit: () => void;
  onPanelPointerEnter?: () => void;
};

const fieldClassName =
  "w-full rounded-[14px] border border-border/80 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60";

function summarizeStrings(values: Array<string | null | undefined>): string {
  const normalizedValues = values.map((value) => (value ?? "").trim());
  const uniqueValues = Array.from(new Set(normalizedValues));

  if (
    uniqueValues.length === 0 ||
    (uniqueValues.length === 1 && uniqueValues[0] === "")
  ) {
    return "Non renseigne";
  }

  return uniqueValues.length === 1 ? uniqueValues[0] : "Etat mixte";
}

function summarizeVisibleTrueBoolean(
  values: Array<boolean | null | undefined>,
): string | null {
  const hasTrueValue = values.some((value) => value === true);

  if (!hasTrueValue) {
    return null;
  }

  return values.every((value) => value === true) ? "Oui" : "Etat mixte";
}

function summarizeStringLists(values: string[][]): string {
  const normalizedValues = values.map((list) =>
    Array.from(
      new Set(list.map((value) => value.trim()).filter(Boolean)),
    ).sort(),
  );
  const uniqueValues = Array.from(
    new Set(normalizedValues.map((list) => list.join(", "))),
  );

  if (
    uniqueValues.length === 0 ||
    (uniqueValues.length === 1 && uniqueValues[0] === "")
  ) {
    return "Non renseigne";
  }

  return uniqueValues.length === 1 ? uniqueValues[0] : "Etat mixte";
}

function isDisplayValueEmpty(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.length === 0 || normalized === "non renseigne";
}

function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function getSlotCalculationRows(
  calculation: SlotCalculationResult,
): Array<{ label: string; value: string }> {
  if (!calculation.available) {
    return [{ label: "Etat", value: calculation.reason }];
  }

  return [
    {
      label: "emplacements_base",
      value: String(calculation.emplacements_base),
    },
    {
      label: "malus_colline",
      value: formatSignedNumber(calculation.malus_colline),
    },
    {
      label: "modificateur_peuple",
      value: formatSignedNumber(calculation.modificateur_peuple),
    },
    {
      label: "bonus_contextuel",
      value: formatSignedNumber(calculation.bonus_contextuel),
    },
    {
      label: "emplacements_bruts",
      value: String(calculation.emplacements_bruts),
    },
    { label: "emplacements_max", value: String(calculation.emplacements_max) },
    {
      label: "emplacements_utilises",
      value: String(calculation.emplacements_utilises),
    },
    {
      label: "emplacements_restants",
      value: String(calculation.emplacements_restants),
    },
  ];
}

function CompactInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-1.5 first:pt-0 last:border-b-0 last:pb-0">
      <p className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="text-right text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function CompactInfoList({
  rows,
  emptyMessage,
}: {
  rows: Array<{ label: string; value: string }>;
  emptyMessage: string;
}) {
  const visibleRows = rows.filter((row) => !isDisplayValueEmpty(row.value));

  if (visibleRows.length === 0) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">{emptyMessage}</p>
    );
  }

  return (
    <div>
      {visibleRows.map((row) => (
        <CompactInfoRow key={row.label} label={row.label} value={row.value} />
      ))}
    </div>
  );
}

function SlotCalculationDetails({
  calculation,
}: {
  calculation: SlotCalculationResult;
}) {
  const rows = getSlotCalculationRows(calculation);

  return (
    <details className="rounded-[18px] border border-border/70 bg-background/35 p-4">
      <summary className="cursor-pointer select-none text-sm font-semibold text-foreground">
        Detail du calcul
      </summary>
      <div className="mt-4 space-y-4">
        {calculation.available && calculation.depassement ? (
          <p className="rounded-[14px] border border-destructive/50 bg-destructive/12 px-3 py-2 text-sm text-destructive">
            Depassement detecte : les emplacements utilises excedent le maximum
            calcule.
          </p>
        ) : null}
        <CompactInfoList rows={rows} emptyMessage="Calcul indisponible." />
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Modificateurs appliques
          </p>
          {calculation.modifiers.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Aucun modificateur applique.
            </p>
          ) : (
            <div className="mt-3 rounded-[14px] border border-border/50 bg-background/30">
              {calculation.modifiers.map((modifier, index) => (
                <div
                  key={`${modifier.label}:${modifier.declencheur ?? ""}:${index}`}
                  className="flex items-start justify-between gap-4 border-b border-border/45 px-3 py-2.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {modifier.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {modifier.type_declencheur ?? modifier.source}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-foreground">
                    {formatSignedNumber(modifier.valeur)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h3 className="text-lg font-semibold text-foreground">{title}</h3>;
}

function MapSearchBox({
  searchValue,
  searchError,
  onSearchValueChange,
  onSearchSubmit,
}: {
  searchValue: string;
  searchError: string | null;
  onSearchValueChange: (value: string) => void;
  onSearchSubmit: () => void;
}) {
  return (
    <div className="rounded-[18px] border border-primary/20 bg-primary/8 p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-primary">
        Recherche
      </p>
      <form
        className="mt-2 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          onSearchSubmit();
        }}
      >
        <input
          className={fieldClassName}
          placeholder="Case, objet, faction, terrain, region..."
          autoComplete="off"
          value={searchValue}
          onChange={(event) => onSearchValueChange(event.target.value)}
        />
        <Button type="submit" size="sm" variant="outline">
          Rechercher
        </Button>
      </form>
      {searchError ? (
        <p className="mt-3 text-sm text-destructive">{searchError}</p>
      ) : null}
    </div>
  );
}

export function CaseInfoPanel(props: CaseInfoPanelProps) {
  const {
    activeCase,
    selectedCases,
    selectedCaseIds,
    totalCases = 0,
    casesVisible,
    adminModeEnabled,
    activeAdminRecord,
    selectedAdminRecords,
    adminLoading,
    adminError,
    editorHref,
    searchValue,
    searchError,
    onSearchValueChange,
    onSearchSubmit,
    onPanelPointerEnter,
  } = props;

  const isMultiSelection = selectedCaseIds.length > 1;
  const hasSelection = selectedCaseIds.length > 0;
  const slotDetails =
    adminModeEnabled && !isMultiSelection && activeAdminRecord ? (
      <SlotCalculationDetails calculation={activeAdminRecord.emplacements} />
    ) : null;
  const slotSummary =
    !isMultiSelection && activeAdminRecord
      ? activeAdminRecord.emplacements.available
        ? `${activeAdminRecord.emplacements.emplacements_restants}/${activeAdminRecord.emplacements.emplacements_max} restants`
        : activeAdminRecord.emplacements.reason
      : "Non renseigne";

  const identityRows = [
    {
      label: "Cases selectionnees",
      value: String(selectedCaseIds.length),
    },
    {
      label: "Case active",
      value: activeCase?.id_case ?? "Aucune",
    },
    {
      label: "Region",
      value: summarizeStrings(selectedCases.map((item) => item.region)),
    },
    {
      label: "Sous-region",
      value: summarizeStrings(selectedCases.map((item) => item.sous_region)),
    },
  ];
  const terrainRows = [
    {
      label: "Categorie",
      value: summarizeStrings(selectedCases.map((item) => item.terrain_cat)),
    },
    {
      label: "Type",
      value: summarizeStrings(selectedCases.map((item) => item.terrain_type)),
    },
    ...[
      {
        label: "Cote",
        value: summarizeVisibleTrueBoolean(
          selectedCases.map((item) => item.cote),
        ),
      },
      {
        label: "Lac",
        value: summarizeVisibleTrueBoolean(
          selectedCases.map((item) => item.lac),
        ),
      },
      {
        label: "Fluvial",
        value: summarizeVisibleTrueBoolean(
          selectedCases.map((item) => item.fluvial),
        ),
      },
      {
        label: "Colline",
        value: summarizeVisibleTrueBoolean(
          selectedCases.map((item) => item.colline),
        ),
      },
    ].filter(
      (row): row is { label: string; value: string } => row.value !== null,
    ),
    { label: "Emplacements", value: slotSummary },
  ];
  const controlRows = [
    {
      label: "Peuple",
      value: summarizeStrings(selectedCases.map((item) => item.peuple)),
    },
    {
      label: "Faction",
      value: summarizeStrings(selectedCases.map((item) => item.faction)),
    },
    {
      label: "Controleur",
      value: summarizeStrings(selectedCases.map((item) => item.controleur)),
    },
    {
      label: "Type de controle",
      value: summarizeStrings(selectedCases.map((item) => item.controle_type)),
    },
  ];
  const bonusRows = [
    {
      label: "Bonus contextuels",
      value: summarizeStringLists(
        selectedAdminRecords.map((record) =>
          record.bonus_contextuels.map((bonus) => bonus.label),
        ),
      ),
    },
  ];
  return (
    <aside
      className="h-full min-h-0 [overflow-anchor:none]"
      aria-live="polite"
      onPointerEnter={onPanelPointerEnter}
    >
      <SectionPanel className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-4 sm:p-5">
          <header className="space-y-3">
            <h2 className="font-chronicle text-2xl tracking-[0.04em] text-foreground">
              Informations de case
            </h2>
            <MapSearchBox
              searchValue={searchValue}
              searchError={searchError}
              onSearchValueChange={onSearchValueChange}
              onSearchSubmit={onSearchSubmit}
            />
            {adminModeEnabled && hasSelection ? (
              <div className="rounded-[22px] border border-primary/25 bg-primary/8 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-primary">
                      Edition
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Les modifications de cases sont centralisees dans
                      l&apos;editeur.
                    </p>
                    {adminLoading ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Chargement des donnees admin...
                      </p>
                    ) : null}
                  </div>
                  {editorHref ? (
                    <Button asChild>
                      <Link href={editorHref}>Ouvrir dans l&apos;editeur</Link>
                    </Button>
                  ) : null}
                </div>
                {adminError ? (
                  <p className="mt-3 text-sm text-destructive">{adminError}</p>
                ) : null}
              </div>
            ) : null}
          </header>

          <Separator className="my-4" />

          {!casesVisible ? (
            <div className="rounded-[20px] border border-border/70 bg-background/40 p-4 text-sm leading-6 text-muted-foreground">
              <p className="font-medium text-foreground">
                La couche des cases est masquee.
              </p>
              <p>
                Reactive les contours pour cliquer sur une case et consulter ses
                informations.
              </p>
            </div>
          ) : !hasSelection ? (
            <div className="rounded-[20px] border border-border/70 bg-background/40 p-4 text-sm leading-6 text-muted-foreground">
              <p className="font-medium text-foreground">
                Aucune case selectionnee.
              </p>
              <p>Clique sur une case pour afficher son resume.</p>
              <p className="mt-2">
                {totalCases || "..."} case(s) sont actuellement chargee(s).
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-3">
              <section className="rounded-[20px] border border-border/70 bg-background/40 p-3">
                <SectionTitle title="Case" />
                <div className="mt-3">
                  <CompactInfoList
                    rows={identityRows}
                    emptyMessage="Aucune case selectionnee."
                  />
                </div>
              </section>

              <section className="rounded-[20px] border border-border/70 bg-background/40 p-3">
                <SectionTitle title="Terrain" />
                <div className="mt-3 space-y-3">
                  <CompactInfoList
                    rows={terrainRows}
                    emptyMessage="Aucune donnee de terrain renseignee."
                  />
                  {slotDetails}
                </div>
              </section>

              <section className="rounded-[20px] border border-border/70 bg-background/40 p-3">
                <SectionTitle title="Controle" />
                <div className="mt-3">
                  <CompactInfoList
                    rows={controlRows}
                    emptyMessage="Aucune donnee de controle renseignee."
                  />
                </div>
              </section>

              {adminModeEnabled ? (
                <section className="rounded-[20px] border border-border/70 bg-background/40 p-3">
                  <SectionTitle title="Bonus contextuels" />
                  <div className="mt-3">
                    <CompactInfoList
                      rows={bonusRows}
                      emptyMessage="Aucun bonus contextuel applique."
                    />
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </SectionPanel>
    </aside>
  );
}
