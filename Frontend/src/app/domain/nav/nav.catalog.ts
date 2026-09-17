export interface AppModuleItem {
  id: string;
  label: string;
}

export interface SideNavChild {
  id: string;
  label: string;
  slug: string;
  icon: string;
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
    slug: 'rdg',
    description:
      'Build the aircraft reference dataset: ingest source files, map them to the A400M model, run quality checks and generate the event baseline.',
    children: [
      { id: 'rdg-ingest', label: 'Source ingestion', slug: 'source-ingestion', icon: 'ingest' },
      { id: 'rdg-map', label: 'Data mapping', slug: 'data-mapping', icon: 'mapping' },
      { id: 'rdg-quality', label: 'Quality checks', slug: 'quality-checks', icon: 'quality' },
      { id: 'rdg-generate', label: 'Dataset generation', slug: 'dataset-generation', icon: 'generate' },
    ],
  },
  {
    id: 'rdp',
    code: 'RDP',
    label: 'Reference Data Production',
    icon: 'rdp',
    requiresAircraft: true,
    slug: 'rdp',
    description:
      'Turn approved reference data into production packages, control outputs and prepare delivery for the selected MSN.',
    children: [],
  },
  {
    id: 'ra',
    code: 'R.A.',
    label: 'Reference Application',
    icon: 'ra',
    requiresAircraft: true,
    slug: 'ra',
    description:
      'Work with the live reference application for this aircraft: consult, compare and apply the generated data in the event workspace.',
  },
];

export const AIRCRAFT_MODULES = SIDE_NAV.filter((item) => item.requiresAircraft);

export const PROGRAM_LABEL = 'A400M';
