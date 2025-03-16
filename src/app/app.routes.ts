import { Routes } from '@angular/router';
import { RouteListComponent } from './components/route-list/route-list.component';
import { RouteMapComponent } from './components/route-map/route-map.component';
import { RouteChartComponent } from './components/route-chart/route-chart.component';
import { LoginComponent } from './components/login/login.component';

export const routes: Routes = [
  { path: '', redirectTo: 'routes', pathMatch: 'full' },
  { path: 'routes', component: RouteListComponent },
  { path: 'routes/:id/map', component: RouteMapComponent },
  { path: 'routes/:id/chart', component: RouteChartComponent },
  { path: 'login', component: LoginComponent }
];