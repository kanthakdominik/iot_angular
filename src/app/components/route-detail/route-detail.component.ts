import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { IotData } from '../../models/iot-data.model';
import { MapService } from '../../services/map.service';
import { RadiationLevelService } from '../../services/radiation-level.service';
import { RouteDataService } from '../../services/route-data.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-route-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './route-detail.component.html',
  styleUrls: ['./route-detail.component.scss']
})
export class RouteDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapRef') mapRef!: ElementRef;

  routeId!: number;
  routeData: IotData[] = [];
  loading = false;
  error = '';
  readonly legendItems = RadiationLevelService.legendItems;
  private initAttempts = 0;
  private readonly MAX_ATTEMPTS = 5;

  constructor(
    private route: ActivatedRoute,
    private routeDataService: RouteDataService,
    private mapService: MapService
  ) { }

  ngOnInit(): void {
    this.routeId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadRouteData();
  }

  ngAfterViewInit(): void {
    this.tryInitMap();
  }

  ngOnDestroy(): void {
    this.mapService.destroy();
  }

  private tryInitMap(): void {
    if (this.initAttempts >= this.MAX_ATTEMPTS) {
      this.error = 'Failed to initialize map after multiple attempts';
      return;
    }

    if (!this.mapRef?.nativeElement?.offsetHeight) {
      this.initAttempts++;
      setTimeout(() => this.tryInitMap(), 100);
      return;
    }

    try {
      this.mapService.initMap(this.mapRef.nativeElement);
      if (this.routeData.length > 0) {
        this.updateMap();
      }
    } catch (error) {
      console.error('Error initializing map:', error);
      this.error = 'Failed to initialize map';
    }
  }

  private loadRouteData(): void {
    if (!this.routeId) return;

    this.loading = true;
    this.routeDataService.getRouteData(this.routeId).subscribe({
      next: (data) => {
        this.routeData = data;
        this.loading = false;
        if (this.mapService.isMapInitialized()) {
          this.updateMap();
        }
      },
      error: (err) => {
        this.error = 'Failed to load route data';
        this.loading = false;
        console.error('Error loading route data:', err);
      }
    });
  }

  private updateMap(): void {
    this.mapService.updateMapWithData(this.routeData);
  }
}