import { NgClass, NgTemplateOutlet } from '@angular/common';
import { Component, HostListener, computed, contentChild, contentChildren, input, output, signal } from '@angular/core';
import { UiTableHeadComponent } from '../table-head/ui-table-head.component';
import { UiTableCellDirective } from './ui-table-cell.directive';
import { UiTableExpandDirective } from './ui-table-expand.directive';
import { UiTableColumn } from './ui-table.column';

@Component({
  selector: 'app-ui-table',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet, UiTableHeadComponent],
  templateUrl: './ui-table.component.html',
  styleUrl: './ui-table.component.scss',
  host: {
    '[class.is-fit]': 'fit() === "content"',
    '[class.is-card]': 'variant() === "card"',
  },
})
export class UiTableComponent<T = unknown> {
  readonly columns = input.required<UiTableColumn<T>[]>();
  readonly rows = input<T[]>([]);
  readonly search = input('');
  readonly empty = input('No rows match these filters.');
  readonly framed = input(true);
  readonly fit = input<'fill' | 'content'>('fill');
  readonly variant = input<'data' | 'card'>('data');
  readonly rowClickable = input(false);
  readonly initialSort = input<string | null>(null);
  readonly initialDir = input<'asc' | 'desc'>('asc');
  readonly trackBy = input<(row: T) => unknown>((row) => row);
  readonly rowClass = input<(row: T) => string | Record<string, boolean>>(() => '');
  readonly canExpand = input<(row: T) => boolean>(() => false);

  readonly rowClick = output<T>();

  private readonly cells = contentChildren(UiTableCellDirective);
  private readonly expand = contentChild(UiTableExpandDirective);
  readonly expanded = signal<unknown | null>(null);
  readonly sortKey = signal<string | null>(null);
  readonly sortDir = signal<'asc' | 'desc'>('asc');
  readonly openFilter = signal<string | null>(null);
  readonly clipKey = signal<string | null>(null);
  readonly filters = signal<Record<string, string[] | null>>({});
  private readonly clipLimit = 42;

  readonly visible = computed(() => {
    const cols = this.columns();
    const key = this.sortKey() ?? this.initialSort() ?? cols.find((col) => !col.action)?.id ?? '';
    const dir = (this.sortKey() ? this.sortDir() : this.initialDir()) === 'asc' ? 1 : -1;
    const filters = this.filters();
    const q = this.search().trim().toLowerCase();
    return this.rows()
      .filter((row) => !q || cols.some((col) => this.cellValue(col, row).toLowerCase().includes(q)))
      .filter((row) => cols.every((col) => col.action || this.passes(filters[col.id], this.cellValue(col, row))))
      .slice()
      .sort((a, b) => dir * this.sortValue(this.col(key), a).localeCompare(this.sortValue(this.col(key), b), undefined, { numeric: true }));
  });

  @HostListener('document:click', ['$event'])
  closeFilters(event: MouseEvent): void {
    const path = event.composedPath();
    if (!path.some((node) => node instanceof HTMLElement && node.tagName === 'APP-UI-TABLE-HEAD')) {
      this.openFilter.set(null);
    }
    if (!path.some((node) => node instanceof HTMLElement && node.classList.contains('clip'))) {
      this.clipKey.set(null);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.openFilter.set(null);
    this.clipKey.set(null);
  }

  templateFor(id: string) {
    return this.cells().find((cell) => cell.name() === id)?.tpl ?? null;
  }

  expandTpl() {
    return this.expand()?.tpl ?? null;
  }

  colCount(): number {
    return this.columns().length + (this.expandTpl() ? 1 : 0);
  }

  expandable(row: T): boolean {
    return !!this.expandTpl() && this.canExpand()(row);
  }

  isOpen(row: T): boolean {
    return this.expanded() === this.trackOf(row);
  }

  toggleExpand(event: Event, row: T): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.expandable(row)) {
      return;
    }
    const key = this.trackOf(row);
    this.expanded.update((cur) => (cur === key ? null : key));
  }

  onRowClick(event: MouseEvent, row: T): void {
    if ((event.target as HTMLElement).closest('a, button, .acts')) {
      return;
    }
    if (this.expandable(row)) {
      this.toggleExpand(event, row);
      return;
    }
    if (this.rowClickable()) {
      this.rowClick.emit(row);
    }
  }

  options(col: UiTableColumn<T>): string[] {
    return [...new Set(this.rows().map((row) => this.cellValue(col, row)).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
  }

  sortDirOf(col: UiTableColumn<T>): 'asc' | 'desc' | null {
    const key = this.sortKey() ?? this.initialSort();
    const dir = this.sortKey() ? this.sortDir() : this.initialDir();
    return key === col.id ? dir : null;
  }

  selectedOf(col: UiTableColumn<T>): string[] | null {
    return this.filters()[col.id] ?? null;
  }

  toggleSort(col: UiTableColumn<T>): void {
    if (col.action) {
      return;
    }
    const key = this.sortKey() ?? this.initialSort();
    if (key === col.id) {
      const current = this.sortKey() ? this.sortDir() : this.initialDir();
      this.sortKey.set(col.id);
      this.sortDir.set(current === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.sortKey.set(col.id);
    this.sortDir.set('asc');
  }

  toggleFilter(col: UiTableColumn<T>, event: MouseEvent): void {
    event.stopPropagation();
    if (col.action) {
      return;
    }
    this.openFilter.update((open) => (open === col.id ? null : col.id));
  }

  setFilter(col: UiTableColumn<T>, value: string[] | null): void {
    this.filters.update((cur) => ({ ...cur, [col.id]: value }));
  }

  classes(row: T): string | Record<string, boolean> {
    return this.rowClass()(row);
  }

  trackOf(row: T): unknown {
    return this.trackBy()(row);
  }

  cellClass(col: UiTableColumn<T>, row: T): string {
    const value = col.cellClass;
    return typeof value === 'function' ? value(row) : value ?? '';
  }

  clipId(col: UiTableColumn<T>, row: T): string {
    return `${String(this.trackOf(row))}:${col.id}`;
  }

  clipped(col: UiTableColumn<T>, row: T): boolean {
    if (col.clip === false) {
      return false;
    }
    return this.cellValue(col, row).replace(/\s+/g, ' ').trim().length > this.clipLimit;
  }

  toggleClip(event: Event, col: UiTableColumn<T>, row: T): void {
    event.preventDefault();
    event.stopPropagation();
    const id = this.clipId(col, row);
    this.clipKey.update((cur) => (cur === id ? null : id));
  }

  badgeClass(value: string): string {
    if (value === 'Y' || value === 'OK' || value === 'Delivered' || value === 'New' || value === '!') {
      return 'is-y';
    }
    if (value === 'On going' || value === 'UNDER REVIEW' || value === 'Change') {
      return 'is-on';
    }
    if (value === 'Fail' || value === 'X') {
      return 'is-fail';
    }
    return 'is-out';
  }

  private col(id: string): UiTableColumn<T> | undefined {
    return this.columns().find((col) => col.id === id);
  }

  private cellValue(col: UiTableColumn<T> | undefined, row: T): string {
    return col?.value(row) ?? '';
  }

  private sortValue(col: UiTableColumn<T> | undefined, row: T): string {
    return col?.sortValue?.(row) ?? this.cellValue(col, row);
  }

  private passes(chosen: string[] | null | undefined, value: string): boolean {
    return chosen == null || chosen.includes(value);
  }
}
