import * as L from 'leaflet';
import { MAP_LAYER_KEYS, MapLayerKey } from '../../core/api/users.models';
import { TranslationKey } from '../../core/i18n/pl';

export interface BaseLayerDef {
  readonly url: string;
  readonly attribution: string;
  readonly maxZoom: number;
  readonly subdomains?: string;
  /** Light imagery dimmed in dark mode (CSS class `app-tiles-dimmable`). */
  readonly dimmable: boolean;
  readonly labelKey: TranslationKey;
}

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Base layers selectable in the preferences (`mapLayer`). Hosts must be allowed by the CSP `img-src`
 * (deploy/Caddyfile): *.tile.openstreetmap.org, server.arcgisonline.com, *.tile.opentopomap.org, *.basemaps.cartocdn.com.
 */
export const BASE_LAYERS: Readonly<Record<MapLayerKey, BaseLayerDef>> = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
    dimmable: true,
    labelKey: 'map.layers.osm',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 19,
    dimmable: false,
    labelKey: 'map.layers.satellite',
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: `Map data: ${OSM_ATTRIBUTION}, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> `
      + '(<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    maxZoom: 17,
    dimmable: true,
    labelKey: 'map.layers.topo',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`,
    maxZoom: 20,
    subdomains: 'abcd',
    dimmable: false,
    labelKey: 'map.layers.dark',
  },
};

/** New tile layer for a preference key. */
export function createBaseLayer(key: MapLayerKey): L.TileLayer {
  const def = BASE_LAYERS[key];
  return L.tileLayer(def.url, {
    maxZoom: def.maxZoom,
    attribution: def.attribution,
    subdomains: def.subdomains ?? 'abc',
    className: def.dimmable ? 'app-tiles-dimmable' : '',
  });
}

/** All base layers, keyed by preference key, in the order of the preferences. */
export function createBaseLayers(): Record<MapLayerKey, L.TileLayer> {
  return Object.fromEntries(MAP_LAYER_KEYS.map(key => [key, createBaseLayer(key)])) as Record<MapLayerKey, L.TileLayer>;
}

let iconsFixed = false;

/**
 * Default marker icons are copied from node_modules/leaflet/dist/images to /leaflet (angular.json "assets");
 * Leaflet's own path detection does not work with bundled CSS.
 */
export function fixDefaultMarkerIcons(): void {
  if (!iconsFixed) {
    L.Icon.Default.imagePath = 'leaflet/';
    iconsFixed = true;
  }
}
