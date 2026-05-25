import Feature from "ol/Feature";
import GeoJSON from "ol/format/GeoJSON";
import type Geometry from "ol/geom/Geometry";
import type Projection from "ol/proj/Projection";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";

import { getCaseStyle } from "@/map/styles";
import {
  createEmptyPublicMapStyles,
  type MapDisplayMode,
  type PublicMapStyles,
  type StableCaseFeatureCollection,
  type StableCaseProperties,
  toStableCaseProperties,
} from "@/map/types";

type CaseLayerSelectionState = "default" | "selected" | "active";

export type CaseLayerSelectionStateResolver = (
  idCase: string | null,
) => CaseLayerSelectionState;

export type CaseLayerStyleContext = {
  getDisplayMode: () => MapDisplayMode;
  getCasePropertiesById: () => Record<string, StableCaseProperties>;
  getPublicMapStyles: () => PublicMapStyles;
  getSelectionState?: CaseLayerSelectionStateResolver;
};

type CreateCasesVectorLayerOptions = {
  visible?: boolean;
  opacity?: number;
  fallbackWhenUnstyled?: boolean;
};

const geoJsonFormat = new GeoJSON();
const fallbackInfluenceCaseStyle = new Style({
  fill: new Fill({ color: "rgba(220, 193, 130, 0.06)" }),
  stroke: new Stroke({ color: "rgba(220, 193, 130, 0.35)", width: 1 }),
});

export function createCasesVectorSource(): VectorSource {
  return new VectorSource();
}

function resolveCaseLookupId(properties: Record<string, unknown>): string | null {
  if (typeof properties.registry_id_case === "string" && properties.registry_id_case.length > 0) {
    return properties.registry_id_case;
  }

  if (typeof properties.id_case === "string" && properties.id_case.length > 0) {
    return properties.id_case;
  }

  return null;
}

function hasInfluenceStyle(
  properties: StableCaseProperties | null,
  styles: PublicMapStyles,
): boolean {
  if (!properties) {
    return false;
  }

  if (properties.controleur && styles.controleur[properties.controleur]) {
    return true;
  }

  if (properties.faction && styles.faction[properties.faction]) {
    return true;
  }

  return false;
}

export function resolveCaseFeatureProperties(
  feature: Feature<Geometry>,
  casePropertiesById: Record<string, StableCaseProperties>,
): StableCaseProperties | null {
  const idCase = resolveCaseLookupId(feature.getProperties() as Record<string, unknown>);

  return (
    (idCase ? casePropertiesById[idCase] : null) ??
    toStableCaseProperties(feature.getProperties() as Record<string, unknown>) ??
    null
  );
}

export function createCasesVectorLayer(
  source: VectorSource,
  context: CaseLayerStyleContext,
  options: CreateCasesVectorLayerOptions = {},
): VectorLayer {
  const {
    visible = true,
    opacity,
    fallbackWhenUnstyled = false,
  } = options;

  return new VectorLayer({
    source,
    visible,
    opacity,
    style: (candidateFeature) => {
      if (!(candidateFeature instanceof Feature)) {
        return undefined;
      }

      const styles = context.getPublicMapStyles() ?? createEmptyPublicMapStyles();
      const properties = resolveCaseFeatureProperties(
        candidateFeature as Feature<Geometry>,
        context.getCasePropertiesById(),
      );
      const displayMode = context.getDisplayMode();

      if (fallbackWhenUnstyled && displayMode === "influence" && !hasInfluenceStyle(properties, styles)) {
        return fallbackInfluenceCaseStyle;
      }

      const idCase = candidateFeature.getId();
      const selectionState = context.getSelectionState?.(
        typeof idCase === "string" ? idCase : null,
      ) ?? "default";

      return getCaseStyle({
        selectionState,
        displayMode,
        properties,
        styles,
      });
    },
  });
}

export function readCaseFeatures(
  collection: StableCaseFeatureCollection,
  projection: Projection,
): Feature<Geometry>[] {
  const features = geoJsonFormat.readFeatures(collection as object, {
    dataProjection: projection,
    featureProjection: projection,
  }) as Feature<Geometry>[];

  for (const feature of features) {
    const idCase = resolveCaseLookupId(feature.getProperties() as Record<string, unknown>);

    if (idCase) {
      feature.setId(idCase);
    }
  }

  return features;
}

export function replaceCaseFeatures(
  source: VectorSource,
  collection: StableCaseFeatureCollection | null,
  projection: Projection,
): void {
  source.clear(true);

  if (!collection) {
    return;
  }

  source.addFeatures(readCaseFeatures(collection, projection));
}

export function syncCaseLayerVisibility(
  layer: VectorLayer | null,
  visible: boolean,
): void {
  if (!layer) {
    return;
  }

  layer.setVisible(visible);
  layer.changed();
}
