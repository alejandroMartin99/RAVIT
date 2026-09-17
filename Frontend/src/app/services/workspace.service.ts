import { Injectable, signal } from '@angular/core';
import { Aircraft } from '../domain/fleet/aircraft.model';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  readonly aircraft = signal<Aircraft | null>(null);

  enter(aircraft: Aircraft): void {
    this.aircraft.set(aircraft);
  }

  leave(): void {
    this.aircraft.set(null);
  }
}
