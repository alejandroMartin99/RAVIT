import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Aircraft } from '../../domain/fleet/aircraft.model';
import { AIRCRAFT_MODULES } from '../../domain/nav/nav.catalog';
import { AircraftService } from '../../services/aircraft.service';
import { WorkspaceService } from '../../services/workspace.service';
import { ModuleIconComponent } from '../../shared/ui/module-icon/module-icon.component';

@Component({
  selector: 'app-aircraft',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ModuleIconComponent],
  templateUrl: './aircraft.page.html',
  styleUrl: './aircraft.page.scss',
})
export class AircraftPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly aircraftApi = inject(AircraftService);
  private readonly workspace = inject(WorkspaceService);

  readonly modules = AIRCRAFT_MODULES;
  readonly aircraft = signal<Aircraft | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigateByUrl('/');
      return;
    }
    this.aircraftApi.get(id).subscribe({
      next: (item) => {
        this.aircraft.set(item);
        this.workspace.enter(item);
      },
      error: () => {
        this.error.set('Aircraft not found.');
        this.workspace.leave();
      },
    });
  }
}
