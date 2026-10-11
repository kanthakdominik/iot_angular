import {
  ApplicationRef, ComponentRef, EnvironmentInjector, Injectable, createComponent, inject,
} from '@angular/core';
import * as L from 'leaflet';
import { MAP_LAYER_KEYS, MapLayerKey } from '../../core/api/users.models';
import { I18nService } from '../../core/i18n/i18n.service';
import { PrefsService } from '../../core/prefs/prefs.service';
import { DoseLegend } from '../dose-legend/dose-legend';
import { ElementControl, FullscreenControl } from './map-controls';
import { BASE_LAYERS, createBaseLayers, fixDefaultMarkerIcons } from './map-layers';

export interface AppMapOptions {
  /** Default: Poland. */
  readonly center?: L.LatLngExpression;
  readonly zoom?: number;
  /** Initial base layer; default: the `mapLayer` preference. */
  readonly layer?: MapLayerKey;
  /** Base layer switcher, top right (default true). */
  readonly layerSwitcher?: boolean;
  /** Overlays listed in the switcher, label -> layer (e.g. the heat map). */
  readonly overlays?: Readonly<Record<string, L.Layer>>;
  /** Full-screen button (default true); `fullscreenTarget` = element to show full screen (default: the map). */
  readonly fullscreen?: boolean;
  readonly fullscreenTarget?: HTMLElement;
  /** Dose legend control, bottom right (default false). */
  readonly legend?: false | 'vertical' | 'horizontal';
  /** Show the "no GPS" swatch in the legend. */
  readonly legendNoFix?: boolean;
  /** Extra Leaflet map options. */
  readonly mapOptions?: L.MapOptions;
}

export interface AppMap {
  readonly map: L.Map;
  /** Null when `layerSwitcher: false`. */
  readonly layers: L.Control.Layers | null;
  setBaseLayer(key: MapLayerKey): void;
  /** Removes the map, its controls and observers. Call from `DestroyRef.onDestroy`. */
  destroy(): void;
}

/**
 * Creates Leaflet maps in the app's style: canvas rendering, base layer from the preferences, translated zoom
 * buttons, layer switcher, full-screen button, optional dose legend, and `invalidateSize()` on container resize.
 *
 * ```ts
 * afterNextRender(() => {
 *   const appMap = this.maps.create(this.mapElement().nativeElement, { legend: 'vertical' });
 *   this.destroyRef.onDestroy(() => appMap.destroy());
 * });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class MapFactory {
  private readonly prefs = inject(PrefsService);
  private readonly i18n = inject(I18nService);
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);

  create(element: HTMLElement, options: AppMapOptions = {}): AppMap {
    fixDefaultMarkerIcons();
    const map = L.map(element, {
      zoomControl: false,
      preferCanvas: true,
      minZoom: 2,
      maxZoom: 20,
      worldCopyJump: true,
      ...options.mapOptions,
    }).setView(options.center ?? [52.0, 19.0], options.zoom ?? 6);

    L.control.zoom({
      position: 'topleft',
      zoomInTitle: this.i18n.t('map.zoomIn'),
      zoomOutTitle: this.i18n.t('map.zoomOut'),
    }).addTo(map);

    const baseLayers = createBaseLayers();
    let current: MapLayerKey = options.layer ?? this.prefs.prefs().mapLayer;
    baseLayers[current].addTo(map);
    map.on('baselayerchange', event => {
      const key = MAP_LAYER_KEYS.find(k => baseLayers[k] === (event as L.LayersControlEvent).layer);
      if (key) {
        current = key;
      }
    });

    let layers: L.Control.Layers | null = null;
    if (options.layerSwitcher !== false) {
      const labelled = Object.fromEntries(
        MAP_LAYER_KEYS.map(key => [this.i18n.t(BASE_LAYERS[key].labelKey), baseLayers[key]]));
      layers = L.control.layers(labelled, { ...options.overlays }, { position: 'topright' }).addTo(map);
    }

    if (options.fullscreen !== false) {
      new FullscreenControl({
        enter: this.i18n.t('map.fullscreen.enter'),
        exit: this.i18n.t('map.fullscreen.exit'),
      }, options.fullscreenTarget).addTo(map);
    }

    let legend: ComponentRef<DoseLegend> | null = null;
    if (options.legend) {
      legend = createComponent(DoseLegend, { environmentInjector: this.injector });
      legend.setInput('orientation', options.legend);
      legend.setInput('showNoFix', options.legendNoFix ?? false);
      this.appRef.attachView(legend.hostView);
      const container = L.DomUtil.create('div', 'app-map-legend');
      container.appendChild(legend.location.nativeElement as HTMLElement);
      new ElementControl(container, { position: 'bottomright' }).addTo(map);
    }

    const resizeObserver = new ResizeObserver(() => map.invalidateSize({ debounceMoveend: true }));
    resizeObserver.observe(element);

    return {
      map,
      layers,
      setBaseLayer: key => {
        if (key !== current) {
          map.removeLayer(baseLayers[current]);
          baseLayers[key].addTo(map);
          current = key;
        }
      },
      destroy: () => {
        resizeObserver.disconnect();
        legend?.destroy();
        map.remove();
      },
    };
  }
}
