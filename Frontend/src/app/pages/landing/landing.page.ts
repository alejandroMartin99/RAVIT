import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
import { UiTableCellDirective } from '../../shared/ui/table/ui-table-cell.directive';
import { UiTableColumn } from '../../shared/ui/table/ui-table.column';
import { UiTableComponent } from '../../shared/ui/table/ui-table.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    FormsModule,
    FlagIconComponent,
    UiButtonComponent,
    UiModalComponent,
    UiSegmentedComponent,
    UiTableComponent,
    UiTableCellDirective,
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

  msnInput = '';
  nationInput = 'SAF';
  chiefInput = 'Alejandro Martín Iglesias';
  eventInput = 'retrofit';
  loadInput = 'as-is';
  hoInput = '';
  tocInput = '';

  readonly trackAircraft = (ac: Aircraft) => ac.id;

  readonly fleetCols = computed<UiTableColumn<Aircraft>[]>(() => [
    { id: 'aircraft', label: 'Aircraft', value: (ac) => `MSN ${padMsn(ac.msn)}` },
    { id: 'airforce', label: 'Air force', value: (ac) => ac.nation },
    { id: 'chief', label: 'Aircraft chief', value: (ac) => ac.chief },
    { id: 'maintenance', label: 'Type of maintenance', value: (ac) => this.eventLabel(ac.event_type) },
    { id: 'retrofit', label: 'Retrofit event', value: (ac) => this.loadLabel(ac.load_type) },
    {
      id: 'ho',
      label: 'Hang Over (HO)',
      value: (ac) => formatDate(ac.hang_over),
      sortValue: (ac) => ac.hang_over,
    },
    {
      id: 'toc',
      label: 'Transfer of Custody (ToC)',
      value: (ac) => formatDate(ac.transfer_of_custody),
      sortValue: (ac) => ac.transfer_of_custody,
    },
  ]);

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

  ngOnInit(): void {
    this.workspace.leave();
    this.catalogs.load();
    this.refresh();
  }

  padMsn(msn: number): string {
    return padMsn(msn);
  }

  eventLabel(type: EventType): string {
    return catalogLabel(this.catalog().event_types, type);
  }

  loadLabel(type: LoadType): string {
    return catalogLabel(this.catalog().load_types, type);
  }

  select(ac: Aircraft): void {
    void this.router.navigate(['/aircraft', ac.id]);
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
          this.formError.set(typeof detail === 'string' ? detail : 'Could not create the aircraft');
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
