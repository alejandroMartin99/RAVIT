import { Directive, TemplateRef, inject } from '@angular/core';

@Directive({
  selector: 'ng-template[uiTableExpand]',
  standalone: true,
})
export class UiTableExpandDirective<T = unknown> {
  readonly tpl = inject(TemplateRef<{ $implicit: T }>);
}
