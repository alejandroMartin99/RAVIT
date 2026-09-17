export interface HelpSection {
  heading: string;
  body?: string;
  items?: string[];
}

export interface HelpGuide {
  title: string;
  summary: string;
  sections: HelpSection[];
}
