import { DatePipe } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PdCheckStatus, PdFailRow, PdIngestEvent, PdIssue, PdIssueRef, PdRow, PdService } from '../../services/pd.service';
import { AircraftService } from '../../services/aircraft.service';
import { WorkspaceService } from '../../services/workspace.service';
import { ModuleIconComponent } from '../../shared/ui/module-icon/module-icon.component';
import { UiHelpComponent } from '../../shared/ui/help/ui-help.component';
import { UiButtonComponent } from '../../shared/ui/button/ui-button.component';
import { UiModalComponent } from '../../shared/ui/modal/ui-modal.component';
import { UiTableCellDirective } from '../../shared/ui/table/ui-table-cell.directive';
import { UiTableExpandDirective } from '../../shared/ui/table/ui-table-expand.directive';
import { UiTableColumn } from '../../shared/ui/table/ui-table.column';
import { UiTableComponent } from '../../shared/ui/table/ui-table.component';
import { forkJoin, timer } from 'rxjs';

interface IngestStep {
  id: string;
  label: string;
  status: PdCheckStatus;
  detail?: string;
}

@Component({
  selector: 'app-pd',
  standalone: true,
  imports: [RouterLink, DatePipe, ModuleIconComponent, UiTableComponent, UiTableCellDirective, UiTableExpandDirective, UiModalComponent, UiButtonComponent, UiHelpComponent],
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
  private readonly aircraftIdSig = signal(this.route.snapshot.paramMap.get('id') ?? '');
  get aircraftId(): string {
    return this.aircraftIdSig();
  }
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
  readonly pendingReplace = signal<string | null>(null);
  readonly failRows = signal<PdFailRow[]>([]);
  readonly trackFailRow = (row: PdFailRow) => String(row.line ?? '');
  readonly historyCanExpand = (item: PdIssueRef) => item.status === 'fail' && !!(item.fail_rows?.length || item.message);
  readonly skelCols = signal<{ id: string; label: string }[]>([]);
  readonly skelRows = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  private loadGen = 0;
  private readonly minLoadMs = 1000;

  readonly trackHistory = (item: PdIssueRef) => item.id;
  readonly trackRow = (row: PdRow) =>
    `${row.item_ref ?? ''}-${row.task_reference ?? row.reference ?? ''}-${row.revision ?? ''}`;
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
      value: (item) => (item.current ? 'Current' : this.failNote(item)),
      clip: false,
    },
    { id: 'actions', label: '', value: () => '', action: true, headerClass: 'act-col', cellClass: 'act-col' },
  ]);

  readonly pdCols = computed<UiTableColumn<PdRow>[]>(() => {
    const versions = this.issue()?.versions ?? [];
    return [
      { id: 'item_ref', label: 'Item ref', value: (row) => row.item_ref || '', cellClass: 'ref' },
      { id: 'scope_comitee_id', label: 'Scope comitee ID', value: (row) => row.scope_comitee_id || row.reference || '', cellClass: 'ref' },
      { id: 'document_type', label: 'Document type', value: (row) => row.document_type || row.type || '' },
      { id: 'task_reference', label: 'Task reference', value: (row) => row.task_reference || '', cellClass: 'ref' },
      { id: 'revision', label: 'Revision', value: (row) => row.revision || '', cellClass: 'rev' },
      { id: 'description', label: 'Description', value: (row) => this.rowText(row) },
      { id: 'pn', label: 'PN', value: (row) => row.pn || '' },
      { id: 'sn', label: 'SN', value: (row) => row.sn || '' },
      { id: 'fin_position', label: 'FIN / Position', value: (row) => row.fin_position || '' },
      { id: 'source_material', label: 'Source material', value: (row) => row.source_material || '' },
      { id: 'source_hours', label: 'Source hours', value: (row) => row.source_hours || '' },
      { id: 'pd_comment', label: 'PD comment', value: (row) => row.pd_comment || '' },
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
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (!id) {
        void this.router.navigateByUrl('/');
        return;
      }
      this.bindAircraft(id);
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
    if (item.status === 'fail') {
      return '—';
    }
    if (item.issue && /^\d{2}\.\d{2}$/.test(item.issue)) {
      return `Issue ${item.issue}`;
    }
    if (!item.number) {
      return '—';
    }
    return `Issue ${item.number.toString().padStart(2, '0')}`;
  }

  failNote(item: PdIssueRef): string {
    if (item.status !== 'fail') {
      return '—';
    }
    const n = item.fail_rows?.length ?? 0;
    if (n === 1) {
      return '1 failing row';
    }
    if (n > 1) {
      return `${n} failing rows`;
    }
    return item.message ? 'Validation failed' : '—';
  }

  failColsFor(rows: PdFailRow[]): UiTableColumn<PdFailRow>[] {
    const labels: Record<string, string> = {
      line: 'Excel row',
      item_ref: 'Item ref',
      scope_comitee_id: 'Scope comitee ID',
      document_type: 'Document type',
      task_reference: 'Task reference',
      revision: 'Revision',
      description: 'Description',
      pn: 'PN',
      sn: 'SN',
      fin_position: 'FIN / Position',
      source_material: 'Source material',
      source_hours: 'Source hours',
      pd_comment: 'PD comment',
    };
    const sample = rows[0] ?? {};
    const keys = ['line', ...Object.keys(sample).filter((key) => key !== 'line' && key !== 'issue_col' && key !== 'issue_value')];
    return [...new Set(keys)].map((id) => ({
      id,
      label: labels[id] || id,
      value: (row) => String(row[id] ?? ''),
      clip: false,
    }));
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
    this.failRows.set([]);
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

  confirmReplace(): void {
    const version = this.pendingReplace();
    if (!version) {
      return;
    }
    this.pendingReplace.set(null);
    this.pdApi.commitReplace(this.aircraftId, version).subscribe({
      next: () => this.refreshList(),
      error: () => this.error.set('Could not replace this Program Directive.'),
    });
  }

  cancelReplace(): void {
    const version = this.pendingReplace();
    this.pendingReplace.set(null);
    if (version) {
      this.pdApi.discardReplace(this.aircraftId, version).subscribe();
    }
  }

  private onIngest(event: PdIngestEvent): void {
    this.percent.set(event.percent);
    if (event.kind === 'plan' && event.checks) {
      this.steps.set(event.checks.map((check) => ({ id: check.id, label: check.label, status: 'pending' as const })));
      return;
    }
    if (event.kind === 'step' && event.id && event.status) {
      if (event.rows?.length) {
        this.failRows.set(event.rows);
      }
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
    if (event.kind === 'replace' && event.version) {
      this.pendingReplace.set(event.version);
      this.closeIngestPanel();
      return;
    }
    if (event.kind === 'error') {
      this.error.set(event.message ?? 'Validation failed.');
      if (event.rows?.length) {
        this.failRows.set(event.rows);
      }
      this.refreshList();
      return;
    }
    if (event.kind === 'done') {
      this.closeIngestPanel();
      this.refreshList();
    }
  }

  private closeIngestPanel(): void {
    this.steps.set([]);
    this.percent.set(0);
    this.fileName.set(null);
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

  private bindAircraft(id: string): void {
    this.aircraftIdSig.set(id);
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

  private loadIssue(issue: string): void {
    const gen = ++this.loadGen;
    this.loading.set(true);
    this.skelCols.set([
      { id: 'item_ref', label: 'Item ref' },
      { id: 'task_reference', label: 'Task reference' },
      { id: 'revision', label: 'Revision' },
      { id: 'description', label: 'Description' },
    ]);
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

}
