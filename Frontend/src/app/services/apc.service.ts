import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { PdIngestEvent } from './pd.service';
import { ToastService } from './toast.service';

export interface ApcRow {
  position_code: string;
  pnr: string;
  snr: string;
}

export interface ApcCurrent {
  rows: ApcRow[];
  source_file?: string | null;
  uploaded_at: string;
  uploaded_by: string;
  nation?: string | null;
  version?: number | null;
  source_id?: string | null;
}

export interface ApcUpload {
  id: string;
  uploaded_at: string;
  uploaded_by: string;
  source_file?: string | null;
  rows: number;
  current: boolean;
  status?: 'ok' | 'fail';
  message?: string | null;
  nation?: string | null;
  version?: number | null;
}

export interface ApcList {
  history: ApcUpload[];
  latest: string | null;
  current: ApcCurrent | null;
  nation?: string | null;
}

export type ApcIngestEvent = PdIngestEvent & { current?: ApcCurrent };

@Injectable({ providedIn: 'root' })
export class ApcService {
  private readonly http = inject(HttpClient);
  private readonly zone = inject(NgZone);
  private readonly toast = inject(ToastService);

  private url(aircraftId: string): string {
    return `${environment.apiUrl}/api/aircraft/${aircraftId}/apc/`;
  }

  list(aircraftId: string): Observable<ApcList> {
    return this.http.get<ApcList>(this.url(aircraftId));
  }

  select(aircraftId: string, attemptId: string) {
    return this.http.post<ApcCurrent>(`${this.url(aircraftId)}select/${attemptId}`, {}).pipe(
      tap({
        next: () => this.toast.ok('APC assigned to this aircraft'),
        error: () => this.toast.fail('Could not assign this APC'),
      }),
    );
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

  ingest(aircraftId: string, file: File): Observable<ApcIngestEvent> {
    return new Observable((subscriber) => {
      let active = true;
      const body = new FormData();
      body.append('file', file);
      fetch(`${this.url(aircraftId)}ingest`, { method: 'POST', body })
        .then(async (response) => {
          if (!response.ok || !response.body) {
            throw new Error('Could not start APC validation');
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
                  this.toast.ok('APC uploaded');
                }
                if (event.kind === 'error') {
                  this.toast.fail(event.message ?? 'APC upload failed');
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
            this.toast.fail('Could not validate APC.');
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

  private emitSse(buffer: string, emit: (event: ApcIngestEvent) => void): string {
    let rest = buffer;
    let split = rest.indexOf('\n\n');
    while (split >= 0) {
      const block = rest.slice(0, split);
      rest = rest.slice(split + 2);
      for (const line of block.split('\n')) {
        if (line.startsWith('data: ')) {
          emit(JSON.parse(line.slice(6)) as ApcIngestEvent);
        }
      }
      split = rest.indexOf('\n\n');
    }
    return rest;
  }
}
