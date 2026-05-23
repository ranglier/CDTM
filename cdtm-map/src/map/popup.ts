export type CaseProperties = {
  id_case?: string | null;
  region?: string | null;
  sous_region?: string | null;
  terrain_cat?: string | null;
  terrain_type?: string | null;
  relief?: string | null;
  cote?: boolean | null;
  lac_majeur?: boolean | null;
  cours_eau_majeur?: boolean | null;
  faction?: string | null;
  peuple_majoritaire?: string | null;
  bonus_speciaux?: string[] | null;
  empl_base?: number | null;
  empl_max?: number | null;
  controleur?: string | null;
  controle_type?: string | null;
  [key: string]: unknown;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatValue(value: unknown): string {
  if (value === true) return "oui";
  if (value === false) return "non";
  return escapeHtml(value);
}

function formatTerrain(properties: CaseProperties): string {
  const parts = [properties.terrain_cat, properties.terrain_type].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "";
}

function formatEmplacements(properties: CaseProperties): string {
  const base = properties.empl_base ?? "?";
  const max = properties.empl_max ?? "?";
  return `${base} / ${max}`;
}

function renderRow(label: string, value: unknown): string {
  if (value === undefined || value === null || value === "") return "";

  return `<dt>${escapeHtml(label)}</dt><dd>${formatValue(value)}</dd>`;
}

export function buildCasePopup(properties: CaseProperties = {}): string {
  const rows = [
    renderRow("Case", properties.id_case ?? "case_inconnue"),
    renderRow("Région", properties.region),
    renderRow("Sous-région", properties.sous_region),
    renderRow("Terrain", formatTerrain(properties)),
    renderRow("Relief", properties.relief),
    properties.cote === true ? renderRow("Côte", properties.cote) : "",
    properties.lac_majeur === true ? renderRow("Lac majeur", properties.lac_majeur) : "",
    properties.cours_eau_majeur === true
      ? renderRow("Cours d'eau majeur", properties.cours_eau_majeur)
      : "",
    renderRow("Faction", properties.faction),
    renderRow("Peuple majoritaire", properties.peuple_majoritaire),
    renderRow("Emplacements", formatEmplacements(properties)),
    renderRow("Contrôleur", properties.controleur),
    renderRow("Type de contrôle", properties.controle_type),
  ];

  return `<section class="case-popup"><dl>${rows.join("")}</dl></section>`;
}
