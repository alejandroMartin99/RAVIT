import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Aircraft, EventType, LoadType, NationCode } from '../../domain/fleet/aircraft.model';
import { catalogLabel, formatDate, padMsn } from '../../domain/fleet/fleet.catalog';
import { AircraftService } from '../../services/aircraft.service';
import { CatalogService } from '../../services/catalog.service';
import { WorkspaceService } from '../../services/workspace.service';
import { UiButtonComponent } from '../../shared/ui/button/ui-button.component';
import { FlagIconComponent } from '../../shared/ui/flag-icon/flag-icon.component';
import { UiModalComponent } from '../../shared/ui/modal/ui-modal.component';
import { SegmentOption, UiSegmentedComponent } from '../../shared/ui/segmented/ui-segmented.component';
import { UiTableHeadComponent } from '../../shared/ui/table-head/ui-table-head.component';

export type FleetCol = 'aircraft' | 'airforce' | 'chief' | 'maintenance' | 'retrofit' | 'ho' | 'toc';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    FormsModule,
    FlagIconComponent,
    UiButtonComponent,
    UiModalComponent,
    UiSegmentedComponent,
    UiTableHeadComponent,
  ],
  templateUrl: './landing.page.html',
  styleUrl: './landing.page.scss',
})
export class LandingPage implements OnInit {
  private readonly aircraftApi = inject(AircraftService);
  private readonly catalogs = inject(CatalogService);
  private readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);

  readonly catalog = this.catalogs.catalog;
  readonly fleet = signal<Aircraft[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly adding = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly query = signal('');
  readonly sortKey = signal<FleetCol>('aircraft');
  readonly sortDir = signal<'asc' | 'desc'>('asc');
  readonly openFilter = signal<FleetCol | null>(null);
  readonly filterAircraft = signal<string[] | null>(null);
  readonly filterAirforce = signal<string[] | null>(null);
  readonly filterChief = signal<string[] | null>(null);
  readonly filterMaintenance = signal<string[] | null>(null);
  readonly filterRetrofit = signal<string[] | null>(null);
  readonly filterHo = signal<string[] | null>(null);
  readonly filterToc = signal<string[] | null>(null);

  msnInput = '';
  nationInput = 'SAF';
  chiefInput = 'Alejandro Martín Iglesias';
  eventInput = 'retrofit';
  loadInput = 'as-is';
  hoInput = '';
  tocInput = '';

  readonly nationOptions = computed<SegmentOption[]>(() =>
    this.catalog().nations.map((item) => ({
      value: item.code,
      label: item.label,
      nation: item.code,
    })),
  );

  readonly eventOptions = computed<SegmentOption[]>(() =>
    this.catalog().event_types.map((item) => ({
      value: item.code,
      label: item.label,
    })),
  );

  readonly loadOptions = computed<SegmentOption[]>(() =>
    this.catalog().load_types.map((item) => ({
      value: item.code,
      label: item.label,
    })),
  );

  readonly aircraftOptions = computed(() => this.uniq(this.fleet().map((ac) => this.cell(ac, 'aircraft'))));
  readonly airforceOptions = computed(() => this.uniq(this.fleet().map((ac) => this.cell(ac, 'airforce'))));
  readonly chiefOptions = computed(() => this.uniq(this.fleet().map((ac) => this.cell(ac, 'chief'))));
  readonly maintenanceOptions = computed(() =>
    this.uniq(this.fleet().map((ac) => this.cell(ac, 'maintenance'))),
  );
  readonly retrofitOptions = computed(() => this.uniq(this.fleet().map((ac) => this.cell(ac, 'retrofit'))));
  readonly hoOptions = computed(() => this.uniq(this.fleet().map((ac) => this.cell(ac, 'ho'))));
  readonly tocOptions = computed(() => this.uniq(this.fleet().map((ac) => this.cell(ac, 'toc'))));

  readonly filteredFleet = computed(() => {
    const q = this.query().trim().toLowerCase();
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return this.fleet()
      .filter((ac) => !q || this.rowText(ac).includes(q))
      .filter((ac) => this.passes('aircraft', ac, this.filterAircraft()))
      .filter((ac) => this.passes('airforce', ac, this.filterAirforce()))
      .filter((ac) => this.passes('chief', ac, this.filterChief()))
      .filter((ac) => this.passes('maintenance', ac, this.filterMaintenance()))
      .filter((ac) => this.passes('retrofit', ac, this.filterRetrofit()))
      .filter((ac) => this.passes('ho', ac, this.filterHo()))
      .filter((ac) => this.passes('toc', ac, this.filterToc()))
      .slice()
      .sort((a, b) => dir * this.sortValue(a, key).localeCompare(this.sortValue(b, key), undefined, { numeric: true }));
  });

  @HostListener('document:click', ['$event'])
  closeFilters(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('app-ui-table-head')) {
      this.openFilter.set(null);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.openFilter.set(null);
  }

  ngOnInit(): void {
    this.workspace.leave();
    this.catalogs.load();
    this.refresh();
  }

  padMsn(msn: number): string {
    return padMsn(msn);
  }

  cellDate(iso: string): string {
    return formatDate(iso);
  }

  eventLabel(type: EventType): string {
    return catalogLabel(this.catalog().event_types, type);
  }

  loadLabel(type: LoadType): string {
    return catalogLabel(this.catalog().load_types, type);
  }

  private rowText(ac: Aircraft): string {
    return [
      `msn ${this.padMsn(ac.msn)}`,
      String(ac.msn),
      ac.nation,
      ac.chief,
      this.eventLabel(ac.event_type),
      this.loadLabel(ac.load_type),
      this.cell(ac, 'ho'),
      this.cell(ac, 'toc'),
      ac.hang_over,
      ac.transfer_of_custody,
    ]
      .join(' ')
      .toLowerCase();
  }

  sortDirOf(col: FleetCol): 'asc' | 'desc' | null {
    return this.sortKey() === col ? this.sortDir() : null;
  }

  toggleSort(col: FleetCol): void {
    if (this.sortKey() === col) {
      this.sortDir.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    this.sortKey.set(col);
    this.sortDir.set('asc');
  }

  toggleFilter(col: FleetCol, event: MouseEvent): void {
    event.stopPropagation();
    this.openFilter.update((open) => (open === col ? null : col));
  }

  select(ac: Aircraft): void {
    void this.router.navigate(['/aircraft', ac.id]);
  }

  private cell(ac: Aircraft, col: FleetCol): string {
    switch (col) {
      case 'aircraft':
        return `MSN ${this.padMsn(ac.msn)}`;
      case 'airforce':
        return ac.nation;
      case 'chief':
        return ac.chief;
      case 'maintenance':
        return this.eventLabel(ac.event_type);
      case 'retrofit':
        return this.loadLabel(ac.load_type);
      case 'ho':
        return formatDate(ac.hang_over);
      case 'toc':
        return formatDate(ac.transfer_of_custody);
    }
  }

  private sortValue(ac: Aircraft, col: FleetCol): string {
    if (col === 'ho') {
      return ac.hang_over;
    }
    if (col === 'toc') {
      return ac.transfer_of_custody;
    }
    return this.cell(ac, col);
  }

  private passes(col: FleetCol, ac: Aircraft, chosen: string[] | null): boolean {
    return chosen === null || chosen.includes(this.cell(ac, col));
  }

  private uniq(values: string[]): string[] {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  openAdd(): void {
    const chiefs = this.catalog().chiefs;
    this.adding.set(true);
    this.formError.set(null);
    this.msnInput = '';
    this.nationInput = 'SAF';
    this.chiefInput = chiefs[0] ?? 'Alejandro Martín Iglesias';
    this.eventInput = 'retrofit';
    this.loadInput = 'as-is';
    this.hoInput = '';
    this.tocInput = '';
  }

  cancelAdd(): void {
    this.adding.set(false);
    this.formError.set(null);
  }

  submit(): void {
    const msn = Number(this.msnInput);
    if (!Number.isInteger(msn) || msn < 1 || msn > 999) {
      this.formError.set('MSN must be between 001 and 999');
      return;
    }

    if (!this.hoInput || !this.tocInput) {
      this.formError.set('Hang Over and ToC dates are required');
      return;
    }
    if (this.tocInput < this.hoInput) {
      this.formError.set('ToC cannot be before Hang Over');
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    this.aircraftApi
      .create({
        msn,
        nation: this.nationInput as NationCode,
        chief: this.chiefInput,
        event_type: this.eventInput as EventType,
        load_type: this.loadInput as LoadType,
        hang_over: this.hoInput,
        transfer_of_custody: this.tocInput,
      })
      .subscribe({
        next: (created) => {
          this.fleet.update((list) => [...list, created].sort((a, b) => a.msn - b.msn));
          this.saving.set(false);
          this.adding.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          const detail = err.error?.detail;
          this.formError.set(
            typeof detail === 'string' ? detail : 'Could not create the aircraft',
          );
        },
      });
  }

  private refresh(): void {
    this.loading.set(true);
    this.aircraftApi.list().subscribe({
      next: (list) => {
        this.fleet.set(list);
        this.loading.set(false);
        this.error.set(null);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load the fleet. Check the API.');
      },
    });
  }
}
