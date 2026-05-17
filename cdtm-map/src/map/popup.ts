export type CaseProperties = Record<string, unknown>;

export function buildCasePopup(properties: CaseProperties): string {
  const idCase =
    typeof properties.id_case === "string" ? properties.id_case : "case_inconnue";

  // TODO: enrichir ce rendu quand le modele de donnees sera stabilise.
  return `<strong>${idCase}</strong>`;
}
