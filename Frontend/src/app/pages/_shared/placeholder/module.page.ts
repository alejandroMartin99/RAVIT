import { Component, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SIDE_NAV } from '../../../domain/nav/nav.catalog';
import { AircraftService } from '../../../services/aircraft.service';
import { WorkspaceService } from '../../../services/workspace.service';
import { ModuleIconComponent } from '../../../shared/ui/module-icon/module-icon.component';
import { UiHelpComponent } from '../../../shared/ui/help/ui-help.component';
import { enterAircraft, routeMsn } from '../aircraft-context';

@Component({
  selector: 'app-module',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ModuleIconComponent, UiHelpComponent],
  templateUrl: './module.page.html',
  styleUrl: './module.page.scss',
})
export class ModulePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly aircraftApi = inject(AircraftService);
  private readonly workspace = inject(WorkspaceService);

  private readonly data = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  readonly aircraftId = routeMsn(this.route);

  readonly code = computed(() => (this.data()['code'] as string) ?? '');
  readonly label = computed(() => (this.data()['label'] as string) ?? '');
  readonly icon = computed(() => (this.data()['icon'] as string) ?? '');
  readonly slug = computed(() => (this.data()['slug'] as string) ?? '');
  readonly childLabel = computed(() => (this.data()['childLabel'] as string) ?? null);
  readonly childSlug = computed(() => (this.data()['childSlug'] as string) ?? null);
  readonly grandLabel = computed(() => (this.data()['grandLabel'] as string) ?? null);
  readonly helpTopic = computed(
    () => (this.data()['grandSlug'] as string) || (this.data()['childSlug'] as string) || (this.data()['slug'] as string) || 'module',
  );
  readonly children = computed(
    () => SIDE_NAV.find((item) => item.slug === this.slug())?.children ?? [],
  );
  readonly nested = computed(() => {
    const childSlug = this.childSlug();
    if (!childSlug) {
      return [];
    }
    return this.children().find((item) => item.slug === childSlug)?.children ?? [];
  });

  ngOnInit(): void {
    enterAircraft(this.route, this.router, this.aircraftApi, this.workspace);
  }
}
