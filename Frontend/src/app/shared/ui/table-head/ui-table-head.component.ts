import { Component, DestroyRef, ElementRef, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-ui-table-head',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './ui-table-head.component.html',
  styleUrl: './ui-table-head.component.scss',
})
export class UiTableHeadComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroy = inject(DestroyRef);
  private applyTimer: ReturnType<typeof setTimeout> | null = null;

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

  constructor() {
    this.destroy.onDestroy(() => this.clearTimer());
    effect(() => {
      if (!this.open()) {
        return;
      }
      queueMicrotask(() => this.placePanel());
    });
  }

  onQuery(value: string): void {
    this.query.set(value);
    this.clearTimer();
    this.applyTimer = setTimeout(() => this.applyQuery(), 1000);
  }

  onQueryEnter(): void {
    this.applyQuery();
  }

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

  private applyQuery(): void {
    this.clearTimer();
    const q = this.query().trim().toLowerCase();
    if (!q) {
      this.selected.set(null);
      return;
    }
    this.selected.set(this.options().filter((item) => item.toLowerCase().includes(q)));
  }

  private clearTimer(): void {
    if (this.applyTimer) {
      clearTimeout(this.applyTimer);
      this.applyTimer = null;
    }
  }

  private placePanel(): void {
    const funnel = this.host.nativeElement.querySelector('.funnel') as HTMLElement | null;
    if (!funnel) {
      return;
    }
    const box = funnel.getBoundingClientRect();
    const width = 216;
    let left = box.left;
    if (box.left + width > window.innerWidth - 8) {
      left = box.right - width;
    }
    this.host.nativeElement.style.setProperty('--funnel-x', `${Math.max(8, left)}px`);
    this.host.nativeElement.style.setProperty('--funnel-y', `${box.bottom + 6}px`);
  }
}
