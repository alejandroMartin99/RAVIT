import { Component, input } from '@angular/core';

@Component({
  selector: 'app-ui-skel-table',
  standalone: true,
  template: `
    <div class="sheet is-skel" aria-busy="true" aria-live="polite">
      <table class="grid">
        <thead>
          <tr>
            @for (col of cols(); track col.id) {
              <th><span class="skel skel-head">{{ col.label }}</span></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows; track row; let r = $index) {
            <tr>
              @for (col of cols(); track col.id; let c = $index) {
                <td>
                  <span class="skel" [style.animation-delay]="r * 45 + c * 22 + 'ms'"></span>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styleUrl: './ui-skel-table.component.scss',
})
export class UiSkelTableComponent {
  readonly cols = input.required<{ id: string; label: string }[]>();
  readonly count = input(12);
  get rows(): number[] {
    return Array.from({ length: this.count() }, (_, i) => i);
  }
}
