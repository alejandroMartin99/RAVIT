import { CatalogItem, FleetCatalog, NationItem } from './aircraft.model';

/** Local fallback. Runtime source of truth is GET /api/catalog/. */
export const FALLBACK_CATALOG: FleetCatalog = {
  nations: [
    { code: 'FAF', label: 'FAF', title: 'French Air Force' },
    { code: 'RAF', label: 'RAF', title: 'Royal Air Force' },
    { code: 'GAF', label: 'GAF', title: 'German Air Force' },
    { code: 'SAF', label: 'SAF', title: 'Spanish Air Force' },
  ],
  chiefs: [
    'Alejandro Martín Iglesias',
    'Marta Soler Campos',
    'James Hartley Cooper',
    'Lena Vogt Schneider',
  ],
  event_types: [
    { code: 'retrofit', label: 'Retrofit' },
    { code: 'maintenance', label: 'Maintenance' },
  ],
  load_types: [
    { code: 'as-is', label: 'AS-IS' },
    { code: 'ac-exchange', label: 'A/C Exchange' },
    { code: 'mds-for-mro', label: 'MDS for MRO' },
  ],
};

export function padMsn(msn: number): string {
  return msn.toString().padStart(3, '0');
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) {
    return iso;
  }
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function catalogLabel(items: CatalogItem[], code: string): string {
  return items.find((item) => item.code === code)?.label ?? code;
}

export function nationTitle(nations: NationItem[], code: string): string {
  return nations.find((item) => item.code === code)?.title ?? code;
}
