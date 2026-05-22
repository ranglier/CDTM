import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";

const defaultCaseStyle = new Style({
  fill: new Fill({
    color: "rgba(0, 0, 0, 0)",
  }),
  stroke: new Stroke({
    color: "rgba(14, 15, 18, 0.96)",
    width: 1.2,
  }),
});

const selectedCaseStyle = new Style({
  fill: new Fill({
    color: "rgba(94, 82, 57, 0.18)",
  }),
  stroke: new Stroke({
    color: "rgba(174, 150, 98, 0.9)",
    width: 1.9,
  }),
  zIndex: 8,
});

const activeCaseStyle = new Style({
  fill: new Fill({
    color: "rgba(33, 30, 26, 0.34)",
  }),
  stroke: new Stroke({
    color: "rgba(125, 109, 82, 0.96)",
    width: 2.2,
  }),
  zIndex: 10,
});

export function getCaseStyle(
  selectionState: "default" | "selected" | "active" = "default",
): Style {
  if (selectionState === "active") {
    return activeCaseStyle;
  }

  if (selectionState === "selected") {
    return selectedCaseStyle;
  }

  return defaultCaseStyle;
}
