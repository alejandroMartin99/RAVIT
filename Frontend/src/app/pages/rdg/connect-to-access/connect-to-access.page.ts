import { DatePipe } from '@angular/common';
import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AccessService, AccessTable } from '../../../services/access.service';
import { AircraftService } from '../../../services/aircraft.service';
import { WorkspaceService } from '../../../services/workspace.service';
import { ModuleIconComponent } from '../../../shared/ui/module-icon/module-icon.component';
import { UiButtonComponent, UiEmptyComponent, UiHelpComponent } from '../../../shared/ui';
import { enterAircraft, routeMsn } from '../../_shared/aircraft-context';

@Component({
  selector: 'app-connect-to-access',
  standalone: true,
  imports: [ModuleIconComponent, UiButtonComponent, UiEmptyComponent, UiHelpComponent],
  providers: [DatePipe],
  templateUrl: './connect-to-access.page.html',
  styleUrl: '../../_shared/source-page.scss',
})
export class ConnectToAccessPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly aircraftApi = inject(AircraftService);
  private readonly workspace = inject(WorkspaceService);
  private readonly accessApi = inject(AccessService);
  private readonly dates = inject(DatePipe);
  private readonly picker = viewChild<ElementRef<HTMLInputElement>>('picker');

  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  readonly aircraftId = routeMsn(this.route);

  readonly code = computed(() => (this.data()['code'] as string) ?? '');
  readonly icon = 'access';
  readonly title = computed(() => (this.data()['childLabel'] as string) ?? 'Connect to Access');

  readonly tables = signal<AccessTable[]>([]);
  readonly scan = signal<AccessTable[] | null>(null);
  readonly fileName = signal<string | null>(null);
  readonly selected = signal<Set<string>>(new Set());
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  private pending: File | null = null;

  readonly stored = computed(() => this.tables().filter((item) => item.current));
  readonly canAccept = computed(() => {
    const scan = this.scan();
    if (!scan || this.busy()) {
      return false;
    }
    const picked = this.selected();
    return scan.some((item) => item.in_file && picked.has(item.id));
  });

  ngOnInit(): void {
    enterAircraft(this.route, this.router, this.aircraftApi, this.workspace, () => this.reload());
  }

  openPicker(): void {
    this.picker()?.nativeElement.click();
  }

  onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.error.set(null);
    this.busy.set(true);
    this.pending = file;
    this.fileName.set(file.name);
    this.accessApi.scan(this.aircraftId, file).subscribe({
      next: (pack) => {
        this.scan.set(pack.tables);
        this.selected.set(
          new Set(pack.tables.filter((item) => item.in_file && !this.occupied(item)).map((item) => item.id)),
        );
        this.busy.set(false);
      },
      error: (err) => {
        this.pending = null;
        this.scan.set(null);
        this.busy.set(false);
        this.error.set(this.failMsg(err, 'Could not read this Access database.'));
      },
    });
  }

  toggle(id: string, inFile: boolean | undefined): void {
    if (!inFile) {
      return;
    }
    const next = new Set(this.selected());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selected.set(next);
  }

  occupied(item: AccessTable): boolean {
    return !!item.current && item.rows > 0;
  }

  found(items: AccessTable[]): AccessTable[] {
    return items.filter((item) => item.in_file);
  }

  note(item: AccessTable): string {
    if (!item.in_file) {
      return 'Not in this file';
    }
    if (this.occupied(item)) {
      return `Overwrite ${item.rows} stored rows?`;
    }
    return item.current ? 'Stored copy is empty' : 'New for this aircraft';
  }

  storedNote(item: AccessTable): string {
    const when = item.updated_at ? this.dates.transform(item.updated_at, 'd MMM y, HH:mm') : null;
    return [item.rows ? `${item.rows} rows` : 'Empty', item.source_file, when].filter(Boolean).join(' · ');
  }

  discard(): void {
    this.pending = null;
    this.scan.set(null);
    this.fileName.set(null);
    this.selected.set(new Set());
    const picker = this.picker()?.nativeElement;
    if (picker) {
      picker.value = '';
    }
  }

  accept(): void {
    const file = this.pending;
    const ids = [...this.selected()].filter((id) => this.scan()?.find((item) => item.id === id)?.in_file);
    if (!file || !ids.length) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.accessApi.commit(this.aircraftId, file, ids).subscribe({
      next: (pack) => {
        this.tables.set(pack.tables);
        this.busy.set(false);
        this.discard();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(this.failMsg(err, 'Could not ingest this Access file.'));
      },
    });
  }

  private reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.discard();
    this.accessApi.list(this.aircraftId).subscribe({
      next: (pack) => {
        this.tables.set(pack.tables);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.failMsg(err, 'Could not load stored Access tables.'));
      },
    });
  }

  private failMsg(err: { error?: { detail?: string } }, fallback: string): string {
    const detail = err.error?.detail;
    return typeof detail === 'string' ? detail : fallback;
  }
}
