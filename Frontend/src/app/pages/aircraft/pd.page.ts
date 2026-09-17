import { DatePipe } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PdCheckStatus, PdIngestEvent, PdIssue, PdIssueRef, PdRow, PdService } from '../../services/pd.service';
import { AircraftService } from '../../services/aircraft.service';
import { WorkspaceService } from '../../services/workspace.service';
import { ModuleIconComponent } from '../../shared/ui/module-icon/module-icon.component';
import { UiHelpComponent } from '../../shared/ui/help/ui-help.component';
import { UiButtonComponent } from '../../shared/ui/button/ui-button.component';
import { UiModalComponent } from '../../shared/ui/modal/ui-modal.component';
import { UiTableCellDirective } from '../../shared/ui/table/ui-table-cell.directive';
import { UiTableColumn } from '../../shared/ui/table/ui-table.column';
import { UiTableComponent } from '../../shared/ui/table/ui-table.component';
import { forkJoin, timer } from 'rxjs';

interface IngestStep {
  id: string;
  label: string;
  status: PdCheckStatus;
}

type TableCol = { id: string; label: string };

@Component({
  selector: 'app-pd',
  standalone: true,
  imports: [RouterLink, DatePipe, ModuleIconComponent, UiTableComponent, UiTableCellDirective, UiModalComponent, UiButtonComponent, UiHelpComponent],
  providers: [DatePipe],
  templateUrl: './pd.page.html',
  styleUrl: './pd.page.scss',
})
export class PdPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly aircraftApi = inject(AircraftService);
  private readonly workspace = inject(WorkspaceService);
  private readonly pdApi = inject(PdService);
  private readonly dates = inject(DatePipe);
  private readonly picker = viewChild<ElementRef<HTMLInputElement>>('picker');

  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  readonly aircraftId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly circ = 2 * Math.PI * 52;

  readonly code = computed(() => (this.data()['code'] as string) ?? '');
  readonly icon = computed(() => (this.data()['icon'] as string) ?? 'pd');
  readonly title = computed(
    () => (this.data()['grandLabel'] as string) ?? (this.data()['childLabel'] as string) ?? 'Program Directive (PD)',
  );
  readonly ingest = computed(() => this.data()['pdMode'] === 'ingest');
  readonly helpTopic = computed(() => (this.ingest() ? 'pd-ingest' : 'pd-view'));
  readonly ingestPath = computed(() => ['/aircraft', this.aircraftId, 'r.d.g', 'source-ingestion', 'pd']);
  readonly viewPath = computed(() => ['/aircraft', this.aircraftId, 'r.d.p', 'plan-data', 'pd']);
  readonly dash = computed(() => this.circ * (1 - this.percent() / 100));

  readonly issues = signal<PdIssueRef[]>([]);
  readonly history = signal<PdIssueRef[]>([]);
  readonly selected = signal<string | null>(null);
  readonly issueOpen = signal(false);
  readonly issue = signal<PdIssue | null>(null);
  readonly loading = signal(true);
  readonly uploading = signal(false);
  readonly percent = signal(0);
  readonly steps = signal<IngestStep[]>([]);
  readonly fileName = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly pendingDelete = signal<PdIssueRef | null>(null);
  readonly skelCols = signal<TableCol[]>([]);
  readonly skelRows = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  private loadGen = 0;
  private readonly minLoadMs = 1000;

  readonly trackHistory = (item: PdIssueRef) => item.id;
  readonly trackRow = (row: PdRow) => `${row.item_ref ?? ''}-${row.reference}-${row.revision}`;
  readonly historyRowClass = (item: PdIssueRef) => ({ 'is-current': item.current, 'is-fail': item.status === 'fail' });

  readonly histCols = computed<UiTableColumn<PdIssueRef>[]>(() => [
    { id: 'issue', label: 'Issue', value: (item) => this.issueLabel(item), cellClass: 'ref' },
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
      label: 'Current',
      value: (item) => (item.current ? 'Current' : item.status === 'fail' && item.message ? item.message : '—'),
    },
    { id: 'actions', label: '', value: () => '', action: true, headerClass: 'act-col', cellClass: 'act-col' },
  ]);

  readonly pdCols = computed<UiTableColumn<PdRow>[]>(() => {
    const versions = this.issue()?.versions ?? [];
    return [
      { id: 'item_ref', label: 'Item ref', value: (row) => row.item_ref || '', cellClass: 'ref' },
      { id: 'reference', label: 'Reference', value: (row) => row.reference, cellClass: 'ref' },
      { id: 'revision', label: 'Revision', value: (row) => row.revision, cellClass: 'rev' },
      { id: 'ata', label: 'ATA', value: (row) => row.ata },
      { id: 'description', label: 'Description', value: (row) => this.rowText(row) },
      { id: 'type', label: 'Type', value: (row) => row.type || '' },
      { id: 'source_material', label: 'Source material', value: (row) => row.source_material || '' },
      { id: 'source_hours', label: 'Source hours', value: (row) => row.source_hours || '' },
      { id: 'fin_position', label: 'FIN / Position', value: (row) => row.fin_position || '' },
      { id: 'pn', label: 'PN', value: (row) => row.pn || '' },
      { id: 'sn', label: 'SN', value: (row) => row.sn || '' },
      ...versions.map((col) => ({
        id: `flag:${col}`,
        label: col,
        value: (row: PdRow) => row.flags[col] ?? '',
        headerClass: 'flag-col',
        cellClass: 'flag-col',
        badge: true,
      })),
    ];
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigateByUrl('/');
      return;
    }
    this.skelCols.set(this.colsForIssue('issue02'));
    this.aircraftApi.get(id).subscribe({
      next: (item) => {
        this.workspace.enter(item);
        this.reload();
      },
      error: () => {
        this.workspace.leave();
        void this.router.navigateByUrl('/');
      },
    });
  }

  issueLabel(item: PdIssueRef | string | null): string {
    if (!item) {
      return 'Select issue';
    }
    if (typeof item === 'string') {
      const found = this.issues().find((entry) => entry.issue === item || entry.id === item);
      return found ? this.issueLabel(found) : item;
    }
    if (item.status === 'fail' || !item.number) {
      return '—';
    }
    return `Issue ${item.number.toString().padStart(2, '0')}`;
  }

  @HostListener('document:click', ['$event'])
  closeMenus(event: MouseEvent): void {
    const path = event.composedPath();
    const inPick = path.some((node) => node instanceof HTMLElement && node.classList.contains('pick'));
    if (!inPick) {
      this.issueOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.issueOpen.set(false);
  }

  closeIssues(): void {
    this.issueOpen.set(false);
  }

  toggleIssues(): void {
    this.issueOpen.update((open) => !open);
  }

  selectIssue(id: string): void {
    this.issueOpen.set(false);
    if (id === this.selected()) {
      return;
    }
    this.selected.set(id);
    this.loadIssue(id);
  }

  rowText(row: { description?: string; title?: string }): string {
    return row.description || row.title || '';
  }

  openPicker(): void {
    this.picker()?.nativeElement.click();
  }

  askDelete(item: PdIssueRef, event: Event): void {
    event.stopPropagation();
    this.pendingDelete.set(item);
  }

  download(item: PdIssueRef, event: Event): void {
    event.stopPropagation();
    this.pdApi.downloadHistory(this.aircraftId, item.id, item.source_file).subscribe();
  }

  closeDelete(): void {
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const item = this.pendingDelete();
    if (!item) {
      return;
    }
        this.pdApi.deleteHistory(this.aircraftId, item.id).subscribe({
      next: () => {
        this.pendingDelete.set(null);
        if (this.issue()?.issue === item.issue) {
          this.issue.set(null);
        }
        this.refreshList(!this.ingest());
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
    this.pdApi.ingest(this.aircraftId, file).subscribe({
      next: (event) => this.onIngest(event),
      error: () => {
        this.uploading.set(false);
        this.error.set('Could not validate the Program Directive.');
      },
      complete: () => this.uploading.set(false),
    });
  }

  private onIngest(event: PdIngestEvent): void {
    this.percent.set(event.percent);
    if (event.kind === 'plan' && event.checks) {
      this.steps.set(event.checks.map((check) => ({ id: check.id, label: check.label, status: 'pending' as const })));
      return;
    }
    if (event.kind === 'step' && event.id && event.status) {
      this.steps.update((list) => {
        if (!list.some((step) => step.id === event.id)) {
          return [...list, { id: event.id!, label: event.label || event.id!, status: event.status! }];
        }
        return list.map((step) =>
          step.id === event.id ? { ...step, status: event.status!, label: event.label || step.label } : step,
        );
      });
      return;
    }
    if (event.kind === 'error') {
      this.error.set(event.message ?? 'Validation failed.');
      this.refreshList();
      return;
    }
    if (event.kind === 'done' && event.issue) {
      this.refreshList();
    }
  }

  private reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.refreshList(true);
  }

  private refreshList(loadCurrent = false): void {
    this.pdApi.list(this.aircraftId).subscribe({
      next: (listed) => {
        this.issues.set(listed.issues);
        this.history.set([...(listed.history ?? listed.issues)].reverse());
        const wanted = this.route.snapshot.queryParamMap.get('issue');
        const match = listed.issues.find((item) => item.issue === wanted || item.id === wanted);
        const target = match?.issue || listed.latest;
        this.selected.set(target);
        if (!loadCurrent || this.ingest() || !target) {
          this.loading.set(false);
          return;
        }
        this.loadIssue(target);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load Program Directive issues.');
      },
    });
  }

  private loadIssue(issue: string): void {
    const gen = ++this.loadGen;
    this.loading.set(true);
    this.skelCols.set(this.colsForIssue(issue));
    forkJoin({
      payload: this.pdApi.get(this.aircraftId, issue),
      wait: timer(this.minLoadMs),
    }).subscribe({
      next: ({ payload }) => {
        if (gen !== this.loadGen) {
          return;
        }
        this.issue.set(payload);
        this.loading.set(false);
      },
      error: () => {
        if (gen !== this.loadGen) {
          return;
        }
        this.loading.set(false);
        this.error.set('Could not load this Program Directive issue.');
      },
    });
  }

  private colsForIssue(_issue: string): TableCol[] {
    const versions = this.issue()?.versions ?? [];
    return [
      { id: 'item_ref', label: 'Item ref' },
      { id: 'reference', label: 'Reference' },
      { id: 'revision', label: 'Revision' },
      { id: 'ata', label: 'ATA' },
      { id: 'description', label: 'Description' },
      { id: 'type', label: 'Type' },
      { id: 'source_material', label: 'Source material' },
      { id: 'source_hours', label: 'Source hours' },
      { id: 'fin_position', label: 'FIN / Position' },
      { id: 'pn', label: 'PN' },
      { id: 'sn', label: 'SN' },
      ...versions.map((col) => ({ id: `flag:${col}`, label: col })),
    ];
  }
}
