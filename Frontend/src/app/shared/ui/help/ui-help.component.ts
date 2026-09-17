import { Component, computed, input, signal } from '@angular/core';
import { helpGuide } from '../../../domain/help/help.catalog';
import { UiModalComponent } from '../modal/ui-modal.component';

@Component({
  selector: 'app-ui-help',
  standalone: true,
  imports: [UiModalComponent],
  templateUrl: './ui-help.component.html',
  styleUrl: './ui-help.component.scss',
})
export class UiHelpComponent {
  readonly topic = input.required<string>();
  readonly open = signal(false);
  readonly guide = computed(() => helpGuide(this.topic()));

  toggle(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.open.update((value) => !value);
  }

  close(): void {
    this.open.set(false);
  }
}
