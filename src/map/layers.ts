export type LayerConfig = {
  id: string;
  label: string;
  visibleByDefault: boolean;
  sourcePath?: string;
};

export const plannedLayers: LayerConfig[] = [
  {
    id: 'fond_carte',
    label: 'Fond de carte',
    visibleByDefault: true,
    sourcePath: '/maps/',
  },
  {
    id: 'cases',
    label: 'Cases territoriales',
    visibleByDefault: true,
    sourcePath: '/data/cases.geojson',
  },
  {
    id: 'frontieres_raster_backup',
    label: 'Frontières raster backup',
    visibleByDefault: false,
  },
];

export function getPlannedLayers(): LayerConfig[] {
  return plannedLayers;
}
