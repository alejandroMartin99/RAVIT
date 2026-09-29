import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiIconComponent, UiIconName } from '../icon/ui-icon.component';

@Component({
  selector: 'app-ui-icon-act',
  standalone: true,
  imports: [RouterLink, UiIconComponent],
  template: `
    @if (off()) {
      <span class="act is-off" [class.is-sm]="size() === 'sm'" [attr.data-tip]="tip()" [attr.aria-label]="tip()">
        <app-ui-icon [name]="name()" />
      </span>
    } @else if (link()) {
      <a
        class="act"
        [class.is-sm]="size() === 'sm'"
        [class.is-danger]="danger()"
        [routerLink]="link()"
        [queryParams]="params()"
        [attr.data-tip]="tip()"
        [attr.aria-label]="tip()"
        (click)="act.emit($event)"
      >
        <app-ui-icon [name]="name()" />
      </a>
    } @else {
      <button
        type="button"
        class="act"
        [class.is-sm]="size() === 'sm'"
        [class.is-danger]="danger()"
        [attr.data-tip]="tip()"
        [attr.aria-label]="tip()"
        (click)="act.emit($event)"
      >
        <app-ui-icon [name]="name()" />
      </button>
    }
  `,
  styleUrl: './ui-icon-act.component.scss',
})
export class UiIconActComponent {
  readonly name = input.required<UiIconName>();
  readonly tip = input('');
  readonly off = input(false);
  readonly danger = input(false);
  readonly size = input<'sm' | 'md'>('md');
  readonly link = input<string[] | null>(null);
  readonly params = input<Record<string, string> | null>(null);
  readonly act = output<Event>();
}
