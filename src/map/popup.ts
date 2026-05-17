export type PopupProperties = {
  id_case?: string;
  region?: string;
  sous_region?: string;
  terrain_cat?: string;
  terrain_type?: string;
  faction?: string;
  race?: string;
  empl_base?: number;
  empl_max?: number;
  controleur?: string;
  controleur_type?: string;
  controle_type?: string;
  note_publique?: string;
  note_staff?: string;
  [key: string]: unknown;
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function buildCasePopup(properties: PopupProperties, includeStaff = false): string {
  const rows: [string, unknown][] = [
    ['Case', properties.id_case],
    ['Région', properties.region],
    ['Sous-région', properties.sous_region],
    ['Terrain', [properties.terrain_cat, properties.terrain_type].filter(Boolean).join(' / ')],
    ['Faction', properties.faction],
    ['Race', properties.race],
    ['Emplacements', `${properties.empl_base ?? '?'} / ${properties.empl_max ?? '?'}`],
    ['Contrôleur', properties.controleur],
    ['Type de contrôleur', properties.controleur_type],
    ['Type de contrôle', properties.controle_type],
    ['Note publique', properties.note_publique],
  ];

  if (includeStaff) {
    rows.push(['Note staff', properties.note_staff]);
  }

  const body = rows
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join('');

  return `<section class="case-popup"><dl>${body}</dl></section>`;
}
