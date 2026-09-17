import { Component, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SIDE_NAV } from '../../domain/nav/nav.catalog';
import { AircraftService } from '../../services/aircraft.service';
import { WorkspaceService } from '../../services/workspace.service';
import { ModuleIconComponent } from '../../shared/ui/module-icon/module-icon.component';

@Component({
  selector: 'app-module',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ModuleIconComponent],
  templateUrl: './module.page.html',
  styleUrl: './module.page.scss',
})
export class ModulePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly aircraftApi = inject(AircraftService);
  private readonly workspace = inject(WorkspaceService);

  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  readonly aircraftId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly code = computed(() => (this.data()['code'] as string) ?? '');
  readonly label = computed(() => (this.data()['label'] as string) ?? '');
  readonly icon = computed(() => (this.data()['icon'] as string) ?? '');
  readonly slug = computed(() => (this.data()['slug'] as string) ?? '');
  readonly childLabel = computed(() => (this.data()['childLabel'] as string) ?? null);
  readonly children = computed(
    () => SIDE_NAV.find((item) => item.slug === this.slug())?.children ?? [],
  );

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigateByUrl('/');
      return;
    }
    this.aircraftApi.get(id).subscribe({
      next: (item) => this.workspace.enter(item),
      error: () => {
        this.workspace.leave();
        void this.router.navigateByUrl('/');
      },
    });
  }
}
