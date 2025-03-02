import { Routes } from '@angular/router';
import { RouteListComponent } from './components/route-list/route-list.component';
import { RouteDetailComponent } from './components/route-detail/route-detail.component';

export const routes: Routes = [
  { path: '', redirectTo: 'routes', pathMatch: 'full' },
  { path: 'routes', component: RouteListComponent },
  { path: 'routes/:id', component: RouteDetailComponent }
];