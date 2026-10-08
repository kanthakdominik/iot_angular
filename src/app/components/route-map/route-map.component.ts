import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subscription, forkJoin } from 'rxjs';
import { Measurement, hasPosition } from '../../models/measurement.model';
import { Marker } from '../../models/marker.model';
import { Route } from '../../models/route.model';
import { MapCallbacks, MapService } from '../../services/map.service';
import { RadiationLevelService } from '../../services/radiation-legend.service';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { TextInputModalComponent } from '../text-input-modal/text-input-modal.component';

@Component({
  selector: 'app-route-map',
  standalone: true,
  imports: [RouterModule, DatePipe, DecimalPipe],
  templateUrl: './route-map.component.html',
  styleUrls: ['./route-map.component.scss']
})
export class RouteMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapRef', { static: true }) mapRef!: ElementRef<HTMLElement>;

  route?: Route;
  measurements: Measurement[] = [];
  markers: Marker[] = [];
  loading = false;
  error = '';
  isAdmin = false;

  readonly legendItems = RadiationLevelService.legendItems;
  routeId = 0;
  private subscriptions = new Subscription();

  constructor(
    private activatedRoute: ActivatedRoute,
    private apiService: ApiService,
    private mapService: MapService,
    private modalService: NgbModal,
    private authService: AuthService
  ) { }

  get positionedCount(): number {
    return this.measurements.filter(hasPosition).length;
  }

  get maxUsv(): number {
    return this.measurements.reduce((max, m) => Math.max(max, m.usvPerHour), 0);
  }

  ngOnInit(): void {
    this.routeId = Number(this.activatedRoute.snapshot.paramMap.get('id'));
    this.subscriptions.add(
      this.authService.isAdmin$.subscribe(isAdmin => {
        this.isAdmin = isAdmin;
        this.redraw(false);
      })
    );
  }

  ngAfterViewInit(): void {
    this.mapService.initMap(this.mapRef.nativeElement);
    // the container gets its final size after layout
    setTimeout(() => this.mapService.invalidateSize(), 200);
    this.load(true);
  }

  ngOnDestroy(): void {
    this.mapService.destroy();
    this.subscriptions.unsubscribe();
  }

  load(fitBounds = false): void {
    this.loading = true;
    this.error = '';
    forkJoin({
      route: this.apiService.getRoute(this.routeId),
      measurements: this.apiService.getMeasurements(this.routeId),
      markers: this.apiService.getMarkers(this.routeId)
    }).subscribe({
      next: ({ route, measurements, markers }) => {
        this.route = route;
        this.measurements = measurements;
        this.markers = markers;
        this.loading = false;
        this.redraw(fitBounds);
      },
      error: () => {
        this.error = 'Failed to load route data';
        this.loading = false;
      }
    });
  }

  deleteMarker(marker: Marker): void {
    this.confirm('Delete marker', `Delete marker "${marker.label}"?`, () =>
      this.apiService.deleteMarker(this.routeId, marker.id).subscribe({
        next: () => {
          this.markers = this.markers.filter(m => m.id !== marker.id);
          this.redraw(false);
        },
        error: () => this.error = 'Failed to delete marker'
      }));
  }

  private redraw(fitBounds: boolean): void {
    if (!this.mapService.isMapInitialized()) {
      return;
    }
    const callbacks: MapCallbacks = this.isAdmin ? {
      onDeletePoint: m => this.deletePoint(m),
      onAddMarker: m => this.addMarkerAt(m),
      onDeleteMarker: marker => this.deleteMarker(marker)
    } : {};
    this.mapService.update(this.measurements, this.markers, callbacks, fitBounds);
  }

  private deletePoint(m: Measurement): void {
    this.confirm('Delete point', 'Are you sure you want to delete this measurement?', () =>
      this.apiService.deleteMeasurement(this.routeId, m.id).subscribe({
        next: () => {
          this.measurements = this.measurements.filter(x => x.id !== m.id);
          this.redraw(false);
        },
        error: () => this.error = 'Failed to delete point'
      }));
  }

  private addMarkerAt(m: Measurement): void {
    const modalRef = this.modalService.open(TextInputModalComponent);
    modalRef.componentInstance.title = 'Add marker';
    modalRef.componentInstance.label = 'Label (e.g. "Am-241 source")';
    modalRef.result.then(
      (label: string) => this.apiService.addMarker(this.routeId, {
        label,
        timestamp: m.timestamp,
        latitude: m.latitude ?? undefined,
        longitude: m.longitude ?? undefined
      }).subscribe({
        next: marker => {
          this.markers = [...this.markers, marker];
          this.redraw(false);
        },
        error: () => this.error = 'Failed to add marker'
      }),
      () => void 0
    );
  }

  private confirm(title: string, message: string, onConfirm: () => void): void {
    const modalRef = this.modalService.open(ConfirmDialogComponent, { centered: true, backdrop: 'static' });
    modalRef.componentInstance.title = title;
    modalRef.componentInstance.message = message;
    modalRef.closed.subscribe(confirmed => {
      if (confirmed) {
        onConfirm();
      }
    });
  }
}
