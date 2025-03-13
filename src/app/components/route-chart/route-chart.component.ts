import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IotData } from '../../models/iot-data.model';
import { RouteService } from '../../services/route.service';
import { Route } from '../../models/route.model';
import { Chart } from 'chart.js';
import 'chart.js/auto';

@Component({
  selector: 'app-route-chart',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './route-chart.component.html',
  styleUrls: ['./route-chart.component.scss']
})
export class RouteChartComponent implements OnInit {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  routeId!: number;
  routeName = '';
  routeData: IotData[] = [];
  loading = false;
  error = '';
  chart: Chart | undefined;

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

  private initChart(): void {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (ctx) {
      this.chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: this.routeData.map(d => new Date(d.timestamp).toLocaleTimeString()),
          datasets: [{
            label: 'Radiation Level (µSv/h)',
            data: this.routeData.map(d => d.usvPerHour),
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            tension: 0.1,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Radiation Level (µSv/h)'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Time'
              },
              ticks: {
                maxTicksLimit: 20,
                maxRotation: 45,
                autoSkip: true,
              }
            }
          }
        }
      });
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
        if (this.chartCanvas) {
          this.initChart();
        }
      },
      error: (err) => {
        this.error = 'Failed to load route data';
        this.loading = false;
        console.error('Error loading route data:', err);
      }
    });
  }
}