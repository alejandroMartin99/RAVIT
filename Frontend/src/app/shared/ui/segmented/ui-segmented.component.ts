import { Component, input, model } from '@angular/core';
import { FlagIconComponent } from '../flag-icon/flag-icon.component';
import { UiIconComponent, UiIconName } from '../icon/ui-icon.component';
import { NationCode } from '../../../domain/fleet/aircraft.model';

export interface SegmentOption {
  value: string;
  label: string;
  nation?: NationCode;
  icon?: UiIconName;
}

@Component({
  selector: 'app-ui-segmented',
  standalone: true,
  imports: [FlagIconComponent, UiIconComponent],
  templateUrl: './ui-segmented.component.html',
  styleUrl: './ui-segmented.component.scss',
})
export class UiSegmentedComponent {
  readonly options = input.required<SegmentOption[]>();
  readonly value = model.required<string>();

  choose(next: string): void {
    this.value.set(next);
  }
}
