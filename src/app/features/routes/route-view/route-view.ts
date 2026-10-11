import {
  ChangeDetectionStrategy, Component, booleanAttribute, computed, effect, inject, input, output, signal, untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { MarkerCreate, MarkerDto, MeasurementDto, RouteDto, hasPosition } from '../../../core/api/routes.models';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { DateTimePipe } from '../../../core/units/date-time.pipe';
import { DistancePipe } from '../../../core/units/distance.pipe';
import { DosePipe } from '../../../core/units/dose.pipe';
import { DurationPipe } from '../../../core/units/duration.pipe';
import { NumberPipe } from '../../../core/units/number.pipe';
import { LayoutMode } from '../../../layout/layout-mode';
import { DoseReadout } from '../../../shared/dose-readout/dose-readout';
import { EmptyState } from '../../../shared/empty-state/empty-state';
import { StatTile } from '../../../shared/stat-tile/stat-tile';
import { DoseHistogram } from './dose-histogram';
import { HotspotList } from './hotspot-list';
import { MarkerList } from './marker-list';
import { PlaybackBar } from './playback-bar';
import { RouteChartPanel } from './route-chart-panel';
import { MapPosition, RouteMapPanel } from './route-map-panel';
import { computeRouteStats, statsFromDto } from './route-stats';
import { SampleInspector } from './sample-inspector';

/** Where the samples are: still loading, failed, or loaded. */
export type SamplesState = 'loading' | 'error' | 'ready';

/** A marker the user wants to add: at a sample or at a map position. */
export type MarkerRequest = Omit<MarkerCreate, 'label'>;

/**
 * The route view shared by `/routes/:id` and the public `/share/:token` page (UI.md §3): map with playback,
 * side panel (name, dose readouts, stat tiles, sample inspector), chart, hotspots, histogram and markers.
 * Purely presentational – the page loads data, handles mutations and projects its actions:
 * `[routeActions]` (buttons / menus next to the name) and `[routeStatus]` (chips under the name).
 */
@Component({
  selector: 'app-route-view',
  imports: [
    DateTimePipe, DistancePipe, DosePipe, DoseHistogram, DoseReadout, DurationPipe, EmptyState, HotspotList,
    MarkerList, MatButtonModule, MatIconModule, MatProgressBarModule, MatTabsModule, NumberPipe, PlaybackBar,
    RouteChartPanel, RouteMapPanel, RouterLink, SampleInspector, StatTile, TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './route-view.html',
  styleUrl: './route-view.scss',
  host: {
    '[class.handset]': 'handset()',
  },
})
export class RouteView {
  private readonly layout = inject(LayoutMode);

  readonly route = input.required<RouteDto>();
  readonly measurements = input<readonly MeasurementDto[]>([]);
  readonly samplesState = input<SamplesState>('loading');
  readonly markers = input<readonly MarkerDto[]>([]);
  /** Admin: add / delete markers and samples. */
  readonly editable = input(false, { transform: booleanAttribute });
  /** Recording right now: pulsing track head, live readout. */
  readonly live = input(false, { transform: booleanAttribute });
  /** Public share view: no links into the app. */
  readonly publicView = input(false, { transform: booleanAttribute });
  /** Marker to focus once the map is ready (`?marker=` from the command palette). */
  readonly focusMarkerId = input<number | null>(null);

  readonly addMarker = output<MarkerRequest>();
  readonly deleteMarker = output<MarkerDto>();
  readonly deleteSample = output<MeasurementDto>();
  readonly retry = output<void>();

  private readonly mapPanel = viewChild(RouteMapPanel);

  protected readonly handset = this.layout.isHandset;
  protected readonly hovered = signal<number | null>(null);
  protected readonly selected = signal<number | null>(null);
  protected readonly cursor = computed(() => this.hovered() ?? this.selected());
  protected readonly cursorSample = computed(() => {
    const index = this.cursor();
    return index === null ? null : this.measurements()[index] ?? null;
  });
  protected readonly pinned = computed(() => this.hovered() === null && this.selected() !== null);
  protected readonly activeMarkerId = signal<number | null>(null);

  protected readonly stats = computed(() => this.samplesState() === 'ready'
    ? computeRouteStats(this.measurements())
    : statsFromDto(this.route()));
  protected readonly loadingStats = computed(() => this.samplesState() === 'loading' && this.route().sampleCount > 0
    && this.route().maxUsv === null);
  protected readonly noFixCount = computed(() => this.stats().samples - this.stats().fixCount);
  protected readonly durationMs = computed(() => {
    const { startedAt, endedAt } = this.stats();
    return startedAt !== null && endedAt !== null ? endedAt - startedAt : null;
  });
  protected readonly hasSamples = computed(() => this.measurements().length > 0);
  protected readonly hasTrack = computed(() => this.measurements().some(hasPosition));

  constructor() {
    // a selected sample (list, playback) is brought into view
    effect(() => {
      const index = this.selected();
      const map = this.mapPanel();
      if (index !== null && map) {
        untracked(() => map.panToIndex(index));
      }
    });
    // indices shift when samples are replaced (deleted sample) – drop a selection that no longer exists
    effect(() => {
      const count = this.measurements().length;
      untracked(() => {
        const index = this.selected();
        if (index !== null && index >= count) {
          this.selected.set(null);
        }
      });
    });
    // `?marker=`: focus it once markers and map are there
    let focused: number | null = null;
    effect(() => {
      const id = this.focusMarkerId();
      const marker = this.markers().find(m => m.id === id);
      const map = this.mapPanel();
      if (marker && map && focused !== marker.id && this.samplesState() === 'ready') {
        focused = marker.id;
        untracked(() => {
          this.activeMarkerId.set(marker.id);
          // after the track has been fitted
          setTimeout(() => map.focusMarker(marker));
        });
      }
    });
  }

  protected selectSample(index: number): void {
    this.selected.set(index);
  }

  protected selectMarker(marker: MarkerDto): void {
    this.activeMarkerId.set(marker.id);
    this.mapPanel()?.focusMarker(marker);
  }

  protected requestMarkerAtSample(m: MeasurementDto): void {
    this.addMarker.emit({
      timestamp: m.timestamp,
      ...(hasPosition(m) ? { latitude: m.latitude, longitude: m.longitude } : {}),
    });
  }

  protected requestMarkerAt(position: MapPosition): void {
    const index = this.cursor();
    const sample = index === null ? undefined : this.measurements()[index];
    this.addMarker.emit({
      latitude: position.lat,
      longitude: position.lon,
      ...(sample ? { timestamp: sample.timestamp } : {}),
    });
  }

  protected requestDeleteSample(m: MeasurementDto): void {
    this.deleteSample.emit(m);
  }

  /** Called by the page after a sample was deleted. */
  clearSelection(): void {
    this.selected.set(null);
    this.hovered.set(null);
  }
}
