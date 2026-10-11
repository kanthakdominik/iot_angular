import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { SearchService } from '../../services/search.service';
import { Route } from '../../models/route.model';
import { EditRouteModalComponent } from '../edit-route-modal/edit-route-modal.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { DevicePanelComponent } from '../device-panel/device-panel.component';

@Component({
  selector: 'app-route-list',
  standalone: true,
  imports: [RouterModule, DatePipe, DevicePanelComponent],
  templateUrl: './route-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./route-list.component.scss']
})
export class RouteListComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  private searchQuery = '';

  routes: Route[] = [];
  filteredRoutes: Route[] = [];
  loading = false;
  error = '';
  isAdmin = false;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private searchService: SearchService,
    private modalService: NgbModal
  ) { }

  ngOnInit(): void {
    this.loadRoutes();
    this.subscriptions.add(
      this.authService.isAdmin$.subscribe(isAdmin => this.isAdmin = isAdmin)
    );
    this.subscriptions.add(
      this.searchService.searchQuery$.subscribe(query => {
        this.searchQuery = query;
        this.applyFilter();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadRoutes(): void {
    this.loading = true;
    this.apiService.getRoutes().subscribe({
      next: routes => {
        this.routes = routes;
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load routes';
        this.loading = false;
      }
    });
  }

  /** After "New route" the device starts sending a new route - refresh the list shortly after. */
  onDeviceCommand(): void {
    setTimeout(() => this.loadRoutes(), 5000);
  }

  editRoute(route: Route): void {
    const modalRef = this.modalService.open(EditRouteModalComponent);
    modalRef.componentInstance.route = route;
    modalRef.result.then(
      (updated: Route) => {
        this.routes = this.routes.map(r => r.id === updated.id ? updated : r);
        this.applyFilter();
      },
      () => void 0
    );
  }

  deleteRoute(route: Route): void {
    const modalRef = this.modalService.open(ConfirmDialogComponent, { centered: true, backdrop: 'static' });
    modalRef.componentInstance.title = 'Delete route';
    modalRef.componentInstance.message =
      `Are you sure you want to delete route "${route.name}"? All ${route.sampleCount} measurements will be deleted.`;

    modalRef.closed.subscribe(confirmed => {
      if (!confirmed) {
        return;
      }
      this.apiService.deleteRoute(route.id).subscribe({
        next: () => {
          this.routes = this.routes.filter(r => r.id !== route.id);
          this.applyFilter();
        },
        error: () => this.error = 'Failed to delete route'
      });
    });
  }

  duration(route: Route): string {
    if (!route.startedAt || !route.endedAt) {
      return '';
    }
    const seconds = Math.round((Date.parse(route.endedAt) - Date.parse(route.startedAt)) / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h} h ${m} min` : `${m} min ${s} s`;
  }

  private applyFilter(): void {
    this.filteredRoutes = this.routes.filter(route => SearchService.matches(route, this.searchQuery));
  }
}
