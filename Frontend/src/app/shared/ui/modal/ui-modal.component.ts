import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-ui-modal',
  standalone: true,
  templateUrl: './ui-modal.component.html',
  styleUrl: './ui-modal.component.scss',
})
export class UiModalComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly wide = input(false);
  readonly closed = output<void>();
}
