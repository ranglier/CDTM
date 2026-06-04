"use client";

type MapPerformanceAggregate = {
  label: string;
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  lastMs: number;
};

const mapPerformanceAggregates = new Map<string, MapPerformanceAggregate>();

export function isMapPerformanceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CDTM_MAP_PERF === "1";
}

export function getMapPerformanceNow(): number {
  if (typeof performance === "undefined") {
    return Date.now();
  }

  return performance.now();
}

export function markMapPerformance(name: string): void {
  if (!isMapPerformanceEnabled() || typeof performance === "undefined") {
    return;
  }

  performance.mark(`cdtm:${name}`);
}

export function recordMapPerformanceDuration(
  label: string,
  durationMs: number,
): void {
  if (!isMapPerformanceEnabled() || !Number.isFinite(durationMs)) {
    return;
  }

  const normalizedDuration = Math.max(0, durationMs);
  const current = mapPerformanceAggregates.get(label);

  if (!current) {
    mapPerformanceAggregates.set(label, {
      label,
      count: 1,
      totalMs: normalizedDuration,
      minMs: normalizedDuration,
      maxMs: normalizedDuration,
      lastMs: normalizedDuration,
    });
    return;
  }

  current.count += 1;
  current.totalMs += normalizedDuration;
  current.minMs = Math.min(current.minMs, normalizedDuration);
  current.maxMs = Math.max(current.maxMs, normalizedDuration);
  current.lastMs = normalizedDuration;
}

export function measureMarkedMapPerformance(
  label: string,
  startMark: string,
  endMark?: string,
): void {
  if (!isMapPerformanceEnabled() || typeof performance === "undefined") {
    return;
  }

  const fullStartMark = `cdtm:${startMark}`;
  const fullEndMark = endMark ? `cdtm:${endMark}` : undefined;

  try {
    const measure = performance.measure(
      `cdtm:${label}`,
      fullStartMark,
      fullEndMark,
    );
    recordMapPerformanceDuration(label, measure.duration);
  } catch {
    // Les marks de performance sont optionnels et ne doivent jamais casser la carte.
  }
}

export function measureMapPerformanceSync<T>(
  label: string,
  callback: () => T,
): T {
  if (!isMapPerformanceEnabled()) {
    return callback();
  }

  const start = getMapPerformanceNow();

  try {
    return callback();
  } finally {
    recordMapPerformanceDuration(label, getMapPerformanceNow() - start);
  }
}

export async function measureMapPerformanceAsync<T>(
  label: string,
  callback: () => Promise<T>,
): Promise<T> {
  if (!isMapPerformanceEnabled()) {
    return callback();
  }

  const start = getMapPerformanceNow();

  try {
    return await callback();
  } finally {
    recordMapPerformanceDuration(label, getMapPerformanceNow() - start);
  }
}

export function logMapPerformanceSummary(title = "CDTM map performance"): void {
  if (!isMapPerformanceEnabled()) {
    return;
  }

  const rows = Array.from(mapPerformanceAggregates.values()).map((entry) => ({
    label: entry.label,
    count: entry.count,
    avgMs: Math.round((entry.totalMs / entry.count) * 10) / 10,
    minMs: Math.round(entry.minMs * 10) / 10,
    maxMs: Math.round(entry.maxMs * 10) / 10,
    lastMs: Math.round(entry.lastMs * 10) / 10,
  }));

  if (rows.length === 0) {
    return;
  }

  console.groupCollapsed(title);
  console.table(rows);
  console.groupEnd();
}
