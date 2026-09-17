import { Injectable, signal } from '@angular/core';

export type ToastKind = 'ok' | 'fail';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  leaving: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly items = signal<Toast[]>([]);
  private seq = 0;

  ok(message: string): void {
    this.push('ok', message);
  }

  fail(message: string): void {
    this.push('fail', message);
  }

  private push(kind: ToastKind, message: string): void {
    const id = ++this.seq;
    this.items.update((list) => [...list, { id, kind, message, leaving: false }]);
    window.setTimeout(() => this.beginLeave(id), 2000);
  }

  private beginLeave(id: number): void {
    this.items.update((list) => list.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
    window.setTimeout(() => {
      this.items.update((list) => list.filter((item) => item.id !== id));
    }, 320);
  }
}
