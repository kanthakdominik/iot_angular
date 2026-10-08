import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subscription, forkJoin } from 'rxjs';
import { Measurement } from '../../models/measurement.model';
import { Marker } from '../../models/marker.model';
import { Route } from '../../models/route.model';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ChartService } from '../../services/chart.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-route-chart',
  standalone: true,
  imports: [RouterModule, DatePipe],
  templateUrl: './route-chart.component.html',
  styleUrls: ['./route-chart.component.scss']
})
export class RouteChartComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartCanvasCpm', { static: true }) chartCanvasCpm!: ElementRef<HTMLCanvasElement>;

  route?: Route;
  markers: Marker[] = [];
  loading = false;
  error = '';
  isAdmin = false;
  routeId = 0;

  private measurements: Measurement[] = [];
  private subscriptions = new Subscription();

  constructor(
    private activatedRoute: ActivatedRoute,
    private apiService: ApiService,
    private authService: AuthService,
    private chartService: ChartService,
    private modalService: NgbModal
  ) { }

  get noFixCount(): number {
    return this.measurements.filter(m => !m.gpsFix).length;
  }

  get sampleCount(): number {
    return this.measurements.length;
  }

  ngOnInit(): void {
    this.routeId = Number(this.activatedRoute.snapshot.paramMap.get('id'));
    this.subscriptions.add(
      this.authService.isAdmin$.subscribe(isAdmin => {
        this.isAdmin = isAdmin;
        this.drawCharts();
      })
    );
  }

  ngAfterViewInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.chartService.destroy();
    this.subscriptions.unsubscribe();
  }

  load(): void {
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
        this.drawCharts();
      },
      error: () => {
        this.error = 'Failed to load route data';
        this.loading = false;
      }
    });
  }

  private drawCharts(): void {
    if (!this.chartCanvas || this.measurements.length === 0) {
      return;
    }
    const onClick = this.isAdmin ? (m: Measurement) => this.deleteDataPoint(m) : undefined;
    this.chartService.initRadiationChart(this.chartCanvas.nativeElement, this.measurements, onClick);
    this.chartService.initCpmChart(this.chartCanvasCpm.nativeElement, this.measurements, onClick);
  }

  private deleteDataPoint(m: Measurement): void {
    const modalRef = this.modalService.open(ConfirmDialogComponent, { centered: true, backdrop: 'static' });
    modalRef.componentInstance.title = 'Delete point';
    modalRef.componentInstance.message =
      `Delete the measurement from ${new Date(m.timestamp).toLocaleTimeString()} (${m.usvPerHour} µSv/h)?`;

    modalRef.closed.subscribe(confirmed => {
      if (!confirmed) {
        return;
      }
      this.apiService.deleteMeasurement(this.routeId, m.id).subscribe({
        next: () => {
          this.measurements = this.measurements.filter(x => x.id !== m.id);
          this.drawCharts();
        },
        error: () => this.error = 'Failed to delete point'
      });
    });
  }
}
