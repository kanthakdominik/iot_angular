import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { ApiService } from '../../services/api.service';
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
export class RouteListComponent implements OnInit {
  routes: Route[] = [];
  loading = false;
  error = '';

  constructor(
    private apiService: ApiService,
    private modalService: NgbModal
  ) { }

  ngOnInit(): void {
    this.loadRoutes();
  }

  editRouteName(route: Route): void {
    const modalRef = this.modalService.open(EditRouteNameModalComponent);
    modalRef.componentInstance.currentName = route.name;
    modalRef.componentInstance.routeId = route.id;

    modalRef.result.then(
      (newName: string) => this.updateRouteName(route, newName),
      () => void 0
    );
  }

  deleteRoute(route: Route): void {
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