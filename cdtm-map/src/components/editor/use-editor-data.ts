"use client";

import { useCallback, useEffect, useState } from "react";

import type { PublicCaseIndexResponse } from "@/admin/types";
import { buildCasePropertiesById, getStableCasesFromCollection, mergeStableCases } from "@/map/case-data";
import {
  CASES_DATA_URL,
  createEmptyPublicMapStyles,
  isStableCaseFeatureCollection,
  type PublicMapStyles,
  type StableCaseFeatureCollection,
  type StableCaseProperties,
} from "@/map/types";
import type { EditorMapLocality, EditorReferenceData } from "@/editor/types";

type EditorDataLoadStatus = "idle" | "loading" | "ready" | "error";

type EditorDataState = {
  referenceData: EditorReferenceData | null;
  localities: EditorMapLocality[];
  stableCaseCollection: StableCaseFeatureCollection | null;
  casePropertiesById: Record<string, StableCaseProperties>;
  publicMapStyles: PublicMapStyles;
  influenceOverlayMessage: string | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

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
  const [stableCaseCollection, setStableCaseCollection] = useState<StableCaseFeatureCollection | null>(null);
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
        const [
          nextReferenceData,
          nextLocalities,
          nextStableCaseResult,
          nextPublicCaseIndexResult,
        ] = await Promise.all([
          fetchJson<EditorReferenceData>("/api/admin/editor/reference-data"),
          fetchJson<EditorMapLocality[]>("/api/admin/editor/localities?limit=1000"),
          fetchJson<StableCaseFeatureCollection>(CASES_DATA_URL)
            .then((collection) => {
              if (!isStableCaseFeatureCollection(collection)) {
                throw new Error("Le GeoJSON stable des cases est invalide pour l’overlay Influence.");
              }

              return {
                collection,
                message: null,
              };
            })
            .catch((nextError) => ({
              collection: null,
              message:
                nextError instanceof Error
                  ? nextError.message
                  : "Les cases n’ont pas pu être chargées pour l’overlay Influence.",
            })),
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
        const mergedCases =
          nextStableCaseResult.collection === null
            ? []
            : mergeStableCases(
                getStableCasesFromCollection(nextStableCaseResult.collection),
                nextPublicCaseIndexResult.data.cases,
              );
        const overlayMessage =
          nextStableCaseResult.message ??
          (nextPublicCaseIndexResult.fallbackUsed
            ? "Les styles publics n’ont pas pu être chargés. L’overlay Influence utilisera seulement les données stables disponibles."
            : null);

        setReferenceData(nextReferenceData);
        setLocalities(nextLocalities);
        setStableCaseCollection(nextStableCaseResult.collection);
        setCasePropertiesById(buildCasePropertiesById(mergedCases));
        setPublicMapStyles(nextPublicCaseIndexResult.data.styles);
        setInfluenceOverlayMessage(overlayMessage);
        setError(null);
        setLoadStatus("ready");
      } catch (nextError) {
        if (cancelled) {
          return;
        }

        setError(nextError instanceof Error ? nextError.message : "Chargement de l'editeur impossible.");
        setStableCaseCollection(null);
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
      stableCaseCollection: null,
      casePropertiesById: {},
      publicMapStyles: createEmptyPublicMapStyles(),
      influenceOverlayMessage: null,
      loading: false,
      error: null,
      reload,
    };
  }

  return {
    referenceData,
    localities,
    stableCaseCollection,
    casePropertiesById,
    publicMapStyles,
    influenceOverlayMessage,
    loading: loadStatus === "loading" || loadStatus === "idle",
    error,
    reload,
  };
}
