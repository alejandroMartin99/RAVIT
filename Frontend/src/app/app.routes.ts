import { Routes } from '@angular/router';
import { AIRCRAFT_MODULES } from './domain/nav/nav.catalog';

const modulePage = () =>
  import('./pages/aircraft/module.page').then((m) => m.ModulePage);

const aircraftModuleRoutes: Routes = AIRCRAFT_MODULES.flatMap((item) => [
  {
    path: `aircraft/:id/${item.slug}`,
    data: {
      code: item.code,
      label: item.label,
      icon: item.icon,
      slug: item.slug,
    },
    loadComponent: modulePage,
  },
  ...(item.children ?? []).map((child) => ({
    path: `aircraft/:id/${item.slug}/${child.slug}`,
    data: {
      code: item.code,
      label: item.label,
      icon: item.icon,
      slug: item.slug,
      childLabel: child.label,
      childSlug: child.slug,
    },
    loadComponent: modulePage,
  })),
]);

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        data: { breadcrumb: 'Dashboard' },
        loadComponent: () =>
          import('./pages/landing/landing.page').then((m) => m.LandingPage),
      },
      {
        path: 'aircraft/:id',
        loadComponent: () =>
          import('./pages/aircraft/aircraft.page').then((m) => m.AircraftPage),
      },
      ...aircraftModuleRoutes,
    ],
  },
];
