import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RecipeListRefreshService {
  private readonly subject = new Subject<void>();

  /** Emits when the recipe list should be re-fetched (e.g. after save from the dialog). */
  readonly refresh$ = this.subject.asObservable();

  notify(): void {
    this.subject.next();
  }
}
