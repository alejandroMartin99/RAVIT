import { Component, computed, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-ui-table-head',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './ui-table-head.component.html',
  styleUrl: './ui-table-head.component.scss',
})
export class UiTableHeadComponent {
  readonly label = input.required<string>();
  readonly options = input<string[]>([]);
  readonly sortDir = input<'asc' | 'desc' | null>(null);
  readonly open = input(false);
  readonly selected = model<string[] | null>(null);

  readonly sorted = output<void>();
  readonly menuToggled = output<MouseEvent>();

  query = signal('');

  readonly visibleOptions = computed(() => {
    const q = this.query().trim().toLowerCase();
    const opts = this.options();
    return q ? opts.filter((item) => item.toLowerCase().includes(q)) : opts;
  });

  readonly filtered = computed(() => this.selected() !== null);

  isOn(value: string): boolean {
    const chosen = this.selected();
    return chosen === null || chosen.includes(value);
  }

  toggleValue(value: string, checked: boolean): void {
    const opts = this.options();
    const current = this.selected();
    const base = current === null ? [...opts] : [...current];
    const next = checked
      ? [...new Set([...base, value])]
      : base.filter((item) => item !== value);
    this.selected.set(next.length === opts.length ? null : next);
  }

  selectAll(): void {
    this.selected.set(null);
  }

  clear(): void {
    this.selected.set([]);
  }
}
