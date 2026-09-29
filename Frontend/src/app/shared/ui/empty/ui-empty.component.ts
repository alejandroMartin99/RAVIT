import { Component, input } from '@angular/core';

@Component({
  selector: 'app-ui-empty',
  standalone: true,
  template: `
    <article class="empty">
      <p class="step">{{ kicker() }}</p>
      <h2>{{ title() }}</h2>
      <p class="hint">{{ hint() }}</p>
      <ng-content />
    </article>
  `,
  styles: `
    .empty {
      padding: 1.5rem;
      border: 1px solid var(--hairline);
      border-radius: var(--radius-lg);
      background: var(--surface);
    }
    .step {
      margin: 0;
      color: var(--text-secondary);
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h2 {
      margin: 0.3rem 0 0.65rem;
      font-size: 1.45rem;
      font-weight: 600;
      letter-spacing: -0.03em;
    }
    .hint {
      margin: 0 0 1.1rem;
      color: var(--text-secondary);
    }
  `,
})
export class UiEmptyComponent {
  readonly kicker = input('');
  readonly title = input('');
  readonly hint = input('');
}
