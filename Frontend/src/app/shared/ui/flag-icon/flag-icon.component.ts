import { Component, input } from '@angular/core';
import { NationCode } from '../../../domain/fleet/aircraft.model';

@Component({
  selector: 'app-flag-icon',
  standalone: true,
  templateUrl: './flag-icon.component.html',
  styleUrl: './flag-icon.component.scss',
})
export class FlagIconComponent {
  readonly nation = input.required<NationCode>();
}
