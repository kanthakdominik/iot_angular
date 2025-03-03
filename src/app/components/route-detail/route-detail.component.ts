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
import { EditRouteNameModalComponent } from '../edit-route-name-modal/edit-route-name-modal.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-route-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, EditRouteNameModalComponent],
  templateUrl: './route-detail.component.html',
  styleUrls: ['./route-detail.component.scss']
})
export class RouteDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapRef') mapRef!: ElementRef;

  routeId!: number;
  routeName = 'Route Details';
  routeData: IotData[] = [];
  showEditModal = false;
  loading = false;
  error = '';

  readonly legendItems = RadiationLevelService.legendItems;
  private initAttempts = 0;
  private readonly MAX_ATTEMPTS = 5;

  constructor(
    private modalService: NgbModal,
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
      this.mapService.initMap(this.mapRef.nativeElement);
      if (this.routeData.length > 0) {
        this.updateMap();
      }
    } catch (error) {
      console.error('Error initializing map:', error);
      this.error = 'Failed to initialize map';
    }
  }

  editRouteName() {
    const modalRef = this.modalService.open(EditRouteNameModalComponent);
    modalRef.componentInstance.currentName = this.routeName;
    
    modalRef.result.then(
      (newName: string) => {
        this.routeName = newName;
        // Here you would typically call your service to update the route name
        // this.routeService.updateRouteName(this.routeId, newName).subscribe(...);
      },
      (reason) => {
        console.log('Modal dismissed');
      }
    );
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