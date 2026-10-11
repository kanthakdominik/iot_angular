import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/guards';

/**
 * Screens of V2.1-SPEC §6. Every page is lazy; `data.titleKey` is the translated title in the top bar and
 * `document.title` (pages may override it with `PageTitle.set()`). Route / query params bind to inputs.
 */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.page').then(m => m.LoginPage),
    data: { titleKey: 'auth.login.title' },
  },
  {
    path: 'share/:token',
    loadComponent: () => import('./features/share/share.page').then(m => m.SharePage),
    data: { titleKey: 'share.title' },
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then(m => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPage),
        data: { titleKey: 'nav.dashboard' },
      },
      {
        path: 'routes',
        loadComponent: () => import('./features/routes/route-list.page').then(m => m.RouteListPage),
        data: { titleKey: 'nav.routes' },
      },
      {
        // before routes/:id; ?ids=1,2,3
        path: 'routes/compare',
        loadComponent: () => import('./features/routes/route-compare.page').then(m => m.RouteComparePage),
        data: { titleKey: 'nav.compare' },
      },
      // v2.0 addresses
      { path: 'routes/:id/map', redirectTo: '/routes/:id' },
      { path: 'routes/:id/chart', redirectTo: '/routes/:id' },
      {
        path: 'routes/:id',
        loadComponent: () => import('./features/routes/route-detail.page').then(m => m.RouteDetailPage),
        data: { titleKey: 'nav.routeDetail' },
      },
      {
        path: 'map',
        loadComponent: () => import('./features/map/global-map.page').then(m => m.GlobalMapPage),
        data: { titleKey: 'nav.map' },
      },
      {
        path: 'devices',
        loadComponent: () => import('./features/devices/device-list.page').then(m => m.DeviceListPage),
        data: { titleKey: 'nav.devices' },
      },
      {
        path: 'devices/:id',
        loadComponent: () => import('./features/devices/device-detail.page').then(m => m.DeviceDetailPage),
        data: { titleKey: 'nav.deviceDetail' },
      },
      {
        path: 'alerts',
        loadComponent: () => import('./features/alerts/alerts.page').then(m => m.AlertsPage),
        data: { titleKey: 'nav.alerts' },
      },
      {
        path: 'events',
        loadComponent: () => import('./features/events/events.page').then(m => m.EventsPage),
        data: { titleKey: 'nav.events' },
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.page').then(m => m.SettingsPage),
        data: { titleKey: 'nav.settings' },
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
