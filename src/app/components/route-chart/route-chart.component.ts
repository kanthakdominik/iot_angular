import { Component, OnInit } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { IotData } from '../../models/iot-data.model';
import { RouteService } from '../../services/route.service';
import { Route } from '../../models/route.model';

@Component({
  selector: 'app-route-chart',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './route-chart.component.html',
  styleUrls: ['./route-chart.component.scss']
})
export class RouteChartComponent implements OnInit {
  routeId!: number;
  routeName = '';
  routeData: IotData[] = [];
  loading = false;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private routeService: RouteService
  ) { }

  ngOnInit(): void {
    this.routeId = Number(this.route.snapshot.paramMap.get('id'));
    if (this.routeId) {
      this.loadRouteDetails();
    }
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
      },
      error: (err) => {
        this.error = 'Failed to load route data';
        this.loading = false;
        console.error('Error loading route data:', err);
      }
    });
  }
}