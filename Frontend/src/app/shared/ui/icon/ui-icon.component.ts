import { Component, input } from '@angular/core';

export type UiIconName = 'view' | 'download' | 'delete' | 'plus' | 'check' | 'apply';

const PATHS: Record<UiIconName, string> = {
  view: 'M12 5.25c-4.9 0-8.25 5.4-9.36 7.13a.75.75 0 0 0 0 .74C3.75 14.85 7.1 20.25 12 20.25s8.25-5.4 9.36-7.13a.75.75 0 0 0 0-.74C20.25 9.15 16.9 5.25 12 5.25zm0 13.5c-3.86 0-6.74-4.05-7.8-5.75C5.26 11.3 8.14 7.25 12 7.25s6.74 4.05 7.8 5.75c-1.06 1.7-3.94 5.75-7.8 5.75zM12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5zm0 5.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
  download:
    'M12 3.25a.75.75 0 0 1 .75.75v9.19l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 1.06-1.06l2.72 2.72V4A.75.75 0 0 1 12 3.25zM5.75 18.5A.75.75 0 0 1 6.5 17.75h11a.75.75 0 0 1 0 1.5h-11a.75.75 0 0 1-.75-.75z',
  delete:
    'M9 3.75A1.75 1.75 0 0 1 10.75 2h2.5A1.75 1.75 0 0 1 15 3.75V5h4.25a.75.75 0 0 1 0 1.5H19v12.75A2.75 2.75 0 0 1 16.25 22h-8.5A2.75 2.75 0 0 1 5 19.25V6.5h-.25a.75.75 0 0 1 0-1.5H9V3.75zm1.5.25v1h3V4h-3zM6.5 6.5v12.75c0 .69.56 1.25 1.25 1.25h8.5c.69 0 1.25-.56 1.25-1.25V6.5h-11zM10 10a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5A.75.75 0 0 1 10 10zm4.75.75a.75.75 0 0 0-1.5 0v6.5a.75.75 0 0 0 1.5 0v-6.5z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  check: 'M9.2 16.2 4.8 11.8 6.2 10.4 9.2 13.4 17.8 4.8 19.2 6.2z',
  apply: 'M9.2 16.2 4.8 11.8 6.2 10.4 9.2 13.4 17.8 4.8 19.2 6.2z',
};

@Component({
  selector: 'app-ui-icon',
  standalone: true,
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" [attr.d]="path" />
    </svg>
  `,
  styles: `
    :host { display: grid; place-items: center; }
    svg { width: 1.35rem; height: 1.35rem; }
  `,
})
export class UiIconComponent {
  readonly name = input.required<UiIconName>();
  get path(): string {
    return PATHS[this.name()];
  }
}
