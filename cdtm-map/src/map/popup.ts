export type CaseProperties = {
  id_case?: string | null;
  region?: string | null;
  sous_region?: string | null;
  terrain_cat?: string | null;
  terrain_type?: string | null;
  terrain_secondaire?: string | null;
  cote?: boolean | null;
  faction?: string | null;
  peuple_majoritaire?: string | null;
  empl_base?: number | null;
  empl_max?: number | null;
  controleur?: string | null;
  controle_type?: string | null;
  note_publique?: string | null;
  note_staff?: string | null;
  [key: string]: unknown;
};

export type PopupOptions = {
  includeStaff?: boolean;
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

export function buildCasePopup(
  properties: CaseProperties = {},
  options: PopupOptions = {}
): string {
  const rows = [
    renderRow("Case", properties.id_case ?? "case_inconnue"),
    renderRow("Région", properties.region),
    renderRow("Sous-région", properties.sous_region),
    renderRow("Terrain", formatTerrain(properties)),
    renderRow("Terrain secondaire", properties.terrain_secondaire),
    properties.cote === true ? renderRow("Côte", properties.cote) : "",
    renderRow("Faction", properties.faction),
    renderRow("Peuple majoritaire", properties.peuple_majoritaire),
    renderRow("Emplacements", formatEmplacements(properties)),
    renderRow("Contrôleur", properties.controleur),
    renderRow("Type de contrôle", properties.controle_type),
    renderRow("Note publique", properties.note_publique),
  ];

  if (options.includeStaff) {
    rows.push(renderRow("Note staff", properties.note_staff));
  }

  return `<section class="case-popup"><dl>${rows.join("")}</dl></section>`;
}
