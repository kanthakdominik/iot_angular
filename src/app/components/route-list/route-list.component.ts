import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { RouteService } from '../../services/route.service';
import { Route } from '../../models/route.model';
import { EditRouteNameModalComponent } from '../edit-route-name-modal/edit-route-name-modal.component';

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
    private routeService: RouteService,
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

  private updateRouteName(route: Route, newName: string): void {
    route.name = newName;
  }

  private loadRoutes(): void {
    this.loading = true;
    this.routeService.getAllRoutes().subscribe({
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