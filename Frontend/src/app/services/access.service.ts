import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ToastService } from './toast.service';

export interface AccessTable {
  id: string;
  label: string;
  current: boolean;
  rows: number;
  updated_at?: string | null;
  source_file?: string | null;
  in_file?: boolean;
  file_name?: string | null;
}

export interface AccessScan {
  file: string;
  tables: AccessTable[];
}

export interface AccessCommit extends AccessScan {
  ok: boolean;
  saved: { id: string; label: string; rows: number; replaced: boolean }[];
}

@Injectable({ providedIn: 'root' })
export class AccessService {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);

  private url(aircraftId: string): string {
    return `${environment.apiUrl}/api/aircraft/${aircraftId}/access/`;
  }

  list(aircraftId: string): Observable<{ tables: AccessTable[] }> {
    return this.http.get<{ tables: AccessTable[] }>(this.url(aircraftId));
  }

  scan(aircraftId: string, file: File): Observable<AccessScan> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<AccessScan>(`${this.url(aircraftId)}scan`, body);
  }

  commit(aircraftId: string, file: File, tables: string[]): Observable<AccessCommit> {
    const body = new FormData();
    body.append('file', file);
    body.append('tables', JSON.stringify(tables));
    return this.http.post<AccessCommit>(`${this.url(aircraftId)}commit`, body).pipe(
      tap({
        next: () => this.toast.ok('Access tables updated'),
        error: () => this.toast.fail('Could not ingest this Access file'),
      }),
    );
  }
}
