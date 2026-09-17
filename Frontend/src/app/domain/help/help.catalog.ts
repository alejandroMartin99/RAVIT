import { HelpGuide } from './help.model';

const FALLBACK: HelpGuide = {
  title: 'About this tab',
  summary: 'This block is not built yet. When it opens, this panel will describe what the tab does, using the same layout on every page.',
  sections: [
    {
      heading: 'This tab',
      body: 'Content comes next. Help always uses this format so every module reads the same way.',
    },
  ],
};

export const HELP_GUIDES: Record<string, HelpGuide> = {
  'pd-ingest': {
    title: 'Program Directive · ingest',
    summary:
      'Upload a PD Excel for this aircraft. The file is validated step by step in the backend. Every attempt stays in history. The last successful issue becomes current.',
    sections: [
      {
        heading: 'This tab',
        body: 'Source ingestion for Program Directive. Production (R.D.P. Plan data) shows the issue after a successful upload.',
      },
      {
        heading: 'What you can do',
        items: [
          'Upload the next issue as .xlsx or .xlsm (max 10 MB).',
          'Download the original file of any attempt.',
          'Open a successful issue in R.D.P. Plan data.',
          'Delete an attempt from history. A successful delete also removes that issue from the aircraft PD folder.',
        ],
      },
      {
        heading: 'Checks',
        items: [
          'Source file received and size limit.',
          'Excel workbook format (.xlsx / .xlsm) and the workbook can be opened.',
          'Last column is named Issue XX (or Issue 01, Issue 02…).',
          'A version column XX.00 exists for that issue number.',
          'Required columns are present.',
          'Required cells are not empty.',
          'Column formats are valid (item ref, reference, revision, ATA, type, hours, flags).',
          'Applicability flags Y / OUT are sequential (no Y after OUT).',
          'ITEM REF is unique. REFERENCE + REVISION is unique.',
          'The issue is stored in the aircraft PD folder.',
        ],
      },
      {
        heading: 'Columns',
        items: [
          'ITEM REF, REFERENCE, REVISION, ATA, DESCRIPTION, TYPE, SOURCE MATERIAL, SOURCE HOURS, FIN / POSITION, PN, SN.',
          'Version columns NN.NN with Y or OUT. The last column must be Issue XX.',
          'Issue N only requires NN.00 for that issue. Extra versions come from the file; they are not invented.',
        ],
      },
      {
        heading: 'Storage',
        items: [
          'Each aircraft has its own PD folder: data/fleet/{MSN}/pd/.',
          'Successful issues are stored as issueNN.json next to the original Excel.',
          'Every upload is kept under uploads/ and listed in history.json, including failures.',
        ],
      },
    ],
  },
  'pd-view': {
    title: 'Program Directive · production',
    summary:
      'This is the live PD for the selected aircraft. It always shows one issue at a time. The current issue is the last successful ingest.',
    sections: [
      {
        heading: 'This tab',
        body: 'R.D.P. Plan data. Upload and history live in R.D.G. Source ingestion · Program Directive.',
      },
      {
        heading: 'What you can do',
        items: [
          'Read the current issue, including applicability flags per version.',
          'Switch to a previous successful issue from the issue picker.',
          'Go to Source ingestion if no PD has been loaded yet.',
        ],
      },
      {
        heading: 'Columns',
        items: [
          'Item ref, Reference, Revision, ATA, Description, Type, Source material, Source hours, FIN / Position, PN, SN.',
          'One flag column per version found in that issue (Y or OUT).',
        ],
      },
      {
        heading: 'Storage',
        items: [
          'Data is read from this aircraft only: data/fleet/{MSN}/pd/.',
          'PD is not shared across the fleet. Each MSN keeps its own issues.',
        ],
      },
    ],
  },
  'apc-ingest': {
    title: 'APC · ingest',
    summary:
      'APC is fleet-common. Upload a new file into the air-force library, or assign an existing version to this aircraft. The aircraft itself always holds a single assigned APC.',
    sections: [
      {
        heading: 'This tab',
        body: 'Source ingestion for APC. R.D.P. Plan data shows only the version assigned to this aircraft.',
      },
      {
        heading: 'What you can do',
        items: [
          'Upload a new .xlsx / .xlsm. It is stored in the fleet library and assigned to this aircraft.',
          'Use on this aircraft: pick a successful version already in the library of the same air force (FAF, RAF, GAF, SAF).',
          'Download the original file from the library.',
          'Delete a version from the library. Aircraft that already use it keep their assigned copy.',
        ],
      },
      {
        heading: 'Checks',
        items: [
          'Source file received and size limit (10 MB).',
          'Excel workbook format and the workbook can be opened.',
          'Required columns are present: POSITION CODE, PNR, SNR.',
          'Required cells are not empty.',
          'Column formats are valid.',
          'Position codes are unique.',
          'The version is stored in the fleet library and assigned to this aircraft.',
        ],
      },
      {
        heading: 'Columns',
        items: ['Position code (unique, required).', 'PNR (required).', 'SNR (required).'],
      },
      {
        heading: 'Storage',
        items: [
          'Fleet library: data/common/apc/{nation}/ (shared by every aircraft of that air force).',
          'Aircraft copy: data/fleet/{MSN}/apc/current.json — one assigned version per aircraft.',
          'A French aircraft writes to FAF. Other FAF aircraft can assign that same version without uploading again.',
        ],
      },
    ],
  },
  'apc-view': {
    title: 'APC · production',
    summary:
      'Production always shows the single APC assigned to this aircraft, with its current version. It does not list the whole fleet library.',
    sections: [
      {
        heading: 'This tab',
        body: 'R.D.P. Plan data. Assign or upload from R.D.G. Source ingestion · APC.',
      },
      {
        heading: 'What you can do',
        items: [
          'Read Position code, PNR and SNR for the assigned version.',
          'See which version is current (01, 02…) and when it was uploaded.',
          'Go to Source ingestion to upload a new file or pick another fleet version.',
        ],
      },
      {
        heading: 'Columns',
        items: ['Position code.', 'PNR.', 'SNR.'],
      },
      {
        heading: 'Storage',
        items: [
          'Shown data comes from this aircraft folder: data/fleet/{MSN}/apc/.',
          'The library of versions stays in data/common/apc/{nation}/. Changing assignment does not delete other aircraft copies.',
        ],
      },
    ],
  },
};

export function helpGuide(topic: string): HelpGuide {
  return HELP_GUIDES[topic] ?? FALLBACK;
}
