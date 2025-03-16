import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';

import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { SearchService } from '../../services/search.service';
import { Route } from '../../models/route.model';
import { EditRouteNameModalComponent } from '../edit-route-name-modal/edit-route-name-modal.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-route-list',
  standalone: true,
  imports: [CommonModule, RouterModule, NgbModule],
  templateUrl: './route-list.component.html',
  styleUrls: ['./route-list.component.scss']
})
export class RouteListComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  routes: Route[] = [];
  filteredRoutes: Route[] = [];
  loading = false;
  error = '';
  isLoggedIn = false;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private searchService: SearchService,
    private modalService: NgbModal
  ) { }

  ngOnInit(): void {
    this.loadRoutes();
    this.filteredRoutes = this.routes;
    this.authService.isLoggedIn$.subscribe(
      isLoggedIn => this.isLoggedIn = isLoggedIn
    );
    this.subscriptions.add(
      this.searchService.searchQuery$.subscribe(query => {
        this.filterRoutes(query);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  filterRoutes(searchQuery: string): void {
    if (!searchQuery.trim()) {
      this.filteredRoutes = this.routes;
      return;
    }

    this.filteredRoutes = this.routes.filter(route => 
      route.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  editRouteName(route: Route): void {
    if (!this.isLoggedIn) {
      return;
    }

    const modalRef = this.modalService.open(EditRouteNameModalComponent);
    modalRef.componentInstance.currentName = route.name;
    modalRef.componentInstance.routeId = route.id;

    modalRef.result.then(
      (newName: string) => this.updateRouteName(route, newName),
      () => void 0
    );
  }

  deleteRoute(route: Route): void {
    if (!this.isLoggedIn) {
      return;
    }

    const modalRef = this.modalService.open(ConfirmDialogComponent, {
      centered: true,
      backdrop: 'static'
    });
    
    modalRef.componentInstance.title = 'Delete Route';
    modalRef.componentInstance.message = `Are you sure you want to delete route "${route.name}"? This will also delete all associated data points.`;

    modalRef.closed.subscribe(result => {
      if (result) {
        this.loading = true;
        this.apiService.deleteRoute(route.id).subscribe({
          next: () => {
            this.routes = this.routes.filter(r => r.id !== route.id);
            this.loading = false;
          },
          error: (error: Error) => {
            this.error = 'Failed to delete route';
            this.loading = false;
            console.error('Error deleting route:', error);
          }
        });
      }
    });
  }

  private updateRouteName(route: Route, newName: string): void {
    route.name = newName;
  }

  private loadRoutes(): void {
    this.loading = true;
    this.apiService.getAllRoutes().subscribe({
      next: (routes: Route[]) => {
        this.routes = routes;
        this.filteredRoutes = routes;
        this.loading = false;
      },
      error: (error: Error) => {
        this.error = 'Failed to load routes';
        this.loading = false;
        console.error('Error loading routes:', error);
      }
    });
  }
}