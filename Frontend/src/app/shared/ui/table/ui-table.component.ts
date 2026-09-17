import { NgClass, NgTemplateOutlet } from '@angular/common';
import { Component, HostListener, computed, contentChildren, input, output, signal } from '@angular/core';
import { UiTableHeadComponent } from '../table-head/ui-table-head.component';
import { UiTableCellDirective } from './ui-table-cell.directive';
import { UiTableColumn } from './ui-table.column';

@Component({
  selector: 'app-ui-table',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet, UiTableHeadComponent],
  templateUrl: './ui-table.component.html',
  styleUrl: './ui-table.component.scss',
})
export class UiTableComponent<T = unknown> {
  readonly columns = input.required<UiTableColumn<T>[]>();
  readonly rows = input<T[]>([]);
  readonly search = input('');
  readonly empty = input('No rows match these filters.');
  readonly framed = input(true);
  readonly rowClickable = input(false);
  readonly initialSort = input<string | null>(null);
  readonly initialDir = input<'asc' | 'desc'>('asc');
  readonly trackBy = input<(row: T) => unknown>((row) => row);
  readonly rowClass = input<(row: T) => string | Record<string, boolean>>(() => '');

  readonly rowClick = output<T>();

  private readonly cells = contentChildren(UiTableCellDirective);
  readonly sortKey = signal<string | null>(null);
  readonly sortDir = signal<'asc' | 'desc'>('asc');
  readonly openFilter = signal<string | null>(null);
  readonly filters = signal<Record<string, string[] | null>>({});

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
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.openFilter.set(null);
  }

  templateFor(id: string) {
    return this.cells().find((cell) => cell.name() === id)?.tpl ?? null;
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

  badgeClass(value: string): string {
    if (value === 'Y' || value === 'OK' || value === 'Delivered') {
      return 'is-y';
    }
    if (value === 'On going') {
      return 'is-on';
    }
    if (value === 'Fail') {
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
