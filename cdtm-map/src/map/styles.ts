export type CaseFeature = {
  properties?: Record<string, unknown>;
};

export type CaseStyle = {
  fillColor?: string;
  color?: string;
  weight?: number;
  opacity?: number;
  fillOpacity?: number;
};

export function getCaseStyle(feature: CaseFeature): CaseStyle {
  void feature;

  // TODO: brancher plus tard les styles sur les attributs metier.
  return {
    fillColor: "#cccccc",
    color: "#444444",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.6
  };
}
