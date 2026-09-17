export type NationCode = 'FAF' | 'RAF' | 'GAF' | 'SAF';
export type EventType = 'retrofit' | 'maintenance';
export type LoadType = 'as-is' | 'ac-exchange' | 'mds-for-mro';

export interface NationItem {
  code: NationCode;
  label: string;
  title: string;
}

export interface CatalogItem {
  code: string;
  label: string;
}

export interface Aircraft {
  id: string;
  msn: number;
  folder: string;
  nation: NationCode;
  chief: string;
  event_type: EventType;
  load_type: LoadType;
  hang_over: string;
  transfer_of_custody: string;
}

export interface AircraftCreate {
  msn: number;
  nation: NationCode;
  chief: string;
  event_type: EventType;
  load_type: LoadType;
  hang_over: string;
  transfer_of_custody: string;
}

export interface AircraftPatch {
  event_type?: EventType;
  load_type?: LoadType;
  hang_over?: string;
  transfer_of_custody?: string;
}

export interface FleetCatalog {
  nations: NationItem[];
  chiefs: string[];
  event_types: CatalogItem[];
  load_types: CatalogItem[];
}
