"use client";

import { useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { CaseInfoPanel } from "@/components/map/case-info-panel";
import { CasesMap } from "@/components/map/cases-map";
import { getBaseLayers } from "@/map/layers";
import type { StableCaseProperties } from "@/map/types";

export default function HomePage() {
  const [selectedCase, setSelectedCase] = useState<StableCaseProperties | null>(null);
  const [totalCases, setTotalCases] = useState(0);
  const [, casesLayer] = getBaseLayers();
  const [casesVisible, setCasesVisible] = useState(true);
  const [panelVisible, setPanelVisible] = useState(true);

  function handleCasesVisibilityChange(visible: boolean) {
    setCasesVisible(visible);

    if (!visible) {
      setSelectedCase(null);
    }
  }

  return (
    <AppShell>
      <section
        className={
          panelVisible
            ? "grid min-h-[calc(100svh-2rem)] flex-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_24rem]"
            : "grid min-h-[calc(100svh-2rem)] flex-1 gap-6"
        }
        aria-label="Carte publique des cases"
      >
        <CasesMap
          dataUrl={casesLayer.sourcePath}
          selectedCaseId={selectedCase?.id_case ?? null}
          casesVisible={casesVisible}
          panelVisible={panelVisible}
          onCaseSelect={setSelectedCase}
          onCasesVisibilityChange={handleCasesVisibilityChange}
          onPanelVisibilityChange={setPanelVisible}
          onFeaturesLoad={setTotalCases}
        />
        {panelVisible ? (
          <CaseInfoPanel
            selectedCase={selectedCase}
            totalCases={totalCases}
            casesVisible={casesVisible}
          />
        ) : null}
      </section>
    </AppShell>
  );
}
