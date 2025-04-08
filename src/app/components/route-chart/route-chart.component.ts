import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';

import { IotData } from '../../models/iot-data.model';
import { Route } from '../../models/route.model';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ChartService } from '../../services/chart.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';


@Component({
  selector: 'app-route-chart',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './route-chart.component.html',
  styleUrls: ['./route-chart.component.scss']
})
export class RouteChartComponent implements OnInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartCanvasCpm') chartCanvasCpm!: ElementRef<HTMLCanvasElement>;

  routeName = '';
  loading = false;
  error = '';
  isLoggedIn = false;

  private routeId!: number;
  private routeData: IotData[] = [];
  private subscriptions = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private authService: AuthService,
    private chartService: ChartService,
    private modalService: NgbModal
  ) { }

  ngOnInit(): void {
    this.initializeRouteId();
    this.subscriptions.add(
      this.authService.currentUser$.subscribe(user => {
        this.isLoggedIn = !!user;
        if (this.chartCanvas && this.routeData.length > 0) {
          this.initCharts();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.chartService.destroy();
    this.subscriptions.unsubscribe();
  }

  public refreshData(): void {
    this.loading = true;
    this.loadRouteData();
  }

  private initializeRouteId(): void {
    this.routeId = Number(this.route.snapshot.paramMap.get('id'));
    if (this.routeId) {
      this.loadRouteDetails();
    }
  }

  private loadRouteDetails(): void {
    this.loading = true;
    this.apiService.getRoute(this.routeId).subscribe({
      next: (route: Route) => {
        this.routeName = route.name;
        this.loadRouteData();
      },
      error: (err: any) => {
        this.handleError('Failed to load route details', err);
      }
    });
  }

  private loadRouteData(): void {
    this.apiService.getRouteData(this.routeId).subscribe({
      next: (data) => {
        this.routeData = data;
        this.loading = false;
        if (this.chartCanvas) {
          this.initCharts();
        }
      },
      error: (err) => {
        this.handleError('Failed to load route data', err);
      }
    });
  }

  private initCharts(): void {
    const deleteCallback = this.isLoggedIn 
      ? (pointId: number) => this.deleteDataPoint(pointId)
      : undefined;

    this.chartService.initRadiationChart(
      this.chartCanvas.nativeElement, 
      this.routeData,
      deleteCallback
    );
    
    this.chartService.initCpmChart(
      this.chartCanvasCpm.nativeElement, 
      this.routeData,
      deleteCallback
    );
  }
  
  private deleteDataPoint(pointId: number): void {
    if (!this.isLoggedIn) {
      return;
    }

    const modalRef = this.modalService.open(ConfirmDialogComponent, {
      centered: true,
      backdrop: 'static'
    });
    
    modalRef.componentInstance.title = 'Delete Point';
    modalRef.componentInstance.message = 'Are you sure you want to delete this point?';

    modalRef.closed.subscribe(result => {
      if (result) {
        this.loading = true;
        this.apiService.deleteIotDataPoint(this.routeId, pointId).subscribe({
          next: () => {
            this.routeData = this.routeData.filter(point => point.id !== pointId);
            this.initCharts();
            this.loading = false;
          },
          error: (error) => {
            this.handleError('Failed to delete point', error);
          }
        });
      }
    });
  }

  private handleError(message: string, error: any): void {
    this.error = message;
    this.loading = false;
    console.error(`${message}:`, error);
  }
}