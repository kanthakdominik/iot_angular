import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';

import { IotData } from '../../models/iot-data.model';
import { Route } from '../../models/route.model';
import { MapService } from '../../services/map.service';
import { RadiationLevelService } from '../../services/radiation-level.service';
import { RouteService } from '../../services/route.service';

@Component({
  selector: 'app-route-map',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './route-map.component.html',
  styleUrls: ['./route-map.component.scss']
})
export class RouteMapComponent implements OnInit, OnDestroy {
  @ViewChild('mapRef') mapRef!: ElementRef;

  routeId!: number;
  routeName = '';
  routeData: IotData[] = [];
  loading = false;
  error = '';
  readonly legendItems = RadiationLevelService.legendItems;

  private readonly MAX_ATTEMPTS = 5;
  private initAttempts = 0;

  constructor(
    private route: ActivatedRoute,
    private routeService: RouteService,
    private mapService: MapService
  ) { }

  ngOnInit(): void {
    this.initializeRoute();
  }

  ngOnDestroy(): void {
    this.mapService.destroy();
  }

  refreshMap(): void {
    this.resetMapState();
    this.loadRouteData();
  }

  tryInitMap(): void {
    if (this.hasReachedMaxAttempts()) return;
    if (!this.isMapElementReady()) return;

    this.initializeMap();
  }

  private initializeRoute(): void {
    this.routeId = Number(this.route.snapshot.paramMap.get('id'));
    if (this.routeId) {
      this.loadRouteDetails();
    }
  }

  private resetMapState(): void {
    this.error = '';
    this.initAttempts = 0;
    this.mapService.destroy();
  }

  private hasReachedMaxAttempts(): boolean {
    if (this.initAttempts >= this.MAX_ATTEMPTS) {
      this.error = 'Failed to initialize map after multiple attempts';
      return true;
    }
    return false;
  }

  private isMapElementReady(): boolean {
    if (!this.mapRef?.nativeElement?.offsetHeight) {
      this.initAttempts++;
      setTimeout(() => this.tryInitMap(), 100);
      return false;
    }
    return true;
  }

  private initializeMap(): void {
    try {
      this.error = '';
      this.mapService.initMap(this.mapRef.nativeElement);
      if (this.routeData.length > 0) {
        this.updateMap();
      }
    } catch (error) {
      this.handleMapError(error);
    }
  }

  private updateMap(): void {
    this.mapService.updateMapWithData(this.routeData, (pointId: number) => {
      if (confirm('Are you sure you want to delete this point?')) {
        this.deleteDataPoint(pointId);
      }
    });
  }

  private loadRouteDetails(): void {
    this.loading = true;
    this.routeService.getRoute(this.routeId).subscribe({
      next: (route: Route) => {
        this.routeName = route.name;
        this.loadRouteData();
      },
      error: (error: Error) => {
        this.handleError('Failed to load route details', error);
      }
    });
  }

  private loadRouteData(): void {
    this.routeService.getRouteData(this.routeId).subscribe({
      next: (data: IotData[]) => {
        this.handleRouteDataSuccess(data);
      },
      error: (error: Error) => {
        this.handleError('Failed to load route data', error);
      }
    });
  }

  private handleRouteDataSuccess(data: IotData[]): void {
    this.routeData = data;
    this.loading = false;
    this.initAttempts = 0;
    setTimeout(() => this.tryInitMap(), 300);
  }

  private handleError(message: string, error: Error): void {
    this.error = message;
    this.loading = false;
    console.error(`${message}:`, error);
  }

  private handleMapError(error: unknown): void {
    console.error('Error initializing map:', error);
    this.error = 'Failed to initialize map';
  }

  deleteDataPoint(pointId: number): void {
    if (confirm('Are you sure you want to delete this point?')) {
      this.loading = true;
      this.routeService.deleteIotDataPoint(this.routeId, pointId).subscribe({
        next: () => {
          this.routeData = this.routeData.filter(point => point.id !== pointId);
          this.refreshMap();
          this.loading = false;
        },
        error: (error: Error) => {
          this.handleError('Failed to delete point', error);
        }
      });
    }
  }
}