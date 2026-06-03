"use client";

import { useSyncExternalStore } from "react";

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

function getMobileViewportSnapshot(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(MOBILE_MEDIA_QUERY).matches
  );
}

function subscribeToMobileViewportChange(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);

  mediaQuery.addEventListener("change", onStoreChange);

  return () => {
    mediaQuery.removeEventListener("change", onStoreChange);
  };
}

export function useIsMobileViewport(): boolean {
  return useSyncExternalStore(
    subscribeToMobileViewportChange,
    getMobileViewportSnapshot,
    () => false,
  );
}
