export type CaseProperties = {
  id_case?: string;
  faction?: string;
  controle_type?: string;
  [key: string]: unknown;
};

export type CaseStyle = {
  color: string;
  weight: number;
  opacity: number;
  fillColor: string;
  fillOpacity: number;
};

export function getCaseStyle(properties: CaseProperties = {}): CaseStyle {
  // TODO: remplacer par une lecture de data/reference/styles_factions.example.json
  const contested = properties.controle_type === 'conteste' || properties.controle_type === 'partiel';

  return {
    color: '#000000',
    weight: contested ? 2 : 1,
    opacity: 0.85,
    fillColor: '#888888',
    fillOpacity: contested ? 0.3 : 0.45,
  };
}
