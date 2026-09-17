export interface AppModuleItem {
  id: string;
  label: string;
}

export interface SideNavChild {
  id: string;
  label: string;
  slug: string;
  icon: string;
  children?: SideNavChild[];
}

export interface SideNavItem {
  id: string;
  code: string;
  label: string;
  icon: string;
  requiresAircraft: boolean;
  slug?: string;
  description?: string;
  children?: SideNavChild[];
}

/** App switcher entries. Add more modules here as they appear. */
export const APP_MODULES: AppModuleItem[] = [{ id: 'ravit', label: 'RAVIT' }];

/** Left drawer. Aircraft modules stay disabled until an MSN is selected. */
export const SIDE_NAV: SideNavItem[] = [
  {
    id: 'dashboard',
    code: 'Dashboard',
    label: 'Events Fleet',
    icon: 'dashboard',
    requiresAircraft: false,
  },
  {
    id: 'rdg',
    code: 'R.D.G.',
    label: 'Reference Data Generation',
    icon: 'rdg',
    requiresAircraft: true,
    slug: 'r.d.g',
    description:
      'Build the aircraft reference dataset: ingest source files, map them to the A400M model, run quality checks and generate the event baseline.',
    children: [
      { id: 'rdg-ingest', label: 'Source ingestion', slug: 'source-ingestion', icon: 'ingest', children: [
          { id: 'rdg-ingest-apc', label: 'APC', slug: 'apc', icon: 'apc' },
          { id: 'rdg-ingest-pd', label: 'Program Directive (PD)', slug: 'pd', icon: 'pd' },
        ] },
      { id: 'rdg-map', label: 'Data mapping', slug: 'data-mapping', icon: 'mapping' },
      { id: 'rdg-quality', label: 'Quality checks', slug: 'quality-checks', icon: 'quality' },
      { id: 'rdg-generate', label: 'Dataset generation', slug: 'dataset-generation', icon: 'generate' },
    ],
  },
  {
    id: 'rdp',
    code: 'R.D.P.',
    label: 'Reference Data Production',
    icon: 'rdp',
    requiresAircraft: true,
    slug: 'r.d.p',
    description:
      'Turn approved reference data into production packages, control outputs and prepare delivery for the selected MSN.',
    children: [
      { id: 'rdp-plan', label: 'Plan data', slug: 'plan-data', icon: 'plan', children: [
          { id: 'rdp-plan-pd', label: 'Program Directive (PD)', slug: 'pd', icon: 'pd' },
          { id: 'rdp-plan-apc', label: 'APC', slug: 'apc', icon: 'apc' },
        ] },
      { id: 'rdp-mro', label: 'MRO', slug: 'mro', icon: 'mro', children: [
          { id: 'rdp-mro-wo', label: 'Work Order (WO)', slug: 'wo', icon: 'wo' },
          { id: 'rdp-mro-ri', label: 'Removals and Inspection', slug: 'ri', icon: 'ri' },
          { id: 'rdp-mro-sw', label: 'Software (SW)', slug: 'sw', icon: 'sw' },
        ] },
    ],
  },
  {
    id: 'ra',
    code: 'R.D.A.',
    label: 'Reference Data Application',
    icon: 'ra',
    requiresAircraft: true,
    slug: 'r.d.a',
    description:
      'Work with the live reference data application for this aircraft: consult, compare and apply the generated data in the event workspace.',
  },
];

export const AIRCRAFT_MODULES = SIDE_NAV.filter((item) => item.requiresAircraft);

export const PROGRAM_LABEL = 'A400M';
