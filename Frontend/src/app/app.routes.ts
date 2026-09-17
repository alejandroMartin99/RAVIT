import { Routes } from '@angular/router';
import { AIRCRAFT_MODULES } from './domain/nav/nav.catalog';

const modulePage = () =>
  import('./pages/aircraft/module.page').then((m) => m.ModulePage);

const pdPage = () =>
  import('./pages/aircraft/pd.page').then((m) => m.PdPage);

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
  ...(item.children ?? []).flatMap((child) => [
    {
      path: `aircraft/:id/${item.slug}/${child.slug}`,
      data: {
        code: item.code,
        label: item.label,
        icon: item.icon,
        slug: item.slug,
        childLabel: child.label,
        childSlug: child.slug,
        pdMode: child.slug === 'pd' ? 'view' : undefined,
      },
      loadComponent: child.slug === 'pd' ? pdPage : modulePage,
    },
    ...(child.children ?? []).map((grand) => ({
      path: `aircraft/:id/${item.slug}/${child.slug}/${grand.slug}`,
      data: {
        code: item.code,
        label: item.label,
        icon: item.icon,
        slug: item.slug,
        childLabel: child.label,
        childSlug: child.slug,
        grandLabel: grand.label,
        grandSlug: grand.slug,
        pdMode: grand.slug === 'pd' ? 'ingest' : undefined,
      },
      loadComponent: grand.slug === 'pd' ? pdPage : modulePage,
    })),
  ]),
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
