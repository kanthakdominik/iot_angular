import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { IotData } from '../../models/iot-data.model';
import { MapService } from '../../services/map.service';
import { RadiationLevelService } from '../../services/radiation-level.service';
import { RouteService } from '../../services/route.service'; // Change this import
import { EditRouteNameModalComponent } from '../edit-route-name-modal/edit-route-name-modal.component';
import { Route } from '../../models/route.model';

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
  private initAttempts = 0;
  private readonly MAX_ATTEMPTS = 5;

  constructor(
    private modalService: NgbModal,
    private route: ActivatedRoute,
    private routeService: RouteService,
    private mapService: MapService
  ) { }

  ngOnInit(): void {
    this.routeId = Number(this.route.snapshot.paramMap.get('id'));
    if (this.routeId) {
      this.loadRouteDetails();
    }
  }

  ngOnDestroy(): void {
    this.mapService.destroy();
  }

  public refreshMap(): void {
    this.error = '';
    this.initAttempts = 0;
    this.mapService.destroy();
    this.loadRouteData();
  }

  public tryInitMap(): void {
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
      this.error = '';
      this.mapService.initMap(this.mapRef.nativeElement);
      if (this.routeData.length > 0) {
        this.updateMap();
      }
    } catch (error) {
      console.error('Error initializing map:', error);
      this.error = 'Failed to initialize map';
    }
  }

  private updateMap(): void {
    this.mapService.updateMapWithData(this.routeData);
  }

  private loadRouteDetails(): void {
    this.loading = true;
    this.routeService.getRoute(this.routeId).subscribe({
      next: (route: Route) => {
        this.routeName = route.name;
        this.loadRouteData();
      },
      error: (err: any) => {
        this.error = 'Failed to load route details';
        this.loading = false;
        console.error('Error loading route details:', err);
      }
    });
  }

  private loadRouteData(): void {
    this.routeService.getRouteData(this.routeId).subscribe({
      next: (data) => {
        this.routeData = data;
        this.loading = false;
        this.initAttempts = 0;
        setTimeout(() => {
          this.tryInitMap();
        }, 300);
      },
      error: (err) => {
        this.error = 'Failed to load route data';
        this.loading = false;
        console.error('Error loading route data:', err);
      }
    });
  }
}