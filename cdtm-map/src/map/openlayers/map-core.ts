"use client";

import { defaults as defaultControls } from "ol/control/defaults";
import type BaseLayer from "ol/layer/Base";
import ImageLayer from "ol/layer/Image";
import Map from "ol/Map";
import { addProjection } from "ol/proj";
import Projection from "ol/proj/Projection";
import ImageStatic from "ol/source/ImageStatic";
import View from "ol/View";

import {
  CASES_EXTENT,
  MAP_BACKGROUND_PATH,
  MAP_EXTENT,
  MAP_FIT_PADDING,
  MAP_MAX_ZOOM,
  MAP_PROJECTION_CODE,
} from "@/map/config";

export const cdtmProjection = new Projection({
  code: MAP_PROJECTION_CODE,
  extent: MAP_EXTENT,
  units: "pixels",
});

addProjection(cdtmProjection);

export function createCdtmView() {
  return new View({
    projection: cdtmProjection,
    center: [1600, -2000],
    extent: MAP_EXTENT,
    maxZoom: MAP_MAX_ZOOM,
    showFullExtent: true,
  });
}

export function createCdtmBackgroundLayer() {
  return new ImageLayer({
    source: new ImageStatic({
      url: MAP_BACKGROUND_PATH,
      imageExtent: MAP_EXTENT,
      projection: cdtmProjection,
    }),
  });
}

export function createCdtmMap(target: HTMLElement, layers: BaseLayer[]) {
  return new Map({
    target,
    layers,
    controls: defaultControls({
      attribution: false,
      rotate: false,
    }),
    view: createCdtmView(),
  });
}

export function fitCdtmCasesExtent(map: Map, duration = 0) {
  map.getView().fit(CASES_EXTENT, {
    duration,
    padding: MAP_FIT_PADDING,
    maxZoom: MAP_MAX_ZOOM,
  });
}
