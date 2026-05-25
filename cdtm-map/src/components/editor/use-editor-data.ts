"use client";

import { useCallback, useEffect, useState } from "react";

import type { EditorMapLocality, EditorReferenceData } from "@/editor/types";

type EditorDataLoadStatus = "idle" | "loading" | "ready" | "error";

type EditorDataState = {
  referenceData: EditorReferenceData | null;
  localities: EditorMapLocality[];
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
  const [loadStatus, setLoadStatus] = useState<EditorDataLoadStatus>(enabled ? "loading" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setError(null);
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
        const [nextReferenceData, nextLocalities] = await Promise.all([
          fetchJson<EditorReferenceData>("/api/admin/editor/reference-data"),
          fetchJson<EditorMapLocality[]>("/api/admin/editor/localities?limit=1000"),
        ]);

        if (cancelled) {
          return;
        }

        setReferenceData(nextReferenceData);
        setLocalities(nextLocalities);
        setError(null);
        setLoadStatus("ready");
      } catch (nextError) {
        if (cancelled) {
          return;
        }

        setError(nextError instanceof Error ? nextError.message : "Chargement de l'editeur impossible.");
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
      loading: false,
      error: null,
      reload,
    };
  }

  return {
    referenceData,
    localities,
    loading: loadStatus === "loading" || loadStatus === "idle",
    error,
    reload,
  };
}
