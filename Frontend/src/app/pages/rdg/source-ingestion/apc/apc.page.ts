import { DatePipe } from '@angular/common';
import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NationCode } from '../../../../domain/fleet/aircraft.model';
import { ApcCurrent, ApcRow, ApcService, ApcUpload, ApcIngestEvent } from '../../../../services/apc.service';
import { AircraftService } from '../../../../services/aircraft.service';
import { PdCheckStatus } from '../../../../services/pd.service';
import { WorkspaceService } from '../../../../services/workspace.service';
import { ModuleIconComponent } from '../../../../shared/ui/module-icon/module-icon.component';
import { FlagIconComponent, UiButtonComponent, UiEmptyComponent, UiHelpComponent, UiIconActComponent, UiModalComponent, UiTableCellDirective, UiTableColumn, UiTableComponent } from '../../../../shared/ui';
import { enterAircraft, routeMsn } from '../../../_shared/aircraft-context';

interface IngestStep {
  id: string;
  label: string;
  status: PdCheckStatus;
  detail?: string;
}

@Component({
  selector: 'app-apc',
  standalone: true,
  imports: [RouterLink, ModuleIconComponent, FlagIconComponent, UiTableComponent, UiTableCellDirective, UiModalComponent, UiButtonComponent, UiHelpComponent, UiEmptyComponent, UiIconActComponent],
  providers: [DatePipe],
  templateUrl: './apc.page.html',
  styleUrl: '../../../_shared/source-page.scss',
})
export class ApcPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly aircraftApi = inject(AircraftService);
  private readonly workspace = inject(WorkspaceService);
  private readonly apcApi = inject(ApcService);
  private readonly dates = inject(DatePipe);
  private readonly picker = viewChild<ElementRef<HTMLInputElement>>('picker');

  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  readonly aircraftId = routeMsn(this.route);
  readonly circ = 2 * Math.PI * 52;

  readonly code = computed(() => (this.data()['code'] as string) ?? '');
  readonly icon = computed(() => 'apc');
  readonly title = computed(() => (this.data()['grandLabel'] as string) ?? 'APC');
  readonly ingest = computed(() => this.data()['apcMode'] !== 'view');
  readonly helpTopic = computed(() => (this.ingest() ? 'apc-ingest' : 'apc-view'));
  readonly ingestPath = computed(() => ['/aircraft', this.aircraftId, 'r.d.g', 'source-ingestion', 'apc']);
  readonly viewPath = computed(() => ['/aircraft', this.aircraftId, 'r.d.p', 'plan-data', 'apc']);
  readonly dash = computed(() => this.circ * (1 - this.percent() / 100));

  readonly history = signal<ApcUpload[]>([]);
  readonly others = signal<ApcUpload[]>([]);
  readonly current = signal<ApcCurrent | null>(null);
  readonly nation = signal<string | null>(null);
  readonly rows = signal<ApcRow[]>([]);
  readonly loading = signal(true);
  readonly uploading = signal(false);
  readonly percent = signal(0);
  readonly steps = signal<IngestStep[]>([]);
  readonly fileName = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly pendingDelete = signal<ApcUpload | null>(null);

  readonly trackHistory = (item: ApcUpload) => `${item.nation ?? ''}-${item.id}`;
  readonly trackRow = (row: ApcRow) => `${row.position_code}-${row.pnr}-${row.snr}`;
  readonly historyRowClass = (item: ApcUpload) => ({ 'is-current': item.current, 'is-fail': item.status === 'fail' });

  readonly histCols = computed<UiTableColumn<ApcUpload>[]>(() => [
    { id: 'version', label: 'Version', value: (item) => this.versionLabel(item.version), cellClass: 'ref' },
    { id: 'file', label: 'File', value: (item) => item.source_file || '—' },
    {
      id: 'uploaded',
      label: 'Uploaded',
      value: (item) => this.dates.transform(item.uploaded_at, 'd MMM y, HH:mm') || item.uploaded_at,
      sortValue: (item) => item.uploaded_at,
    },
    { id: 'by', label: 'Uploaded by', value: (item) => item.uploaded_by },
    { id: 'status', label: 'Status', value: (item) => (item.status === 'ok' ? 'OK' : 'Fail'), badge: true },
    {
      id: 'note',
      label: 'Assigned',
      value: (item) => (item.current ? 'Assigned' : item.status === 'fail' && item.message ? item.message : '—'),
    },
    { id: 'actions', label: '', value: () => '', action: true, headerClass: 'act-col', cellClass: 'act-col' },
  ]);

  readonly otherCols = computed<UiTableColumn<ApcUpload>[]>(() => [
    { id: 'fleet', label: 'Air force', value: (item) => item.nation || '—' },
    ...this.histCols().filter((col) => col.id !== 'status'),
  ]);

  readonly dataCols = computed<UiTableColumn<ApcRow>[]>(() => [
    { id: 'position_code', label: 'Position code', value: (row) => row.position_code, cellClass: 'ref' },
    { id: 'pnr', label: 'PNR', value: (row) => row.pnr },
    { id: 'snr', label: 'SNR', value: (row) => row.snr },
  ]);

  ngOnInit(): void {
    enterAircraft(this.route, this.router, this.aircraftApi, this.workspace, () => this.reload());
  }

  openPicker(): void {
    this.picker()?.nativeElement.click();
  }

  versionLabel(value?: number | null): string {
    return value ? String(value).padStart(2, '0') : '—';
  }

  currentMeta(): string {
    const item = this.current();
    if (!item) {
      return '';
    }
    const when = this.dates.transform(item.uploaded_at, 'd MMM y, HH:mm') || item.uploaded_at;
    const fleet = item.nation || this.nation() || '';
    return [item.source_file, fleet, when].filter(Boolean).join(' · ');
  }

  askDelete(item: ApcUpload, event: Event): void {
    event.stopPropagation();
    this.pendingDelete.set(item);
  }

  asNation(code?: string | null): NationCode {
    return (code || 'SAF') as NationCode;
  }

  download(item: ApcUpload, event: Event): void {
    event.stopPropagation();
    this.apcApi.downloadHistory(this.aircraftId, item.id, item.source_file, item.nation).subscribe();
  }

  useOnAircraft(item: ApcUpload, event: Event): void {
    event.stopPropagation();
    if (item.status !== 'ok' || item.current) {
      return;
    }
    this.apcApi.select(this.aircraftId, item.id, item.nation).subscribe({
      next: () => this.reload(),
    });
  }

  closeDelete(): void {
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const item = this.pendingDelete();
    if (!item) {
      return;
    }
    this.apcApi.deleteHistory(this.aircraftId, item.id).subscribe({
      next: () => {
        this.pendingDelete.set(null);
        this.reload();
      },
      error: () => this.pendingDelete.set(null),
    });
  }

  onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.upload(file);
    }
  }

  private upload(file: File): void {
    if (this.uploading()) {
      return;
    }
    this.uploading.set(true);
    this.error.set(null);
    this.percent.set(0);
    this.steps.set([]);
    this.fileName.set(file.name);
    this.apcApi.ingest(this.aircraftId, file).subscribe({
      next: (event) => this.onIngest(event),
      error: () => {
        this.uploading.set(false);
        this.error.set('Could not validate APC.');
      },
      complete: () => this.uploading.set(false),
    });
  }

  private onIngest(event: ApcIngestEvent): void {
    this.percent.set(event.percent);
    if (event.kind === 'plan' && event.checks) {
      this.steps.set(event.checks.map((check) => ({ id: check.id, label: check.label, status: 'pending' as const })));
      return;
    }
    if (event.kind === 'step' && event.id && event.status) {
      this.steps.update((list) => {
        if (!list.some((step) => step.id === event.id)) {
          return [...list, { id: event.id!, label: event.label || event.id!, status: event.status!, detail: event.detail }];
        }
        return list.map((step) =>
          step.id === event.id
            ? { ...step, status: event.status!, label: event.label || step.label, detail: event.detail || step.detail }
            : step,
        );
      });
      return;
    }
    if (event.kind === 'error') {
      this.error.set(event.message ?? 'Validation failed.');
      this.reload();
      return;
    }
    if (event.kind === 'done') {
      this.reload();
    }
  }

  private reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.apcApi.list(this.aircraftId).subscribe({
      next: (listed) => {
        this.history.set([...(listed.history ?? [])].reverse());
        this.others.set([...(listed.others ?? [])].reverse());
        this.current.set(listed.current ?? null);
        this.nation.set(listed.nation ?? listed.current?.nation ?? null);
        this.rows.set(listed.current?.rows ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load APC.');
      },
    });
  }
}
