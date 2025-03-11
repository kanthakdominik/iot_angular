import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { RouteService } from '../../services/route.service';
import { Route } from '../../models/route.model';

@Component({
  selector: 'app-route-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './route-list.component.html',
  styleUrls: ['./route-list.component.scss']
})
export class RouteListComponent implements OnInit {
  routes: Route[] = [];
  loading = false;
  error = '';

  constructor(private routeService: RouteService) {}

  ngOnInit(): void {
    this.loadRoutes();
  }

  private loadRoutes(): void {
    this.loading = true;
    this.routeService.getAllRoutes().subscribe({
      next: (routes) => {
        this.routes = routes;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load routes';
        this.loading = false;
        console.error('Error loading routes:', err);
      }
    });
  }
}