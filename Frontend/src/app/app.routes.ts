import { Routes } from '@angular/router';
import { AIRCRAFT_MODULES } from './domain/nav/nav.catalog';

const modulePage = () =>
  import('./pages/aircraft/module.page').then((m) => m.ModulePage);

const pdPage = () =>
  import('./pages/aircraft/pd.page').then((m) => m.PdPage);

const apcPage = () =>
  import('./pages/aircraft/apc.page').then((m) => m.ApcPage);


const sourcePage = (slug: string) => {
  if (slug === 'pd') {
    return pdPage;
  }
  if (slug === 'apc') {
    return apcPage;
  }
  return modulePage;
};

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
      },
      loadComponent: modulePage,
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
        pdMode: grand.slug === 'pd' ? (item.slug === 'r.d.g' ? 'ingest' : 'view') : undefined,
        apcMode: grand.slug === 'apc' ? (item.slug === 'r.d.g' ? 'ingest' : 'view') : undefined,
      },
      loadComponent: sourcePage(grand.slug),
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
      {
        path: 'aircraft/:id/r.d.p/pd',
        redirectTo: 'aircraft/:id/r.d.p/plan-data/pd',
        pathMatch: 'full',
      },
      {
        path: 'aircraft/:id/r.d.p/wo',
        redirectTo: 'aircraft/:id/r.d.p/mro/wo',
        pathMatch: 'full',
      },
      {
        path: 'aircraft/:id/r.d.p/ri',
        redirectTo: 'aircraft/:id/r.d.p/mro/ri',
        pathMatch: 'full',
      },
      {
        path: 'aircraft/:id/r.d.p/sw',
        redirectTo: 'aircraft/:id/r.d.p/mro/sw',
        pathMatch: 'full',
      },
    ],
  },
];
