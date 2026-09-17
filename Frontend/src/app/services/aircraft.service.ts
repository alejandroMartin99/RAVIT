import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Aircraft, AircraftCreate, AircraftPatch } from '../domain/fleet/aircraft.model';

@Injectable({ providedIn: 'root' })
export class AircraftService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/aircraft/`;

  list(): Observable<Aircraft[]> {
    return this.http.get<Aircraft[]>(this.url);
  }

  get(id: string): Observable<Aircraft> {
    return this.http.get<Aircraft>(`${this.url}${id}`);
  }

  patch(id: string, payload: AircraftPatch): Observable<Aircraft> {
    return this.http.patch<Aircraft>(`${this.url}${id}`, payload);
  }

  create(payload: AircraftCreate): Observable<Aircraft> {
    return this.http.post<Aircraft>(this.url, payload);
  }
}
