import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { RouteService } from '../../services/route.service';
import { IotData } from '../../models/iot-data.model';

@Component({
  selector: 'app-route-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './route-detail.component.html',
  styleUrls: ['./route-detail.component.scss']
})
export class RouteDetailComponent implements OnInit {
  routeId!: number;
  routeData: IotData[] = [];
  loading = false;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private routeService: RouteService
  ) { }

  ngOnInit(): void {
    this.routeId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadRouteData();
  }

  private loadRouteData(): void {
    if (!this.routeId) return;

    this.loading = true;
    this.routeService.getRouteData(this.routeId).subscribe({
      next: (data) => {
        this.routeData = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load route data';
        this.loading = false;
        console.error('Error loading route data:', err);
      }
    });
  }
}