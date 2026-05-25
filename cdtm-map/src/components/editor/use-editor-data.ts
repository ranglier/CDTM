"use client";

import { useCallback, useEffect, useState } from "react";

import type { PublicCaseIndexResponse, PublicCaseProperties } from "@/admin/types";
import {
  createEmptyPublicMapStyles,
  type PublicMapStyles,
  type StableCaseProperties,
} from "@/map/types";
import type { EditorMapLocality, EditorReferenceData } from "@/editor/types";

type EditorDataLoadStatus = "idle" | "loading" | "ready" | "error";

type EditorDataState = {
  referenceData: EditorReferenceData | null;
  localities: EditorMapLocality[];
  casePropertiesById: Record<string, StableCaseProperties>;
  publicMapStyles: PublicMapStyles;
  influenceOverlayMessage: string | null;
  influenceOverlayStats: {
    caseCount: number;
    factionStyleCount: number;
    controllerStyleCount: number;
  };
  loading: boolean;
  error: string | null;
  reload: () => void;
};

function buildPublicCasePropertiesById(
  publicCases: PublicCaseProperties[],
): Record<string, StableCaseProperties> {
  return Object.fromEntries(
    publicCases.map((publicCase) => {
      const key = publicCase.registry_id_case || publicCase.id_case;

      return [
        key,
        {
          registry_id_case: publicCase.registry_id_case,
          id_case: publicCase.id_case,
          region: publicCase.region,
          sous_region: publicCase.sous_region,
          cote: publicCase.cote,
          lac_majeur: publicCase.lac_majeur,
          cours_eau_majeur: publicCase.cours_eau_majeur,
          terrain_cat: publicCase.terrain_cat,
          terrain_type: publicCase.terrain_type,
          relief: publicCase.relief,
          faction: publicCase.faction,
          controleur: publicCase.controleur,
          controle_type: publicCase.controle_type,
        } satisfies StableCaseProperties,
      ];
    }),
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = "Requete impossible.";

    try {
      const data = (await response.json()) as { error?: string };

      if (data.error) {
        message = data.error;
      }
    } catch {}

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function useEditorData(enabled: boolean): EditorDataState {
  const [referenceData, setReferenceData] = useState<EditorReferenceData | null>(null);
  const [localities, setLocalities] = useState<EditorMapLocality[]>([]);
  const [casePropertiesById, setCasePropertiesById] = useState<Record<string, StableCaseProperties>>({});
  const [publicMapStyles, setPublicMapStyles] = useState<PublicMapStyles>(createEmptyPublicMapStyles());
  const [influenceOverlayMessage, setInfluenceOverlayMessage] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<EditorDataLoadStatus>(enabled ? "loading" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setError(null);
    setInfluenceOverlayMessage(null);
    setLoadStatus("loading");
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled || (loadStatus !== "loading" && loadStatus !== "idle")) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const [nextReferenceData, nextLocalities, nextPublicCaseIndexResult] = await Promise.all([
          fetchJson<EditorReferenceData>("/api/admin/editor/reference-data"),
          fetchJson<EditorMapLocality[]>("/api/admin/editor/localities?limit=1000"),
          fetchJson<PublicCaseIndexResponse>("/api/cases/public-index")
            .then((response) => ({
              data: response,
              fallbackUsed: false,
            }))
            .catch(() => ({
              data: {
                cases: [],
                styles: createEmptyPublicMapStyles(),
              },
              fallbackUsed: true,
            })),
        ]);

        if (cancelled) {
          return;
        }
        const overlayMessage = nextPublicCaseIndexResult.fallbackUsed
          ? "Les styles publics n’ont pas pu être chargés. L’overlay Influence utilisera seulement les données stables disponibles."
          : null;

        setReferenceData(nextReferenceData);
        setLocalities(nextLocalities);
        setCasePropertiesById(buildPublicCasePropertiesById(nextPublicCaseIndexResult.data.cases));
        setPublicMapStyles(nextPublicCaseIndexResult.data.styles);
        setInfluenceOverlayMessage(overlayMessage);
        setError(null);
        setLoadStatus("ready");
      } catch (nextError) {
        if (cancelled) {
          return;
        }

        setError(nextError instanceof Error ? nextError.message : "Chargement de l'editeur impossible.");
        setCasePropertiesById({});
        setPublicMapStyles(createEmptyPublicMapStyles());
        setInfluenceOverlayMessage(null);
        setLoadStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, loadStatus, reloadToken]);

  if (!enabled) {
    return {
      referenceData: null,
      localities: [],
      casePropertiesById: {},
      publicMapStyles: createEmptyPublicMapStyles(),
      influenceOverlayMessage: null,
      influenceOverlayStats: {
        caseCount: 0,
        factionStyleCount: 0,
        controllerStyleCount: 0,
      },
      loading: false,
      error: null,
      reload,
    };
  }

  return {
    referenceData,
    localities,
    casePropertiesById,
    publicMapStyles,
    influenceOverlayMessage,
    influenceOverlayStats: {
      caseCount: Object.keys(casePropertiesById).length,
      factionStyleCount: Object.keys(publicMapStyles.faction).length,
      controllerStyleCount: Object.keys(publicMapStyles.controleur).length,
    },
    loading: loadStatus === "loading" || loadStatus === "idle",
    error,
    reload,
  };
}
