import { Component, input } from '@angular/core';

export type UiButtonVariant = 'primary' | 'ghost';

@Component({
  selector: 'app-ui-button',
  standalone: true,
  template: `
    <button [type]="type()" [disabled]="disabled()" [class]="variant()">
      <ng-content />
    </button>
  `,
  styleUrl: './ui-button.component.scss',
})
export class UiButtonComponent {
  readonly variant = input<UiButtonVariant>('primary');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
}
