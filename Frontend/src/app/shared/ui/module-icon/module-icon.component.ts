import { Component, input } from '@angular/core';

@Component({
  selector: 'app-module-icon',
  standalone: true,
  templateUrl: './module-icon.component.html',
  styleUrl: './module-icon.component.scss',
})
export class ModuleIconComponent {
  readonly name = input.required<string>();
}
