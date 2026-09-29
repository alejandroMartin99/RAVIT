import { Routes } from '@angular/router';
import { AIRCRAFT_MODULES } from './domain/nav/nav.catalog';

const placeholder = () =>
  import('./pages/_shared/placeholder/module.page').then((m) => m.ModulePage);

const pages = {
  landing: () => import('./pages/landing/landing.page').then((m) => m.LandingPage),
  aircraft: () => import('./pages/aircraft/aircraft.page').then((m) => m.AircraftPage),
  pd: () => import('./pages/rdg/source-ingestion/pd/pd.page').then((m) => m.PdPage),
  apc: () => import('./pages/rdg/source-ingestion/apc/apc.page').then((m) => m.ApcPage),
  placeholder,
};

const sourcePage = (slug: string) => {
  if (slug === 'pd') {
    return pages.pd;
  }
  if (slug === 'apc') {
    return pages.apc;
  }
  return pages.placeholder;
};

const aircraftModuleRoutes: Routes = AIRCRAFT_MODULES.flatMap((item) => [
  {
    path: `aircraft/:msn/${item.slug}`,
    data: { code: item.code, label: item.label, icon: item.icon, slug: item.slug },
    loadComponent: pages.placeholder,
  },
  ...(item.children ?? []).flatMap((child) => [
    {
      path: `aircraft/:msn/${item.slug}/${child.slug}`,
      data: {
        code: item.code,
        label: item.label,
        icon: item.icon,
        slug: item.slug,
        childLabel: child.label,
        childSlug: child.slug,
      },
      loadComponent: pages.placeholder,
    },
    ...(child.children ?? []).map((grand) => ({
      path: `aircraft/:msn/${item.slug}/${child.slug}/${grand.slug}`,
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
    loadComponent: () => import('./layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        data: { breadcrumb: 'Dashboard' },
        loadComponent: pages.landing,
      },
      {
        path: 'aircraft/:msn',
        loadComponent: pages.aircraft,
      },
      ...aircraftModuleRoutes,
      { path: 'aircraft/:msn/r.d.p/pd', redirectTo: 'aircraft/:msn/r.d.p/plan-data/pd', pathMatch: 'full' },
      { path: 'aircraft/:msn/r.d.p/wo', redirectTo: 'aircraft/:msn/r.d.p/mro/wo', pathMatch: 'full' },
      { path: 'aircraft/:msn/r.d.p/ri', redirectTo: 'aircraft/:msn/r.d.p/mro/ri', pathMatch: 'full' },
      { path: 'aircraft/:msn/r.d.p/sw', redirectTo: 'aircraft/:msn/r.d.p/mro/sw', pathMatch: 'full' },
    ],
  },
];
