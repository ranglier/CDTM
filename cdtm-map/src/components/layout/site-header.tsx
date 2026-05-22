import { Compass, MountainSnow, ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";

type SiteHeaderProps = {
  totalCases: number;
  casesVisible: boolean;
};

export function SiteHeader({ totalCases, casesVisible }: SiteHeaderProps) {
  return (
    <header className="grid gap-5 rounded-[32px] border border-border/60 bg-panel/92 px-6 py-6 shadow-[0_32px_80px_hsl(var(--shadow)/0.5)] backdrop-blur-xl lg:grid-cols-[minmax(0,1.3fr)_auto] lg:items-end">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge>Chroniques de la Terre du Milieu</Badge>
          <Badge variant="secondary">Fond CTM statique</Badge>
          <Badge variant="outline">Projection locale CDTM-LOCAL</Badge>
        </div>
        <div className="space-y-3">
          <h1 className="max-w-4xl font-chronicle text-4xl leading-none tracking-[0.04em] text-foreground sm:text-5xl lg:text-6xl">
            Table de guerre publique
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            Premiere iteration visuelle de la carte CDTM. Le fond statique et la couche
            stable des cases partagent le meme repere local pour garantir l&apos;alignement
            sans reprojection geographique.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
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
      </div>
    </header>
  );
}
