import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { padMsn } from '../domain/fleet/fleet.catalog';
import { PROGRAM_LABEL, SIDE_NAV, SideNavChild, SideNavItem } from '../domain/nav/nav.catalog';
import { WorkspaceService } from '../services/workspace.service';
import { ModuleIconComponent } from '../shared/ui/module-icon/module-icon.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ModuleIconComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  private readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);

  readonly program = PROGRAM_LABEL;
  readonly sideNav = SIDE_NAV;
  readonly sidebarOpen = signal(false);
  readonly aircraft = this.workspace.aircraft;
  private readonly toggled = signal<Record<string, boolean>>({});

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly msnTitle = computed(() => {
    const aircraft = this.aircraft();
    return aircraft ? `MSN ${padMsn(aircraft.msn)}` : null;
  });

  readonly crumbs = computed(() => {
    const parts = ['Dashboard'];
    const aircraft = this.aircraft();
    if (!aircraft) {
      return parts;
    }
    parts.push(`MSN ${padMsn(aircraft.msn)}`);
    const segments = (this.url() ?? '').split('?')[0].split('/').filter(Boolean);
    const moduleSlug = segments[2];
    const childSlug = segments[3];
    const item = SIDE_NAV.find((entry) => entry.slug === moduleSlug);
    if (!item) {
      return parts;
    }
    parts.push(item.code);
    const child = item.children?.find((entry) => entry.slug === childSlug);
    if (child) {
      parts.push(child.label);
    }
    return parts;
  });

  pathFor(item: SideNavItem): string {
    if (!item.slug) {
      return '/';
    }
    const aircraft = this.aircraft();
    return aircraft ? `/aircraft/${aircraft.id}/${item.slug}` : '/';
  }

  childPath(item: SideNavItem, child: SideNavChild): string {
    const aircraft = this.aircraft();
    return aircraft ? `/aircraft/${aircraft.id}/${item.slug}/${child.slug}` : '/';
  }

  canOpen(item: SideNavItem): boolean {
    return !item.requiresAircraft || !!this.aircraft();
  }

  isGroup(item: SideNavItem): boolean {
    return item.children !== undefined;
  }

  isExpanded(item: SideNavItem): boolean {
    const manual = this.toggled()[item.id];
    if (manual !== undefined) {
      return manual;
    }
    const url = this.url() ?? '';
    return !!item.slug && url.includes(`/${item.slug}`);
  }

  toggleGroup(item: SideNavItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.canOpen(item)) {
      return;
    }
    const next = !this.isExpanded(item);
    this.toggled.update((state) => ({ ...state, [item.id]: next }));
  }

  toggleSidebar(event: Event): void {
    event.stopPropagation();
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
