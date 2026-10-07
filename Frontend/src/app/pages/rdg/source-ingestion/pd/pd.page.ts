import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ConsistencyReport, ConsistencySource, PdCheckStatus, PdCompare, PdFailRow, PdIngestEvent, PdIssue, PdIssueRef, PdRow, PdService } from '../../../../services/pd.service';
import { AircraftService } from '../../../../services/aircraft.service';
import { WorkspaceService } from '../../../../services/workspace.service';
import { ModuleIconComponent } from '../../../../shared/ui/module-icon/module-icon.component';
import { UiButtonComponent, UiChipComponent, UiEmptyComponent, UiHelpComponent, UiIconActComponent, UiIconComponent, UiModalComponent, UiSkelTableComponent, UiTableCellDirective, UiTableColumn, UiTableComponent, UiTableExpandDirective } from '../../../../shared/ui';
import { enterAircraft, routeMsn } from '../../../_shared/aircraft-context';
import { cellOf, changeArrow, changedBases, compareFieldId, viewLikeValue, type PdCompareRow } from './pd-compare';
import { forkJoin, of, timer } from 'rxjs';
import { tap } from 'rxjs/operators';

interface IngestStep {
  id: string;
  label: string;
  status: PdCheckStatus;
  detail?: string;
}

@Component({
  selector: 'app-pd',
  standalone: true,
  imports: [RouterLink, DatePipe, NgTemplateOutlet, ModuleIconComponent, UiTableComponent, UiTableCellDirective, UiTableExpandDirective, UiModalComponent, UiButtonComponent, UiHelpComponent, UiChipComponent, UiEmptyComponent, UiIconActComponent, UiIconComponent, UiSkelTableComponent],
  providers: [DatePipe],
  templateUrl: './pd.page.html',
  styleUrl: '../../../_shared/source-page.scss',
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
  private readonly aircraftIdSig = signal(routeMsn(this.route));
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
  readonly rawOpen = signal(true);
  readonly reportOpen = signal(false);
  readonly mode = signal<'view' | 'delta'>('view');
  readonly genSource = signal<'full' | 'delta' | null>(null);
  readonly genStep = signal(1);
  readonly genConfirmed = signal(false);
  readonly genSteps = [
    { id: 1, label: 'Select PD' },
    { id: 2, label: 'Consistency report' },
    { id: 3, label: 'Calculate WO, RI, SW' },
  ];
  readonly genSources = signal<ConsistencyReport['sources'] | null>(null);
  readonly genReport = signal<ConsistencyReport | null>(null);
  readonly genBusy = signal(false);
  readonly genError = signal<string | null>(null);
  readonly genSourceList = computed(() => {
    const pack = this.genSources() ?? this.genReport()?.sources;
    const labels = { apc: 'APC', omp: 'OMP', acr: 'ACR', tt_brackdown: 'tt_brackdown' } as const;
    return (Object.keys(labels) as (keyof typeof labels)[]).map((key) => {
      const item = pack?.[key];
      return {
        key,
        label: item?.label ?? labels[key],
        loaded: !!item?.loaded,
        detail: this.sourceDetail(item),
      };
    });
  });
  readonly missingSources = computed(() => this.genSourceList().filter((item) => !item.loaded).map((item) => item.label));
  readonly canRunConsistency = computed(() => {
    if (this.genBusy() || this.missingSources().length) {
      return false;
    }
    if (this.genSource() === 'full') {
      return !!this.selected();
    }
    return this.genSource() === 'delta' && this.canDelta();
  });
  readonly selected = signal<string | null>(null);
  readonly selectedNew = signal<string | null>(null);
  readonly selectedOld = signal<string | null>(null);
  readonly issueOpen = signal(false);
  readonly newOpen = signal(false);
  readonly oldOpen = signal(false);
  readonly colsOpen = signal(false);
  readonly allIssues = signal(false);
  readonly mainColumns = signal(true);
  readonly hiddenCols = signal<Set<string>>(new Set());
  readonly extraCols = signal<Set<string>>(new Set());
  readonly issue = signal<PdIssue | null>(null);
  readonly delta = signal<PdCompare | null>(null);
  private readonly issueCache = new Map<string, PdIssue>();
  private readonly mainIds = new Set(['task_reference', 'revision', 'fin_position', 'pn', 'sn', 'pd_comment']);
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
  readonly trackCompare = (row: PdCompareRow) => row['item_ref'];
  readonly compareRowClass = (row: PdCompareRow) => ({
    'is-discard': row['Item_Status'] === 'Discard_Line',
    'is-new': row['Item_Status'] === 'new_line',
  });
  readonly deltaLineRows = computed(() =>
    [...this.deltaNew(), ...this.deltaDiscard()].sort((a, b) => (a['item_ref'] || '').localeCompare(b['item_ref'] || '', undefined, { numeric: true })),
  );
  readonly deltaLineNote = computed(() => {
    const n = this.deltaNew().length;
    const d = this.deltaDiscard().length;
    const news = n === 1 ? '1 new line' : `${n} new lines`;
    const discards = d === 1 ? '1 discard line' : `${d} discard lines`;
    return `${news} · ${discards}`;
  });
  readonly canDelta = computed(() => !!this.selectedNew() && !!this.selectedOld() && this.selectedNew() !== this.selectedOld());
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

  toggleAllIssues(): void {
    this.allIssues.update((on) => !on);
    this.clearColOverrides();
  }

  toggleMainColumns(): void {
    this.mainColumns.update((on) => !on);
    this.clearColOverrides();
  }

  toggleCols(): void {
    this.issueOpen.set(false);
    this.newOpen.set(false);
    this.oldOpen.set(false);
    this.colsOpen.update((open) => !open);
  }

  toggleRaw(): void {
    this.closeIssues();
    const next = !this.rawOpen();
    this.rawOpen.set(next);
    if (next) {
      this.reportOpen.set(false);
    }
  }

  toggleReport(): void {
    this.closeIssues();
    const next = !this.reportOpen();
    this.reportOpen.set(next);
    if (next) {
      this.rawOpen.set(false);
      this.loadGenSources();
    }
  }

  setGenSource(next: string): void {
    if (next !== 'full' && next !== 'delta') {
      return;
    }
    if (next === this.genSource()) {
      return;
    }
    this.closeIssues();
    this.genSource.set(next);
    this.genReport.set(null);
    this.genError.set(null);
    this.genConfirmed.set(false);
    this.genStep.set(1);
  }

  goGenStep(id: number): void {
    if (id === 1) {
      this.genStep.set(1);
      return;
    }
    if (id === 2 && this.genReport()) {
      this.genStep.set(2);
      return;
    }
    if (id === 3 && this.genConfirmed()) {
      this.genStep.set(3);
    }
  }

  canGoGenStep(id: number): boolean {
    if (id === 1) {
      return true;
    }
    if (id === 2) {
      return !!this.genReport();
    }
    return this.genConfirmed();
  }

  confirmGen(): void {
    if (!this.genReport()) {
      return;
    }
    this.genConfirmed.set(true);
    this.genStep.set(3);
  }

  runConsistency(): void {
    if (!this.canRunConsistency()) {
      return;
    }
    const source = this.genSource();
    if (!source) {
      return;
    }
    this.genBusy.set(true);
    this.genError.set(null);
    this.pdApi
      .consistency(this.aircraftId, {
        source,
        issue: this.selected(),
        new: this.selectedNew(),
        old: this.selectedOld(),
      })
      .subscribe({
        next: (payload) => {
          this.genReport.set(payload);
          this.genSources.set(payload.sources);
          this.genBusy.set(false);
          this.genConfirmed.set(false);
          this.genStep.set(2);
        },
        error: (err: { error?: { detail?: string } }) => {
          this.genBusy.set(false);
          this.genError.set(err.error?.detail || 'Could not generate the consistency report.');
        },
      });
  }

  setMode(next: string): void {
    if (next !== 'view' && next !== 'delta') {
      return;
    }
    if (next === this.mode()) {
      return;
    }
    this.closeIssues();
    this.clearColOverrides();
    this.mainColumns.set(true);
    this.mode.set(next);
    if (next === 'view') {
      const id = this.selected();
      if (id && !this.issue()) {
        this.loadIssue(id);
      }
    }
  }

  colOn(id: string): boolean {
    if (this.hiddenCols().has(id)) {
      return false;
    }
    if (this.extraCols().has(id)) {
      return true;
    }
    return this.inPreset(id);
  }

  toggleCol(id: string): void {
    if (this.colOn(id)) {
      this.extraCols.update((set) => {
        const next = new Set(set);
        next.delete(id);
        return next;
      });
      this.hiddenCols.update((set) => new Set(set).add(id));
      return;
    }
    this.hiddenCols.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
    this.extraCols.update((set) => new Set(set).add(id));
  }

  private clearColOverrides(): void {
    this.hiddenCols.set(new Set());
    this.extraCols.set(new Set());
  }

  private inPreset(id: string): boolean {
    if (id.startsWith('flag:')) {
      const versions = this.viewVersions();
      const shown = this.allIssues()
        ? versions
        : this.mode() === 'delta'
          ? [this.selectedNew()].filter((col): col is string => !!col)
          : versions.slice(-1);
      return shown.includes(id.slice(5));
    }
    return !this.mainColumns() || this.mainIds.has(id);
  }

  private viewVersions(): string[] {
    if (this.mode() === 'delta') {
      const extra = this.selectedNew();
      const base = this.delta()?.versions ?? [];
      return extra && !base.includes(extra) ? [...base, extra] : base;
    }
    return this.issue()?.versions ?? [];
  }

  private dataCols(): UiTableColumn<PdRow>[] {
    return [
      { id: 'item_ref', label: 'Item ref', value: (row) => row.item_ref || '', cellClass: 'ref' },
      { id: 'scope_comitee_id', label: 'Scope comitee ID', value: (row) => row.scope_comitee_id || row.reference || '', cellClass: 'ref' },
      { id: 'document_type', label: 'Document type', value: (row) => row.document_type || row.type || '' },
      { id: 'task_reference', label: 'Task reference', value: (row) => row.task_reference || row.reference || '', cellClass: 'ref' },
      { id: 'revision', label: 'Revision', value: (row) => row.revision || '', cellClass: 'rev' },
      { id: 'description', label: 'Description', value: (row) => this.rowText(row) },
      { id: 'fin_position', label: 'FIN / Position', value: (row) => row.fin_position || '' },
      { id: 'pn', label: 'PNR', value: (row) => row.pn || '' },
      { id: 'sn', label: 'SNR', value: (row) => row.sn || '' },
      { id: 'source_material', label: 'Source material', value: (row) => row.source_material || '' },
      { id: 'source_hours', label: 'Source hours', value: (row) => row.source_hours || '' },
      { id: 'pd_comment', label: 'PD comment', value: (row) => row.pd_comment || '' },
    ];
  }

  readonly colChoices = computed(() => {
    const versions = this.viewVersions();
    return [
      ...this.dataCols().map((col) => ({ id: col.id, label: col.label })),
      ...versions.map((col) => ({ id: `flag:${col}`, label: col })),
    ];
  });

  readonly deltaNew = computed(() => (this.delta()?.rows ?? []).filter((row) => row['Item_Status'] === 'new_line'));
  readonly deltaDiscard = computed(() => (this.delta()?.rows ?? []).filter((row) => row['Item_Status'] === 'Discard_Line'));
  readonly deltaChange = computed(() => (this.delta()?.rows ?? []).filter((row) => row['Item_Status'] === 'Change'));

  readonly deltaViewCols = computed(() => {
    const cols: UiTableColumn<PdCompareRow>[] = this.dataCols().map((col) => {
      const id = col.id;
      const mapped: UiTableColumn<PdCompareRow> = {
        id,
        label: col.label,
        cellClass: id === 'item_ref' ? 'ref' : id === 'revision' ? 'rev' : undefined,
        value: (row) => (id === 'item_ref' ? cellOf(row, 'item_ref') : viewLikeValue(row, id)),
      };
      return mapped;
    });
    for (const ver of this.viewVersions()) {
      cols.push({
        id: `flag:${ver}`,
        label: ver,
        value: (row) => viewLikeValue(row, ver),
        headerClass: 'flag-col',
        cellClass: 'flag-col',
        badge: true,
      });
    }
    return cols.filter((col) => this.colOn(col.id));
  });

  readonly deltaChangeCols = computed<UiTableColumn<PdCompareRow>[]>(() => {
    const neu = this.selectedNew() ?? '';
    const old = this.selectedOld() ?? '';
    const labels = Object.fromEntries(this.dataCols().map((col) => [col.id, col.label]));
    const bases = new Set<string>();
    for (const row of this.deltaChange()) {
      for (const base of changedBases(row)) {
        const field = compareFieldId(base);
        if (!field || this.colOn(field)) {
          bases.add(base);
        }
      }
    }
    const order = [
      ...this.dataCols().map((col) => col.id),
      ...this.viewVersions(),
      'ChangeStatus',
    ];
    const fields = order.filter((base) => bases.has(base));
    return [
      { id: 'item_ref', label: 'Item ref', value: (row) => cellOf(row, 'item_ref'), cellClass: 'ref' },
      ...fields.map((base) => ({
        id: `chg:${base}`,
        label: base === 'ChangeStatus' ? 'Change status' : labels[base] || base,
        value: (row: PdCompareRow) => (changedBases(row).includes(base) ? changeArrow(row, base, neu, old) : ''),
        clip: false,
      })),
    ];
  });

  readonly pdCols = computed<UiTableColumn<PdRow>[]>(() => {
    const versions = this.issue()?.versions ?? [];
    const flags = versions.map((col) => ({
      id: `flag:${col}`,
      label: col,
      value: (row: PdRow) => row.flags[col] ?? '',
      headerClass: 'flag-col',
      cellClass: 'flag-col',
      badge: true,
    }));
    return [...this.dataCols(), ...flags].filter((col) => this.colOn(col.id));
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const msn = routeMsn(this.route, params);
      if (!msn) {
        void this.router.navigateByUrl('/');
        return;
      }
      this.aircraftIdSig.set(msn);
      enterAircraft(this.route, this.router, this.aircraftApi, this.workspace, () => this.reload());
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

  issueCode(item: PdIssueRef | string | null): string {
    return this.issueLabel(item).replace(/^Issue\s+/, '');
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
    const inPick = path.some((node) => node instanceof HTMLElement && (node.classList.contains('pick') || node.classList.contains('col-pick')));
    if (!inPick) {
      this.closeIssues();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeIssues();
  }

  closeIssues(): void {
    this.issueOpen.set(false);
    this.newOpen.set(false);
    this.oldOpen.set(false);
    this.colsOpen.set(false);
  }

  toggleIssues(): void {
    this.colsOpen.set(false);
    this.newOpen.set(false);
    this.oldOpen.set(false);
    this.issueOpen.update((open) => !open);
  }

  toggleNew(): void {
    this.colsOpen.set(false);
    this.issueOpen.set(false);
    this.oldOpen.set(false);
    this.newOpen.update((open) => !open);
  }

  toggleOld(): void {
    this.colsOpen.set(false);
    this.issueOpen.set(false);
    this.newOpen.set(false);
    this.oldOpen.update((open) => !open);
  }

  selectIssue(id: string): void {
    this.issueOpen.set(false);
    if (id === this.selected() && this.issue()) {
      return;
    }
    this.selected.set(id);
    this.loadIssue(id);
  }

  selectNew(id: string): void {
    this.newOpen.set(false);
    if (id === this.selectedNew()) {
      return;
    }
    this.selectedNew.set(id);
    if (id === this.selectedOld()) {
      this.selectedOld.set(this.otherIssue(id));
    }
    this.delta.set(null);
  }

  selectOld(id: string): void {
    this.oldOpen.set(false);
    if (id === this.selectedOld()) {
      return;
    }
    this.selectedOld.set(id);
    if (id === this.selectedNew()) {
      this.selectedNew.set(this.otherIssue(id));
    }
    this.delta.set(null);
  }

  generateDelta(): void {
    const neu = this.selectedNew();
    const old = this.selectedOld();
    if (!neu || !old || neu === old) {
      return;
    }
    const gen = ++this.loadGen;
    this.loading.set(true);
    this.error.set(null);
    this.skelCols.set([
      { id: 'item_ref', label: 'Item ref' },
      { id: 'Item_Status', label: 'Status' },
      { id: 'ChangeStatus__Check', label: 'Change status' },
    ]);
    this.pdApi.compare(this.aircraftId, neu, old).subscribe({
      next: (payload) => {
        if (gen !== this.loadGen) {
          return;
        }
        this.delta.set(payload);
        this.loading.set(false);
      },
      error: () => {
        if (gen !== this.loadGen) {
          return;
        }
        this.loading.set(false);
        this.error.set('Could not generate the PD delta.');
      },
    });
  }

  private otherIssue(except: string): string | null {
    const list = this.issues();
    const idx = list.findIndex((item) => item.issue === except);
    if (idx > 0) {
      return list[idx - 1].issue ?? null;
    }
    return list.find((item) => item.issue && item.issue !== except)?.issue ?? null;
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

  private sourceDetail(item?: ConsistencySource | null): string {
    if (!item?.loaded) {
      return 'Not loaded';
    }
    const version = item.version == null ? '' : String(item.version);
    const padded = /^\d+$/.test(version) ? version.padStart(2, '0') : version;
    const rows = item.rows ? `${item.rows} rows` : '';
    return [padded, item.nation, rows, item.file].filter(Boolean).join(' · ') || 'Loaded';
  }

  private loadGenSources(): void {
    this.pdApi.consistencySources(this.aircraftId).subscribe({
      next: (pack) => this.genSources.set(pack),
    });
  }

  private reload(): void {
    this.rawOpen.set(true);
    this.reportOpen.set(false);
    this.mode.set('view');
    this.genSource.set(null);
    this.genReport.set(null);
    this.genSources.set(null);
    this.genError.set(null);
    this.genConfirmed.set(false);
    this.genStep.set(1);
    this.delta.set(null);
    this.loading.set(true);
    this.error.set(null);
    this.refreshList(true);
    if (!this.ingest()) {
      this.loadGenSources();
    }
  }

  private refreshList(loadCurrent = false): void {
    this.issueCache.clear();
    this.pdApi.list(this.aircraftId).subscribe({
      next: (listed) => {
        this.issues.set(listed.issues);
        this.history.set([...(listed.history ?? listed.issues)].reverse());
        const wanted = this.route.snapshot.queryParamMap.get('issue');
        const match = listed.issues.find((item) => item.issue === wanted || item.id === wanted);
        const target = match?.issue || listed.latest;
        this.selected.set(target);
        this.selectedNew.set(target);
        this.selectedOld.set(target ? this.otherIssue(target) : null);
        if (!loadCurrent || this.ingest() || !target) {
          this.loading.set(false);
          return;
        }
        if (!this.ingest()) {
          this.loading.set(false);
          this.loadIssue(target, true);
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

  private fetchIssue(issue: string) {
    const hit = this.issueCache.get(issue);
    if (hit) {
      return of(hit);
    }
    return this.pdApi.get(this.aircraftId, issue).pipe(tap((payload) => this.issueCache.set(issue, payload)));
  }

  private loadIssue(issue: string, quiet = false): void {
    const gen = ++this.loadGen;
    if (!quiet) {
      this.loading.set(true);
      this.skelCols.set([
        { id: 'item_ref', label: 'Item ref' },
        { id: 'task_reference', label: 'Task reference' },
        { id: 'revision', label: 'Revision' },
        { id: 'description', label: 'Description' },
      ]);
    }
    forkJoin({
      payload: this.fetchIssue(issue),
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
