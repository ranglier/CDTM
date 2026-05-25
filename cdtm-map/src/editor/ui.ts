import type {
  EditorMapLocality,
  EditorReferenceData,
  EditorReferenceOption,
  MapObjectStatus,
} from "@/editor/types";

export type EditorLocalityStatusFilter = "all" | MapObjectStatus;

export function getEditorOptionLabel(
  options: EditorReferenceOption[],
  value: string | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  return options.find((option) => option.value === value)?.label ?? value;
}

export function getEditorReferenceOptions<K extends keyof EditorReferenceData>(
  referenceData: EditorReferenceData | null,
  key: K,
): EditorReferenceData[K] {
  return referenceData?.[key] ?? [];
}

export function sortEditorLocalitiesByName(localities: EditorMapLocality[]): EditorMapLocality[] {
  return [...localities].sort((left, right) => {
    const byName = left.name.localeCompare(right.name, "fr", { sensitivity: "base" });

    if (byName !== 0) {
      return byName;
    }

    return left.id_locality.localeCompare(right.id_locality, "fr", { sensitivity: "base" });
  });
}

export function countLocalitiesByStatus(localities: EditorMapLocality[]) {
  return {
    draft: localities.filter((locality) => locality.status === "draft").length,
    published: localities.filter((locality) => locality.status === "published").length,
    archived: localities.filter((locality) => locality.status === "archived").length,
  };
}
