import { SectionPanel } from "@/components/layout/section-panel";
import { Separator } from "@/components/ui/separator";
import type { StableCaseProperties } from "@/map/types";

type CaseInfoPanelProps = {
  selectedCase: StableCaseProperties | null;
  totalCases?: number;
  casesVisible: boolean;
};

function formatText(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "Non renseigne";
}

function formatFlag(value: boolean | null | undefined): string {
  return value === true ? "Oui" : "Non";
}

export function CaseInfoPanel({
  selectedCase,
  totalCases = 0,
  casesVisible,
}: CaseInfoPanelProps) {
  return (
    <aside aria-live="polite">
      <SectionPanel className="flex h-full flex-col">
        <div className="flex flex-1 flex-col p-6">
          <header className="space-y-4">
            <h2 className="font-chronicle text-3xl tracking-[0.04em] text-foreground">
              Informations de case
            </h2>
          </header>

          <Separator className="my-5" />

          {!casesVisible ? (
            <div className="rounded-[24px] border border-border/70 bg-background/40 p-5 text-sm leading-7 text-muted-foreground">
              <p className="font-medium text-foreground">
                La couche des cases est actuellement masquee.
              </p>
              <p>Reactive les contours pour cliquer sur une case et afficher ses informations.</p>
            </div>
          ) : selectedCase ? (
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex items-center justify-between gap-3 rounded-[24px] border border-primary/30 bg-primary/10 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-primary">
                    Case selectionnee
                  </p>
                  <p className="mt-1 text-xl font-semibold text-foreground">
                    {selectedCase.id_case}
                  </p>
                </div>
              </div>

              <dl className="grid gap-3">
                <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
                  <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Region
                  </dt>
                  <dd className="mt-2 text-base font-medium text-foreground">
                    {formatText(selectedCase.region)}
                  </dd>
                </div>
                <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
                  <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Sous-region
                  </dt>
                  <dd className="mt-2 text-base font-medium text-foreground">
                    {formatText(selectedCase.sous_region)}
                  </dd>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
                    <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Cote
                    </dt>
                    <dd className="mt-2 text-base font-medium text-foreground">
                      {formatFlag(selectedCase.cote)}
                    </dd>
                  </div>
                  <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
                    <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Lac majeur
                    </dt>
                    <dd className="mt-2 text-base font-medium text-foreground">
                      {formatFlag(selectedCase.lac_majeur)}
                    </dd>
                  </div>
                  <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
                    <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Cours d&apos;eau majeur
                    </dt>
                    <dd className="mt-2 text-base font-medium text-foreground">
                      {formatFlag(selectedCase.cours_eau_majeur)}
                    </dd>
                  </div>
                </div>
              </dl>
            </div>
          ) : (
            <div className="rounded-[24px] border border-border/70 bg-background/40 p-5 text-sm leading-7 text-muted-foreground">
              <p className="font-medium text-foreground">Aucune case selectionnee.</p>
              <p>
                Clique sur un contour pour afficher ici l&apos;identifiant stable, la
                region, la sous-region et les indicateurs d&apos;eau majeure.
              </p>
              <p className="mt-2">{totalCases || "..."} case(s) sont actuellement chargee(s).</p>
            </div>
          )}

        </div>
      </SectionPanel>
    </aside>
  );
}
