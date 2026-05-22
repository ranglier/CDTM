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
    color: "rgba(33, 30, 26, 0.34)",
  }),
  stroke: new Stroke({
    color: "rgba(125, 109, 82, 0.96)",
    width: 2.2,
  }),
  zIndex: 10,
});

export function getCaseStyle(isSelected = false): Style {
  return isSelected ? selectedCaseStyle : defaultCaseStyle;
}
