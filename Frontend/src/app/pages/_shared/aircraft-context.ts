import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { AircraftService } from '../../services/aircraft.service';
import { WorkspaceService } from '../../services/workspace.service';

/** MSN slug from the URL (`/aircraft/014/...`). */
export function routeMsn(route: ActivatedRoute, params?: ParamMap): string {
  return (params ?? route.snapshot.paramMap).get('msn') ?? '';
}

/** Load the aircraft from the URL and put it in the workspace. */
export function enterAircraft(
  route: ActivatedRoute,
  router: Router,
  api: AircraftService,
  workspace: WorkspaceService,
  onReady?: (msn: string) => void,
): void {
  const msn = routeMsn(route);
  if (!msn) {
    void router.navigateByUrl('/');
    return;
  }
  api.get(msn).subscribe({
    next: (item) => {
      workspace.enter(item);
      onReady?.(msn);
    },
    error: () => {
      workspace.leave();
      void router.navigateByUrl('/');
    },
  });
}
