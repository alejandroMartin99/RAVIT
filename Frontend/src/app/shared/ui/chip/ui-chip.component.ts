import { Component, input } from '@angular/core';

@Component({
  selector: 'app-ui-chip',
  standalone: true,
  template: `
    <button type="button" class="chip" [class.is-on]="on()">
      <ng-content />
    </button>
  `,
  styles: `
    :host { display: inline-block; }
    .chip {
      min-height: 1.85rem;
      padding: 0.2rem 0.7rem;
      border: 1px solid var(--hairline);
      border-radius: 980px;
      background: transparent;
      color: var(--text-secondary);
      font: inherit;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .chip:hover {
      background: var(--fill);
      color: var(--text);
    }
    .chip.is-on {
      border-color: transparent;
      background: var(--accent-soft);
      color: var(--accent);
    }
  `,
})
export class UiChipComponent {
  readonly on = input(false);
}
