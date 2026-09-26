import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ToastService } from './toast.service';

export type PdFlag = 'Y' | 'OUT' | 'UNDER REVIEW';

export interface PdRow {
  item_ref?: string;
  scope_comitee_id?: string;
  document_type?: string;
  task_reference?: string;
  revision?: string;
  description?: string;
  title?: string;
  pn?: string;
  sn?: string;
  fin_position?: string;
  source_material?: string;
  source_hours?: string;
  pd_comment?: string;
  reference?: string;
  ata?: string;
  type?: string;
  flags: Record<string, PdFlag>;
}

export interface PdIssue {
  issue: string;
  number: number;
  versions: string[];
  rows: PdRow[];
}

export interface PdIssueRef {
  id: string;
  issue?: string | null;
  number?: number | null;
  uploaded_at: string;
  uploaded_by: string;
  source_file?: string | null;
  rows: number;
  current: boolean;
  status?: 'ok' | 'fail';
  message?: string | null;
  fail_rows?: PdFailRow[];
}

export interface PdList {
  issues: PdIssueRef[];
  history?: PdIssueRef[];
  latest: string | null;
}

export type PdCheckStatus = 'pending' | 'running' | 'ok' | 'fail';

export type PdFailRow = Record<string, string | number | undefined> & { line?: number };

export interface PdIngestEvent {
  kind: 'plan' | 'step' | 'done' | 'error' | 'replace';
  id?: string;
  label?: string;
  status?: PdCheckStatus;
  detail?: string;
  percent: number;
  message?: string;
  version?: string;
  issue?: PdIssue;
  rows?: PdFailRow[];
  checks?: { id: string; label: string }[];
}

@Injectable({ providedIn: 'root' })
export class PdService {
  private readonly http = inject(HttpClient);
  private readonly zone = inject(NgZone);
  private readonly toast = inject(ToastService);

  private url(aircraftId: string): string {
    return `${environment.apiUrl}/api/aircraft/${aircraftId}/pd/`;
  }

  list(aircraftId: string): Observable<PdList> {
    return this.http.get<PdList>(this.url(aircraftId));
  }

  get(aircraftId: string, issue: string): Observable<PdIssue> {
    return this.http.get<PdIssue>(`${this.url(aircraftId)}${issue}`);
  }

  create(aircraftId: string): Observable<PdIssue> {
    return this.http.post<PdIssue>(this.url(aircraftId), {});
  }

  deleteHistory(aircraftId: string, attemptId: string) {
    return this.http.delete<{ ok: boolean; id: string }>(`${this.url(aircraftId)}history/${attemptId}`).pipe(
      tap({
        next: () => this.toast.ok('Upload removed from history'),
        error: () => this.toast.fail('Could not remove this upload'),
      }),
    );
  }

  downloadHistory(aircraftId: string, attemptId: string, filename?: string | null) {
    return this.http.get(`${this.url(aircraftId)}history/${attemptId}/file`, { responseType: 'blob' }).pipe(
      tap({
        next: (blob) => {
          const href = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = href;
          link.download = filename || 'upload.xlsx';
          link.click();
          URL.revokeObjectURL(href);
          this.toast.ok('File downloaded');
        },
        error: () => this.toast.fail('Could not download this file'),
      }),
    );
  }

  commitReplace(aircraftId: string, version: string) {
    return this.http.post<PdIssue>(`${this.url(aircraftId)}ingest/commit`, null, { params: { version } }).pipe(
      tap({
        next: () => this.toast.ok('Program Directive replaced'),
        error: () => this.toast.fail('Could not replace this Program Directive'),
      }),
    );
  }

  discardReplace(aircraftId: string, version: string) {
    return this.http.delete<{ ok: boolean }>(`${this.url(aircraftId)}ingest/pending`, { params: { version } });
  }

  ingest(aircraftId: string, file: File): Observable<PdIngestEvent> {
    return new Observable((subscriber) => {
      let active = true;
      const body = new FormData();
      body.append('file', file);

      fetch(`${this.url(aircraftId)}ingest`, {
        method: 'POST',
        body,
      })
        .then(async (response) => {
          if (!response.ok || !response.body) {
            throw new Error('Could not start PD validation');
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            buffer += decoder.decode(value, { stream: true });
            buffer = this.emitSse(buffer, (event) => {
              this.zone.run(() => {
                if (event.kind === 'done') {
                  this.toast.ok('Program Directive uploaded');
                }
                if (event.kind === 'error') {
                  this.toast.fail(event.message ?? 'Program Directive upload failed');
                }
                if (active) {
                  subscriber.next(event);
                }
              });
            });
          }
          this.zone.run(() => {
            if (active) {
              subscriber.complete();
            }
          });
        })
        .catch((err: unknown) => {
          this.zone.run(() => {
            this.toast.fail('Could not validate the Program Directive.');
            if (active) {
              subscriber.error(err);
            }
          });
        });

      return () => {
        active = false;
      };
    });
  }

  private emitSse(buffer: string, emit: (event: PdIngestEvent) => void): string {
    let rest = buffer;
    let split = rest.indexOf('\n\n');
    while (split >= 0) {
      const block = rest.slice(0, split);
      rest = rest.slice(split + 2);
      for (const line of block.split('\n')) {
        if (line.startsWith('data: ')) {
          emit(JSON.parse(line.slice(6)) as PdIngestEvent);
        }
      }
      split = rest.indexOf('\n\n');
    }
    return rest;
  }
}
