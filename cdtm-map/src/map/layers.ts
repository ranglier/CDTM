export type MapLayerDefinition = {
  id: string;
  label: string;
  visibleByDefault?: boolean;
};

export function getBaseLayers(): MapLayerDefinition[] {
  // TODO: declarer ici les futurs calques de carte.
  return [];
}
