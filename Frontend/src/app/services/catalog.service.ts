import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { FleetCatalog } from '../domain/fleet/aircraft.model';
import { FALLBACK_CATALOG } from '../domain/fleet/fleet.catalog';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/catalog/`;

  readonly catalog = signal<FleetCatalog>(FALLBACK_CATALOG);

  load(): void {
    this.http.get<FleetCatalog>(this.url).pipe(catchError(() => of(FALLBACK_CATALOG))).subscribe((data) => {
      this.catalog.set(data);
    });
  }
}
