import { Directive, TemplateRef, inject, input } from '@angular/core';
import { UiTableColumn } from './ui-table.column';

export interface UiTableCellContext<T = unknown> {
  $implicit: T;
  column: UiTableColumn<T>;
}

@Directive({
  selector: 'ng-template[uiTableCell]',
  standalone: true,
})
export class UiTableCellDirective<T = unknown> {
  readonly name = input.required<string>({ alias: 'uiTableCell' });
  readonly tpl = inject(TemplateRef<UiTableCellContext<T>>);
}
