import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, booleanAttribute, effect, inject, input,
  output, signal, untracked, viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { MarkerDto, MeasurementDto, hasPosition } from '../../../core/api/routes.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { HeatLayer, HeatPoint } from '../../../shared/map/heat-layer';
import { AppMap, MapFactory } from '../../../shared/map/map-factory';
import { TrackRenderer } from '../../../shared/map/track-renderer';
import { listChange } from './route-stats';

export interface MapPosition {
  readonly lat: number;
  readonly lon: number;
}

function heatPoints(measurements: readonly MeasurementDto[]): HeatPoint[] {
  return measurements.filter(hasPosition).map(m => [m.latitude, m.longitude, m.usvPerHour] as const);
}

/**
 * The route map: dose-coloured track (TrackRenderer), heat map overlay, markers, legend, layer switcher, full screen.
 * Live samples appended to `measurements` are drawn incrementally. Reports hover / click as sample indices
 * (indices of the full measurements array, the same as the chart's).
 */
@Component({
  selector: 'app-route-map-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.aria-busy]': '!ready()',
  },
  template: `<div #map class="map" role="region" [attr.aria-label]="ariaLabel()"></div>`,
  styles: `
    :host {
      display: block;
      position: relative;
      min-height: 240px;
    }

    .map {
      position: absolute;
      inset: 0;
    }

    :host ::ng-deep .app-route-marker {
      display: grid;
      place-items: center;
      border-radius: 50% 50% 50% 4px;
      transform: rotate(-45deg);
      background: var(--mat-sys-inverse-surface);
      color: var(--mat-sys-inverse-on-surface);
      border: 2px solid var(--mat-sys-surface);
      box-shadow: var(--mat-sys-level1);

      span {
        transform: rotate(45deg);
        font-size: 15px;
      }

      &.active {
        background: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);
      }
    }
  `,
})
export class RouteMapPanel {
  private readonly maps = inject(MapFactory);
  private readonly i18n = inject(I18nService);
  private readonly mapElement = viewChild.required<ElementRef<HTMLElement>>('map');

  readonly measurements = input<readonly MeasurementDto[]>([]);
  readonly markers = input<readonly MarkerDto[]>([]);
  /** Live route: pulsing head at the last sample. */
  readonly live = input(false, { transform: booleanAttribute });
  /** Highlighted sample index (hover / selection / playback). */
  readonly cursor = input<number | null>(null);
  readonly activeMarkerId = input<number | null>(null);
  /** Element shown in full screen (e.g. map + playback bar); default: the map. */
  readonly fullscreenTarget = input<HTMLElement | undefined>(undefined);
  /** Right click / long press reports a position for a new marker. */
  readonly editable = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input('');

  readonly hoverIndex = output<number | null>();
  readonly selectIndex = output<number>();
  readonly markerSelect = output<MarkerDto>();
  readonly addMarkerAt = output<MapPosition>();

  protected readonly ready = signal(false);
  private appMap?: AppMap;
  private track?: TrackRenderer;
  private heat?: HeatLayer;
  private readonly markerLayer = L.layerGroup();
  private readonly markerRefs = new Map<number, L.Marker>();
  private drawn: readonly MeasurementDto[] = [];
  private fitted = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const appMap = this.maps.create(this.mapElement().nativeElement, {
        legend: 'vertical',
        legendNoFix: true,
        fullscreenTarget: this.fullscreenTarget(),
        overlays: {},
      });
      this.appMap = appMap;
      this.heat = new HeatLayer([], { radius: 22 });
      appMap.layers?.addOverlay(this.heat, this.i18n.t('map.heatmap'));
      appMap.layers?.addOverlay(this.markerLayer, this.i18n.t('routes.detail.markers'));
      this.markerLayer.addTo(appMap.map);
      this.track = new TrackRenderer(appMap.map, { live: this.live() });
      this.track.onHover(index => this.hoverIndex.emit(index));
      appMap.map.on('click', event => {
        const index = this.track?.nearestIndex((event as L.LeafletMouseEvent).latlng) ?? null;
        if (index !== null) {
          this.selectIndex.emit(index);
        }
      });
      appMap.map.on('contextmenu', event => {
        if (this.editable()) {
          const { lat, lng } = (event as L.LeafletMouseEvent).latlng;
          this.addMarkerAt.emit({ lat, lon: lng });
        }
      });
      this.ready.set(true);
    });
    destroyRef.onDestroy(() => {
      this.track?.destroy();
      this.appMap?.destroy();
    });

    effect(() => {
      const list = this.measurements();
      if (!this.ready()) {
        return;
      }
      untracked(() => this.draw(list));
    });
    effect(() => {
      const live = this.live();
      if (this.ready()) {
        this.track?.setLive(live);
      }
    });
    effect(() => {
      const index = this.cursor();
      if (this.ready()) {
        this.track?.highlight(index);
      }
    });
    effect(() => {
      const markers = this.markers();
      const active = this.activeMarkerId();
      if (this.ready()) {
        untracked(() => this.drawMarkers(markers, active));
      }
    });
  }

  /** Pans to a sample (when outside the view) and highlights it. */
  panToIndex(index: number): void {
    this.track?.highlight(index, true);
  }

  /** Centres the map on a marker and shows its label. */
  focusMarker(marker: MarkerDto): void {
    const ref = this.markerRefs.get(marker.id);
    if (ref && this.appMap) {
      this.appMap.map.setView(ref.getLatLng(), Math.max(this.appMap.map.getZoom(), 16));
      ref.openTooltip();
    }
  }

  /** Shows the whole track. */
  fitTrack(): void {
    this.track?.fitBounds();
  }

  private draw(list: readonly MeasurementDto[]): void {
    const track = this.track;
    if (!track) {
      return;
    }
    const change = listChange(this.drawn, list);
    if (change === 'append') {
      for (const m of list.slice(this.drawn.length)) {
        track.append(m);
      }
    } else if (change === 'replace') {
      track.setMeasurements(list);
    }
    this.drawn = list;
    if (change !== 'same') {
      this.heat?.setPoints(heatPoints(list));
    }
    if (!this.fitted && track.bounds()) {
      track.fitBounds({ animate: false });
      this.fitted = true;
    }
  }

  private drawMarkers(markers: readonly MarkerDto[], activeId: number | null): void {
    this.markerLayer.clearLayers();
    this.markerRefs.clear();
    for (const marker of markers) {
      if (marker.latitude === null || marker.longitude === null) {
        continue;
      }
      const icon = L.divIcon({
        className: `app-route-marker${marker.id === activeId ? ' active' : ''}`,
        html: `<span class="material-symbols-rounded" aria-hidden="true">${marker.source === 'device' ? 'memory' : 'flag'}</span>`,
        iconSize: [28, 28],
        iconAnchor: [3, 27],
      });
      const label = document.createElement('span');
      label.textContent = marker.label;
      const ref = L.marker([marker.latitude, marker.longitude], {
        icon,
        title: marker.label,
        alt: marker.label,
        keyboard: true,
        zIndexOffset: marker.id === activeId ? 1200 : 800,
      })
        .bindTooltip(label, { direction: 'top', offset: [12, -28] })
        .on('click', () => this.markerSelect.emit(marker))
        .addTo(this.markerLayer);
      this.markerRefs.set(marker.id, ref);
    }
  }
}
